import {useEffect, useRef, useState} from 'react'
import type {Event} from '../utils'

/**
 * @en React bindings for the {@link Emitter} / {@link Event} system: subscribe for as long as a
 * component is alive, turn "the last thing that happened" into something renderable, and hand out
 * callbacks that are stable *and* see the latest props.
 *
 * Three non-obvious decisions are shared by everything here:
 *
 * 1. **Subscriptions live in an effect, never during render.** The effect body subscribes and the
 *    cleanup unsubscribes, which is also what makes `StrictMode` (mount → unmount → mount) safe. A
 *    subscription created during render would double up on every commit, and one disposed in a
 *    cleanup that lives outside the effect (a `useMemo`/`useRef` store) would already be dead on the
 *    second mount — the subscription silently stops working, which is exactly the failure this
 *    shape avoids.
 * 2. **The listener is stabilised, the *event* is not.** A re-render must not resubscribe, so the
 *    callback is forwarded through a ref ({@link useEventCallback}) and the subscription depends on
 *    the event identity alone. That puts the burden on the event: `emitter.event` is cached and
 *    stable, but `Event.map(ev, fn)` returns a fresh event on every call, so a derived event has to
 *    be created once (`useMemo`, or a `DisposableStore` on the source) instead of inline in JSX. The
 *    ref itself is written **during render** rather than from an effect, so an event fired between
 *    render and commit already sees the new closure; last write wins, which is why neither
 *    StrictMode's double render nor a discarded concurrent render leaves a wrong closure behind.
 * 3. **Missing an event is the caller's model, not a bug to paper over.** Events are hot: anything
 *    fired between render and the effect is gone. `Event.buffer` is the opt-in fix, and
 *    {@link useEventValue} covers "I need the current value *and* to follow changes" — neither is
 *    forced on everyone.
 *
 * What is deliberately *not* here: no `useSyncExternalStore` (there is no shared snapshot to stay
 * consistent with — {@link useEventValue} caches the last payload per component, so there is nothing
 * to tear), and no subscription handle returned from the hooks (it would be a new object every
 * render). Subscribing outside a component's lifetime is `DisposableStore`'s job.
 *
 * @zh {@link Emitter} / {@link Event} 的 React 绑定：跟着组件生死订阅、把「最近发生的事」变成可渲染
 * 的东西、给出既稳定又能读到最新 props 的回调。
 *
 * 这里所有 hook 共享三个不显然的决定：
 *
 * 1. **订阅建在 effect 里，绝不在渲染期订阅。** effect 体订阅、清理函数退订，这也是 `StrictMode`
 *    （挂载 → 卸载 → 再挂载）下依然正确的原因。渲染期建立的订阅会随每次提交翻倍；而把 store 放在
 *    effect 外（`useMemo`/`useRef`）、在清理函数里 dispose，第二次挂载拿到的就已经是死的——
 *    订阅会静默失效，正是这个形状要规避的失败。
 * 2. **稳定的是监听器，不是事件。** 重渲染不该重订阅，所以回调经由 ref 转发
 *    （{@link useEventCallback}），订阅只依赖事件身份。这反过来对事件提出了要求：
 *    `emitter.event` 是缓存过的稳定引用，而 `Event.map(ev, fn)` 每次调用都返回新事件——派生事件必须
 *    只建一次（放进 `useMemo`，或绑到源上的 `DisposableStore`），不能写在 JSX 里。ref 本身在**渲染期**
 *    写入而不是放进 effect：这样才能让「渲染到提交之间」触发的事件也拿到新闭包；写入是「最后一次为准」，
 *    所以 StrictMode 双跑与并发渲染丢弃分支都不会留下错误的闭包（被丢弃那一轮的闭包可能短暂留在 ref 里，
 *    直到下一次提交覆盖它，但两者的取值语义相同）。
 * 3. **漏掉事件是使用者的模型问题，不用统一兜住。** 事件是热的：渲染到 effect 之间触发的事件不会
 *    补发。想缓冲用 `Event.buffer`，「既要当前值又要跟变更」用 {@link useEventValue}——两者都不强加
 *    给所有人。
 *
 * 刻意没做的：没有用 `useSyncExternalStore`（这里没有需要保持一致性的共享快照，{@link useEventValue}
 * 只在组件本地缓存最后一次载荷，不存在 tearing），hook 也不返回订阅句柄（那会是每次渲染都新建的对象）。
 * 组件生命周期之外的订阅交给 `DisposableStore`。
 */

type AnyFunction = (...args: any[]) => any

/**
 * @description - 返回一个身份稳定、但总能读到最新一次渲染闭包的函数。
 * - 身份稳定：组件整个生命周期内引用不变，可以安全地作为依赖项或传给子组件，不必为了「别变」而
 *   维护 `useCallback` 的一长串依赖。
 * - 最新闭包：调用时读到的是**当前**那次渲染的 props / state，因此适合放进事件监听、定时器、异步
 *   回调里——这些地方的旧闭包问题是同一类 bug 的常见来源。
 * - 与 React 19 的 `useEffectEvent` 的差别：那个只能在 effect 内调用、也不建议往下传；这个函数在
 *   任何地方都能调用（事件处理器、effect、Promise 回调），代价是少了那层限制带来的保护。
 *
 * @description_en - Returns a function whose identity is stable while always seeing the latest
 * render's closure.
 * - Stable identity: the same reference for the component's whole lifetime, safe in a dependency
 *   array or passed to a child, with no `useCallback` dependency list to maintain.
 * - Latest closure: calling it reads the **current** render's props/state, which is what event
 *   listeners, timers and async callbacks need.
 * - Versus React 19's `useEffectEvent`: that one may only be called inside an effect and should not
 *   be passed down; this one can be called anywhere (event handlers, effects, promise callbacks),
 *   at the cost of losing the guardrail that restriction provides.
 *
 * @example
 * ```tsx
 * function Search({ query }: { query: string }) {
 *   // 每敲一次键都重新计时，但监听器只挂一次
 *   const onInput = useEventCallback(() => search(query))
 *   useEffect(() => input.onInput(onInput), [input, onInput])
 * }
 * ```
 */
export function useEventCallback<F extends AnyFunction>(fn: F): F {
  // 最新闭包：每次渲染把当次的 fn 写进 ref，返回出去的函数在调用时才读它。
  // 渲染期写入是刻意的（见模块头第 2 条）：让「渲染到提交之间」触发的事件也用上新闭包。
  const fnRef = useRef(fn)
  fnRef.current = fn

  // 稳定身份：惰性建一次，之后永不重建
  const stableRef = useRef<F | null>(null)
  if (stableRef.current === null) {
    stableRef.current = ((...args: Parameters<F>) => fnRef.current(...args)) as F
  }
  return stableRef.current
}

/**
 * @description - useEvent / useEventValue 的共同部分：把监听器稳定化，并在 effect 内订阅、在清理
 * 函数里退订。依赖只有 `event` 一项，所以重渲染不会重订阅，只有换源才会。
 * @description_en - The shared half of useEvent / useEventValue: stabilise the listener, subscribe
 * inside an effect, unsubscribe in the cleanup. The dependency is the event alone, so a re-render
 * never resubscribes — only a new event does.
 */
function useEventSubscription<T>(event: Event<T>, listener: (e: T) => void): void {
  const stableListener = useEventCallback(listener)

  useEffect(() => {
    const subscription = event(stableListener)
    return () => subscription.dispose()
  }, [event, stableListener])
}

/**
 * @description - 在组件存活期间订阅一个事件：挂载时订阅，卸载时退订，回调始终看到最新一次渲染的
 * props / state，而重渲染不会重订阅。
 *
 * 要注意的三点：
 * - **事件必须是稳定引用**。`emitter.event` 是缓存过的，可以直接传；`Event.map(ev, fn)` 这类派生
 *   每次调用都返回新事件，必须只建一次（`useMemo` 或绑到 `DisposableStore`），否则每轮渲染都会换源。
 * - **渲染到 effect 之间触发的事件会丢**（事件是热的）。需要缓冲用 `Event.buffer`；需要「先有值再跟
 *   更新」用 {@link useEventValue}。
 * - **条件订阅不需要额外参数**：传 `enabled ? event : Event.None` 即可，`Event.None` 是稳定单例，
 *   订阅它零成本。
 *
 * 不返回订阅句柄：每一次渲染都会得到新对象，退订由「卸载」与「换源」这两个时机负责。需要在渲染期之外
 * 手动管理订阅时用 `DisposableStore`（并且建在 effect 内部）。
 *
 * @description_en - Subscribe to an event for as long as the component is alive: subscribe on
 * mount, unsubscribe on unmount, always call the latest render's closure, and never resubscribe just
 * because props changed.
 *
 * Three things to keep in mind:
 * - **The event must be a stable reference.** `emitter.event` is cached and safe to pass inline;
 *   derived events such as `Event.map(ev, fn)` return a fresh event per call and must be created
 *   once (`useMemo`, or a `DisposableStore` on the source), or every render swaps the source.
 * - **Fires between render and the effect are lost** (events are hot). Use `Event.buffer` to buffer,
 *   or {@link useEventValue} when you need a current value as well.
 * - **Conditional subscriptions need no extra parameter**: pass `enabled ? event : Event.None`.
 *   `Event.None` is a stable singleton and subscribing to it costs nothing.
 *
 * No subscription handle is returned: it would be a new object every render, and unsubscribing is
 * owned by the unmount / source-change moments. Manage subscriptions outside the render phase with a
 * `DisposableStore` (created inside an effect).
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const [messages, setMessages] = useState<string[]>([])
 *   useEvent(socket.onMessage, (message) => setMessages((all) => [...all, message]))
 *   return <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
 * }
 * ```
 */
export function useEvent<T>(event: Event<T>, handler: (e: T) => void): void {
  useEventSubscription(event, handler)
}

/**
 * @description - 把事件变成可渲染的值：保存最近一次触发收到的载荷，并在每次触发时重渲染。
 *
 * 语义上是「组件本地的最后一次载荷」，不是状态存储：
 * - `initial` 只在挂载时使用，之后由事件驱动。
 * - React 按 `Object.is` 比较新旧值，所以**同一个引用连续触发两次只重渲染一次**。要「每次触发都算数」
 *   就在事件上自增（`Event.map(ev, () => n++)`）；要「值真的变了才处理」用 `Event.latch`。
 * - 想反映**全局**状态请用 `createExternalState` + `useSelector`（那边靠 `useSyncExternalStore` 保证
 *   一次提交内读到一致的值）；这里没有权威存储，因此不存在 tearing，也就没必要引入它。
 * - 载荷与 `initial` 都可以是函数：两者都通过函数形式传给 React，不会被误当成状态更新器或惰性初始化函数。
 *
 * @description_en - Turn an event into something renderable: keep the payload of the most recent
 * fire and re-render on each one.
 *
 * Semantically this is "the last payload, local to this component", not a state store:
 * - `initial` is only used on mount; the event drives it afterwards.
 * - React compares with `Object.is`, so **firing twice with the same reference re-renders once**.
 *   If every fire must count, count in the event (`Event.map(ev, () => n++)`); if only real changes
 *   matter, use `Event.latch`.
 * - To mirror **global** state use `createExternalState` + `useSelector` (which relies on
 *   `useSyncExternalStore` to keep a single commit consistent). There is no authoritative store
 *   here, so there is nothing to tear and no reason to introduce it.
 * - Both the payload and `initial` may be functions: each goes through the function form so React does
 *   not mistake one for a state updater or a lazy initializer.
 *
 * @example
 * ```tsx
 * function Upload() {
 *   const percent = useEventValue(uploader.onProgress, 0)
 *   return <progress value={percent} max={100} />
 * }
 * ```
 */
export function useEventValue<T>(event: Event<T>, initial: T): T {
  // 用函数形式给初值：initial 本身可能就是函数（事件载荷允许是函数），
  // 直接 useState(initial) 会被 React 当成「惰性初始化函数」调用掉
  const [value, setValue] = useState<T>(() => initial)

  // 同理，写入也走更新函数形式：直接 setValue(payload) 会被当成状态更新器
  useEventSubscription(event, (payload) => setValue(() => payload))

  return value
}
