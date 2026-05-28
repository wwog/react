import React, { Fragment, type ReactNode } from "react";

export interface RepeatProps {
  /**
   * @description_en Number of times to repeat.
   * @description_zh 重复次数。
   */
  times: number;
  /**
   * @description_en Render function receiving the current index (0-based).
   * @description_zh 渲染函数，接收当前索引（从 0 开始）。
   */
  children: (index: number) => ReactNode;
}

/**
 * @description_zh 声明式重复渲染组件，常用于骨架屏、占位符等场景。
 * @description_en Declarative repeat-render component, commonly used for skeleton screens and placeholders.
 * @component
 * @example
 * ```tsx
 * <Repeat times={3}>
 *   {(i) => <Skeleton key={i} />}
 * </Repeat>
 * ```
 */
export function Repeat({ times, children }: RepeatProps): ReactNode {
  if (times <= 0) return null;
  const items: ReactNode[] = [];
  for (let i = 0; i < times; i++) {
    items.push(children(i));
  }
  return <Fragment>{items}</Fragment>;
}
