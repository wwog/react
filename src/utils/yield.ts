/**
 * @en Splitting: yield the main thread between pieces of long-running work.
 *
 * The browser's main thread is single-threaded: while a task runs, the rendering
 * pipeline (style / layout / paint) and user input cannot be processed. A task
 * longer than ~50ms is a "long task" and shows up as jank — the well-known
 * symptom is a streaming chat flood freezing the input field and animations.
 *
 * The fix is to split long work into pieces and yield the main thread between
 * them, so backlogged input and frame production get their turn in the gaps.
 * Yielding does NOT make the work faster (total time is unchanged, or slightly
 * longer due to scheduling overhead) — it makes the page *feel* responsive.
 *
 * @zh 拆分（Splitting）：在长任务的各片段之间让出主线程。
 *
 * 浏览器主线程是单线程的：一个任务运行期间，渲染管线（样式 / 布局 / 绘制）与用户输入
 * 都无法处理。超过 ~50ms 的任务即“长任务”，表现为卡顿——典型症状是直播聊天洪流
 * 把输入框和动画冻住。
 *
 * 解法是把长工作切成小片，片段之间让出主线程，让积压的输入和帧生产在空隙中得以处理。
 * 让出并不会让工作变快（总耗时不变，甚至因调度开销略增）——它让页面“感觉”流畅。
 */

/**
 * @en Yield to the main thread, resolving once the continuation is ready to run.
 *
 * Resolution order (best available wins):
 * 1. `MessageChannel` — a macrotask with no minimum delay, and the transport
 *    React's scheduler uses. Empirically lets frame production and input
 *    through between chunks, which is the entire point of yielding. A single
 *    channel is shared by the whole module and rescheduled per yield: creating
 *    a channel costs ~6.4µs, so a per-call channel would burn ~32ms over 5,000
 *    yields.
 * 2. `scheduler.yield()` — kept as a fallback for runtimes without
 *    `MessageChannel`. Its continuation priority resumes ahead of other queued
 *    tasks; measured in Chromium that same priority starves frame production
 *    (a 10×10ms chunked loop produced 1 frame, versus 7 via MessageChannel), so
 *    it is deliberately not preferred here.
 * 3. `setTimeout(0)` — universal fallback, but carries a minimum delay (up to
 *    ~4ms after nesting) and pushes the continuation to the back of the queue.
 *
 * For work that must stay in rhythm with screen updates, use `forEachInFrames`
 * instead, which yields via `requestAnimationFrame` and lands just before a
 * frame is drawn.
 *
 * @param signal Optional AbortSignal; when aborted, the returned promise rejects
 * immediately so callers can stop a chunked loop early.
 * @returns A promise that resolves in a fresh task, after pending input /
 * rendering work got a chance to run.
 *
 * @example
 * ```ts
 * async function renderChats(chats: Chat[]) {
 *   let count = 0
 *   for (const chat of chats) {
 *     appendChatNode(chat)
 *     if (++count % 20 === 0) {
 *       await yieldToMain() // backlogged input & paint get their turn here
 *     }
 *   }
 * }
 * ```
 */

/**
 * @en The shared MessageChannel, created on first use so merely importing the
 * module never touches browser-only APIs.
 * @zh 共享的 MessageChannel，首次使用时才创建，因此仅导入模块不会触碰浏览器专有 API。
 */
let yieldChannel: MessageChannel | undefined
/**
 * @en One message is in flight or booked; guards against duplicate bookings.
 * @zh 已有一条消息在途/已预约，防止重复预约。
 */
let yieldMessageBooked = false
/**
 * @en Pending resumes, FIFO. Each entry gets its own task boundary.
 * @zh 等待中的恢复回调，FIFO。每个条目独占一个任务边界。
 */
const yieldResolvers: Array<() => void> = []

const getYieldChannel = (): MessageChannel | undefined => {
  if (yieldChannel) return yieldChannel
  if (typeof MessageChannel === 'undefined') return undefined
  const channel = new MessageChannel()
  // One message = one task boundary: resolve exactly one waiter, then book the
  // next message only if more are queued. Resolving them all in a single task
  // would silently collapse their boundaries.
  channel.port1.onmessage = () => {
    yieldMessageBooked = false
    yieldResolvers.shift()?.()
    if (yieldResolvers.length > 0) bookYieldMessage()
  }
  yieldChannel = channel
  return channel
}

const bookYieldMessage = (): boolean => {
  const channel = getYieldChannel()
  if (!channel) return false
  if (yieldMessageBooked) return true
  yieldMessageBooked = true
  channel.port2.postMessage(null)
  return true
}

export function yieldToMain(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason)
  }

  return new Promise<void>((resolve, reject) => {
    const target = signal
    let settled = false

    // Removed on every settle path; with `{once: true}` alone a long-lived
    // signal would accumulate one listener per yield.
    const cleanup = () => target?.removeEventListener('abort', onAbort)

    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(target?.reason)
    }

    const resume = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    target?.addEventListener('abort', onAbort)

    if (bookYieldMessage()) {
      // An abort after queuing leaves the resolver queued but inert; it costs
      // at most one task boundary and avoids an O(n) splice out of the queue.
      yieldResolvers.push(resume)
      return
    }

    const scheduler = (globalThis as {scheduler?: {yield?: () => Promise<void>}}).scheduler
    if (scheduler?.yield) {
      scheduler.yield().then(resume, onAbort)
      return
    }

    setTimeout(resume, 0)
  })
}

/**
 * @en Options for {@link forEachChunked}.
 * @zh {@link forEachChunked} 的选项。
 */
export interface ForEachChunkedOptions {
  /**
   * @en How many items to process before each yield. Default `20`.
   * Must be a positive integer; `0`, negative or fractional values throw a
   * `RangeError` instead of silently disabling the yields.
   * Splitting too finely backfires: the yield/resume overhead can exceed the
   * work itself. Splitting too coarsely (hundreds+) recreates the long task.
   * @zh 每处理多少条让出一次主线程，默认 `20`。
   * 必须为正整数；传 `0`、负数或小数会抛 `RangeError`，而不是静默取消让出。
   * 切得太碎会适得其反：让出/恢复的开销可能超过工作本身；切得太粗（数百条以上）
   * 则又变回长任务。
   */
  chunkSize?: number
  /**
   * @en AbortSignal for early termination. When aborted, iteration stops and
   * the returned promise rejects with the abort reason.
   * @zh 用于提前终止的 AbortSignal。中断后迭代停止，返回的 Promise 以中断原因 reject。
   */
  signal?: AbortSignal
}

/**
 * @en Run `fn` over every item, yielding the main thread after every
 * `chunkSize` items — the streaming-chat-flood fix.
 *
 * Solves: a burst of hundreds of messages (or any bulk DOM/compute work)
 * processed in one task blocks input and paint for its whole duration. With a
 * yield every N items, the input field keeps responding while the flood is
 * still being drawn. Total wall-clock time is unchanged or slightly longer —
 * the win is responsiveness, not throughput.
 *
 * @param items Items to process, in order.
 * @param fn Called per item. May be async; each item completes before the next.
 * @param options See {@link ForEachChunkedOptions}.
 * @returns Promise that resolves when all items are processed.
 * @throws RangeError If `chunkSize` is not a positive integer.
 *
 * @example
 * ```ts
 * // A batch of chat messages arrives at once
 * socket.on('messages', (chats: Chat[]) => {
 *   // draw the flood, yielding the main thread after every 20 messages
 *   await forEachChunked(chats, (chat) => appendChatNode(chat))
 * })
 * ```
 */
export async function forEachChunked<T>(
  items: Iterable<T>,
  fn: (item: T, index: number) => void | Promise<void>,
  options: ForEachChunkedOptions = {},
): Promise<void> {
  const chunkSize = options.chunkSize ?? 20
  const signal = options.signal

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError(
      `forEachChunked: chunkSize must be a positive integer, received ${chunkSize}`,
    )
  }

  let untilYield = chunkSize
  let index = 0
  for (const item of items) {
    if (signal?.aborted) {
      return Promise.reject(signal.reason)
    }

    // Only await actual thenables: this loop is the hot path of the flood
    // scenario, and `await` on a synchronously-returning callback costs ~28ns
    // per item for nothing.
    const result = fn(item, index++)
    if (result instanceof Promise) await result

    // Countdown instead of `count % chunkSize`, one less operation per item.
    if (--untilYield === 0) {
      untilYield = chunkSize
      await yieldToMain(signal)
    }
  }
}

/**
 * @en Options for {@link forEachInFrames}.
 * @zh {@link forEachInFrames} 的选项。
 */
export interface ForEachInFramesOptions {
  /**
   * @en Main-thread budget per frame, in milliseconds. Default `5`.
   * Must be a positive number; a non-positive or non-finite value throws a
   * `RangeError` rather than silently spinning without progress.
   * The practical frame budget is ~10ms (of the 16.6ms a 60Hz frame allows,
   * minus browser overhead); handing roughly half to background work leaves
   * the rest for animation callbacks, style, layout and paint. Shrink it if
   * the animations running alongside are heavy.
   * @zh 每帧占用的主线程预算（毫秒），默认 `5`。
   * 必须为正数；传 0、负数或非有限值会抛 `RangeError`，而不是静默空转不推进。
   * 实际帧预算约 10ms（60Hz 的 16.6ms 减去浏览器自身开销），分给后台工作约一半，
   * 其余留给动画回调、样式、布局与绘制。若同时运行的动画较重，应调小。
   */
  budgetMs?: number
  /**
   * @en How many items to process between two `performance.now()` reads.
   * Default `1` (check the budget after every item — exact, and the right
   * choice when items are heavy). Reading the clock costs ~69ns, which is
   * negligible against a heavy item but dominant against a trivial one; if
   * items are cheap, raise this (e.g. `16`) to trade budget precision for
   * throughput — the budget can then overshoot by up to
   * `clockSampleEvery × per-item cost`. Must be a positive integer.
   * @zh 每处理多少条才读一次 `performance.now()`。默认 `1`（每条都检查预算 ——
   * 精确，且条目较重时的正确选择）。读一次时钟约 69ns，相对重条目可忽略，
   * 但相对极轻的条目就是主要开销；条目很轻时可调大（如 `16`），用预算精度换吞吐——
   * 此时预算最多超出 `clockSampleEvery × 单条耗时`。必须为正整数。
   */
  clockSampleEvery?: number
  /**
   * @en AbortSignal for early termination.
   * @zh 用于提前终止的 AbortSignal。
   */
  signal?: AbortSignal
}

/**
 * @en Run `fn` over every item, but only for `budgetMs` per animation frame —
 * heavy work that coexists with running animations.
 *
 * Solves: work like N-body particle steering (~16M distance checks per pass)
 * blows the frame budget on its own, dropping fps to single digits. Anchoring
 * to the frame's start timestamp (passed to rAF callbacks) instead of "now"
 * makes the code cooperate naturally when several callbacks share one frame:
 * "use 5ms" becomes "use until 5ms after the frame started", so our share
 * shrinks by whatever earlier callbacks already used.
 *
 * Resumption lands via `requestAnimationFrame`, i.e. just before the next
 * frame is drawn — in rhythm with the rendering cycle, unlike
 * {@link yieldToMain}, which resumes without regard to it.
 *
 * At least one item is processed per frame, so the loop always makes progress
 * even when other callbacks already consumed the frame's budget. When `fn` is
 * async, the loop resumes on the next frame after each item (at most one
 * async item per frame); use a synchronous `fn` for full per-frame throughput.
 *
 * @param items Items to process, in order.
 * @param fn Called per item. May be async; each item completes before the next.
 * @param options See {@link ForEachInFramesOptions}.
 * @returns Promise that resolves when all items are processed.
 * @throws RangeError If `budgetMs` is not a positive finite number, or
 * `clockSampleEvery` is not a positive integer.
 *
 * @example
 * ```ts
 * // Recompute 4,000 particles without killing the 60fps animation
 * await forEachInFrames(particles, (p) => p.applyForces(), {budgetMs: 5})
 *
 * // Very cheap items: read the clock every 16 items instead of every item
 * await forEachInFrames(rows, (row) => row.markDirty(), {
 *   budgetMs: 5,
 *   clockSampleEvery: 16,
 * })
 * ```
 */
export async function forEachInFrames<T>(
  items: Iterable<T>,
  fn: (item: T, index: number) => void | Promise<void>,
  options: ForEachInFramesOptions = {},
): Promise<void> {
  const budgetMs = options.budgetMs ?? 5
  const clockSampleEvery = options.clockSampleEvery ?? 1
  const signal = options.signal

  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new RangeError(
      `forEachInFrames: budgetMs must be a positive number, received ${budgetMs}`,
    )
  }

  if (!Number.isInteger(clockSampleEvery) || clockSampleEvery < 1) {
    throw new RangeError(
      `forEachInFrames: clockSampleEvery must be a positive integer, received ${clockSampleEvery}`,
    )
  }

  const iterator = items[Symbol.iterator]()

  return new Promise<void>((resolve, reject) => {
    let index = 0

    const step = (frameStart: number) => {
      if (signal?.aborted) {
        reject(signal.reason)
        return
      }

      try {
        // `first` guarantees progress: at least one item runs per frame even if
        // the frame's budget was already consumed by other callbacks. Without
        // it, a zero/negative budget would spin forever without advancing.
        let first = true
        let sinceClock = 0
        for (;;) {
          // Read the clock only when due; `first` skips the very first check so
          // the first item always runs. Checking after each item is equivalent
          // to checking before the next one.
          if (!first && sinceClock >= clockSampleEvery) {
            sinceClock = 0
            if (performance.now() - frameStart >= budgetMs) break
          }

          const {value, done} = iterator.next()
          if (done) {
            resolve()
            return
          }

          const result = fn(value, index++)
          first = false
          sinceClock++

          if (result instanceof Promise) {
            // Async item: wait for it, then continue on the NEXT frame. Resuming
            // in a microtask would let a chain of fast-resolving callbacks run
            // to completion inside a single task, starving rendering entirely.
            result.then(
              () => requestAnimationFrame(step),
              (error) => reject(error),
            )
            return
          }
        }
        // Budget exhausted with items left: resume at the next frame's start,
        // which becomes the new budget anchor shared with other callbacks.
        requestAnimationFrame(step)
      } catch (error) {
        reject(error)
      }
    }

    requestAnimationFrame(step)
  })
}
