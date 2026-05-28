import React, { Component, type ReactNode } from "react";

export interface BoundaryProps {
  /**
   * @description_en Fallback UI to render when an error is caught. Receives the error and a reset function.
   * @description_zh 捕获到错误时渲染的降级 UI，接收错误对象和重置函数。
   */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /**
   * @description_en Called when an error is caught, useful for logging.
   * @description_zh 捕获到错误时的回调，可用于上报日志。
   * @optional
   */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  /**
   * @description_en Child elements to protect.
   * @description_zh 需要保护的子元素。
   */
  children?: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

class ErrorBoundaryCore extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

/**
 * @description_zh Error Boundary 的声明式封装，通过 render prop 提供降级 UI 和重置能力。
 * @description_en Declarative Error Boundary wrapper with render-prop fallback and reset capability.
 * @component
 * @example
 * ```tsx
 * <Boundary fallback={(error, reset) => (
 *   <div>
 *     <p>出错了: {error.message}</p>
 *     <button onClick={reset}>重试</button>
 *   </div>
 * )}>
 *   <RiskyComponent />
 * </Boundary>
 * ```
 */
export function Boundary(props: BoundaryProps): ReactNode {
  return <ErrorBoundaryCore {...props} />;
}
