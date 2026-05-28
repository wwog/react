import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface PortalProps {
  /**
   * @description_en Target DOM element to mount into. Defaults to document.body.
   * @description_zh 挂载目标 DOM 元素，默认为 document.body。
   * @default document.body
   */
  to?: Element | null;
  /**
   * @description_en Child elements to render into the portal.
   * @description_zh 要渲染到 portal 中的子元素。
   */
  children?: ReactNode;
  /**
   * @description_en Whether to disable the portal and render children inline. Default is false.
   * @description_zh 是否禁用 portal，直接内联渲染子元素。默认为 false。
   * @default false
   */
  disabled?: boolean;
}

/**
 * @description_zh 声明式 Portal 组件，将子元素渲染到指定 DOM 节点，常用于模态框、浮层等场景。
 * @description_en Declarative Portal component that renders children into a specified DOM node, commonly used for modals and overlays.
 * @component
 * @example
 * ```tsx
 * <Portal>
 *   <Modal />
 * </Portal>
 *
 * <Portal to={document.getElementById('overlay-root')}>
 *   <Tooltip />
 * </Portal>
 * ```
 */
export function Portal({ to, children, disabled = false }: PortalProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  // to 可能在首次渲染时为 null（SSR 或 ref 未就绪），延迟到客户端挂载后再渲染
  const toRef = useRef(to);
  toRef.current = to;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  if (!mounted) {
    return null;
  }

  const target = toRef.current ?? document.body;
  return createPortal(children, target);
}
