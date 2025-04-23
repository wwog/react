import React, { FC, ReactNode, useMemo } from "react";

/**
 * Props for the `Pipe` component.
 *
 * @interface PipeProps
 * @property {any} data - The initial data to process.
 * @property {((input: any) => any)[]} transform - Array of functions to transform the data.
 * @property {(result: any) => ReactNode} render - Function to render the transformed data.
 * @property {ReactNode} [fallback] - Content to render if the result is null or undefined.
 */
export interface PipeProps {
  /**
   * @description_en The initial data to process.
   * @description_zh 要处理的初始数据。
   */
  data: any;
  /**
   * @description_en Array of functions to transform the data.
   * @description_zh 转换数据的函数数组。
   */
  transform: ((input: any) => any)[];
  /**
   * @description_en Function to render the transformed data.
   * @description_zh 渲染转换后数据的函数。
   */
  render: (result: any) => ReactNode;
  /**
   * @description_en Content to render if the result is null or undefined.
   * @description_zh 如果结果为 null 或 undefined 时渲染的内容。
   * @optional
   * @default null
   */
  fallback?: ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于通过管道式处理数据并渲染，简化多步骤数据转换。
 * @description_en A declarative component for processing data through a pipeline and rendering, simplifying multi-step data transformations.
 * @component
 * @example
 * ```tsx
 * <Pipe
 *   data={users}
 *   transform={[
 *     (data) => data.filter(user => user.active),
 *     (data) => data.map(user => user.name)
 *   ]}
 *   render={(names) => <div>{names.join(", ")}</div>}
 *   fallback={<div>No Data</div>}
 * />
 * ```
 */
export const Pipe: FC<PipeProps> = ({ data, transform, render, fallback }) => {
  const result = useMemo(() => {
    return transform.reduce((acc, fn) => fn(acc), data);
  }, [data, transform]);

  if (result == null) {
    return <>{fallback || null}</>;
  }

  return <>{render(result)}</>;
};
