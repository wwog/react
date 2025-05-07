import React, { useMemo } from "react";

export interface DateRenderProps<T = string> {
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
  children: (formatted: T) => React.ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于格式化并渲染日期，简单易用且支持自定义格式化。
 * @description_en A declarative component for formatting and rendering dates, simple to use with support for custom formatting.
 * @component
 * @template T - The type of the formatted date value
 * @example
 * ```tsx
 * <DateRender source="2025-05-06">
 *   {(formatted) => <div>日期: {formatted}</div>}
 * </DateRender>
 * ```
 *
 * @example
 * ```tsx
 * <DateRender<string>
 *   source={new Date()}
 *   format={(date) => date.toLocaleDateString("zh-CN")}
 * >
 *   {(formatted) => <div>日期: {formatted}</div>}
 * </DateRender>
 * ```
 */
export function DateRender<T = string>({
  source,
  format,
  children,
}: DateRenderProps<T>) {
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
    return date.toLocaleString() as unknown as T;
  }, [date, format]);

  if (!formattedDate || !children) {
    return null;
  }

  return <>{children(formattedDate)}</>;
}
