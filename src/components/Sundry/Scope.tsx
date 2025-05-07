import React, { FC, ReactNode, useMemo } from "react";

/**
 * Props for the `Scope` component.
 *
 * @interface ScopeProps
 * @property {Record<string, any> | ((props: any) => Record<string, any>)} let - An object or function defining local variables for the scope.
 * @property {any} [props] - Optional props passed to the let function.
 * @property {(scope: Record<string, any>) => ReactNode} [children] - Render function to access the scope variables.
 * @property {ReactNode} [fallback] - Content to render if children or scope is empty.
 */
export interface ScopeProps {
  /**
   * @description_en An object or function defining local variables for the scope.
   * @description_zh 定义作用域局部变量的对象或函数。
   */
  let: Record<string, any> | ((props: any) => Record<string, any>);
  /**
   * @description_en Optional props passed to the let function.
   * @description_zh 传递给 let 函数的可选属性。
   * @optional
   */
  props?: any;
  /**
   * @description_en Render function to access the scope variables.
   * @description_zh 访问作用域变量的渲染函数。
   * @optional
   */
  children?: (scope: Record<string, any>) => ReactNode;
  /**
   * @description_en Content to render if children or scope is empty.
   * @description_zh 如果 children 或 scope 为空时渲染的内容。
   * @optional
   * @default null
   */
  fallback?: ReactNode;
}
/* 
设计原因
避免在组件外定义临时状态或计算。
声明式定义局部变量，增强代码自包含性。
适合表单、计算密集型渲染等场景。 
*/
/**
 * @description_zh 一个声明式组件，为子节点提供局部作用域，简化临时状态或上下文管理。
 * @description_en A declarative component that provides a local scope for children, simplifying temporary state or context management.
 * @component
 * @example
 * ```tsx
 * <Scope let={{ count: 1, text: "Hello" }}>
 *   {({ count, text }) => <div>{text} {count}</div>}
 * </Scope>
 * ```
 *
 * @example
 * ```tsx
 * <Scope let={(props) => ({ total: props.items.length })} props={{ items: [1, 2] }} fallback={<div>Empty</div>}>
 *   {({ total }) => <div>Total: {total}</div>}
 * </Scope>
 * ```
 */
export const Scope: FC<ScopeProps> = ({
  let: letValue,
  props,
  children,
  fallback,
}) => {
  const scope = useMemo(() => {
    return typeof letValue === "function" ? letValue(props) : letValue;
  }, [letValue, props]);

  if (!children || !Object.keys(scope).length) {
    return <>{fallback || null}</>;
  }

  return <>{children(scope)}</>;
};
