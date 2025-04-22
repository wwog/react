import React, { FC, ReactNode, useMemo } from "react";

export interface WhenProps {
  /**
   * @description_en An array of conditions where all must be true to render children.
   * @description_zh 一个条件数组，所有条件都为真时渲染子元素。
   * @index 1
   */
  all?: boolean[];
  /**
   * @description_en An array of conditions where at least one must be true to render children.
   * @description_zh 一个条件数组，至少有一个条件为真时渲染子元素。
   * @index 2
   */
  any?: boolean[];
  /**
   * @description_en An array of conditions where all must be false to render children.
   * @description_zh 一个条件数组，所有条件都为假时渲染子元素。
   * @index 3
   */
  none?: boolean[];
  /**
   * @description_en The content to render when conditions are satisfied.
   * @description_zh 满足条件时渲染的内容。
   */
  children?: ReactNode;
  /**
   * @description_en The content to render when conditions are not satisfied (alternative to `Else`).
   * @description_zh 不满足条件时渲染的内容（替代 `Else`）。
   */
  fallback?: ReactNode;
}

/**
 * @description_zh 一个声明式组件，用于基于多个条件进行条件渲染。比If更简洁。
 * @description_en A declarative component for conditional rendering based on multiple conditions. More concise than If.
 * @component
 * @example
 * ```tsx
 * <When all={[isAdmin, hasPermission]}>
 *   <AdminPanel />
 * </When>
 * ```
 *
 * @example
 * ```tsx
 * <When any={[isLoading, isFetching]} fallback={<ErrorMessage />}>
 *   <Spinner />
 * </When>
 * ```
 *
 */
export const When: FC<WhenProps> = ({ all, any, none, children, fallback }) => {
  const shouldRender = useMemo(() => {
    if (all && (any || none)) {
      console.warn(
        'When: Multiple condition types (all, any, none) provided; "all" takes precedence.'
      );
    }
    if (all && all.length > 0 && all.every(Boolean)) return true;
    if (any && any.length > 0 && any.some(Boolean)) return true;
    if (none && none.length > 0 && none.every((v) => !v)) return true;
    return false;
  }, [all, any, none]);

  return shouldRender ? <>{children}</> : <>{fallback || null}</>;
};
