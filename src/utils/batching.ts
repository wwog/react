/**
 * @en Batching: collapse work that fires too often into fewer, appropriately
 * sized tasks — so the rendering pipeline's fixed cost is paid once per batch
 * instead of once per item.
 *
 * Splitting deals with tasks so long that rendering can't squeeze in; batching
 * deals with tasks so *frequent* that the pipeline's fixed cost is paid over
 * and over. Events are the best targets: scroll, resize and input can fire
 * dozens or hundreds of times in a short span.
 *
 * Two collapse strategies exist: "run once after things quiet down" (debounce)
 * and "run at most once per interval" (throttle). For visual updates, the
 * screen only gets drawn once per frame anyway, so coalescing into one draw
 * per rAF (rafSchedule) loses no data while dropping the cost.
 *
 * DOM writes batch the same way: appending a hundred nodes via one
 * DocumentFragment instead of one at a time turns many layout/paint
 * invalidations into one. And when reads (offsetWidth, getBoundingClientRect)
 * are interleaved with writes, the browser is forced to recompute layout on
 * the spot each iteration — layout thrashing. Grouping all reads before all
 * writes avoids it.
 *
 * @zh 批量（Batching）：把触发过于频繁的工作合并为大小合适的任务——让渲染管线的
 * 固定成本每批只付一次，而不是每条付一次。
 *
 * 拆分处理的是“长到渲染插不进”的任务；批量处理的是“频繁到固定成本反复支付”的任务。
 * 最佳目标是事件：scroll、resize、input 在短时间内可能触发几十上百次。
 *
 * 合并策略有两种：“等安静下来再跑一次”（debounce）和“每个区间最多跑一次”（throttle）。
 * 对视觉更新而言，屏幕每帧本来就只画一次，把更新合并为每帧一次（rafSchedule）不丢数据，
 * 又省下成本。
 *
 * DOM 写入同理：用 DocumentFragment 一次挂载一百个节点，把多次布局/绘制失效合并为一次。
 * 而当读（offsetWidth、getBoundingClientRect）与写交错时，浏览器被迫当场重算布局——
 * 即 layout thrashing（布局抖动）。先收集所有读、再统一写即可避免。
 */

/**
 * @en Debounced function type: same parameters as the original, returns
 * `undefined` (execution is postponed).
 * @zh debounce 后的函数类型：参数与原函数相同，返回 `undefined`（执行被推迟）。
 */
export interface DebouncedFunction<F extends (...args: any[]) => any> {
  (...args: Parameters<F>): void
  /**
   * @en Discard any pending invocation. The debounced function will not run.
   * @zh 丢弃未执行的调用，debounce 后的函数将不再运行。
   */
  cancel(): void
  /**
   * @en If a call is pending, run it immediately.
   * @zh 若有等待中的调用，立即执行。
   */
  flush(): void
}

/**
 * @en Return a debounced version of `fn` that postpones execution until
 * `wait` ms have elapsed since the last call.
 *
 * Solves: a heavy handler that runs on every keystroke — e.g. rebuilding a
 * ~2,000-line markdown preview per character — makes typing fall behind.
 * Debounced, the render happens just once, after typing stops.
 *
 * Each call during the wait window resets the timer; only the last call's
 * arguments survive. This is "run once after things quiet down".
 *
 * @param fn The function to debounce.
 * @param wait Milliseconds of quiet required before `fn` runs. Default `200`.
 * @returns The debounced function, with `cancel()` and `flush()`.
 *
 * @example
 * ```ts
 * // Rebuild the preview once, after the user stops typing
 * const renderPreview = debounce(() => renderMarkdown(editor.value), 300)
 * editor.addEventListener('input', renderPreview)
 * ```
 */
export function debounce<F extends (...args: any[]) => any>(
  fn: F,
  wait = 200,
): DebouncedFunction<F> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: Parameters<F> | undefined

  const debounced = (...args: Parameters<F>) => {
    pendingArgs = args
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = undefined
      const argsToCall = pendingArgs
      pendingArgs = undefined
      if (argsToCall) fn(...argsToCall)
    }, wait)
  }

  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    pendingArgs = undefined
  }

  debounced.flush = () => {
    if (timer === undefined || pendingArgs === undefined) return
    clearTimeout(timer)
    timer = undefined
    const argsToCall = pendingArgs
    pendingArgs = undefined
    fn(...argsToCall)
  }

  return debounced
}

/**
 * @en Throttled function type: same parameters as the original, returns
 * `undefined`.
 * @zh throttle 后的函数类型：参数与原函数相同，返回 `undefined`。
 */
export interface ThrottledFunction<F extends (...args: any[]) => any> {
  (...args: Parameters<F>): void
  /**
   * @en Stop future executions immediately.
   * @zh 立即停止后续执行。
   */
  cancel(): void
}

/**
 * @en Return a throttled version of `fn` that runs at most once per `wait` ms.
 *
 * Solves: scroll / resize / pointermove handlers that fire dozens of times a
 * second and leave nothing of the main thread. Unlike debounce (which waits
 * for quiet), throttle guarantees steady cadence — the first call runs
 * immediately and following calls are dropped until the interval passes.
 *
 * Only the last call's arguments within an interval are kept (leading edge
 * fires immediately, trailing edge fires after the interval if calls occurred).
 *
 * @param fn The function to throttle.
 * @param wait Minimum interval between executions, in ms. Default `200`.
 * @returns The throttled function, with `cancel()`.
 *
 * @example
 * ```ts
 * // At most one highlight computation per 100ms, however fast the user scrolls
 * const onScroll = throttle(() => updateReadingPosition(), 100)
 * window.addEventListener('scroll', onScroll, {passive: true})
 * ```
 */
export function throttle<F extends (...args: any[]) => any>(
  fn: F,
  wait = 200,
): ThrottledFunction<F> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastInvoke = Number.NEGATIVE_INFINITY
  let pendingArgs: Parameters<F> | undefined

  const invoke = (args: Parameters<F>) => {
    lastInvoke = performance.now()
    fn(...args)
  }

  const throttled = (...args: Parameters<F>) => {
    const elapsed = performance.now() - lastInvoke
    if (elapsed >= wait) {
      // Leading edge: run now
      invoke(args)
      return
    }
    // Schedule the trailing edge with the latest arguments
    pendingArgs = args
    if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        const argsToCall = pendingArgs
        pendingArgs = undefined
        if (argsToCall) invoke(argsToCall)
      }, wait - elapsed)
    }
  }

  throttled.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    pendingArgs = undefined
  }

  return throttled
}

/**
 * @en A frame-scheduled function: same parameters as the original, executed at
 * most once per animation frame.
 * @zh 按帧调度的函数类型：参数与原函数相同，每帧最多执行一次。
 */
export interface RafScheduledFunction<F extends (...args: any[]) => any> {
  (...args: Parameters<F>): void
  /**
   * @en Drop the pending call and cancel the booked animation frame, so the
   * wrapped function does not run for that frame.
   * @zh 丢弃待执行调用并取消已预约的动画帧，该帧不会再执行被包装的函数。
   */
  cancel(): void
}

/**
 * @en Return a version of `fn` that is scheduled at most once per animation
 * frame; later calls overwrite the arguments of the still-pending one.
 *
 * Solves: pushing 1,000+ messages per second into a 60-ticker board, where
 * redrawing on every message ("render every tick") drops fps to single digits.
 * The screen is drawn once per frame anyway, so coalescing all updates that
 * arrived during a frame into one call loses nothing — every arriving data
 * point is still reflected, but the fixed render cost is paid once per frame.
 *
 * Callers typically stash the latest value themselves and let `fn` read it,
 * or rely on the last-call-wins argument forwarding.
 *
 * There is deliberately no `flush()`: `requestAnimationFrame` cannot be forced
 * synchronously, so a synchronous flush would break the once-per-frame
 * guarantee it exists to provide.
 *
 * @param fn The function to coalesce; called at most once per frame, with the
 * most recent call's arguments.
 * @returns The scheduled function, with `cancel()` to drop a pending call.
 *
 * @example
 * ```ts
 * // 1,000 ticks/sec, one board render per frame — every point still lands
 * const renderBoard = rafSchedule(() => board.draw())
 * socket.on('tick', (tick) => {
 *   board.push(tick) // keep every data point — nothing is thrown away
 *   renderBoard() // this frame's draw is already booked
 * })
 * ```
 */
export function rafSchedule<F extends (...args: any[]) => any>(fn: F): RafScheduledFunction<F> {
  let rafId: number | undefined
  let pendingArgs: Parameters<F> | undefined

  const scheduledFn = (...args: Parameters<F>) => {
    pendingArgs = args
    if (rafId !== undefined) return // this frame's draw is already booked
    rafId = requestAnimationFrame(() => {
      rafId = undefined
      const argsToCall = pendingArgs
      pendingArgs = undefined
      if (argsToCall) fn(...argsToCall)
    })
  }

  scheduledFn.cancel = () => {
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId)
      rafId = undefined
    }
    pendingArgs = undefined
  }

  return scheduledFn
}

/**
 * @en Append many children to a parent in one operation, via DocumentFragment.
 *
 * Solves: appending nodes one at a time interleaves layout invalidations with
 * style recalculation for every node; a burst of hundreds (chat backlog,
 * table rows) multiplies the pipeline's fixed cost. Collecting the nodes in
 * an inert fragment first and attaching it once turns many insertions into
 * one — the same essence as assembling an HTML string and assigning
 * innerHTML in one shot, without the sanitization concerns.
 *
 * @param parent The element to append to.
 * @param children Nodes (or markup strings) to append, in order.
 * @returns The parent element, for chaining.
 *
 * @example
 * ```ts
 * // One reflow for a hundred rows instead of a hundred reflows
 * appendBatch(tbody, rows.map((row) => renderRow(row)))
 * ```
 */
export function appendBatch(parent: Element, children: (Node | string)[]): Element {
  const fragment = document.createDocumentFragment()
  for (const child of children) {
    if (typeof child === 'string') {
      fragment.append(child)
    } else {
      fragment.appendChild(child)
    }
  }
  parent.appendChild(fragment)
  return parent
}

/**
 * @en Run layout reads and writes as two separated phases to avoid layout
 * thrashing.
 *
 * Solves: interleaving reads (offsetWidth, getBoundingClientRect...) with
 * style writes forces the browser to recompute layout on the spot — inside a
 * loop, layout runs dozens of times in a single frame. Finishing all reads
 * first, then applying all writes together, makes layout run once.
 *
 * `read` returns the measurement values it gathered; that result is passed to
 * `write`, which applies the changes.
 *
 * @param read Gather all layout-dependent values. Called first.
 * @param write Apply all style/DOM changes. Receives `read`'s return value.
 * @returns Whatever `write` returns.
 *
 * @example
 * ```ts
 * // 🟢 All reads finish, then all writes — one layout pass
 * runLayoutBatch(
 *   () => elements.map((el) => el.offsetWidth), // gather reads
 *   (widths) => elements.forEach((el, i) => (el.style.width = `${widths[i]! + 10}px`)),
 * )
 *
 * // 🔴 Reads and writes interleaved — forces a layout recalculation every iteration
 * for (const el of elements) {
 *   const width = el.offsetWidth // read (needs layout)
 *   el.style.width = width + 10 + 'px' // write (invalidates layout)
 * }
 * ```
 */
export function runLayoutBatch<T, R>(read: () => T, write: (measured: T) => R): R {
  const measured = read()
  return write(measured)
}
