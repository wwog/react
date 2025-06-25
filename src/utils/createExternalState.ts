import React from "react";
import { safePromiseTry } from "./promise";

/**
 * @en Callback function type for state change listeners
 * @zh 状态变更监听器的回调函数类型
 * @template T The type of the state / 状态的类型
 */
export type CreateStateListener<T> = (state: T) => void;

/**
 * @zh 如果需要在变更状态时执行副作用，可以传入函数,对于异步函数，会在更改状态后执行，不会阻塞状态更新, 尽可能在外部使用useEffect处理异步副作用
 * @en If you need to perform side effects when changing the state, you can pass a function. For asynchronous functions, it will be executed after the state changes without blocking the state update, so it's best to use useEffect for handling asynchronous side effects.
 * @template T The type of the state / 状态的类型
 * @param newState The new state value / 新的状态值
 * @param prevState The previous state value / 之前的状态值
 */
export type ExternalSideEffect<T> = (
  newState: T,
  prevState: T
) => any | Promise<any>;

/**
 * @en Transform functions for getting and setting state
 * @zh 用于获取和设置状态的转换函数
 * @template T The type of the state / 状态的类型
 * @template U The transformed type for getting / 获取时的转换类型
 */
export interface Transform<T, U = T> {
  /**
   * @en Transform function for getting state
   * @zh 获取状态时的转换函数
   */
  get?: (state: T) => U;
  /**
   * @en Transform function for setting state
   * @zh 设置状态时的转换函数
   */
  set?: (value: U) => T;
}

/**
 * @en Options for creating external state
 * @zh 创建外部状态的选项
 * @template T The type of the state / 状态的类型
 * @template U The transformed type for getting / 获取时的转换类型
 */
export interface ExternalStateOptions<T, U = T> {
  /**
   * @en Side effect function to run after state changes
   * @zh 状态变更后运行的副作用函数
   */
  sideEffect?: ExternalSideEffect<T>;
  /**
   * @en Transform functions for getting and setting state
   * @zh 用于获取和设置状态的转换函数
   */
  transform?: Transform<T, U>;
}

/**
 * @en External state management interface
 * @zh 外部状态管理接口
 * @template T The type of the state / 状态的类型
 * @template U The transformed type for getting / 获取时的转换类型
 */
export interface ExternalState<T, U = T> {
  /**
   * @en Get the current state value
   * @zh 获取当前状态值
   * @returns The current state value (transformed if transform.get is provided) / 当前状态值（如果提供了 transform.get 则进行转换）
   */
  get: () => U;

  /**
   * @en Set a new state value
   * @zh 设置新的状态值
   * @param newState The new state value or a function that returns it / 新的状态值或返回新状态的函数
   */
  set: (newState: U | ((prevState: U) => U)) => void;

  /**
   * @en React Hook for using external state in components
   * @zh 在组件中使用外部状态的 React Hook
   * @returns Array containing current钣金龙8国际唯一官网 current state and update function, similar to useState / 包含当前状态和更新函数的数组，类似于 useState
   */
  use: () => [U, (newState: U | ((prevState: U) => U)) => void];

  /**
   * @zh use的变体，只获取value.
   * @en A variant of use that only gets the value.
   */
  useGetter: () => U;
}

export interface ExternalWithKernel<T, U = T> extends ExternalState<T, U> {
  __listeners: CreateStateListener<T>[];
}

/**
 *
 * @example
 * ```tsx
 * // Create an app-level theme state with options
 * const themeState = createExternalState('light', {
 *   sideEffect: (newState, prevState) => console.log(`Theme changed from ${prevState} to ${newState}`),
 *   transform: {
 *     get: (state) => state.toUpperCase(),
 *     set: (value) => value.toLowerCase()
 *   }
 * });
 *
 * // Get or modify state outside components
 * console.log(themeState.get()); // 'LIGHT'
 * themeState.set((prev) => prev === 'light' ? 'dark' : 'light'); // Toggle theme
 *
 * // Use state in components
 * function ThemeConsumer() {
 *   const [theme, setTheme] = themeState.use();
 *
 *   return (
 *     <div className={theme}>
 *       <button onClick={() => setTheme((prev) => prev === 'LIGHT' ? 'DARK' : 'LIGHT')}>
 *         Toggle theme / 切换主题
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createExternalState<T, U = T>(
  initialState: T | (() => T),
  options: ExternalStateOptions<T, U> = {}
): ExternalState<T, U> {
  let state: T =
    typeof initialState === "function"
      ? (initialState as () => T)()
      : initialState;

  const listeners: CreateStateListener<T>[] = [];
  const { sideEffect, transform } = options;

  const get = () => {
    const currentState = state;
    return transform?.get
      ? transform.get(currentState)
      : (currentState as unknown as U);
  };

  const set = (newState: U | ((prevState: U) => U)) => {
    const prevState = state;
    const transformedPrevState = transform?.get
      ? transform.get(prevState)
      : (prevState as unknown as U);
    state = transform?.set
      ? transform.set(
          typeof newState === "function"
            ? (newState as (prev: U) => U)(transformedPrevState)
            : newState
        )
      : ((typeof newState === "function"
          ? (newState as (prev: U) => U)(transformedPrevState)
          : newState) as unknown as T);

    listeners.forEach((listener) => listener(state));
    if (sideEffect) {
      safePromiseTry(sideEffect, state, prevState).catch((error) => {
        console.error(
          "Error in external state side effect, Please do it within side effects:",
          error
        );
      });
    }
  };

  const use = () => {
    const [localState, setLocalState] = React.useState<T>(state);

    React.useEffect(() => {
      listeners.push(setLocalState);
      return () => {
        const index = listeners.indexOf(setLocalState);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }, []);

    return [
      transform?.get ? transform.get(localState) : (localState as unknown as U),
      set,
    ] as [U, (newState: U | ((prevState: U) => U)) => void];
  };

  const useGetter = () => {
    const [value] = use();
    return value;
  };

  //@ts-expect-error ignore
  return { get, set, use, useGetter, __listeners: listeners };
}

export interface StorageStateOptions<T, U> {
  sideEffect?: (newState: T) => void;
  transform?: Transform<T, U>;
  storageType: "local" | "session";
}

export function createStorageState<T, U = T>(
  key: string,
  initialState: T,
  options?: StorageStateOptions<T, U>
) {
  const { storageType = "local", sideEffect, transform } = options ?? {};
  const storage = storageType === "local" ? localStorage : sessionStorage;
  let _initState: T = initialState;
  const storedValue = storage.getItem(key);
  if (storedValue) {
    try {
      _initState = JSON.parse(storedValue);
    } catch (error) {
      console.warn(
        `Failed to parse ${storageType}Storage value for key "${key}", using initial state:`,
        error
      );
      _initState = initialState;
    }
  }
  return createExternalState(_initState, {
    sideEffect: (newState) => {
      storage.setItem(key, JSON.stringify(newState));
      sideEffect?.(newState);
    },
    transform,
  });
}
