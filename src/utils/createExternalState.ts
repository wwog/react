import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import {safePromiseTry} from './promise'

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
   * @en Set a new state value
   * @zh 设置新的状态值
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

  const storeListeners: (() => void)[] = []
  const gatedListeners: GatedListener<T>[] = []
  const {onSet, onChange} = options

  const runCallback = (
    callback: ExternalStateCallback<T> | undefined,
    newState: T,
    prevState: T,
  ) => {
    if (!callback) return
    safePromiseTry(callback, newState, prevState).catch((error) => {
      console.error('Error in external state callback, Please do it within side effects:', error)
    })
  }

  const get = () => {
    return state
  }

  // 只创建一次：引用稳定，React 才不会每次 render 都退订重订，selector 缓存也不会被反复重建
  const getSnapshot = () => state

  const subscribe = (listener: () => void) => {
    storeListeners.push(listener)
    return () => {
      const index = storeListeners.indexOf(listener)
      if (index > -1) {
        storeListeners.splice(index, 1)
      }
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
    gatedListeners.push(record)

    if (fireImmediately) {
      listener(currentSlice, currentSlice)
    }

    return () => {
      const index = gatedListeners.indexOf(record)
      if (index > -1) {
        gatedListeners.splice(index, 1)
      }
    }
  }

  const set = (newState: T | ((prevState: T) => T)) => {
    const prevState = state
    state = typeof newState === 'function' ? (newState as (prev: T) => T)(prevState) : newState

    storeListeners.forEach((listener) => listener())

    // 门控订阅者：切片没变就不回调。遍历副本，避免回调里退订/订阅导致后面的订阅者被跳过。
    for (const record of [...gatedListeners]) {
      const nextSlice = record.selector(state)
      if (record.isEqual(record.lastSlice, nextSlice)) continue
      const prevSlice = record.lastSlice
      record.lastSlice = nextSlice
      record.listener(nextSlice, prevSlice)
    }

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
    __listeners: storeListeners,
  }

  return store
}

export interface StorageStateOptions<T> {
  onSet?: ExternalStateCallback<T>
  onChange?: ExternalStateCallback<T>
  storageType: 'local' | 'session'
}

export function createStorageState<T>(
  key: string,
  initialState: T,
  options?: StorageStateOptions<T>,
) {
  const {storageType = 'local', onSet, onChange} = options ?? {}
  let _initState: T = initialState

  // 只在客户端环境中读取存储
  if (typeof window !== 'undefined') {
    const storage = storageType === 'local' ? localStorage : sessionStorage
    const storedValue = storage.getItem(key)
    if (storedValue) {
      try {
        _initState = JSON.parse(storedValue)
      } catch (error) {
        console.warn(
          `Failed to parse ${storageType}Storage value for key "${key}", using initial state:`,
          error,
        )
        _initState = initialState
      }
    }
  }

  return createExternalState(_initState, {
    onSet: (newState, prevState) => {
      // 只在客户端环境中写入存储
      if (typeof window !== 'undefined') {
        const storage = storageType === 'local' ? localStorage : sessionStorage
        storage.setItem(key, JSON.stringify(newState))
      }
      onSet?.(newState, prevState)
    },
    onChange,
  })
}
