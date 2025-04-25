import React, { useState, useEffect, ReactNode } from "react";

export interface ToggleProps<T = boolean> {
  /**
   * @description_en The initial value to toggle.
   * @description_zh 初始切换值。
   * @default 0
   */
  index?: number;
  /**
   * @description_en Array of values to toggle between.
   * @description_zh 可切换的值数组。
   */
  options: T[];
  /**
   * @description_en Function to determine the next value index in the toggle sequence.
   * @description_zh 确定切换序列中下一个值索引的函数。
   * @optional
   */
  next?: (curIndex: number, options: T[]) => number;
  /**
   * @description_en Render function, receiving the toggled value and toggle function.
   * @description_zh 渲染函数，接收切换后的值和切换函数。
   */
  render: (value: T, toggle: () => void) => ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于在预定义选项中切换值并通过 render 函数传递给子组件，支持自定义切换逻辑。
 * @description_en A declarative component for toggling between predefined values and passing them to children via a render function, supporting custom toggle logic.
 * @component
 * @example
 * ```tsx
 * <Toggle
 *   options={["light", "dark"]}
 *   render={(theme, toggleTheme) => (
 *     <div onClick={toggleTheme}>当前主题: {theme}</div>
 *   )}
 * />
 * ```
 */
export const Toggle = <T,>(props: ToggleProps<T>) => {
  const {
    index = 0,
    options,
    next,
    render,
  } = props;

  useEffect(() => {
    if (options.length < index + 1) {
      throw new Error(
        `Index ${index} is out of bounds for options array of length ${options.length}. Defaulting to first option.`
      );
    }
  }, [index, options]);

  const [curIndex, setCurIndex] = useState<number>(index);
  const toggle = () => {
    setCurIndex((prev) => {
      if (!options.length) return prev;
      return next ? next(prev, options) : (prev + 1) % options.length;
    });
  };

  return render(options[curIndex], toggle);
};
