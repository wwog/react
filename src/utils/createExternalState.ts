import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import {shallowEqual} from './shallowEqual'

/**
 * @zh 状态回调函数。对于异步函数，会在状态更新后执行，不会阻塞状态更新，尽可能在外部使用 useEffect 处理异步副作用。
 * @en State callback function. Async callbacks run after the state update without blocking it; prefer useEffect for async side effects.
 * @template T The type of the state / 状态的类型
 * @param newState The new state value / 新的状态值
 * @param prevState The previous state value / 之前的状态值
 */
export type ExternalStateCallback<T> = (newState: T, prevState: T) => any | Promise<any>

/**
 * @zh 相等性判断函数。默认是 `Object.is`；需要「内容相同即相等」时传入 `shallowEqual`。
 * @en Equality predicate. Defaults to `Object.is`; pass `shallowEqual` when equal-by-content
 * should count as equal.
 * @template S The type of the compared value / 被比较的值的类型
 */
export type EqualityFn<S> = (a: S, b: S) => boolean

/**
 * @zh 选择性订阅的回调，第一个参数是当前切片，第二个是上一次的切片（`fireImmediately` 时两者相同）。
 * @en Listener for selector subscriptions: the current slice, then the previous slice (both the
 * same when `fireImmediately`).
 * @template S The type of the selected slice / 被选中的切片的类型
 */
export type SelectorListener<S> = (nextSlice: S, prevSlice: S) => void

/**
 * @en Options for `subscribeWithSelector`
 * @zh `subscribeWithSelector` 的选项
 * @template S The type of the selected slice / 被选中的切片的类型
 */
export interface SubscribeSelectorOptions<S> {
  /**
   * @zh 切片相等性判断，默认 `Object.is`。
   * @en Slice equality, `Object.is` by default.
   */
  isEqual?: EqualityFn<S>
  /**
   * @zh 订阅时立即用当前切片触发一次回调（`nextSlice` 与 `prevSlice` 相同）。
   * @en Fire once immediately with the current slice (`nextSlice` and `prevSlice` are the same).
   */
  fireImmediately?: boolean
}

/**
 * @en Options for creating external state
 * @zh 创建外部状态的选项
 * @template T The type of the state / 状态的类型
 */
export interface ExternalStateOptions<T> {
  /**
   * @en Callback invoked on every `set` call, even when the value is unchanged
   * @zh 每次调用 `set` 后触发，即使值未发生变化
   */
  onSet?: ExternalStateCallback<T>
  /**
   * @en Callback invoked only when the stored value actually changes
   * @zh 仅在内部存储值发生变化时触发
   */
  onChange?: ExternalStateCallback<T>
  /**
   * @zh 通知订阅者的时机。
   *
   * `'sync'`（默认）：`set` 返回前就通知完毕，写完立刻读的代码（含测试里的同步断言）都成立。
   * `'microtask'`：同一轮任务内多次 `set` 只通知一次，通知在微任务里执行。适合「订阅者多 + 写很频繁」
   * 的场景——省下的是每次 `set` 的一遍遍历与通知，React 那侧本来就会合并渲染，所以净语义不变；区别是
   * `set` 返回时订阅者还没收到通知，且中间态被跳过（订阅者只看到本轮最后的值）。
   * `onSet` / `onChange` 不受影响，仍然逐次同步执行。
   * @en When subscribers are notified.
   *
   * `'sync'` (default): notification completes before `set` returns, so code that reads right after
   * writing (including synchronous assertions in tests) holds. `'microtask'`: several `set` calls in
   * one task notify once, from a microtask. Worth it when there are many subscribers and writes are
   * frequent — what it saves is the per-`set` walk and notification, and since React coalesces
   * renders anyway the net semantics are the same; the difference is that subscribers have not been
   * notified when `set` returns and intermediate states are skipped (they see the last value of the
   * batch). `onSet` / `onChange` are unaffected and still run synchronously for every `set`.
   */
  notify?: 'sync' | 'microtask'
}

/**
 * @en External state management interface
 * @zh 外部状态管理接口
 * @template T The type of the state / 状态的类型
 */
export interface ExternalState<T> {
  /**
   * @en Get the current state value
   * @zh 获取当前状态值
   * @returns The current state value / 当前状态值
   */
  get: () => T

  /**
   * @zh 设置新的状态值。传入 updater 时必须返回**新引用**：原地修改
   * （`set((prev) => {prev.list.push(x); return prev})`）与旧值 `Object.is` 相等，会被判定为
   * 「没有变化」，订阅者不会收到通知。
   * @en Set a new state value. An updater must return a **new reference**: mutating in place
   * (`set((prev) => {prev.list.push(x); return prev})`) compares `Object.is`-equal to the previous
   * value, counts as "unchanged", and notifies nobody.
   * @param newState The new state value or a function that returns it / 新的状态值或返回新状态的函数
   */
  set: (newState: T | ((prevState: T) => T)) => void

  /**
   * @en React Hook for using external state in components.
   * @zh 在组件中使用外部状态的 React Hook。
   * @returns Array containing current state and update function, similar to React useState / 包含当前状态和更新函数的数组，类似于 React useState
   */
  useState: () => [T, (newState: T | ((prevState: T) => T)) => void]

  /**
   * @zh useState 的变体，只获取 value.
   * @en A variant of useState that only gets the value.
   */
  useGetter: () => T

  /**
   * @zh 选择性订阅：只有 `selector` 选出的切片发生变化时才重渲染。
   *
   * 整份 state 变化时，`set` 依然会通知所有订阅者，但每个消费者的快照是「按 selector 计算 +
   * 相等性比较后的缓存切片」；切片相等时 `useSyncExternalStore` 判定快照未变，不调度重渲染。
   * 于是改一个字段不会让只读其它字段的组件重渲染。
   *
   * selector 返回新对象/新数组时（`s => ({a: s.a})`、`s => s.list.filter(...)`）每次都是新引用，
   * 默认的 `Object.is` 永远认为「变了」，此时应显式传入 `isEqual`（如 `shallowEqual`）。
   * @en Fine-grained subscription: re-render only when the slice picked by `selector` changes.
   *
   * A `set` still notifies every subscriber, but each consumer's snapshot is the slice computed
   * by `selector` and cached with an equality check. When the slice compares equal,
   * `useSyncExternalStore` sees an unchanged snapshot and skips the re-render — so writing one
   * field no longer re-renders components that read other fields.
   *
   * A selector that builds a fresh object/array (`s => ({a: s.a})`, `s => s.list.filter(...)`)
   * returns a new reference every call, so the default `Object.is` always reports a change; pass
   * an explicit `isEqual` (e.g. `shallowEqual`) in that case.
   * @param selector Derives the slice from the whole state / 从整份 state 派生切片
   * @param isEqual Slice equality, `Object.is` by default / 切片相等性判断，默认 `Object.is`
   * @returns The selected slice / 选中的切片
   * @example
   * ```tsx
   * const appState = createExternalState({name: 'wwog', age: 1, theme: 'light'})
   *
   * // 改 age / theme 都不会让这个组件重渲染
   * const name = appState.useSelector((s) => s.name)
   *
   * // 合成对象必须给相等函数，否则每次都是新引用
   * const head = appState.useSelector((s) => ({name: s.name, age: s.age}), shallowEqual)
   * ```
   */
  useSelector: <S>(selector: (state: T) => S, isEqual?: EqualityFn<S>) => S

  /**
   * @zh 在组件外订阅「任意变化」，返回退订函数。组件内请用 `useState` / `useSelector`。
   * @en Subscribe to any change outside components; returns an unsubscribe function. Inside
   * components use `useState` / `useSelector` instead.
   * @param listener Called on every `set` / 每次 `set` 后触发
   * @returns Unsubscribe / 退订函数
   */
  subscribe: (listener: () => void) => () => void

  /**
   * @zh 在组件外按切片订阅：只有 `selector` 选出的切片变化才调用 `listener`，不相关的写入会被跳过。
   * 适合「模块级逻辑只关心某几个字段」的场景，也用于替换手写的监听器集合。
   * @en Subscribe to a slice outside components: `listener` runs only when the slice changes and
   * unrelated writes are skipped. Useful for module-level logic that cares about a few fields, and
   * for replacing hand-rolled listener sets.
   * @param selector Derives the slice from the whole state / 从整份 state 派生切片
   * @param listener Receives (nextSlice, prevSlice); on the first change `prevSlice` is the slice
   * as it was when subscribing / 接收 (nextSlice, prevSlice)；首次变化时 `prevSlice` 是订阅时的切片
   * @param options `isEqual` / `fireImmediately` / `isEqual` 与 `fireImmediately`
   * @returns Unsubscribe / 退订函数
   * @example
   * ```ts
   * const stop = appState.subscribeWithSelector(
   *   (s) => s.age,
   *   (age, prevAge) => console.log(`age: ${prevAge} → ${age}`),
   * )
   * appState.set((prev) => ({...prev, theme: 'dark'})) // 切片没变，不触发
   * stop()
   * ```
   */
  subscribeWithSelector: <S>(
    selector: (state: T) => S,
    listener: SelectorListener<S>,
    options?: SubscribeSelectorOptions<S>,
  ) => () => void
}

export interface ExternalWithKernel<T> extends ExternalState<T> {
  __listeners: (() => void)[]
}

/**
 * @zh 恒等函数（模块级常量）：`useState` 走同一条 selector 订阅路径时，selector 引用必须稳定，
 * 否则 `useMemo` 每轮重建，白跑一次缓存。
 * @en Identity function as a module-level constant: `useState` reuses the same selector
 * subscription path, and its selector reference must stay stable or the `useMemo` cache is
 * rebuilt every render.
 */
const identity = <S>(value: S): S => value

/**
 * @zh 只声明本模块需要的形状，不依赖 `@types/node` —— 本库发布 `src/`，使用者的工程不一定装了
 * node 类型。保留裸标识符写法是刻意的：打包器（Vite / webpack）会把 `process.env.NODE_ENV` 静态
 * 替换成字面量，生产构建里整段提示随之被消除；改成 `globalThis` 间接取值就替换不掉了，提示会跟着
 * 进生产包。
 * @en Only the shape this module needs is declared, so consumers do not need `@types/node` — this
 * library ships `src/`, and their project may not have node types. The bare identifier is
 * deliberate: bundlers (Vite / webpack) statically replace `process.env.NODE_ENV`, which lets the
 * whole hint be eliminated from production builds. Reading it through `globalThis` defeats that
 * replacement and ships the hint to production.
 */
declare const process: {env: Record<string, string | undefined>}

/**
 * @zh 是否为生产构建。取不到 `process` 时（原生 ESM、直接跑在浏览器里）按开发处理：
 * 多一条提示只是噪音，少一条提示会让人查不出问题。
 * @en Whether this is a production build. When `process` is unavailable (native ESM, running
 * straight in a browser) it counts as development: a redundant hint is noise, a missing one costs
 * a debugging session.
 */
const isProduction = (): boolean => {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

/**
 * @zh 开发期提示：selector 每次都返回新引用，但内容浅比较相等。这正是「改了不相关字段却触发
 * 重渲染」的症状，对着 console 很难看出所以然，所以在源头点出来。
 * @en Development-time hint: the selector returns a new reference each call while the contents are
 * shallow-equal. That is exactly the "an unrelated field re-rendered me" symptom, which is hard to
 * diagnose from the console alone, so it is called out at the source.
 */
const warnFreshReferenceSelection = (): void => {
  console.warn(
    '[createExternalState] useSelector: the selector returned a new reference whose contents are shallow-equal to the previous slice, so this render was triggered by a change the component does not depend on. Pass an isEqual (e.g. shallowEqual) as the second argument to skip such renders.',
  )
}

/**
 * @zh 已提交的切片。用 `null` 表示「还没提交过」——不能拿 `undefined` 当哨兵，因为
 * `undefined` 也可能是合法的切片值。
 * @en The committed slice. `null` means "nothing committed yet"; `undefined` cannot be the
 * sentinel because it may be a legitimate slice value.
 */
interface CommittedSelection<S> {
  value: S
}

/**
 * @zh 选择性订阅的核心。快照函数返回「selector 计算 + 相等性缓存」后的切片：
 *
 * 1. 同一份 state 上重复读取直接复用缓存，不重复跑 selector；
 * 2. 切片与上一次**已提交**的切片相等时，沿用旧引用。这一步是关键——
 *    `useSyncExternalStore` 是逐引用比较的，返回新引用就会把它误判成「快照变了」并重渲染。
 *
 * selector 或 isEqual 的身份变化会让 `useMemo` 重建缓存，重建后的首次调用走同一条
 * 「相等就沿用旧引用」的规则，因此内联箭头函数不会造成多余重渲染，也不会读到陈旧切片。
 * @en The core of fine-grained subscription. The snapshot function returns the slice computed by
 * `selector` and reconciled against the committed one:
 *
 * 1. repeated reads on the same state reuse the cache instead of re-running the selector;
 * 2. when the slice equals the last **committed** slice, the previous reference is reused. This is
 *    the load-bearing part: `useSyncExternalStore` compares by reference, so a fresh reference
 *    would be read as "the snapshot changed" and force a re-render.
 *
 * Changing the `selector` or `isEqual` identity rebuilds the `useMemo` cache; the first call after
 * a rebuild follows the same keep-the-old-reference rule, so an inline arrow selector neither
 * causes extra re-renders nor reads a stale slice.
 */
function useSelectedSlice<T, S>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T,
  selector: (state: T) => S,
  isEqual?: EqualityFn<S>,
): S {
  const committedRef = useRef<CommittedSelection<S> | null>(null)
  // 开发提示只报一次，避免每次重渲染都刷屏
  const warnedRef = useRef(false)

  const getSelection = useMemo(() => {
    let hasMemo = false
    let memoState: T
    let memoSelection: S

    return (): S => {
      const nextState = getSnapshot()

      if (!hasMemo) {
        hasMemo = true
        memoState = nextState
        const nextSelection = selector(nextState)
        const committed = committedRef.current
        if (committed && isEqual?.(committed.value, nextSelection)) {
          memoSelection = committed.value
          return memoSelection
        }
        memoSelection = nextSelection
        return nextSelection
      }

      if (Object.is(memoState, nextState)) return memoSelection

      const nextSelection = selector(nextState)
      if (isEqual?.(memoSelection, nextSelection)) return memoSelection
      // 只在调用方没给 isEqual 时提示：给了相等函数说明是明确取舍，不必再劝
      if (
        !warnedRef.current &&
        !isEqual &&
        !isProduction() &&
        shallowEqual(memoSelection, nextSelection)
      ) {
        warnedRef.current = true
        warnFreshReferenceSelection()
      }
      memoState = nextState
      memoSelection = nextSelection
      return nextSelection
    }
  }, [getSnapshot, selector, isEqual])

  const value = useSyncExternalStore(subscribe, getSelection, getSelection)

  // 只有真正渲染出来的值才被记作「已提交」：相等性判断要跟已提交值比，
  // 而不是跟某个中途算出的值比，否则并发渲染下会把未提交的切片当成基准。
  useEffect(() => {
    committedRef.current = {value}
  }, [value])

  return value
}

/**
 * @zh 门控订阅者：在 `set` 时按 selector 计算切片，切片没变就跳过回调。切片基准在订阅时就取好，
 * 因此「订阅后的第一个 set」是与订阅时的切片比较，而不是必然触发一次。
 * @en A gated subscriber: computes its slice on `set` and is skipped when the slice is unchanged.
 * The baseline slice is captured at subscribe time, so the first `set` compares against the slice
 * as it was when subscribing instead of firing unconditionally.
 */
interface GatedListener<T> {
  selector: (state: T) => any
  listener: (nextSlice: any, prevSlice: any) => void
  isEqual: EqualityFn<any>
  lastSlice: any
}

/**
 *
 * @example
 * ```tsx
 * // Create an app-level theme state with options
 * const themeState = createExternalState('light', {
 *   onChange: (newState, prevState) => console.log(`Theme changed from ${prevState} to ${newState}`),
 * });
 *
 * // Get or modify state outside components
 * console.log(themeState.get()); // 'light'
 * themeState.set((prev) => prev === 'light' ? 'dark' : 'light'); // Toggle theme
 *
 * // Use state in components
 * function ThemeConsumer() {
 *   const [theme, setTheme] = themeState.useState();
 *
 *   return (
 *     <div className={theme}>
 *       <button onClick={() => setTheme((prev) => prev === 'light' ? 'dark' : 'light')}>
 *         Toggle theme / 切换主题
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createExternalState<T>(
  initialState: T | (() => T),
  options: ExternalStateOptions<T> = {},
): ExternalState<T> {
  let state: T = typeof initialState === 'function' ? (initialState as () => T)() : initialState

  // 注册表用 Set：挂载/卸载频繁时，退订是 O(1) 而不是 indexOf + splice 的 O(N)
  const storeListeners = new Set<() => void>()
  const gatedListeners = new Set<GatedListener<T>>()
  const {onSet, onChange, notify: notifyMode = 'sync'} = options

  const runCallback = (
    callback: ExternalStateCallback<T> | undefined,
    newState: T,
    prevState: T,
  ) => {
    if (!callback) return
    let result: unknown
    try {
      result = callback(newState, prevState)
    } catch (error) {
      console.error('Error in external state callback, Please do it within side effects:', error)
      return
    }
    // 只有真的返回 thenable 才挂 catch：同步回调不该在每次 set 上白分配一个 Promise
    if (result !== null && typeof (result as PromiseLike<unknown>)?.then === 'function') {
      Promise.resolve(result as PromiseLike<unknown>).catch((error) => {
        console.error('Error in external state callback, Please do it within side effects:', error)
      })
    }
  }

  const get = () => {
    return state
  }

  // 只创建一次：引用稳定，React 才不会每次 render 都退订重订，selector 缓存也不会被反复重建
  const getSnapshot = () => state

  const subscribe = (listener: () => void) => {
    storeListeners.add(listener)
    return () => {
      storeListeners.delete(listener)
    }
  }

  const subscribeWithSelector = <S>(
    selector: (state: T) => S,
    listener: SelectorListener<S>,
    selectorOptions: SubscribeSelectorOptions<S> = {},
  ): (() => void) => {
    const {isEqual = Object.is, fireImmediately = false} = selectorOptions
    // 订阅时就取一次切片作为比较基准
    const currentSlice = selector(state)
    const record: GatedListener<T> = {selector, listener, isEqual, lastSlice: currentSlice}
    gatedListeners.add(record)

    if (fireImmediately) {
      listener(currentSlice, currentSlice)
    }

    return () => {
      gatedListeners.delete(record)
    }
  }

  const notifySafely = (listener: () => void) => {
    // 单个订阅者抛错不能掐断整条通知链：那会让排在它后面的订阅者收不到更新，
    // 也会让位于通知之后的 onSet / onChange（含 createStorageState 的落盘）整个不执行。
    try {
      listener()
    } catch (error) {
      console.error('Error in external state subscriber, it has been skipped:', error)
    }
  }

  const flushSubscribers = () => {
    // 遍历副本：订阅者在通知过程中退订「排在它前面」的订阅者时，活集合的删除会让后面尚未
    // 访问的订阅者被整体跳过（漏通知）。多调一次是安全的，漏调一次不是。
    for (const listener of [...storeListeners]) {
      notifySafely(listener)
    }

    // 门控订阅者：切片没变就不回调。这里同样遍历副本，selector 与 listener 各自兜底。
    for (const record of [...gatedListeners]) {
      try {
        const nextSlice = record.selector(state)
        if (record.isEqual(record.lastSlice, nextSlice)) continue
        const prevSlice = record.lastSlice
        record.lastSlice = nextSlice
        record.listener(nextSlice, prevSlice)
      } catch (error) {
        console.error('Error in external state selector subscriber, it has been skipped:', error)
      }
    }
  }

  // microtask 模式的合并标记：同一轮任务内只安排一次通知
  let flushScheduled = false
  const scheduleFlush = () => {
    if (flushScheduled) return
    flushScheduled = true
    Promise.resolve().then(() => {
      // 先复位再通知：订阅者在通知里再次 set 时会安排下一轮，不会丢通知
      flushScheduled = false
      flushSubscribers()
    })
  }

  const set = (newState: T | ((prevState: T) => T)) => {
    const prevState = state
    state = typeof newState === 'function' ? (newState as (prev: T) => T)(prevState) : newState

    if (notifyMode === 'microtask') {
      scheduleFlush()
    } else {
      flushSubscribers()
    }

    // state 已经变更，落盘与回调必须完成：上面的通知失败只影响通知本身
    runCallback(onSet, state, prevState)
    if (!Object.is(state, prevState)) {
      runCallback(onChange, state, prevState)
    }
  }

  const useState = () => {
    const localState = useSelectedSlice(subscribe, getSnapshot, identity, undefined)
    return [localState, set] as [T, (newState: T | ((prevState: T) => T)) => void]
  }

  const useGetter = () => {
    const [value] = useState()
    return value
  }

  const useSelector = <S>(selector: (state: T) => S, isEqual?: EqualityFn<S>): S =>
    useSelectedSlice(subscribe, getSnapshot, selector, isEqual)

  // 对外返回类型仍然是 ExternalState<T>：__listeners 只暴露在这个内部类型上，供测试断言用
  const store: ExternalWithKernel<T> = {
    get,
    set,
    useState,
    useGetter,
    useSelector,
    subscribe,
    subscribeWithSelector,
    // 投影成数组（每次访问都是快照），注册表本身是 Set
    get __listeners() {
      return [...storeListeners]
    },
  }

  return store
}

export interface StorageStateOptions<T> {
  onSet?: ExternalStateCallback<T>
  onChange?: ExternalStateCallback<T>
  /**
   * @zh 使用 localStorage（默认）或 sessionStorage。
   * @en Use localStorage (default) or sessionStorage.
   */
  storageType?: 'local' | 'session'
  /**
   * @zh 是否跟随其它标签页的写入：监听 `storage` 事件，把别的标签页写入的值同步进来。同步走 `set`，
   * 因此 `onSet` / `onChange` 照常触发，`useSelector` 那套切片订阅也照常工作。
   *
   * 默认关闭：不跨标签页同步是既有行为，而且这个事件只在多个标签页共享同一份存储时才有意义
   * （`sessionStorage` 是每标签页独立的，开了也收不到事件）。对方删除该键或调用 `clear()` 时状态回到
   * `initialState`，并且不会把初值写回存储——否则每个还开着的标签页都会把对方清掉的内容重新写上去。
   * @en Whether to follow writes from other tabs: listen for `storage` events and apply values
   * written elsewhere. The value goes through `set`, so `onSet` / `onChange` fire as usual and the
   * `useSelector` slice subscriptions keep working.
   *
   * Off by default: not syncing is the established behavior, and the event only exists when several
   * tabs share one storage area (`sessionStorage` is per-tab, so enabling it there has no effect).
   * When another tab removes the key or calls `clear()`, the state returns to `initialState` and the
   * initial value is **not** written back — otherwise every remaining tab would resurrect what the
   * other tab just cleared.
   */
  syncAcrossTabs?: boolean
}

export function createStorageState<T>(
  key: string,
  initialState: T,
  options?: StorageStateOptions<T>,
) {
  const {storageType = 'local', onSet, onChange, syncAcrossTabs = false} = options ?? {}
  let _initState: T = initialState
  // 上一次写入存储的序列化结果。set 到一个内容相同的新对象很常见，而每次 set 都全量
  // 序列化并落盘是这条链路上最贵的一步，内容没变就没有写的必要。
  let lastSerialized: string | undefined

  const resolveStorage = (): Storage => (storageType === 'local' ? localStorage : sessionStorage)

  // 只在客户端环境中读取存储
  if (typeof window !== 'undefined') {
    const storedValue = resolveStorage().getItem(key)
    if (storedValue) {
      try {
        _initState = JSON.parse(storedValue)
        // 解析成功说明存储里的内容就是当前值，把它作为基准，之后的等值写入可以直接跳过
        lastSerialized = storedValue
      } catch (error) {
        // 解析失败时不设基准，让下一次 set 覆写掉这条坏数据
        console.warn(
          `Failed to parse ${storageType}Storage value for key "${key}", using initial state:`,
          error,
        )
        _initState = initialState
      }
    }
  }

  const store = createExternalState(_initState, {
    onSet: (newState, prevState) => {
      // 只在客户端环境中写入存储
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(newState)
        // state 本身是 undefined 时 JSON.stringify 返回 undefined，此时基准也是 undefined，
        // 于是不会写入——旧行为会写入字符串 "undefined"，而它在读回时又要走解析失败的告警分支
        if (serialized !== lastSerialized) {
          lastSerialized = serialized
          resolveStorage().setItem(key, serialized)
        }
      }
      onSet?.(newState, prevState)
    },
    onChange,
  })

  if (syncAcrossTabs && typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      // 只认自己那份存储：localStorage 与 sessionStorage 完全可能有同名键
      if (event.storageArea && event.storageArea !== resolveStorage()) return
      // key 为 null 表示对方调用了 clear()，其余情况只认自己的键
      if (event.key !== key && event.key !== null) return

      if (event.newValue === null) {
        // 对方删除该键或清空存储：基准对齐到初值，这样回到初值时不会又写回去
        lastSerialized = JSON.stringify(initialState)
        store.set(initialState)
        return
      }

      // 先把基准对齐到对方写入的原文：sync 模式下 onSet 会据此跳过写回，不会两个标签页来回弹
      lastSerialized = event.newValue
      try {
        store.set(JSON.parse(event.newValue) as T)
      } catch (error) {
        console.warn(
          `Failed to parse ${storageType}Storage value for key "${key}" from another tab, ignored:`,
          error,
        )
      }
    })
  }

  return store
}
