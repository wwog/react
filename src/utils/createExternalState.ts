import { useSyncExternalStore } from 'react'
import { safePromiseTry } from './promise'

/**
 * @zh 状态回调函数。对于异步函数，会在状态更新后执行，不会阻塞状态更新，尽可能在外部使用 useEffect 处理异步副作用。
 * @en State callback function. Async callbacks run after the state update without blocking it; prefer useEffect for async side effects.
 * @template T The type of the state / 状态的类型
 * @param newState The new state value / 新的状态值
 * @param prevState The previous state value / 之前的状态值
 */
export type ExternalStateCallback<T> = (newState: T, prevState: T) => any | Promise<any>

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
   * @zh use的变体，只获取value.
   * @en A variant of use that only gets the value.
   */
  useGetter: () => T
}

export interface ExternalWithKernel<T> extends ExternalState<T> {
  __listeners: (() => void)[]
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
  const { onSet, onChange } = options

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

  const set = (newState: T | ((prevState: T) => T)) => {
    const prevState = state
    state = typeof newState === 'function'
      ? (newState as (prev: T) => T)(prevState)
      : newState

    storeListeners.forEach((listener) => listener())

    runCallback(onSet, state, prevState)
    if (!Object.is(state, prevState)) {
      runCallback(onChange, state, prevState)
    }
  }

  const useState = () => {
    const localState = useSyncExternalStore(
      (onStoreChange) => {
        storeListeners.push(onStoreChange)
        return () => {
          const index = storeListeners.indexOf(onStoreChange)
          if (index > -1) {
            storeListeners.splice(index, 1)
          }
        }
      },
      () => state,
      () => state,
    )

    return [localState, set] as [
      T,
      (newState: T | ((prevState: T) => T)) => void,
    ]
  }


  const useGetter = () => {
    const [value] = useState()
    return value
  }

  //@ts-expect-error ignore
  return { get, set, useState, useGetter, __listeners: storeListeners }
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
  const { storageType = 'local', onSet, onChange } = options ?? {}
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
