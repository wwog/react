/*---------------------------------------------------------------------------------------------
 * @en Ported in full from VS Code's `src/vs/base/common/event.ts`
 * (MIT, Copyright (c) Microsoft Corporation — https://github.com/microsoft/vscode).
 * @zh 完整迁移自 VS Code 的 `src/vs/base/common/event.ts`
 * （MIT，Copyright (c) Microsoft Corporation — https://github.com/microsoft/vscode）。
 *--------------------------------------------------------------------------------------------*/

/**
 * @en A push-based event system: an `Emitter` fires, any number of `Event` subscribers receive.
 *
 * The pair is deliberately not reactive state. An `Event` carries a signal, not a value you can
 * read at any time; a late subscriber has missed everything that already happened. When you need
 * "the current value plus changes" use `createExternalState`, `ValueWithChangeEvent` or
 * `useSyncExternalStore` instead. In React the usual shape is
 *
 * ```tsx
 * useEffect(() => {
 *   const sub = emitter.event(handler)
 *   return () => sub.dispose()
 * }, [emitter])
 * ```
 *
 * ## What is different from the original
 *
 * The event semantics are ported in full — the single-listener fast path, the sparse listener
 * array and its compaction, the delivery queue that makes re-entrant `fire()` behave, leak
 * detection, refuse-to-add, profiler and every combinator. What changed is only what the original
 * borrowed from the rest of `vs/base`:
 *
 * 1. **Disposal** comes from {@link ./disposable} instead of `lifecycle.ts`/`IDisposable`: the
 *    protocol is `dispose()`, plus the real `Symbol.dispose` at runtime. `Disposable.None` is
 *    {@link noopDisposable}.
 * 2. **No base-layer imports.** `LinkedList`, `createSingleCallFunction` and `diffSets` are
 *    implemented privately below, `StopWatch` is a two-line `performance.now()` measurement inside
 *    {@link EventProfiling}, and the default listener-error handler is a local
 *    {@link onUnexpectedError} that reports through `console.error` instead of rethrowing on a
 *    later turn of the loop — a library has no business turning a listener's exception into an
 *    uncaught global error.
 * 3. **`env.VSCODE_DEV`** became {@link isDevelopment} (`process.env.NODE_ENV`), which bundlers
 *    replace statically so the buffer-leak warnings disappear from production builds.
 * 4. **`fromObservable` / `fromObservableLight`** take a minimal structural observable — `get`,
 *    `reportChanges`, `addObserver`, `removeObserver`. VS Code's `IObservable` carries a whole
 *    operator set (`read`, `map`, `keepObserved`, `flatten`, …) that belongs to its observable
 *    implementation, which this library does not ship; anything exposing the four members above
 *    (including a VS Code observable) still satisfies the interface.
 *
 * @zh 推送式事件系统：`Emitter` 触发，任意多个 `Event` 订阅者接收。
 *
 * 它与响应式状态是两回事，刻意不混。`Event` 传递的是信号而非「随时可读的值」；晚到的订阅者
 * 已经错过了此前发生的一切。需要「当前值 + 变更通知」时请用 `createExternalState`、
 * `ValueWithChangeEvent` 或 `useSyncExternalStore`。React 里的典型写法见上方代码块。
 *
 * ## 与原版的差异
 *
 * 事件语义是完整迁移的——单监听器快路径、稀疏监听器数组及其压缩、让重入 `fire()` 行为正确的
 * 投递队列、泄漏检测、拒绝新增监听器、性能剖析，以及每一个组合子都在。变的只是原版从 `vs/base`
 * 其它模块借来的东西，共四处，逐条列在上面。
 *
 * 注意第 1 条：本模块的可释放对象协议是 `dispose()`（运行时附带 `Symbol.dispose`），不是
 * `IDisposable` 这个类型名本身，理由见 {@link ./disposable} 的模块头。
 */

import {
  type CompatDisposable,
  DisposableMap,
  DisposableStore,
  combinedDisposable,
  disposeAll,
  noopDisposable,
  toDisposable,
  withDisposeSymbol,
} from './disposable'

// -------------------------------------------------------------------------------------------------
// 原版从 `vs/base` 其它模块引入的私有替身。数量刻意压到最少，且都不导出：它们是实现细节，
// 不是本库要提供的 API。
// -------------------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------------------
// 三个开关。原版用 `Boolean("TRUE")` 这种「注释掉就是关闭」的写法，好让常量折叠把死代码消掉；
// 这里保留常量形式与折叠效果，但不再保留那个容易误触的写法。
// -------------------------------------------------------------------------------------------------

/**
 * @en Print a warning whenever an emitter with listeners is disposed — that is a sign of code
 * smell (somebody forgot to unsubscribe).
 * @zh 释放「还有监听器」的 emitter 时打印告警——这通常意味着有人忘了退订。
 */
const _enableDisposeWithListenerWarning = false

/**
 * @en Print a warning when a snapshotted event is used repeatedly without cleanup.
 * See https://github.com/microsoft/vscode/issues/142851
 * @zh 快照事件被反复使用却没清理时告警。见上面那个 issue。
 */
const _enableSnapshotPotentialLeakWarning = false

const _bufferLeakWarnCountThreshold = 100
const _bufferLeakWarnTimeThreshold = 60_000 // 1 minute

/**
 * @en Buffer-leak detection is expensive (it captures a stack and keeps a timer alive), so it only
 * runs in development builds.
 * @zh 缓冲泄漏检测很贵（要抓栈、还要挂一个定时器），所以只在开发构建里跑。
 */
function _isBufferLeakWarningEnabled(): boolean {
  return isDevelopment()
}

/**
 * @en Bare `process.env.NODE_ENV`, declared rather than imported so the library does not depend on
 * `@types/node`. The bare identifier is deliberate — bundlers replace the whole expression with a
 * literal, which is what lets {@link isDevelopment} guard dev-only warnings away from production.
 * @zh 裸标识符写法，自行声明而不引入 `@types/node`（本库发布 `src/`，使用者的工程不一定装了
 * node 类型）。刻意保留裸标识符：打包器会把整个表达式替换成字面量，这正是 {@link isDevelopment}
 * 能把仅开发期的告警挡在生产包之外的原因。
 */
declare const process: {env: Record<string, string | undefined>}

/**
 * @en Whether this is a development build. When `process` is unavailable (native ESM, running
 * straight in a browser) it counts as development: a redundant warning is noise, a missing one
 * costs a debugging session.
 * @zh 是否为开发构建。取不到 `process` 时（原生 ESM、直接跑在浏览器里）按开发处理：多一条告警
 * 只是噪音，少一条会让人查不出问题。
 */
const isDevelopment = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return true
  }
}

/**
 * @en Default handler for an exception thrown by a listener. The original rethrows on a later turn
 * of the loop, which surfaces the failure as a global error; a library should not do that to a
 * host application, so the report goes to `console.error` and the remaining listeners still run.
 * Pass `onListenerError` to {@link EmitterOptions} to route it anywhere else.
 * @zh 监听器抛异常时的默认处理。原版会在随后的一轮事件循环里重新抛出，把失败升级成全局错误；
 * 一个库不该这样对待宿主应用，所以这里写进 `console.error`，且其余监听器照常执行。需要别的去
 * 向就给 {@link EmitterOptions} 传 `onListenerError`。
 */
function onUnexpectedError(e: unknown): void {
  console.error(e)
}

/**
 * @en A doubly linked list. Local rather than imported because the original only uses it as an
 * unbounded FIFO for the async/pauseable emitters, and a dependency on the wider collection module
 * would come with a dozen unrelated exports.
 * @zh 双向链表。之所以在本地实现而不引入：原版只把它当作无界 FIFO 用在异步/可暂停 emitter 上，
 * 而引入那个集合模块会顺带拖进十几个无关导出。
 */
class LinkedListNode<E> {
  static readonly Undefined = new LinkedListNode<unknown>(undefined)

  element: E
  next: LinkedListNode<E> | typeof LinkedListNode.Undefined
  prev: LinkedListNode<E> | typeof LinkedListNode.Undefined

  constructor(element: E) {
    this.element = element
    this.next = LinkedListNode.Undefined
    this.prev = LinkedListNode.Undefined
  }
}

class LinkedList<E> {
  #first: LinkedListNode<E> | typeof LinkedListNode.Undefined = LinkedListNode.Undefined
  #last: LinkedListNode<E> | typeof LinkedListNode.Undefined = LinkedListNode.Undefined
  #size = 0

  get size(): number {
    return this.#size
  }

  isEmpty(): boolean {
    return this.#first === LinkedListNode.Undefined
  }

  clear(): void {
    let node = this.#first
    while (node !== LinkedListNode.Undefined) {
      const next = node.next
      node.prev = LinkedListNode.Undefined
      node.next = LinkedListNode.Undefined
      node = next
    }

    this.#first = LinkedListNode.Undefined
    this.#last = LinkedListNode.Undefined
    this.#size = 0
  }

  push(element: E): () => void {
    return this.#insert(element, true)
  }

  #insert(element: E, atTheEnd: boolean): () => void {
    const newNode = new LinkedListNode(element)
    if (this.#first === LinkedListNode.Undefined) {
      this.#first = newNode
      this.#last = newNode
    } else if (atTheEnd) {
      const oldLast = this.#last
      this.#last = newNode
      newNode.prev = oldLast
      oldLast.next = newNode
    } else {
      const oldFirst = this.#first
      this.#first = newNode
      newNode.next = oldFirst
      oldFirst.prev = newNode
    }
    this.#size += 1

    let didRemove = false
    return () => {
      if (!didRemove) {
        didRemove = true
        this.#remove(newNode)
      }
    }
  }

  shift(): E | undefined {
    if (this.#first === LinkedListNode.Undefined) {
      return undefined
    }
    const res = this.#first.element
    this.#remove(this.#first)
    return res as E
  }

  #remove(node: LinkedListNode<E> | typeof LinkedListNode.Undefined): void {
    if (node.prev !== LinkedListNode.Undefined && node.next !== LinkedListNode.Undefined) {
      const anchor = node.prev
      anchor.next = node.next
      node.next.prev = anchor
    } else if (node.prev === LinkedListNode.Undefined && node.next === LinkedListNode.Undefined) {
      this.#first = LinkedListNode.Undefined
      this.#last = LinkedListNode.Undefined
    } else if (node.next === LinkedListNode.Undefined) {
      this.#last = this.#last.prev!
      this.#last.next = LinkedListNode.Undefined
    } else if (node.prev === LinkedListNode.Undefined) {
      this.#first = this.#first.next!
      this.#first.prev = LinkedListNode.Undefined
    }

    this.#size -= 1
  }

  *[Symbol.iterator](): Iterator<E> {
    let node = this.#first
    while (node !== LinkedListNode.Undefined) {
      yield node.element as E
      node = node.next
    }
  }
}

/**
 * @en Wrap `fn` so it only ever runs once; later calls return the first result. Used by
 * {@link EventMultiplexer.add} so a doubly-disposed handle cannot splice the wrong entry.
 * @zh 把 `fn` 包成只执行一次；之后的调用返回第一次的结果。{@link EventMultiplexer.add} 用它来
 * 保证重复 dispose 同一个句柄不会误删别的条目。
 */
function createSingleCallFunction<T extends (...args: never[]) => unknown>(fn: T): T {
  let didCall = false
  let result: unknown

  return function (this: unknown, ...args: never[]) {
    if (didCall) {
      return result
    }
    didCall = true
    result = fn.apply(this, args)
    return result
  } as unknown as T
}

/**
 * @en Elements that `before` has and `after` does not, and vice versa. Used by
 * {@link trackSetChanges} to turn two snapshots into the add/remove calls.
 * @zh `before` 有而 `after` 没有的元素，以及反向的那一批。{@link trackSetChanges} 用它把两个快照
 * 变成增删调用。
 */
function diffSets<T>(before: ReadonlySet<T>, after: ReadonlySet<T>): {removed: T[]; added: T[]} {
  const removed: T[] = []
  const added: T[] = []
  for (const element of before) {
    if (!after.has(element)) {
      removed.push(element)
    }
  }
  for (const element of after) {
    if (!before.has(element)) {
      added.push(element)
    }
  }
  return {removed, added}
}

/**
 * @en Passed as the `delay` of {@link Event.debounce} / {@link Event.throttle} to flush on the next
 * microtask instead of on a timer. Cheaper and ordered with the rest of the microtask queue, at the
 * cost of not coalescing anything that arrives in a later task.
 * @zh 作为 {@link Event.debounce} / {@link Event.throttle} 的 `delay` 传入，表示在下一个微任务
 * 而不是定时器上冲刷。更便宜，且与其余微任务保持顺序；代价是跨任务到达的事件不会被合并。
 */
export const MicrotaskDelay = Symbol('MicrotaskDelay')

/**
 * @en A promise that can be given up on. `cancel()` detaches the listener but — matching the
 * original — does not reject the promise: a cancelled wait simply never settles.
 * @zh 一个可以放弃等待的 promise。`cancel()` 会摘掉监听器，但与原版一致，**不会**让 promise
 * 变成 rejected：被取消的等待只是永远不结算。
 */
export interface CancelablePromise<T> extends Promise<T> {
  cancel(): void
}

/**
 * @en A flag that only ever turns one way, plus an event for the turn. Only the read-only face is
 * declared here: {@link AsyncEmitter} consumes tokens, it never creates them. Any object with these
 * two members works, including VS Code's or `AbortSignal`-based adapters.
 * @zh 一个只会单向翻转的标志，外加翻转时的事件。这里只声明只读的一面：{@link AsyncEmitter} 消费
 * token，不产生 token。任何具备这两个成员的对象都可以（包括 VS Code 的，或基于 `AbortSignal`
 * 的适配器）。
 */
export interface CancellationToken {
  /**
   * @en Whether cancellation has already been requested.
   * @zh 是否已经请求了取消。
   */
  readonly isCancellationRequested: boolean

  /**
   * @en Fires when cancellation is requested. Late subscribers are still called, and only once.
   * @zh 取消被请求时触发。晚到的订阅者同样会被调用，且只调用一次。
   */
  readonly onCancellationRequested: Event<void>
}

/**
 * @en An observable value, as much of VS Code's interface as {@link Event.fromObservable} needs.
 * @zh 可观察值，取 VS Code 接口中 {@link Event.fromObservable} 需要的那部分。
 */
export interface IObservable<T> extends IObservableWithChange<T, unknown> {}

/**
 * @en An observable value whose changes carry a payload. This library does not ship an observable
 * implementation; the interface is here so any compatible one can be adapted to an `Event`.
 * @zh 变更带载荷的可观察值。本库不提供 observable 实现，声明这个接口只是为了让任何兼容实现都能
 * 被适配成 `Event`。
 */
export interface IObservableWithChange<T, TChange = unknown> {
  /**
   * @en The current value.
   * @zh 当前值。
   */
  get(): T

  /**
   * @en Force a check for changes and report them to observers. Must not be called from
   * {@link IObserver.handleChange}.
   * @zh 强制检查变更并上报给观察者。不可在 {@link IObserver.handleChange} 中调用。
   */
  reportChanges(): void

  /**
   * @en Subscribe an observer (idempotent).
   * @zh 订阅一个观察者（幂等）。
   */
  addObserver(observer: IObserver): void

  /**
   * @en Unsubscribe an observer (idempotent).
   * @zh 退订一个观察者（幂等）。
   */
  removeObserver(observer: IObserver): void
}

/**
 * @en The receiving half of {@link IObservable}.
 * @zh {@link IObservable} 的接收端。
 */
export interface IObserver {
  /**
   * @en A transaction that may have modified `observable` started. Every call is paired with an
   * {@link IObserver.endUpdate}.
   * @zh 一次可能改动了 `observable` 的事务开始。每次调用都会配对一个
   * {@link IObserver.endUpdate}。
   */
  beginUpdate<T>(observable: IObservable<T>): void

  /**
   * @en That transaction ended — the place to react to it.
   * @zh 事务结束——反应变更的地方。
   */
  endUpdate<T>(observable: IObservable<T>): void

  /**
   * @en `observable` might have changed. Handle lazily or in {@link IObserver.endUpdate}.
   * @zh `observable` 可能变了。请惰性处理，或留到 {@link IObserver.endUpdate}。
   */
  handlePossibleChange<T>(observable: IObservable<T>): void

  /**
   * @en `observable` changed, with the change payload.
   * @zh `observable` 发生了变化，并附带变更载荷。
   */
  handleChange<T, TChange>(observable: IObservableWithChange<T, TChange>, change: TChange): void
}

/**
 * @en An event with zero or one parameter that can be subscribed to. The event *is* a function:
 * call it with a listener to subscribe, and keep the returned {@link CompatDisposable} to
 * unsubscribe. Events are free to be hot (fire before you subscribe), and calling one is cheap —
 * the emitter does nothing at all until the first listener arrives.
 *
 * @example
 * ```ts
 * class Document {
 *   private readonly _onDidChange = new Emitter<string>()
 *   readonly onDidChange: Event<string> = this._onDidChange.event
 *
 *   private edit(text: string) {
 *     this._onDidChange.fire(text)
 *   }
 * }
 *
 * const subscription = doc.onDidChange(text => console.log(text))
 * subscription.dispose()
 * ```
 *
 * @zh 零参或单参、可被订阅的事件。事件本身就是函数：传入监听器即订阅，保留返回的
 * {@link CompatDisposable} 即可退订。事件可以是热的（订阅前就触发过），调用本身很便宜——第一个
 * 监听器到来之前 emitter 什么都不做。
 */
export type Event<T> = (
  listener: (e: T) => unknown,
  thisArgs?: any,
  disposables?: CompatDisposable[] | DisposableStore,
) => CompatDisposable

export namespace Event {
  /**
   * @en An event that never fires. Safe to hand out as a default.
   * @zh 永不触发的事件。适合作为默认值分发出去。
   */
  export const None: Event<any> = () => noopDisposable

  function _addLeakageTraceLogic(options: EmitterOptions) {
    if (_enableSnapshotPotentialLeakWarning) {
      const {onDidAddListener: origListenerDidAdd} = options
      const stack = Stacktrace.create()
      let count = 0
      options.onDidAddListener = () => {
        if (++count === 2) {
          console.warn(
            'snapshotted emitter LIKELY used public and SHOULD HAVE BEEN created with DisposableStore. snapshotted here',
          )
          stack.print()
        }
        origListenerDidAdd?.()
      }
    }
  }

  /**
   * @en Given an event, returns another event which debounces calls and defers the listeners to a
   * later task via a shared `setTimeout`. The event is converted into a signal (`Event<void>`) to
   * avoid additional object creation as a result of merging events and to try prevent race
   * conditions that could arise when using related deferred and non-deferred events.
   *
   * This is useful for deferring non-critical work (eg. general UI updates) to ensure it does not
   * block critical work (eg. latency of keypress to text rendered).
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties", e.g the event is a public
   * property. Otherwise a leaked listener on the returned event causes this utility to leak a
   * listener on the original event.
   *
   * @param event The event source for the new event.
   * @param flushOnListenerRemove Whether to fire all debounced events when a listener is removed.
   * @param disposable A disposable store to add the new EventEmitter to.
   *
   * @zh 把一个事件变成「合并后延迟到后续任务再通知」的信号事件（统一转成 `Event<void>`，避免合并
   * 事件带来的额外对象分配，也尽量避免延迟事件与非延迟事件混用时的竞态）。适合把非关键工作（例如
   * 常规 UI 更新）让开，别挡住关键路径（例如按键到出字的延迟）。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到（例如作为公开属性），就必须配一个
   * {@link DisposableStore} 使用；否则返回事件上泄漏的监听器会连带在原事件上泄漏一个。
   */
  export function defer(
    event: Event<unknown>,
    flushOnListenerRemove?: boolean,
    disposable?: DisposableStore,
  ): Event<void> {
    return debounce<unknown, void>(
      event,
      () => void 0,
      0,
      undefined,
      flushOnListenerRemove ?? true,
      undefined,
      disposable,
    )
  }

  /**
   * @en Given an event, returns another event which only fires once.
   *
   * @zh 只触发一次的事件。
   */
  export function once<T>(event: Event<T>): Event<T> {
    return (listener, thisArgs = null, disposables?) => {
      // we need this, in case the event fires during the listener call
      let didFire = false
      let result: CompatDisposable | undefined = undefined
      result = event(
        (e) => {
          if (didFire) {
            return
          }
          if (result) {
            result.dispose()
          } else {
            didFire = true
          }

          return listener.call(thisArgs, e)
        },
        null,
        disposables,
      )

      if (didFire) {
        result.dispose()
      }

      return result
    }
  }

  /**
   * @en Fires once, and only when `condition` holds.
   * @zh 仅当 `condition` 成立时触发一次。
   */
  export function onceIf<T>(event: Event<T>, condition: (e: T) => boolean): Event<T> {
    return Event.once(Event.filter(event, condition))
  }

  /**
   * @en Maps an event of one type into an event of another type, like `Array.prototype.map`.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 像 `Array.prototype.map` 一样把一种类型的事件映射成另一种。*注意*：返回的 `Event` 只要
   * 会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function map<I, O>(
    event: Event<I>,
    map: (i: I) => O,
    disposable?: DisposableStore,
  ): Event<O> {
    return snapshot(
      (listener, thisArgs = null, disposables?) =>
        event((i) => listener.call(thisArgs, map(i)), null, disposables),
      disposable,
    )
  }

  /**
   * @en Runs `each` on every event object before the listener sees it — the place for a side effect
   * that must not change the value.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 在监听器收到事件对象之前先跑一遍 `each`——用于不改变值的副作用。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function forEach<I>(
    event: Event<I>,
    each: (i: I) => void,
    disposable?: DisposableStore,
  ): Event<I> {
    return snapshot(
      (listener, thisArgs = null, disposables?) =>
        event(
          (i) => {
            each(i)
            listener.call(thisArgs, i)
          },
          null,
          disposables,
        ),
      disposable,
    )
  }

  /**
   * @en Wraps an event in another event that fires only when some condition is met. The type-guard
   * overload narrows the event type.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 只在条件成立时触发的事件；带类型守卫的重载会同时收窄事件类型。*注意*：返回的 `Event`
   * 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function filter<T, U>(
    event: Event<T | U>,
    filter: (e: T | U) => e is T,
    disposable?: DisposableStore,
  ): Event<T>
  export function filter<T>(
    event: Event<T>,
    filter: (e: T) => boolean,
    disposable?: DisposableStore,
  ): Event<T>
  export function filter<T, R>(
    event: Event<T | R>,
    filter: (e: T | R) => e is R,
    disposable?: DisposableStore,
  ): Event<R>
  export function filter<T>(
    event: Event<T>,
    filter: (e: T) => boolean,
    disposable?: DisposableStore,
  ): Event<T> {
    return snapshot(
      (listener, thisArgs = null, disposables?) =>
        event((e) => filter(e) && listener.call(thisArgs, e), null, disposables),
      disposable,
    )
  }

  /**
   * @en Given an event, returns the same event but typed as `Event<void>`.
   * @zh 同一个事件，但类型上是 `Event<void>`——只关心「发生了」，不关心载荷。
   */
  export function signal<T>(event: Event<T>): Event<void> {
    return event as Event<any> as Event<void>
  }

  /**
   * @en Fires whenever any of the given events fires, carrying that event's payload.
   * @zh 任一给定事件触发时都触发，并带上该事件的载荷。
   */
  export function any<T>(...events: Event<T>[]): Event<T>
  export function any(...events: Event<any>[]): Event<void>
  export function any<T>(...events: Event<T>[]): Event<T> {
    return (listener, thisArgs = null, disposables?) => {
      const disposable = combinedDisposable(
        ...events.map((event) => event((e) => listener.call(thisArgs, e))),
      )
      return addAndReturnDisposable(disposable, disposables)
    }
  }

  /**
   * @en Folds every event object into an accumulator, firing the accumulator after each one. With
   * `initial` the first fire sees `merge(initial, first)`; without it the first event object is
   * passed through as the initial value.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 把每个事件对象折进累加值，每次折叠后触发一次。给了 `initial` 时首次触发即
   * `merge(initial, first)`；不给则把第一个事件对象直接当作初始值透出。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function reduce<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    initial?: O,
    disposable?: DisposableStore,
  ): Event<O> {
    let output: O | undefined = initial

    return map<I, O>(
      event,
      (e) => {
        output = merge(output, e)
        return output
      },
      disposable,
    )
  }

  /**
   * @en The shape behind every derived event: one emitter whose fan-out follows the *current*
   * subscribers, and a listener on the source that only exists while somebody is listening. That
   * laziness is why `Event.map(source, …)` on an idle source costs nothing.
   *
   * @zh 所有派生事件的共同形态：一个 emitter，它的扇出范围跟着*当前*订阅者走；而源上的监听器只在
   * 有人订阅期间存在。正因为这份惰性，`Event.map(source, …)` 在无人订阅时不产生任何开销。
   */
  function snapshot<T>(event: Event<T>, disposable: DisposableStore | undefined): Event<T> {
    let listener: CompatDisposable | undefined

    const options: EmitterOptions | undefined = {
      onWillAddFirstListener() {
        listener = event(emitter.fire, emitter)
      },
      onDidRemoveLastListener() {
        listener?.dispose()
      },
    }

    if (!disposable) {
      _addLeakageTraceLogic(options)
    }

    const emitter = new Emitter<T>(options)

    disposable?.add(emitter)

    return emitter.event
  }

  /**
   * @en Adds the disposable to the store if it's set, and returns it. Useful in `Event` function
   * implementations.
   * @zh 如果给了 store 就把可释放对象登记进去，并返回它。在 `Event` 的各个实现里很有用。
   */
  function addAndReturnDisposable<T extends CompatDisposable>(
    d: T,
    store: DisposableStore | CompatDisposable[] | undefined,
  ): T {
    // Array.isArray 而不是 instanceof：跨 realm（iframe）传进来的数组 instanceof 会失败
    if (Array.isArray(store)) {
      store.push(d)
    } else if (store) {
      store.add(d)
    }
    return d
  }

  /**
   * @en Debounces an event and merges everything that arrives inside the window.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @param event The original event to debounce.
   * @param merge A function that reduces all events into a single event.
   * @param delay The number of milliseconds to debounce, or `MicrotaskDelay`.
   * @param leading Whether to fire a leading event without debouncing.
   * @param flushOnListenerRemove Whether to fire all debounced events when a listener is removed.
   * Without it, some events could go missing if the last listener leaves inside the window.
   * @param leakWarningThreshold See {@link EmitterOptions.leakWarningThreshold}.
   * @param disposable A disposable store to register the debounce emitter to.
   *
   * @zh 防抖：把窗口期内到达的事件合并成一次触发。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   *
   * `flushOnListenerRemove` 为假时，如果最后一个监听器在窗口期内离开，待触发的那批事件会丢失。
   */
  export function debounce<T>(
    event: Event<T>,
    merge: (last: T | undefined, event: T) => T,
    delay?: number | typeof MicrotaskDelay,
    leading?: boolean,
    flushOnListenerRemove?: boolean,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<T>
  export function debounce<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay?: number | typeof MicrotaskDelay,
    leading?: boolean,
    flushOnListenerRemove?: boolean,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<O>
  export function debounce<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay: number | typeof MicrotaskDelay = 100,
    leading = false,
    flushOnListenerRemove = false,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<O> {
    let subscription: CompatDisposable = noopDisposable
    let output: O | undefined = undefined
    let handle: ReturnType<typeof setTimeout> | undefined | null = undefined
    let numDebouncedCalls = 0
    let doFire: (() => void) | undefined

    const options: EmitterOptions | undefined = {
      leakWarningThreshold,
      onWillAddFirstListener() {
        subscription = event((cur) => {
          numDebouncedCalls++
          output = merge(output, cur)

          if (leading && !handle) {
            emitter.fire(output)
            output = undefined
          }

          doFire = () => {
            const _output = output
            output = undefined
            handle = undefined
            if (!leading || numDebouncedCalls > 1) {
              emitter.fire(_output!)
            }
            numDebouncedCalls = 0
          }

          if (typeof delay === 'number') {
            if (handle) {
              clearTimeout(handle)
            }
            handle = setTimeout(doFire, delay)
          } else {
            // 微任务模式：只挂一次，handle 用 null 表示「已挂、但还没跑」
            if (handle === undefined) {
              handle = null
              queueMicrotask(doFire)
            }
          }
        })
      },
      onWillRemoveListener() {
        if (flushOnListenerRemove && numDebouncedCalls > 0) {
          doFire?.()
        }
      },
      onDidRemoveLastListener() {
        doFire = undefined
        subscription.dispose()
      },
    }

    if (!disposable) {
      _addLeakageTraceLogic(options)
    }

    const emitter = new Emitter<O>(options)

    disposable?.add(emitter)

    return emitter.event
  }

  /**
   * @en Debounces an event, firing after some delay (default 0) with an array of everything that
   * arrived in the window. Flushes on listener removal by default, so nothing goes missing.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 防抖并把窗口期内的所有事件对象收集成数组后触发（默认延迟 0）。默认在监听器移除时冲刷，
   * 因此不会丢事件。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function accumulate<T>(
    event: Event<T>,
    delay: number | typeof MicrotaskDelay = 0,
    flushOnListenerRemove?: boolean,
    disposable?: DisposableStore,
  ): Event<T[]> {
    return Event.debounce<T, T[]>(
      event,
      (last, e) => {
        if (!last) {
          return [e]
        }
        last.push(e)
        return last
      },
      delay,
      undefined,
      flushOnListenerRemove ?? true,
      undefined,
      disposable,
    )
  }

  /**
   * @en Throttles an event, ensuring it fires at most once per delay period. Unlike {@link debounce}
   * it can fire on both edges: immediately (`leading`) and after the delay with the merged value of
   * everything that arrived meanwhile (`trailing`).
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @zh 节流：每个延迟窗口最多触发一次。与 {@link debounce} 不同，它可以在两端都触发——立即
   * （`leading`）以及延迟结束后带窗口期内的合并值（`trailing`）。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function throttle<T>(
    event: Event<T>,
    merge: (last: T | undefined, event: T) => T,
    delay?: number | typeof MicrotaskDelay,
    leading?: boolean,
    trailing?: boolean,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<T>
  export function throttle<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay?: number | typeof MicrotaskDelay,
    leading?: boolean,
    trailing?: boolean,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<O>
  export function throttle<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay: number | typeof MicrotaskDelay = 100,
    leading = true,
    trailing = true,
    leakWarningThreshold?: number,
    disposable?: DisposableStore,
  ): Event<O> {
    // 与 debounce 一致地初始化：Emitter.dispose() 会无条件调用 onDidRemoveLastListener，
    // 而「建好但从没人订阅就释放」是合法用法（把公开的节流事件交给 DisposableStore 管理，直到进程
    // 结束都没有订阅者）。保持未初始化的话这里会抛 TypeError。
    let subscription: CompatDisposable = noopDisposable
    let output: O | undefined = undefined
    let handle: ReturnType<typeof setTimeout> | undefined = undefined
    let numThrottledCalls = 0

    const options: EmitterOptions | undefined = {
      leakWarningThreshold,
      onWillAddFirstListener() {
        subscription = event((cur) => {
          numThrottledCalls++
          output = merge(output, cur)

          // If not currently throttling, fire immediately if leading is enabled
          if (handle === undefined) {
            if (leading) {
              emitter.fire(output)
              output = undefined
              numThrottledCalls = 0
            }

            // Set up the throttle period
            if (typeof delay === 'number') {
              handle = setTimeout(() => {
                // Fire on trailing edge if there were calls during throttle period
                if (trailing && numThrottledCalls > 0) {
                  emitter.fire(output!)
                }
                output = undefined
                handle = undefined
                numThrottledCalls = 0
              }, delay)
            } else {
              // 微任务模式下用 0 当哨兵：定时器句柄在浏览器里是数字，microtask 没有句柄
              handle = 0 as unknown as ReturnType<typeof setTimeout>
              queueMicrotask(() => {
                if (trailing && numThrottledCalls > 0) {
                  emitter.fire(output!)
                }
                output = undefined
                handle = undefined
                numThrottledCalls = 0
              })
            }
          }
          // If already throttling, just accumulate the value for trailing edge
        })
      },
      onDidRemoveLastListener() {
        subscription.dispose()
      },
    }

    if (!disposable) {
      _addLeakageTraceLogic(options)
    }

    const emitter = new Emitter<O>(options)

    disposable?.add(emitter)

    return emitter.event
  }

  /**
   * @en Filters an event such that the same value is not emitted twice in a row — the way to
   * collapse "the same window got focus" from two sources into one notification.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @example
   * ```ts
   * // Fire only one time when a single window is opened or focused
   * Event.latch(Event.any(onDidOpenWindow, onDidFocusWindow))
   * ```
   *
   * @zh 连续重复的值只透出一次——把两个来源的「同一个窗口被聚焦」合并成一次通知。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   */
  export function latch<T>(
    event: Event<T>,
    equals: (a: T, b: T) => boolean = (a, b) => a === b,
    disposable?: DisposableStore,
  ): Event<T> {
    let firstCall = true
    let cache: T

    return filter(
      event,
      (value) => {
        const shouldEmit = firstCall || !equals(value, cache)
        firstCall = false
        cache = value
        return shouldEmit
      },
      disposable,
    )
  }

  /**
   * @en Splits an event whose parameter is a union into one event per member.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @example
   * ```ts
   * const event = new Emitter<number | undefined>().event
   * const [numberEvent, undefinedEvent] = Event.split(event, isUndefined)
   * ```
   *
   * @zh 把联合类型的事件拆成每个成员一个事件。*注意*：返回的 `Event` 只要会被「第三方」拿到，
   * 就必须配 {@link DisposableStore} 使用。
   */
  export function split<T, U>(
    event: Event<T | U>,
    isT: (e: T | U) => e is T,
    disposable?: DisposableStore,
  ): [Event<T>, Event<U>] {
    return [
      Event.filter(event, isT, disposable),
      Event.filter(event, (e) => !isT(e), disposable) as Event<U>,
    ]
  }

  /**
   * @en Buffers an event until it has a listener attached, then replays what was buffered.
   *
   * *NOTE* that this function returns an `Event` and it MUST be called with a {@link DisposableStore}
   * whenever the returned event is accessible to "third parties".
   *
   * @param event The event source for the new event.
   * @param debugName A name for this buffer, used in leak detection warnings.
   * @param flushAfterTimeout Whether to flush the buffer through a `setTimeout` when the first
   * listener is added, so several listeners attached in the same turn all receive it.
   * @param _buffer Internal: a source event array used for tests.
   *
   * @example
   * ```ts
   * // Start accumulating events; when the first listener is attached, flush
   * // after a timeout such that multiple listeners attached before the
   * // timeout would receive the event
   * this.onInstallExtension = Event.buffer(service.onInstallExtension, 'onInstallExtension', true)
   * ```
   *
   * @zh 在有监听器之前先缓冲事件，等第一个监听器到来后再回放。
   *
   * *注意*：返回的 `Event` 只要会被「第三方」拿到，就必须配 {@link DisposableStore} 使用。
   *
   * `flushAfterTimeout` 让回放走一次 `setTimeout`，这样同一轮里挂上来的多个监听器都能收到。
   */
  export function buffer<T>(
    event: Event<T>,
    debugName: string,
    flushAfterTimeout = false,
    _buffer: T[] = [],
    disposable?: DisposableStore,
  ): Event<T> {
    let buffer: T[] | null = _buffer.slice()

    // Dev-only leak detection: track when buffer was created and warn
    // if events accumulate without ever being consumed.
    let bufferLeakWarningData:
      | {stack: Stacktrace; timerId: ReturnType<typeof setTimeout>; warned: boolean}
      | undefined
    if (_isBufferLeakWarningEnabled()) {
      bufferLeakWarningData = {
        stack: Stacktrace.create(),
        timerId: setTimeout(() => {
          if (
            buffer &&
            buffer.length > 0 &&
            bufferLeakWarningData &&
            !bufferLeakWarningData.warned
          ) {
            bufferLeakWarningData.warned = true
            console.warn(
              `[Event.buffer][${debugName}] potential LEAK detected: ${buffer.length} events buffered for ${_bufferLeakWarnTimeThreshold / 1000}s without being consumed. Buffered here:`,
            )
            bufferLeakWarningData.stack.print()
          }
        }, _bufferLeakWarnTimeThreshold),
        warned: false,
      }
      if (disposable) {
        disposable.add(toDisposable(() => clearTimeout(bufferLeakWarningData!.timerId)))
      }
    }

    const clearLeakWarningTimer = () => {
      if (bufferLeakWarningData) {
        clearTimeout(bufferLeakWarningData.timerId)
      }
    }

    let listener: CompatDisposable | null = event((e) => {
      if (buffer) {
        buffer.push(e)
        if (
          _isBufferLeakWarningEnabled() &&
          bufferLeakWarningData &&
          !bufferLeakWarningData.warned &&
          buffer.length >= _bufferLeakWarnCountThreshold
        ) {
          bufferLeakWarningData.warned = true
          console.warn(
            `[Event.buffer][${debugName}] potential LEAK detected: ${buffer.length} events buffered without being consumed. Buffered here:`,
          )
          bufferLeakWarningData.stack.print()
        }
      } else {
        emitter.fire(e)
      }
    })

    if (disposable) {
      disposable.add(listener)
    }

    const flush = () => {
      buffer?.forEach((e) => emitter.fire(e))
      buffer = null
      clearLeakWarningTimer()
    }

    const emitter = new Emitter<T>({
      onWillAddFirstListener() {
        if (!listener) {
          listener = event((e) => emitter.fire(e))
          if (disposable) {
            disposable.add(listener)
          }
        }
      },

      onDidAddFirstListener() {
        if (buffer) {
          if (flushAfterTimeout) {
            setTimeout(flush)
          } else {
            flush()
          }
        }
      },

      onDidRemoveLastListener() {
        if (listener) {
          listener.dispose()
        }
        listener = null
        clearLeakWarningTimer()
      },
    })

    if (disposable) {
      disposable.add(emitter)
    }

    return emitter.event
  }

  /**
   * @en Wraps the event in an {@link IChainableSythensis}, allowing a more functional programming
   * style. The synthesis object is built once per subscription, and the steps run in the order they
   * were written; a step that returns `HaltChainable` (what `filter` and `latch` do when they do
   * not pass) stops the chain for that event object.
   *
   * @example
   * ```ts
   * // Normal
   * const onEnterPressNormal = Event.filter(
   *   Event.map(onKeyPress.event, e => new StandardKeyboardEvent(e)),
   *   e => e.keyCode === KeyCode.Enter
   * )
   *
   * // Using chain
   * const onEnterPressChain = Event.chain(onKeyPress.event, $ => $
   *   .map(e => new StandardKeyboardEvent(e))
   *   .filter(e => e.keyCode === KeyCode.Enter)
   * )
   * ```
   *
   * @zh 用链式写法组合事件（见上方示例）。每次订阅构建一个合成器，各步按书写顺序执行；某一步返回
   * `HaltChainable`（`filter`、`latch` 不通过时就是它）即中断该事件对象的后续处理。
   */
  export function chain<T, R>(
    event: Event<T>,
    sythensize: ($: IChainableSythensis<T>) => IChainableSythensis<R>,
  ): Event<R> {
    const fn: Event<R> = (listener, thisArgs, disposables) => {
      const cs = sythensize(new ChainableSynthesis()) as ChainableSynthesis
      return event(
        (value) => {
          const result = cs.evaluate(value)
          if (result !== HaltChainable) {
            listener.call(thisArgs, result)
          }
        },
        undefined,
        disposables,
      )
    }

    return fn
  }

  const HaltChainable = Symbol('HaltChainable')

  class ChainableSynthesis implements IChainableSythensis<any> {
    readonly #steps: ((input: any) => unknown)[] = []

    map<O>(fn: (i: any) => O): this {
      this.#steps.push(fn)
      return this
    }

    forEach(fn: (i: any) => void): this {
      this.#steps.push((v) => {
        fn(v)
        return v
      })
      return this
    }

    filter(fn: (e: any) => boolean): this {
      this.#steps.push((v) => (fn(v) ? v : HaltChainable))
      return this
    }

    reduce<R>(merge: (last: R | undefined, event: any) => R, initial?: R | undefined): this {
      let last = initial
      this.#steps.push((v) => {
        last = merge(last, v)
        return last
      })
      return this
    }

    latch(equals: (a: any, b: any) => boolean = (a, b) => a === b): ChainableSynthesis {
      let firstCall = true
      let cache: any
      this.#steps.push((value) => {
        const shouldEmit = firstCall || !equals(value, cache)
        firstCall = false
        cache = value
        return shouldEmit ? value : HaltChainable
      })

      return this
    }

    evaluate(value: any) {
      for (const step of this.#steps) {
        value = step(value)
        if (value === HaltChainable) {
          break
        }
      }

      return value
    }
  }

  /**
   * @en The chainable face of an event, as produced by {@link Event.chain}. Methods return the same
   * synthesis object, so the calls can be chained; the generic parameter tracks the value flowing
   * through, which is why `map` changes it and `filter` only narrows it.
   * @zh {@link Event.chain} 提供的链式接口。各方法返回同一个合成器对象，因此可以连写；泛型参数
   * 记录流经的值，所以 `map` 会改变它而 `filter` 只做收窄。
   */
  export interface IChainableSythensis<T> {
    map<O>(fn: (i: T) => O): IChainableSythensis<O>
    forEach(fn: (i: T) => void): IChainableSythensis<T>
    filter<R extends T>(fn: (e: T) => e is R): IChainableSythensis<R>
    filter(fn: (e: T) => boolean): IChainableSythensis<T>
    reduce<R>(merge: (last: R, event: T) => R, initial: R): IChainableSythensis<R>
    reduce<R>(merge: (last: R | undefined, event: T) => R): IChainableSythensis<R>
    latch(equals?: (a: T, b: T) => boolean): IChainableSythensis<T>
  }

  /**
   * @en The subset of a Node.js `EventEmitter` that {@link Event.fromNodeEventEmitter} needs.
   * @zh {@link Event.fromNodeEventEmitter} 需要的 Node.js `EventEmitter` 子集。
   */
  export interface NodeEventEmitter {
    on(event: string | symbol, listener: Function): unknown
    removeListener(event: string | symbol, listener: Function): unknown
  }

  /**
   * @en Creates an {@link Event} from a node event emitter. The source is only touched while
   * somebody is listening, so an event nobody subscribes to does not keep the emitter warm.
   * @zh 从 node 事件发射器创建 {@link Event}。只在有人监听期间才碰源，因此没人订阅时不会白白
   * 占着发射器。
   */
  export function fromNodeEventEmitter<T>(
    emitter: NodeEventEmitter,
    eventName: string,
    map: (...args: any[]) => T = (id) => id,
  ): Event<T> {
    const fn = (...args: unknown[]) => result.fire(map(...args))
    const onFirstListenerAdd = () => emitter.on(eventName, fn)
    const onLastListenerRemove = () => emitter.removeListener(eventName, fn)
    const result = new Emitter<T>({
      onWillAddFirstListener: onFirstListenerAdd,
      onDidRemoveLastListener: onLastListenerRemove,
    })

    return result.event
  }

  /**
   * @en The subset of a DOM `EventTarget` that {@link Event.fromDOMEventEmitter} needs.
   * @zh {@link Event.fromDOMEventEmitter} 需要的 DOM `EventTarget` 子集。
   */
  export interface DOMEventEmitter {
    // listener/options 用 any：真实的 `EventTarget` 声明的是
    // `EventListenerOrEventListenerObject | null`，而 node 风格的发射器常用 `Function`；
    // 两边互不相容，写死任何一边都会让另一边无法直接传入。
    addEventListener(event: string | symbol, listener: any, options?: any): void
    removeEventListener(event: string | symbol, listener: any, options?: any): void
  }

  /**
   * @en Creates an {@link Event} from a DOM event emitter (an `EventTarget`, e.g. `window` or an
   * element). Same laziness as {@link fromNodeEventEmitter}.
   * @zh 从 DOM 事件发射器（`EventTarget`，例如 `window` 或某个元素）创建 {@link Event}。惰性
   * 行为与 {@link fromNodeEventEmitter} 相同。
   */
  export function fromDOMEventEmitter<T>(
    emitter: DOMEventEmitter,
    eventName: string,
    map: (...args: any[]) => T = (id) => id,
  ): Event<T> {
    const fn = (...args: unknown[]) => result.fire(map(...args))
    const onFirstListenerAdd = () => emitter.addEventListener(eventName, fn)
    const onLastListenerRemove = () => emitter.removeEventListener(eventName, fn)
    const result = new Emitter<T>({
      onWillAddFirstListener: onFirstListenerAdd,
      onDidRemoveLastListener: onLastListenerRemove,
    })

    return result.event
  }

  /**
   * @en Creates a promise out of an event, using {@link Event.once}.
   *
   * `cancel()` detaches the listener. Matching the original, it does *not* reject the promise — the
   * promise simply never settles, so `await`ing a cancelled wait hangs forever. Race it against
   * something else if that matters.
   *
   * @zh 用 {@link Event.once} 把事件变成 promise。
   *
   * `cancel()` 会摘掉监听器，但与原版一致，**不会**让 promise 变成 rejected——它只是永远不结算，
   * 因此 `await` 一个被取消的等待会一直挂着。在意这点的话，请用别的东西和它 race。
   */
  export function toPromise<T>(
    event: Event<T>,
    disposables?: CompatDisposable[] | DisposableStore,
  ): CancelablePromise<T> {
    let cancelRef: () => void
    let listener: CompatDisposable
    const promise = new Promise((resolve) => {
      listener = once(event)(resolve)
      addToDisposables(listener, disposables)

      // not resolved, matching the behavior of a normal disposal
      cancelRef = () => {
        disposeAndRemove(listener, disposables)
      }
    }) as CancelablePromise<T>
    promise.cancel = cancelRef!

    if (disposables) {
      promise.finally(() => disposeAndRemove(listener, disposables))
    }

    return promise
  }

  /**
   * @en A convenience function for forwarding an event to another emitter which improves
   * readability. This is similar to {@link Relay} but allows instantiating and forwarding on a
   * single line, and also allows for multiple source events.
   *
   * @example
   * ```ts
   * Event.forward(event, emitter)
   * // equivalent to
   * event(e => emitter.fire(e))
   * // equivalent to
   * event(emitter.fire, emitter)
   * ```
   *
   * @zh 把事件转发到另一个 emitter 的便捷写法，可读性比 `event(e => emitter.fire(e))` 好。
   * 与 {@link Relay} 类似，但可以一行内完成创建与转发，也支持多个源事件。
   */
  export function forward<T>(from: Event<T>, to: Emitter<T>): CompatDisposable {
    return from((e) => to.fire(e))
  }

  /**
   * @en Adds a listener to an event and calls the listener immediately with `initial` as the event
   * object — the shape "render the current state, then keep it updated".
   *
   * @example
   * ```ts
   * // Initialize the UI and update it when dataChangeEvent fires
   * runAndSubscribe(dataChangeEvent, () => this._updateUI())
   * ```
   *
   * @zh 订阅事件并立刻用 `initial` 调一次监听器——「先渲染当前状态，再跟着更新」的形态。
   */
  export function runAndSubscribe<T>(
    event: Event<T>,
    handler: (e: T) => unknown,
    initial: T,
  ): CompatDisposable
  export function runAndSubscribe<T>(
    event: Event<T>,
    handler: (e: T | undefined) => unknown,
  ): CompatDisposable
  export function runAndSubscribe<T>(
    event: Event<T>,
    handler: (e: T | undefined) => unknown,
    initial?: T,
  ): CompatDisposable {
    handler(initial)
    return event((e) => handler(e))
  }

  class EmitterObserver<T> implements IObserver {
    readonly emitter: Emitter<T>

    #counter = 0
    #hasChanged = false

    constructor(
      readonly _observable: IObservable<T>,
      store: DisposableStore | undefined,
    ) {
      const options: EmitterOptions = {
        onWillAddFirstListener: () => {
          _observable.addObserver(this)

          // Communicate to the observable that we received its current value and would like to be
          // notified about future changes.
          this._observable.reportChanges()
        },
        onDidRemoveLastListener: () => {
          _observable.removeObserver(this)
        },
      }
      if (!store) {
        _addLeakageTraceLogic(options)
      }
      this.emitter = new Emitter<T>(options)
      if (store) {
        store.add(this.emitter)
      }
    }

    beginUpdate<T>(_observable: IObservable<T>): void {
      this.#counter++
    }

    handlePossibleChange<T>(_observable: IObservable<T>): void {
      // noop
    }

    handleChange<T, TChange>(
      _observable: IObservableWithChange<T, TChange>,
      _change: TChange,
    ): void {
      this.#hasChanged = true
    }

    endUpdate<T>(_observable: IObservable<T>): void {
      this.#counter--
      if (this.#counter === 0) {
        this._observable.reportChanges()
        if (this.#hasChanged) {
          this.#hasChanged = false
          this.emitter.fire(this._observable.get())
        }
      }
    }
  }

  /**
   * @en Creates an event that fires when the observable changes, reading the new value for each
   * notification. The observable is only observed while somebody listens to the event.
   * @zh 观察值变化时触发的事件，每次通知都去读一次新值。只有当有人监听该事件期间才会挂上观察者。
   */
  export function fromObservable<T>(obs: IObservable<T>, store?: DisposableStore): Event<T> {
    const observer = new EmitterObserver(obs, store)
    return observer.emitter.event
  }

  /**
   * @en Same as {@link fromObservable}, but every listener is attached to the observable directly
   * (there is no shared emitter in between) and only the fact that something changed is passed on.
   * Cheaper when the value itself is not needed, more expensive with many listeners.
   * @zh 与 {@link fromObservable} 类似，但每个监听器直接挂到 observable 上（中间没有共享的
   * emitter），并且只传递「变了」这个事实。不需要值时更省，监听器很多时更贵。
   */
  export function fromObservableLight(observable: IObservable<unknown>): Event<void> {
    return (listener, thisArgs, disposables) => {
      let count = 0
      let didChange = false
      const observer: IObserver = {
        beginUpdate() {
          count++
        },
        endUpdate() {
          count--
          if (count === 0) {
            observable.reportChanges()
            if (didChange) {
              didChange = false
              listener.call(thisArgs)
            }
          }
        },
        handlePossibleChange() {
          // noop
        },
        handleChange() {
          didChange = true
        },
      }
      observable.addObserver(observer)
      observable.reportChanges()

      const disposable = toDisposable(() => {
        observable.removeObserver(observer)
      })

      addToDisposables(disposable, disposables)

      return disposable
    }
  }
}

/**
 * @en The hooks an {@link Emitter} exposes around listener bookkeeping. All of them are optional,
 * and every one is only called on the transition it names — `onWillAddFirstListener` fires for the
 * first subscriber, not for the second.
 *
 * Two of them are load-bearing for the combinators in {@link Event}: `onWillAddFirstListener` is
 * how a derived event starts listening to its source, and `onDidRemoveLastListener` is how it stops,
 * which is what keeps an unsubscribed derived event from holding the source alive.
 *
 * @zh {@link Emitter} 在监听器增删前后暴露的钩子。全部可选，且各自只在对应的一次转变时调用——
 * `onWillAddFirstListener` 只在第一个订阅者到来时触发，第二个不会。
 *
 * 其中两个对 {@link Event} 里的组合子至关重要：`onWillAddFirstListener` 是派生事件挂上源的时机，
 * `onDidRemoveLastListener` 是它摘下来的时机，后者正是「没人订阅的派生事件不会拖住源」的原因。
 */
export interface EmitterOptions {
  /**
   * @en Called *before* the very first listener is added.
   * @zh 第一个监听器加入*之前*调用。
   */
  onWillAddFirstListener?: Function
  /**
   * @en Called *after* the very first listener is added.
   * @zh 第一个监听器加入*之后*调用。
   */
  onDidAddFirstListener?: Function
  /**
   * @en Called after a listener is added.
   * @zh 每次有监听器加入后调用。
   */
  onDidAddListener?: Function
  /**
   * @en Called *before* a listener is removed.
   * @zh 监听器移除*之前*调用。
   */
  onWillRemoveListener?: Function
  /**
   * @en Called *after* the very last listener is removed.
   * @zh 最后一个监听器移除*之后*调用。
   */
  onDidRemoveLastListener?: Function
  /**
   * @en Called when a listener throws. Defaults to a `console.error` report (the original in VS Code
   * rethrows instead); the remaining listeners still run either way.
   * @zh 监听器抛错时调用。默认写 `console.error`（VS Code 原版是重新抛出）；两种情况其余监听器
   * 都会照常执行。
   */
  onListenerError?: (e: any) => void
  /**
   * @en Number of listeners allowed before a leak is assumed. Defaults to the globally configured
   * value — see {@link setGlobalLeakWarningThreshold}.
   * @zh 允许的监听器数量上限，超过即认为泄漏。默认取全局配置值，见
   * {@link setGlobalLeakWarningThreshold}。
   */
  leakWarningThreshold?: number
  /**
   * @en Human-readable name for the emitter, included in leak warning messages so a leak can be
   * traced back to its owner.
   * @zh emitter 的可读名字，会写进泄漏告警，便于定位是谁在泄漏。
   */
  leakWarningName?: string
  /**
   * @en Pass in a delivery queue, which is useful for ensuring in-order event delivery across
   * multiple emitters.
   * @zh 传入一个投递队列，用于保证跨多个 emitter 的事件投递顺序。
   */
  deliveryQueue?: EventDeliveryQueue

  /**
   * @en ONLY enable this during development. Names the emitter in {@link EventProfiling.all}.
   * @zh 仅开发期使用。取的名字会出现在 {@link EventProfiling.all} 里。
   */
  _profName?: string
}

/**
 * @en Per-emitter timing, enabled by passing `_profName`. Every instance registers itself in
 * {@link EventProfiling.all} (a `Set` that holds strong references — clear it when done) so a
 * profiling overlay can walk all emitters in the process.
 *
 * @zh 每个 emitter 的耗时统计，通过 `_profName` 开启。每个实例都会把自己登记到
 * {@link EventProfiling.all}（一个持有强引用的 `Set`——用完记得清）里，方便性能面板遍历进程内
 * 全部 emitter。
 */
export class EventProfiling {
  static readonly all = new Set<EventProfiling>()

  private static _idPool = 0

  readonly name: string
  public listenerCount = 0
  public invocationCount = 0
  public elapsedOverall = 0
  public durations: number[] = []

  #startedAt?: number

  constructor(name: string) {
    this.name = `${name}_${EventProfiling._idPool++}`
    EventProfiling.all.add(this)
  }

  start(listenerCount: number): void {
    this.#startedAt = performance.now()
    this.listenerCount = listenerCount
  }

  stop(): void {
    if (this.#startedAt !== undefined) {
      const elapsed = performance.now() - this.#startedAt
      this.durations.push(elapsed)
      this.elapsedOverall += elapsed
      this.invocationCount += 1
      this.#startedAt = undefined
    }
  }
}

let _globalLeakWarningThreshold = -1

/**
 * @en Sets the process-wide leak warning threshold, returning a disposable that restores the
 * previous value — handy in tests that want the warnings on for a single case.
 *
 * @zh 设置进程级的泄漏告警阈值，返回一个可释放对象用于还原旧值——在只想给单个用例打开告警的
 * 测试里很方便。
 */
export function setGlobalLeakWarningThreshold(n: number): CompatDisposable {
  const oldValue = _globalLeakWarningThreshold
  _globalLeakWarningThreshold = n
  return {
    dispose() {
      _globalLeakWarningThreshold = oldValue
    },
  }
}

let leakageMonitorId = 1

function nextLeakageMonitorName(): string {
  return (leakageMonitorId++).toString(16).padStart(3, '0')
}

/**
 * @en Counts listener registrations per call site and reports when one site keeps piling them up.
 * Grouping by stack is what makes the report actionable: "1200 listeners, 1100 of them from the
 * same line" is a bug, "1200 listeners from 1200 places" is a busy emitter.
 * @zh 按调用点统计监听器注册次数，某个调用点越堆越多时上报。按栈分组是这份报告能用的关键：
 * 「1200 个监听器里 1100 个来自同一行」是 bug，「1200 个来自 1200 处」只是这个 emitter 很忙。
 */
class LeakageMonitor {
  #stacks: Map<string, number> | undefined
  #warnCountdown = 0

  constructor(
    private readonly _errorHandler: (err: Error) => void,
    readonly threshold: number,
    readonly name: string = nextLeakageMonitorName(),
  ) {}

  dispose(): void {
    this.#stacks?.clear()
  }

  check(stack: Stacktrace, listenerCount: number): undefined | (() => void) {
    const threshold = this.threshold
    if (threshold <= 0 || listenerCount < threshold) {
      return undefined
    }

    if (!this.#stacks) {
      this.#stacks = new Map()
    }
    const stackKey = stack.value
    const count = this.#stacks.get(stackKey) || 0
    this.#stacks.set(stackKey, count + 1)
    this.#warnCountdown -= 1

    if (this.#warnCountdown <= 0) {
      // only warn on first exceed and then every time the limit
      // is exceeded by 50% again
      this.#warnCountdown = threshold * 0.5

      const [topStack, topCount] = this.getMostFrequentStack()!
      const emitterName = /^[0-9a-f]+$/i.test(this.name) ? undefined : this.name
      const message = `[${this.name}] potential listener LEAK detected, having ${listenerCount} listeners already. MOST frequent listener (${topCount}):`
      console.warn(message)
      console.warn(topStack)

      const kind = topCount / listenerCount > 0.3 ? 'dominated' : 'popular'
      const error = new ListenerLeakError(kind, message, topStack, listenerCount, emitterName)
      this._errorHandler(error)
    }

    return () => {
      const count = this.#stacks!.get(stackKey) || 0
      if (count <= 1) {
        this.#stacks!.delete(stackKey)
      } else {
        this.#stacks!.set(stackKey, count - 1)
      }
    }
  }

  getMostFrequentStack(): [string, number] | undefined {
    if (!this.#stacks) {
      return undefined
    }
    let topStack: [string, number] | undefined
    let topCount = 0
    for (const [stack, count] of this.#stacks) {
      if (!topStack || topCount < count) {
        topStack = [stack, count]
        topCount = count
      }
    }
    return topStack
  }
}

/**
 * @en A captured call stack, kept as a string until somebody asks to print it (capturing is cheap,
 * formatting is not).
 * @zh 一次调用栈快照，在被要求打印之前只以字符串形式保留（抓栈便宜，格式化不便宜）。
 */
class Stacktrace {
  static create() {
    const err = new Error()
    return new Stacktrace(err.stack ?? '')
  }

  private constructor(readonly value: string) {}

  print() {
    console.warn(this.value.split('\n').slice(2).join('\n'))
  }
}

/**
 * @en The error logged when an emitter goes over its configured listener threshold. `kind` is
 * `dominated` when a single call site accounts for most of the listeners (a real leak) and
 * `popular` when they come from everywhere.
 *
 * @zh emitter 超过监听器阈值时记录的错误。`kind` 为 `dominated` 表示绝大多数监听器来自同一个
 * 调用点（真泄漏），`popular` 表示各处都有。
 */
export class ListenerLeakError extends Error {
  readonly kind: string
  readonly listenerCount: number
  /**
   * @en The detailed message including listener count and most frequent stack. Available locally
   * for debugging but intentionally not used as the error `message`.
   * @zh 含监听器数量与最高频调用栈的详细消息。本地调试可用，但刻意不作为 error 的 `message`。
   */
  readonly details: string
  constructor(
    kind: 'dominated' | 'popular',
    details: string,
    stack: string,
    listenerCount: number,
    emitterName?: string,
  ) {
    super(
      emitterName
        ? `[${emitterName}] potential listener LEAK detected, ${kind}`
        : `potential listener LEAK detected, ${kind}`,
    )
    this.name = 'ListenerLeakError'
    this.kind = kind
    this.listenerCount = listenerCount
    this.details = details
    this.stack = stack
  }

  static is(err: unknown): err is ListenerLeakError {
    return (
      err instanceof ListenerLeakError ||
      (err instanceof Error &&
        typeof (err as Error & {kind: unknown; listenerCount: unknown}).kind === 'string' &&
        typeof (err as Error & {kind: unknown; listenerCount: unknown}).listenerCount === 'number')
    )
  }
}

/**
 * @en The severe variant, logged when an emitter has gone so far past its threshold that it refuses
 * to accept new listeners at all (see {@link Emitter.event}).
 * @zh 更严重的一种：emitter 远超阈值时连新监听器都拒绝接受（见 {@link Emitter.event}）。
 */
export class ListenerRefusalError extends ListenerLeakError {
  constructor(
    kind: 'dominated' | 'popular',
    details: string,
    stack: string,
    listenerCount: number,
    emitterName?: string,
  ) {
    super(kind, details, stack, listenerCount, emitterName)
    this.name = 'ListenerRefusalError'
  }
}

let id = 0

/**
 * @en Wraps a listener so it can be identified inside the listener list. A single listener is the
 * most common case for an emitter, so `Emitter` keeps it unwrapped in an array; the container is
 * what makes "remove *this* one" possible without comparing function identity.
 * @zh 包住监听器，使其在监听器列表里可被识别。emitter 只有一个监听器是最常见的情形，因此
 * `Emitter` 会把它单独存放而不用数组；容器的作用是让「移除这一个」不必比较函数身份。
 */
class UniqueContainer<T> {
  stack?: Stacktrace
  public id = id++
  constructor(public readonly value: T) {}
}

const compactionThreshold = 2

type ListenerContainer<T> = UniqueContainer<(data: T) => void>
type ListenerOrListeners<T> = (ListenerContainer<T> | undefined)[] | ListenerContainer<T>

const forEachListener = <T>(
  listeners: ListenerOrListeners<T>,
  fn: (c: ListenerContainer<T>) => void,
) => {
  if (listeners instanceof UniqueContainer) {
    fn(listeners)
  } else {
    for (let i = 0; i < listeners.length; i++) {
      const l = listeners[i]
      if (l) {
        fn(l)
      }
    }
  }
}

/**
 * @en The Emitter can be used to expose an Event to the public to fire it from the insides.
 *
 * @example
 * ```ts
 * class Document {
 *   private readonly _onDidChange = new Emitter<string>()
 *   readonly onDidChange: Event<string> = this._onDidChange.event
 *
 *   private doIt(value: string) {
 *     this._onDidChange.fire(value)
 *   }
 * }
 * ```
 *
 * Three implementation notes worth knowing before changing anything here:
 *
 * 1. **A single listener is stored bare, not in an array.** Most emitters have one subscriber, so
 *    the array (and the allocation that comes with it) is avoided until a second one arrives. A
 *    list never downgrades back to a single container even after removals — swapping between the
 *    two shapes would cost more than the memory it saves.
 * 2. **The listener array can be sparse.** Removal writes `undefined` in place and only compacts
 *    when more than half the slots are holes, so removing listeners is not quadratic.
 * 3. **`fire()` goes through a delivery queue** as soon as there is more than one listener, which
 *    is what makes re-entrant and nested `fire()` calls deliver in order instead of interleaving,
 *    and what makes removing a listener during delivery safe.
 *
 * @zh 对外暴露 `Event`、对内触发的事件发射器。
 *
 * 改动这里之前值得知道的三点实现取舍：
 *
 * 1. **单个监听器直接存放，不进数组。** 大多数 emitter 只有一个订阅者，所以数组（以及随之而来的
 * 分配）等到第二个订阅者出现才产生。列表一旦形成就不会因为移除而退回单个容器——两种形态来回切换
 * 的开销大于省下的内存。
 * 2. **监听器数组可以是稀疏的。** 移除时原位写 `undefined`，只有当空洞超过一半时才压缩，因此移除
 * 监听器不是平方级开销。
 * 3. **一旦监听器多于一个，`fire()` 就走投递队列**，这正是重入与嵌套 `fire()` 能按顺序投递而不是
 * 交错的原因，也是投递过程中移除监听器安全的原因。
 */
export class Emitter<T> {
  private readonly _options?: EmitterOptions
  private readonly _leakWarningThreshold?: number
  private readonly _leakWarningName?: string
  private readonly _leakWarningErrorHandler?: (err: Error) => void
  private _leakageMon?: LeakageMonitor
  private readonly _perfMon?: EventProfiling
  private _disposed?: true
  private _event?: Event<T>

  /**
   * A listener, or list of listeners.
   *
   * `_listeners` and `_size` use TS `protected` rather than `#private` on purpose: subclasses
   * ({@link AsyncEmitter}, {@link PauseableEmitter}, {@link MicrotaskEmitter}) need them, and `#`
   * fields are invisible to subclasses.
   */
  protected _listeners?: ListenerOrListeners<T>

  /**
   * Always to be defined if `_listeners` is an array. It's no longer a true queue, but holds the
   * dispatching 'state'. If `fire()` is called on an emitter, any work left in the `_deliveryQueue`
   * is finished first.
   */
  private _deliveryQueue?: EventDeliveryQueuePrivate
  protected _size = 0

  constructor(options?: EmitterOptions) {
    withDisposeSymbol(Emitter.prototype)
    this._options = options
    if (_globalLeakWarningThreshold > 0 || this._options?.leakWarningThreshold) {
      this._leakWarningThreshold =
        this._options?.leakWarningThreshold ?? _globalLeakWarningThreshold
      this._leakWarningName = this._options?.leakWarningName ?? nextLeakageMonitorName()
      this._leakWarningErrorHandler = this._options?.onListenerError ?? onUnexpectedError
    }
    this._perfMon = this._options?._profName
      ? new EventProfiling(this._options._profName)
      : undefined
    this._deliveryQueue = this._options?.deliveryQueue as EventDeliveryQueuePrivate | undefined
  }

  private _getLeakageMonitor(): LeakageMonitor | undefined {
    if (
      this._leakWarningThreshold === undefined ||
      this._leakWarningName === undefined ||
      this._leakWarningErrorHandler === undefined
    ) {
      return undefined
    }
    this._leakageMon ??= new LeakageMonitor(
      this._leakWarningErrorHandler,
      this._leakWarningThreshold,
      this._leakWarningName,
    )
    return this._leakageMon
  }

  /**
   * @en Detach every listener and make the emitter reuse-proof: subscribing to a disposed emitter
   * returns {@link noopDisposable} instead of registering anything. Disposal is idempotent.
   *
   * Remaining listeners are *not* blamed right away — the popular
   *
   * ```ts
   * store.add(model)          // (1) create and register the model
   * store.add(model.onChange(…))  // (2) subscribe and register the subscription
   * store.dispose()           // disposes (1) then (2)
   * ```
   *
   * pattern would otherwise warn on every teardown.
   *
   * @zh 摘掉所有监听器，并让 emitter 之后不再可用：向已释放的 emitter 订阅会返回
   * {@link noopDisposable} 而不是登记监听器。释放是幂等的。
   *
   * 剩余监听器不会被立刻清算——上方那种「先注册模型、再注册订阅」的常见写法会在每次拆卸时误报。
   */
  dispose() {
    if (!this._disposed) {
      this._disposed = true

      // It is bad to have listeners at the time of disposing an emitter, it is worst to have
      // listeners keep the emitter alive via the reference that is embedded in their disposables.
      if (this._deliveryQueue?.current === this) {
        this._deliveryQueue.reset()
      }
      if (this._listeners) {
        if (_enableDisposeWithListenerWarning) {
          const listeners = this._listeners
          queueMicrotask(() => {
            forEachListener(listeners, (l) => l.stack?.print())
          })
        }

        this._listeners = undefined
        this._size = 0
      }
      this._options?.onDidRemoveLastListener?.()
      this._leakageMon?.dispose()
    }
  }

  /**
   * @en For the public to allow to subscribe to events from this Emitter.
   *
   * The returned function is cached, so `emitter.event === emitter.event` — worth knowing when an
   * effect dependency list has `emitter.event` in it.
   *
   * @zh 供外部订阅本 emitter 的事件。
   *
   * 返回的函数是缓存的，因此 `emitter.event === emitter.event`——effect 依赖数组里写
   * `emitter.event` 时这一点很重要。
   */
  get event(): Event<T> {
    this._event ??= (
      callback: (e: T) => unknown,
      thisArgs?: any,
      disposables?: CompatDisposable[] | DisposableStore,
    ) => {
      if (
        this._leakWarningThreshold !== undefined &&
        this._size > this._leakWarningThreshold ** 2
      ) {
        const leakageMon = this._getLeakageMonitor()
        if (leakageMon) {
          const message = `[${leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${leakageMon.threshold})`
          console.warn(message)

          const tuple = leakageMon.getMostFrequentStack() ?? ['UNKNOWN stack', -1]
          const kind = tuple[1] / this._size > 0.3 ? 'dominated' : 'popular'
          const error = new ListenerRefusalError(
            kind,
            `${message}. HINT: Stack shows most frequent listener (${tuple[1]}-times)`,
            tuple[0],
            this._size,
            this._options?.leakWarningName,
          )
          const errorHandler = this._options?.onListenerError || onUnexpectedError
          errorHandler(error)

          return noopDisposable
        }
      }

      if (this._disposed) {
        // todo: should we warn if a listener is added to a disposed emitter? This happens often
        return noopDisposable
      }

      if (thisArgs) {
        callback = callback.bind(thisArgs)
      }

      const contained = new UniqueContainer(callback)

      let removeMonitor: Function | undefined
      let stack: Stacktrace | undefined
      if (
        this._leakWarningThreshold !== undefined &&
        this._size >= Math.ceil(this._leakWarningThreshold * 0.2)
      ) {
        const leakageMon = this._getLeakageMonitor()
        if (leakageMon) {
          // check and record this emitter for potential leakage
          contained.stack = Stacktrace.create()
          removeMonitor = leakageMon.check(contained.stack, this._size + 1)
        }
      }

      if (_enableDisposeWithListenerWarning) {
        contained.stack = stack ?? Stacktrace.create()
      }

      if (!this._listeners) {
        this._options?.onWillAddFirstListener?.(this)
        this._listeners = contained
        this._options?.onDidAddFirstListener?.(this)
      } else if (this._listeners instanceof UniqueContainer) {
        this._deliveryQueue ??= new EventDeliveryQueuePrivate()
        this._listeners = [this._listeners, contained]
      } else {
        this._listeners.push(contained)
      }
      this._options?.onDidAddListener?.(this)

      this._size++

      const result = toDisposable(() => {
        removeMonitor?.()
        this._removeListener(contained)
      })
      addToDisposables(result, disposables)

      return result
    }

    return this._event
  }

  private _removeListener(listener: ListenerContainer<T>) {
    this._options?.onWillRemoveListener?.(this)

    if (!this._listeners) {
      return // expected if a listener gets disposed
    }

    if (this._size === 1) {
      this._listeners = undefined
      this._options?.onDidRemoveLastListener?.(this)
      this._size = 0
      return
    }

    // size > 1 which requires that listeners be a list:
    const listeners = this._listeners as (ListenerContainer<T> | undefined)[]

    const index = listeners.indexOf(listener)
    if (index === -1) {
      console.error('Attempted to dispose unknown listener', {
        disposed: this._disposed,
        size: this._size,
        listeners: JSON.stringify(this._listeners),
      })
      throw new Error('Attempted to dispose unknown listener')
    }

    this._size--
    listeners[index] = undefined

    const adjustDeliveryQueue = this._deliveryQueue!.current === this
    if (this._size * compactionThreshold <= listeners.length) {
      let n = 0
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i]) {
          listeners[n++] = listeners[i]
        } else if (adjustDeliveryQueue && n < this._deliveryQueue!.end) {
          this._deliveryQueue!.end--
          if (n < this._deliveryQueue!.i) {
            this._deliveryQueue!.i--
          }
        }
      }
      listeners.length = n
    }
  }

  private _deliver(listener: undefined | UniqueContainer<(value: T) => void>, value: T) {
    if (!listener) {
      return
    }

    const errorHandler = this._options?.onListenerError || onUnexpectedError
    if (!errorHandler) {
      listener.value(value)
      return
    }

    try {
      listener.value(value)
    } catch (e) {
      errorHandler(e)
    }
  }

  /** Delivers items in the queue. Assumes the queue is ready to go. */
  private _deliverQueue(dq: EventDeliveryQueuePrivate) {
    const listeners = dq.current!._listeners! as (ListenerContainer<T> | undefined)[]
    while (dq.i < dq.end) {
      // important: dq.i is incremented before calling deliver() because it might reenter deliverQueue()
      this._deliver(listeners[dq.i++], dq.value as T)
    }
    dq.reset()
  }

  /**
   * @en To be kept private to fire an event to subscribers.
   *
   * Fire order is definition order, and it is stable across re-entrant calls: if a listener fires
   * the same emitter again, the nested delivery finishes before the outer loop continues.
   *
   * @zh 触发事件（对外不开放）。投递顺序即注册顺序，并且在重入时保持稳定：如果某个监听器再次触发
   * 同一个 emitter，嵌套的那一轮会先投递完，外层循环才继续。
   */
  fire(event: T): void {
    if (this._deliveryQueue?.current) {
      this._deliverQueue(this._deliveryQueue)
      this._perfMon?.stop() // last fire() will have starting perfmon, stop it before starting the next dispatch
    }

    this._perfMon?.start(this._size)

    if (!this._listeners) {
      // no-op
    } else if (this._listeners instanceof UniqueContainer) {
      this._deliver(this._listeners, event)
    } else {
      const dq = this._deliveryQueue!
      dq.enqueue(this, event, this._listeners.length)
      this._deliverQueue(dq)
    }

    this._perfMon?.stop()
  }

  /**
   * @en Whether anybody is listening right now. Useful to skip building an expensive event object
   * nobody will receive.
   * @zh 当前是否有人监听。可以在没人接收时省掉构造昂贵的事件对象。
   */
  hasListeners(): boolean {
    return this._size > 0
  }
}

// -------------------------------------------------------------------------------------------------
// 投递队列：让多个 emitter 共享同一份投递状态，从而保证它们之间的事件顺序。
// -------------------------------------------------------------------------------------------------

/**
 * @en A marker interface for an event delivery queue. Pass an instance to
 * {@link EmitterOptions.deliveryQueue} to make several emitters share one dispatch order — without
 * it, each emitter keeps its own and interleaved fires can be observed out of order.
 * @zh 事件投递队列的标记接口。传给 {@link EmitterOptions.deliveryQueue} 可让多个 emitter 共享同一
 * 份投递顺序——不共享时各 emitter 各持一份，交错触发在观察者看来会乱序。
 */
export interface EventDeliveryQueue {
  _isEventDeliveryQueue: true
}

/**
 * @en Creates a delivery queue to share between emitters.
 * @zh 创建一个可在多个 emitter 之间共享的投递队列。
 */
export const createEventDeliveryQueue = (): EventDeliveryQueue => new EventDeliveryQueuePrivate()

class EventDeliveryQueuePrivate implements EventDeliveryQueue {
  declare _isEventDeliveryQueue: true

  /**
   * Index in current's listener list.
   */
  public i = -1

  /**
   * The last index in the listener's list to deliver.
   */
  public end = 0

  /**
   * Emitter currently being dispatched on. Emitter._listeners is always an array.
   */
  public current?: Emitter<any>
  /**
   * Currently emitting value. Defined whenever `current` is.
   */
  public value?: unknown

  public enqueue<T>(emitter: Emitter<T>, value: T, end: number) {
    this.i = 0
    this.end = end
    this.current = emitter
    this.value = value
  }

  public reset() {
    this.i = this.end // force any current emission loop to stop, mainly for during dispose
    this.current = undefined
    this.value = undefined
  }
}

/**
 * @en The contract {@link AsyncEmitter} requires of the event object it hands to listeners: a
 * cancellation token, plus a way to keep the delivery waiting for asynchronous work.
 * @zh {@link AsyncEmitter} 交给监听器的事件对象所需满足的约定：一个取消令牌，以及一种让投递等待
 * 异步工作的方式。
 */
export interface IWaitUntil {
  token: CancellationToken
  waitUntil(thenable: Promise<unknown>): void
}

/**
 * @en The data half of an {@link IWaitUntil} event object — what the caller passes to
 * {@link AsyncEmitter.fireAsync}, with `token` and `waitUntil` added per listener.
 * @zh {@link IWaitUntil} 事件对象的数据部分——调用方传给 {@link AsyncEmitter.fireAsync} 的内容，
 * `token` 与 `waitUntil` 由框架按监听器补上。
 */
export type IWaitUntilData<T> = Omit<Omit<T, 'waitUntil'>, 'token'>

/**
 * @en An emitter whose `fireAsync` awaits each listener in turn, in registration order, and lets a
 * listener extend its own turn with `waitUntil(promise)`.
 *
 * This is the "listener can veto / must finish before the next one runs" shape used for things like
 * save-participants: every participant gets a chance to contribute, and delivery only moves on once
 * they are done. Failures are reported through `onUnexpectedError` and do not stop the others.
 *
 * @zh 一个「依次等待每个监听器」的 emitter：按注册顺序逐个 await，监听器可以用
 * `waitUntil(promise)` 延长自己这一轮。
 *
 * 这是「监听器可以拦一下 / 必须处理完才轮到下一个」的形态，例如保存参与者：每个参与者都有机会
 * 参与，全部处理完才继续往下。失败通过 `onUnexpectedError` 上报，不影响其余监听器。
 */
export class AsyncEmitter<T extends IWaitUntil> extends Emitter<T> {
  private _asyncDeliveryQueue?: LinkedList<[(ev: T) => void, IWaitUntilData<T>]>

  /**
   * @en Deliver `data` to every current listener in order, awaiting each one and any promise it
   * registered through `waitUntil` before moving on. Stops early once `token` is cancelled; the
   * listeners already reached have run.
   *
   * @param data The event object, without `token`/`waitUntil` (added per listener).
   * @param token Cancellation for the whole delivery.
   * @param promiseJoin Lets the caller wrap each awaited promise, e.g. to add a timeout or to
   * attribute it to the listener for progress reporting.
   *
   * @zh 按顺序把 `data` 投递给当前每个监听器，逐个等待，并且等它通过 `waitUntil` 注册的 promise
   * 都结算后才继续。`token` 被取消时提前结束；已经轮到的监听器已经执行过。
   */
  async fireAsync(
    data: IWaitUntilData<T>,
    token: CancellationToken,
    promiseJoin?: (p: Promise<unknown>, listener: Function) => Promise<unknown>,
  ): Promise<void> {
    if (!this._listeners) {
      return
    }

    if (!this._asyncDeliveryQueue) {
      this._asyncDeliveryQueue = new LinkedList()
    }

    forEachListener(this._listeners, (listener) =>
      this._asyncDeliveryQueue!.push([listener.value, data]),
    )

    while (this._asyncDeliveryQueue.size > 0 && !token.isCancellationRequested) {
      const [listener, data] = this._asyncDeliveryQueue.shift()!
      const thenables: Promise<unknown>[] = []

      const event = <T>{
        ...data,
        token,
        waitUntil: (p: Promise<unknown>): void => {
          if (Object.isFrozen(thenables)) {
            throw new Error('waitUntil can NOT be called asynchronous')
          }
          if (promiseJoin) {
            p = promiseJoin(p, listener)
          }
          thenables.push(p)
        },
      }

      try {
        listener(event)
      } catch (e) {
        onUnexpectedError(e)
        continue
      }

      // freeze thenables-collection to enforce sync-calls to
      // wait until and then wait for all thenables to resolve
      Object.freeze(thenables)

      await Promise.allSettled(thenables).then((values) => {
        for (const value of values) {
          if (value.status === 'rejected') {
            onUnexpectedError(value.reason)
          }
        }
      })
    }
  }
}

/**
 * @en An emitter whose events can be held back and replayed later. Useful when changes arrive
 * during a batch of work and the subscribers should see them only once the batch is done.
 *
 * Nesting is counted: every `pause()` needs its own `resume()`, and only the last one flushes.
 * While paused nothing is delivered, so a subscriber attached *during* the pause sees nothing until
 * the flush — which is the point.
 *
 * @zh 可以先把事件按住、之后再回放的 emitter。适合「一批工作期间到达的变更，希望订阅者等这批做完
 * 才看到」的场景。
 *
 * 暂停是计数的：每次 `pause()` 都要配一次 `resume()`，只有最后一次会冲刷。暂停期间不投递任何
 * 事件，因此在暂停**期间**挂上的订阅者在冲刷前什么都看不到——这正是它的用途。
 */
export class PauseableEmitter<T> extends Emitter<T> {
  private _isPaused = 0
  /** @zh 暂停期间积压的事件。`@en` Events accumulated while paused. */
  protected _eventQueue = new LinkedList<T>()
  private _mergeFn?: (input: T[]) => T

  /**
   * @en Whether the emitter is currently holding events back.
   * @zh 当前是否处于「按住事件」的状态。
   */
  public get isPaused(): boolean {
    return this._isPaused !== 0
  }

  constructor(options?: EmitterOptions & {merge?: (input: T[]) => T}) {
    super(options)
    this._mergeFn = options?.merge
  }

  /**
   * @en Hold back further events. Counted, so nested pauses need matching resumes.
   * @zh 按住后续事件。计数式，因此嵌套暂停需要一一对应地恢复。
   */
  pause(): void {
    this._isPaused++
  }

  /**
   * @en Release the most recent pause; when the count reaches zero, deliver what accumulated — as
   * one merged event if `merge` was given, otherwise one by one (and a listener that pauses again
   * mid-flush stops the loop, leaving the rest queued).
   * @zh 解除最近一次暂停；计数归零时投递积压的事件——给了 `merge` 就合并成一个，否则逐个投递
   * （某个监听器在冲刷过程中再次暂停会中止循环，剩余事件留在队列里）。
   */
  resume(): void {
    if (this._isPaused !== 0 && --this._isPaused === 0) {
      if (this._mergeFn) {
        // use the merge function to create a single composite
        // event. make a copy in case firing pauses this emitter
        if (this._eventQueue.size > 0) {
          const events = Array.from(this._eventQueue)
          this._eventQueue.clear()
          super.fire(this._mergeFn(events))
        }
      } else {
        // no merging, fire each event individually and test
        // that this emitter isn't paused halfway through
        while (!this._isPaused && this._eventQueue.size !== 0) {
          super.fire(this._eventQueue.shift()!)
        }
      }
    }
  }

  override fire(event: T): void {
    if (this._size) {
      if (this._isPaused !== 0) {
        this._eventQueue.push(event)
      } else {
        super.fire(event)
      }
    }
  }
}

/**
 * @en Like {@link PauseableEmitter}, but the pause starts by itself on the first `fire()` and lifts
 * after `delay` — so a burst collapses into one merged event.
 * @zh 与 {@link PauseableEmitter} 类似，但暂停由第一次 `fire()` 自动开始、`delay` 后自动解除——
 * 一串密集触发因此塌缩成一次合并事件。
 */
export class DebounceEmitter<T> extends PauseableEmitter<T> {
  private readonly _delay: number
  private _handle: ReturnType<typeof setTimeout> | undefined

  constructor(options: EmitterOptions & {merge: (input: T[]) => T; delay?: number}) {
    super(options)
    this._delay = options.delay ?? 100
  }

  override fire(event: T): void {
    if (!this._handle) {
      this.pause()
      this._handle = setTimeout(() => {
        this._handle = undefined
        this.resume()
      }, this._delay)
    }
    super.fire(event)
  }
}

/**
 * @en An emitter which queues all events and processes them at the end of the current task.
 *
 * Note the difference from {@link PauseableEmitter}: nobody has to resume this one, and a fire with
 * no listeners is dropped (there is no point queueing for nobody).
 *
 * @zh 把事件排队、在本轮任务末尾统一处理的 emitter。
 *
 * 与 {@link PauseableEmitter} 的区别：这里不需要谁来恢复；而且没有监听器时直接丢弃（没人为之排队）。
 */
export class MicrotaskEmitter<T> extends Emitter<T> {
  private _queuedEvents: T[] = []
  private _mergeFn?: (input: T[]) => T

  constructor(options?: EmitterOptions & {merge?: (input: T[]) => T}) {
    super(options)
    this._mergeFn = options?.merge
  }

  override fire(event: T): void {
    if (!this.hasListeners()) {
      return
    }

    this._queuedEvents.push(event)
    if (this._queuedEvents.length === 1) {
      queueMicrotask(() => {
        if (this._mergeFn) {
          super.fire(this._mergeFn(this._queuedEvents))
        } else {
          this._queuedEvents.forEach((e) => super.fire(e))
        }
        this._queuedEvents = []
      })
    }
  }
}

/**
 * @en An event emitter that multiplexes many events into a single event.
 *
 * @example
 * ```ts
 * // Listen to the `onData` event of all `Thing`s, dynamically adding and removing `Thing`s
 * // to the multiplexer as needed.
 * const anythingDataMultiplexer = new EventMultiplexer<{ data: string }>()
 * const thingListeners = new DisposableMap<Thing, CompatDisposable>()
 *
 * thingService.onDidAddThing(thing => {
 *   thingListeners.set(thing, anythingDataMultiplexer.add(thing.onData))
 * })
 * thingService.onDidRemoveThing(thing => {
 *   thingListeners.deleteAndDispose(thing)
 * })
 *
 * anythingDataMultiplexer.event(e => {
 *   console.log('Something fired data ' + e.data)
 * })
 * ```
 *
 * @zh 把多个事件汇聚成一个事件。
 *
 * 关键语义：源事件只在**有人订阅聚合事件**期间才被挂上（`add()` 在无人订阅时只是登记，不挂钩），
 * 最后一个订阅者离开时全部摘下。
 */
export class EventMultiplexer<T> implements CompatDisposable {
  private readonly emitter: Emitter<T>
  private hasListeners = false
  private events: {event: Event<T>; listener: CompatDisposable | null}[] = []

  constructor() {
    withDisposeSymbol(EventMultiplexer.prototype)
    this.emitter = new Emitter<T>({
      onWillAddFirstListener: () => this.onFirstListenerAdd(),
      onDidRemoveLastListener: () => this.onLastListenerRemove(),
    })
  }

  /**
   * @en The aggregated event.
   * @zh 聚合后的事件。
   */
  get event(): Event<T> {
    return this.emitter.event
  }

  /**
   * @en Add a source event, returning a handle that removes it again. Disposing the handle twice is
   * safe; removing a source while nobody listens just unregisters it.
   * @zh 加入一个源事件，返回用于移除它的句柄。重复释放该句柄是安全的；无人订阅时移除源只是取消
   * 登记。
   */
  add(event: Event<T>): CompatDisposable {
    const e = {event: event, listener: null}
    this.events.push(e)

    if (this.hasListeners) {
      this.hook(e)
    }

    const dispose = () => {
      if (this.hasListeners) {
        this.unhook(e)
      }

      const idx = this.events.indexOf(e)
      if (idx !== -1) {
        this.events.splice(idx, 1)
      }
    }

    return toDisposable(createSingleCallFunction(dispose))
  }

  private onFirstListenerAdd(): void {
    this.hasListeners = true
    this.events.forEach((e) => this.hook(e))
  }

  private onLastListenerRemove(): void {
    this.hasListeners = false
    this.events.forEach((e) => this.unhook(e))
  }

  private hook(e: {event: Event<T>; listener: CompatDisposable | null}): void {
    e.listener = e.event((r) => this.emitter.fire(r))
  }

  private unhook(e: {event: Event<T>; listener: CompatDisposable | null}): void {
    e.listener?.dispose()
    e.listener = null
  }

  /**
   * @en Unhook every source and dispose the aggregated emitter. The multiplexer cannot be reused
   * afterwards.
   * @zh 摘掉所有源并释放聚合 emitter。之后不能再用。
   */
  dispose(): void {
    this.emitter.dispose()

    for (const e of this.events) {
      e.listener?.dispose()
    }
    this.events = []
  }
}

/**
 * @en The public face of {@link DynamicListEventMultiplexer}: an aggregated event plus disposal.
 * @zh {@link DynamicListEventMultiplexer} 的公开形态：聚合事件加释放能力。
 */
export interface IDynamicListEventMultiplexer<TEventType> extends CompatDisposable {
  readonly event: Event<TEventType>
}

/**
 * @en Aggregates one event per item of a list that changes over time: items already present are
 * hooked immediately, and the `onAddItem` / `onRemoveItem` events keep it in sync as the list
 * changes. Each item's subscription is owned by a {@link DisposableMap}, so removing an item
 * unhooks exactly that item.
 *
 * @zh 汇聚「随时间变化的列表」中每项的一个事件：已有项立刻挂钩，之后由 `onAddItem` /
 * `onRemoveItem` 保持同步。每项的订阅由 {@link DisposableMap} 持有，因此移除某项只摘掉那一项。
 */
export class DynamicListEventMultiplexer<TItem, TEventType>
  implements IDynamicListEventMultiplexer<TEventType>
{
  private readonly _store = new DisposableStore()

  readonly event: Event<TEventType>

  constructor(
    items: TItem[],
    onAddItem: Event<TItem>,
    onRemoveItem: Event<TItem>,
    getEvent: (item: TItem) => Event<TEventType>,
  ) {
    withDisposeSymbol(DynamicListEventMultiplexer.prototype)
    const multiplexer = this._store.add(new EventMultiplexer<TEventType>())
    const itemListeners = this._store.add(new DisposableMap<TItem, CompatDisposable>())

    function addItem(instance: TItem) {
      itemListeners.set(instance, multiplexer.add(getEvent(instance)))
    }

    // Existing items
    for (const instance of items) {
      addItem(instance)
    }

    // Added items
    this._store.add(
      onAddItem((instance) => {
        addItem(instance)
      }),
    )

    // Removed items
    this._store.add(
      onRemoveItem((instance) => {
        itemListeners.deleteAndDispose(instance)
      }),
    )

    this.event = multiplexer.event
  }

  /**
   * @en Unhook everything: the item listeners, the two list events and the multiplexer.
   * @zh 摘掉所有东西：各项的监听、两个列表事件，以及 multiplexer 本身。
   */
  dispose() {
    this._store.dispose()
  }
}

/**
 * @en The EventBufferer is useful in situations in which you want to delay firing your events
 * during some code. You can wrap that code and be sure that the event will not be fired during that
 * wrap.
 *
 * ```
 * const emitter: Emitter
 * const delayer = new EventBufferer()
 * const delayedEvent = delayer.wrapEvent(emitter.event)
 *
 * delayedEvent(console.log)
 *
 * delayer.bufferEvents(() => {
 *   emitter.fire() // event will not be fired yet
 * })
 *
 * // event will only be fired at this point
 * ```
 *
 * @zh 用于「某段代码期间先别触发事件」的场景：把那段代码包起来，事件在这段包裹期间不会触发，
 * 结束后统一投递（见上方示例）。
 */
export class EventBufferer {
  private data: {buffers: Function[]}[] = []

  /**
   * @en Wrap an event so it is buffered while a {@link bufferEvents} call is active.
   *
   * With `reduce`, all events buffered during the wrap collapse into one call carrying the merged
   * value. Without it, every event is replayed one by one afterwards.
   *
   * **Known upstream limitation of the `reduce` form:** it is only correct with a single listener on
   * the returned event. With two or more, each listener pushes the same event into the shared
   * accumulator (so `fire(1)` + `fire(2)` with two listeners reduces `1+1+2+2`), and only the first
   * listener to arrive gets notified at flush time. This is the original implementation's behaviour,
   * kept as-is rather than silently diverging; use the non-reduce form (or `Event.accumulate`) when
   * the derived event has several subscribers.
   *
   * @zh 包一个事件，使其在 {@link bufferEvents} 生效期间被缓冲。
   *
   * 给了 `reduce` 时，包裹期间缓冲的全部事件会合并成一次投递；不给则结束后逐个回放。
   *
   * **`reduce` 形式的上游已知限制：** 只有返回的事件「恰好一个监听器」时才是正确的。有两个及以上
   * 监听器时，每个监听器都会把同一个事件推进共享累加器（于是两个监听器下 `fire(1)`+`fire(2)` 会
   * 累加成 `1+1+2+2`），而且冲刷时只有最先到的那个监听器收到通知。这是原版实现的行为，这里原样
   * 保留而不是悄悄改掉；派生事件有多个订阅者时请用非 reduce 形式（或 `Event.accumulate`）。
   */
  wrapEvent<T>(event: Event<T>): Event<T>
  wrapEvent<T>(event: Event<T>, reduce: (last: T | undefined, event: T) => T): Event<T>
  wrapEvent<T, O>(
    event: Event<T>,
    reduce: (last: O | undefined, event: T) => O,
    initial: O,
  ): Event<O>
  wrapEvent<T, O>(
    event: Event<T>,
    reduce?: (last: T | O | undefined, event: T) => T | O,
    initial?: O,
  ): Event<O | T> {
    return (listener, thisArgs?, disposables?) => {
      return event(
        (i) => {
          const data = this.data[this.data.length - 1]

          // Non-reduce scenario
          if (!reduce) {
            // Buffering case
            if (data) {
              data.buffers.push(() => listener.call(thisArgs, i))
            } else {
              // Not buffering case
              listener.call(thisArgs, i)
            }
            return
          }

          // Reduce scenario
          const reduceData = data as typeof data & {
            /**
             * The accumulated items that will be reduced.
             */
            items?: T[]
            /**
             * The reduced result cached to be shared with other listeners.
             */
            reducedResult?: T | O
          }

          // Not buffering case
          if (!reduceData) {
            listener.call(thisArgs, reduce(initial, i))
            return
          }

          // Buffering case
          reduceData.items ??= []
          reduceData.items.push(i)
          if (reduceData.buffers.length === 0) {
            // Include a single buffered function that will reduce all events when we're done
            // buffering events
            data.buffers.push(() => {
              // cache the reduced result so that the value can be shared across all listeners
              reduceData.reducedResult ??= initial
                ? reduceData.items!.reduce(reduce as (last: O | undefined, event: T) => O, initial)
                : reduceData.items!.reduce(reduce as (last: T | undefined, event: T) => T)
              listener.call(thisArgs, reduceData.reducedResult)
            })
          }
        },
        undefined,
        disposables,
      )
    }
  }

  /**
   * @en Run `fn` with buffering on, then flush.
   *
   * Two behaviours worth knowing, both inherited from the original:
   *
   * - Nested calls each own a layer, and **every layer flushes its own buffers when it ends** — so
   *   an event fired inside the inner call is delivered before an event fired before it in the outer
   *   call. Nesting therefore reverses the order of what each layer buffered; if that matters, do
   *   not nest.
   * - A throw inside `fn` still flushes what was buffered so far (the layer is popped and flushed on
   *   the way out) and then propagates.
   *
   * @zh 在开启缓冲的情况下执行 `fn`，随后冲刷。
   *
   * 两个由原版继承来的行为值得知道：
   *
   * - 嵌套时每一层各管一层缓冲，**且每一层在结束时都会冲刷自己缓冲的事件**——于是「内层调用里
   *   触发的事件」会排在「外层调用里更早触发的事件」前面。嵌套会反转各层缓冲内容的顺序；在意顺序
   *   就不要嵌套。
   * - `fn` 抛错时已缓冲的内容仍会被冲刷（该层弹栈并冲刷），然后继续向上抛出。
   */
  bufferEvents<R = void>(fn: () => R): R {
    const data = {buffers: new Array<Function>()}
    this.data.push(data)
    try {
      return fn()
    } finally {
      this.data.pop()
      data.buffers.forEach((flush) => flush())
    }
  }
}

/**
 * @en A Relay is an event forwarder which functions as a replugable event pipe. Once created, you
 * can connect an input event to it and it will simply forward events from that input event through
 * its own `event` property. The `input` can be changed at any point in time.
 *
 * @zh 可换源的转发管道。创建后把输入事件接到它上面，它就把该输入事件通过自己的 `event` 转发出去；
 * `input` 随时可以更换。
 */
export class Relay<T> implements CompatDisposable {
  private listening = false
  private inputEvent: Event<T> = Event.None
  private inputEventListener: CompatDisposable = noopDisposable

  private readonly emitter = new Emitter<T>({
    onDidAddFirstListener: () => {
      this.listening = true
      this.inputEventListener = this.inputEvent(this.emitter.fire, this.emitter)
    },
    onDidRemoveLastListener: () => {
      this.listening = false
      this.inputEventListener.dispose()
    },
  })

  constructor() {
    withDisposeSymbol(Relay.prototype)
  }

  /** @zh 转发出去的事件。`@en` The forwarded event. */
  readonly event: Event<T> = this.emitter.event

  /**
   * @en Point the relay at a new source. While somebody is listening the old subscription is
   * replaced immediately; otherwise the new source is only used the next time the first listener
   * arrives.
   * @zh 把中继指向新的源。有人监听时立刻换掉旧的订阅；否则新源要等下次第一个监听器到来才被使用。
   */
  set input(event: Event<T>) {
    this.inputEvent = event

    if (this.listening) {
      this.inputEventListener.dispose()
      this.inputEventListener = event(this.emitter.fire, this.emitter)
    }
  }

  /**
   * @en Detach the input and dispose the internal emitter.
   * @zh 摘掉输入并释放内部 emitter。
   */
  dispose() {
    this.inputEventListener.dispose()
    this.emitter.dispose()
  }
}

/**
 * @en A value plus a notification that it changed — the read-anytime counterpart to {@link Event}.
 * The event carries no payload; read `value` when you need it.
 * @zh 「值 + 变更通知」——{@link Event} 的「随时可读」对应物。事件不带载荷，需要时去读 `value`。
 */
export interface IValueWithChangeEvent<T> {
  readonly onDidChange: Event<void>
  get value(): T
}

/**
 * @en The mutable, self-contained implementation of {@link IValueWithChangeEvent}: writing `value`
 * fires `onDidChange`, but only when the new value differs (`!==`) from the current one.
 *
 * @example
 * ```ts
 * const selection = new ValueWithChangeEvent<string | undefined>(undefined)
 * const sub = selection.onDidChange(() => console.log(selection.value))
 * selection.value = 'a' // logs 'a'
 * selection.value = 'a' // nothing — same reference
 * ```
 *
 * @zh {@link IValueWithChangeEvent} 的可变实现：写 `value` 会触发 `onDidChange`，但只在 `!==`
 * 意义上确实变了时触发。
 */
export class ValueWithChangeEvent<T> implements IValueWithChangeEvent<T> {
  /**
   * @en A value that never changes, exposing {@link Event.None} as its event — cheaper than a real
   * instance when the value is fixed.
   * @zh 不变的值，事件就是 {@link Event.None}——值固定时比真造一个实例更省。
   */
  public static const<T>(value: T): IValueWithChangeEvent<T> {
    return new ConstValueWithChangeEvent(value)
  }

  private readonly _onDidChange = new Emitter<void>()
  readonly onDidChange: Event<void> = this._onDidChange.event

  constructor(private _value: T) {}

  /** @zh 当前值。`@en` The current value. */
  get value(): T {
    return this._value
  }

  set value(value: T) {
    if (value !== this._value) {
      this._value = value
      this._onDidChange.fire(undefined)
    }
  }
}

class ConstValueWithChangeEvent<T> implements IValueWithChangeEvent<T> {
  public readonly onDidChange: Event<void> = Event.None

  constructor(readonly value: T) {}
}

/**
 * @en Keep a {@link DisposableMap} in sync with a set that lives elsewhere: `handleItem` is called
 * for each item in the set (only the first time it is seen), and the disposable it returns is
 * disposed once the item leaves the set.
 *
 * Returns a single disposable that ends the tracking — disposing it does *not* dispose the handles
 * of items still in the set (they are owned by the returned store the caller may keep).
 *
 * @param getData Reads the current set.
 * @param onDidChangeData Tells when to re-read it.
 * @param handleItem Is called for each item in the set (but only the first time the item is seen in
 * the set). The returned disposable is disposed if the item is no longer in the set.
 *
 * @zh 让一个 {@link DisposableMap} 跟随别处维护的集合：集合里每出现一项就调用一次 `handleItem`
 * （只在第一次见到该项时调用），该项离开集合时释放它返回的句柄。
 *
 * 返回一个用于结束追踪的可释放对象——释放它**不会**连带上集合里仍在的那些句柄（它们归调用方持有的
 * 那个 store 管）。
 */
export function trackSetChanges<T>(
  getData: () => ReadonlySet<T>,
  onDidChangeData: Event<unknown>,
  handleItem: (d: T) => CompatDisposable,
): CompatDisposable {
  const map = new DisposableMap<T, CompatDisposable>()
  let oldData = new Set(getData())
  for (const d of oldData) {
    map.set(d, handleItem(d))
  }

  const store = new DisposableStore()
  store.add(
    onDidChangeData(() => {
      const newData = getData()
      const diff = diffSets(oldData, newData)
      for (const r of diff.removed) {
        map.deleteAndDispose(r)
      }
      for (const a of diff.added) {
        map.set(a, handleItem(a))
      }
      oldData = new Set(newData)
    }),
  )
  store.add(map)
  return store
}

/**
 * @en Register `result` in either flavour of `disposables` argument the `Event` API accepts. The
 * store owns it (and disposes it on a disposed store); the array is just collected.
 * @zh 把 `result` 登记进 `Event` API 接受的两种 `disposables` 参数之一。store 会接管它（对已释放
 * 的 store 则立刻释放）；数组只是收集。
 */
function addToDisposables(
  result: CompatDisposable,
  disposables: DisposableStore | CompatDisposable[] | undefined,
) {
  if (disposables instanceof DisposableStore) {
    disposables.add(result)
  } else if (Array.isArray(disposables)) {
    disposables.push(result)
  }
}

/**
 * @en Remove `result` from `disposables` **and** dispose of it — used when a promise settles or a
 * wait is cancelled, so the caller's array/store does not keep a dead subscription around.
 * @zh 从 `disposables` 中移除 `result` **并**释放它——promise 结算或等待被取消时使用，避免调用方
 * 的数组/store 里留着一个已经死掉的订阅。
 */
function disposeAndRemove(
  result: CompatDisposable,
  disposables: DisposableStore | CompatDisposable[] | undefined,
) {
  if (disposables instanceof DisposableStore) {
    disposables.delete(result)
  } else if (Array.isArray(disposables)) {
    const index = disposables.indexOf(result)
    if (index !== -1) {
      disposables.splice(index, 1)
    }
  }
  result.dispose()
}
