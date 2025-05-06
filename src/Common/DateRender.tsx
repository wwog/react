import React, { FC, ReactNode, useMemo } from "react";

/**
 * Props for the `DateRender` component.
 *
 * @interface DateRenderProps
 * @property {Date | string | number} source - The input date to render (Date object, ISO string, or timestamp).
 * @property {(date: Date) => T} [format] - Function to format the date.
 * @property {(formatted: T) => ReactNode} children - Function to render the formatted date.
 */
export interface DateRenderProps<T> {
  /**
   * @description_en The input date to render (Date object, ISO string, or timestamp).
   * @description_zh 要渲染的输入日期（Date 对象、ISO 字符串或时间戳）。
   */
  source: Date | string | number;
  /**
   * @description_en Function to format the date.
   * @description_zh 格式化日期的函数。
   * @optional
   * @default toLocaleString
   */
  format?: (date: Date) => T;
  /**
   * @description_en Function to render the formatted date.
   * @description_zh 渲染格式化后日期的函数。
   */
  children: (formatted: T) => ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于格式化并渲染日期，简单易用且支持自定义格式化。
 * @description_en A declarative component for formatting and rendering dates, simple to use with support for custom formatting.
 * @component
 * @example
 * ```tsx
 * <DateRender source="2025-05-06">
 *   {(formatted) => <div>日期: {formatted}</div>}
 * </DateRender>
 * ```
 *
 * @example
 * ```tsx
 * <DateRender
 *   source={new Date()}
 *   format={(date) => date.toLocaleDateString("zh-CN")}
 * >
 *   {(formatted) => <div>日期: {formatted}</div>}
 * </DateRender>
 * ```
 * @returns {ReactNode | null} The rendered content or null if no valid date or children.
 */
export const DateRender: FC<DateRenderProps<any>> = ({
  source,
  format,
  children,
}) => {
  const date = useMemo(() => {
    if (source instanceof Date) return source;
    if (typeof source === "string" || typeof source === "number") {
      const parsed = new Date(source);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }, [source]);

  const formattedDate = useMemo(() => {
    if (!date) return null;
    if (format) {
      return format(date);
    }
    return date.toLocaleString();
  }, [date, format]);

  if (!formattedDate || !children) {
    return null;
  }

  return <>{children(formattedDate)}</>;
};
