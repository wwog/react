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
) => void | Promise<void>;

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
  get: () => T;

  /**
   * @en Set a new state value
   * @zh 设置新的状态值
   * @param newState The new state value / 新的状态值
   */
  set: (newState: T) => void;

  /**
   * @en React Hook for using external state in components
   * @zh 在组件中使用外部状态的 React Hook
   * @returns Array containing current state and update function, similar to useState / 包含当前状态和更新函数的数组，类似于 useState
   */
  use: () => [T, (newState: T) => void];
}

/**
 *
 * @example
 * ```tsx
 * // Create an app-level theme state
 * const themeState = createExternalState('light');
 *
 * // Get or modify state outside components
 * console.log(themeState.get()); // 'light'
 * themeState.set('dark');
 *
 * // Use state in components
 * function ThemeConsumer() {
 *   const [theme, setTheme] = themeState.use();
 *
 *   return (
 *     <div className={theme}>
 *       <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
 *         Toggle theme / 切换主题
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createExternalState<T>(
  initialState: T,
  sideEffect?: ExternalSideEffect<T>
): ExternalState<T> {
  let state: T = initialState;
  const listeners: CreateStateListener<T>[] = [];

  const get = () => state;

  const set = (newState: T) => {
    const prevState = state;
    state = newState;

    listeners.forEach((listener) => listener(state));
    if (sideEffect) {
      safePromiseTry(sideEffect, state, prevState).catch((error) => {
        console.error("Error in external state side effect, Please do it within side effects:", error);
      });
    }
  };

  const use = () => {
    const [localState, setLocalState] = React.useState(state);

    React.useEffect(() => {
      listeners.push(setLocalState);
      return () => {
        const index = listeners.indexOf(setLocalState);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }, []);

    return [localState, set] as [T, (newState: T) => void];
  };

  return { get, set, use };
}
