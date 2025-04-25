import React, { ReactNode, useState, useMemo } from "react";

export interface ToggleProps<T = boolean> {
  /**
   * @description_en The initial value to toggle.
   * @description_zh 初始切换值。
   */
  source: T;
  /**
   * @description_en Array of values to toggle between.
   * @description_zh 可切换的值数组。
   */
  options: T[];
  /**
   * @description_en The prop name to pass the toggled value to children.
   * @description_zh 将切换后的值传递给子节点的属性名。
   * @default 'value'
   */
  target?: string;
  /**
   * @description_en The prop name to pass the toggle function to children.
   * @description_zh 将切换函数传递给子节点的属性名。
   * @default 'toggle'
   */
  toggleTarget?: string;
  /**
   * @description_en Function to determine the next value in the toggle sequence.
   * @description_zh 确定切换序列中下一个值的函数。
   * @optional
   */
  next?: (current: T, options: T[]) => T;
  /**
   * @description_en Content to render, receiving the toggled value and toggle function via the target and toggleTarget props.
   * @description_zh 渲染的内容，通过 target 和 toggleTarget 属性接收切换后的值和切换函数。
   */
  children: ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于在预定义选项中切换值并通过指定属性传递给子组件，支持自定义切换逻辑。
 * @description_en A declarative component for toggling between predefined values and passing them to children via specified props, supporting custom toggle logic.
 * @component
 * @example
 * ```tsx
 * interface ThemeChildProps {
 *   theme: string;
 *   toggleTheme: () => void;
 * }
 * const ThemeChild: FC<ThemeChildProps> = ({ theme, toggleTheme }) => (
 *   <div onClick={toggleTheme}>当前主题: {theme}</div>
 * );
 *
 * <Toggle source="light" options={["light", "dark"]} target="theme" toggleTarget="toggleTheme">
 *   <ThemeChild />
 * </Toggle>
 * ```
 *
 * @example
 * ```tsx
 * <Toggle
 *   source={1}
 *   options={[1, 2, 3]}
 *   target="value"
 *   toggleTarget="toggleValue"
 *   next={(current, options) => options[(options.indexOf(current) + 1) % options.length]}
 * >
 *   <ValueChild />
 * </Toggle>
 * ```
 */
export const Toggle = <T,>(props: ToggleProps<T>) => {
  const {
    source,
    options,
    target = "value",
    toggleTarget = "toggle",
    next,
    children,
  } = props;
  const defaultValue = useMemo(() => {
    return options.includes(source) ? source : options[0];
  }, [source, options]);

  const [currentValue, setCurrentValue] = useState<T>(defaultValue);

  const toggle = () => {
    setCurrentValue((prev) => {
      if (!options.length) return prev;
      const nextValue = next
        ? next(prev, options)
        : options[(options.indexOf(prev) + 1) % options.length] || options[0];
      return nextValue;
    });
  };

  return React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        [target]: currentValue,
        [toggleTarget]: toggle,
      } as { [key: string]: any });
    }
    return child;
  });
};
