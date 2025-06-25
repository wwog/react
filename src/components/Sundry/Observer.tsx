import React, { useEffect, useRef, type ReactNode } from "react";

export interface ObserverProps {
  /**
   * @description_en Callback function when intersection occurs.
   * @description_zh 交叉时触发的回调函数。
   */
  onIntersect: (entry: IntersectionObserverEntry, observer: IntersectionObserver) => void;
  /**
   * @description_en Threshold(s) at which to trigger the callback. Default is 0.1.
   * @description_zh 触发回调的阈值，默认为 0.1。
   * @optional
   * @default 0.1
   */
  threshold?: number | number[];
  /**
   * @description_en The root element for intersection. Default is viewport.
   * @description_zh 交叉的根元素，默认为视口。
   * @optional
   * @default null
   */
  root?: Element | Document | null;
  /**
   * @description_en Margin around the root. Default is "0px".
   * @description_zh 根元素周围的边距，默认为 "0px"。
   * @optional
   * @default "0px"
   */
  rootMargin?: string;
  /**
   * @description_en Whether to trigger only once. Default is false.
   * @description_zh 是否只触发一次，默认为 false。
   * @optional
   * @default false
   */
  triggerOnce?: boolean;
  /**
   * @description_en Whether to disable the observer. Default is false.
   * @description_zh 是否禁用观察者，默认为 false。
   * @optional
   * @default false
   */
  disabled?: boolean;
  /**
   * @description_en Child elements to observe.
   * @description_zh 要观察的子元素。
   * @optional
   */
  children?: ReactNode;
  /**
   * @description_en CSS class name.
   * @description_zh CSS 类名。
   * @optional
   */
  className?: string;
  /**
   * @description_en Inline styles.
   * @description_zh 内联样式。
   * @optional
   */
  style?: React.CSSProperties;
}

/* 
提供声明式的观察者API封装。
简化懒加载、无限滚动等常见场景的实现。
支持灵活的配置选项和一次性触发。
*/
/**
 * @description_zh 交叉观察者组件，用于监听元素与视口的交叉状态，常用于懒加载和无限滚动场景。
 * @description_en Intersection Observer component for monitoring element-viewport intersection, commonly used for lazy loading and infinite scrolling.
 * @component
 * @example
 * ```tsx
 * // 懒加载示例
 * <Observer onIntersect={loadImage} triggerOnce>
 *   <img data-src="image.jpg" alt="Lazy loaded" />
 * </Observer>
 * 
 * // 无限滚动示例
 * <Observer onIntersect={loadMore} threshold={0.1}>
 *   <div>滚动到这里加载更多</div>
 * </Observer>
 * 
 * // 自定义根元素和边距
 * <Observer 
 *   onIntersect={handleIntersect}
 *   root={scrollContainer}
 *   rootMargin="100px"
 *   threshold={[0, 0.5, 1]}
 * >
 *   <div>观察目标</div>
 * </Observer>
 * ```
 */
export const Observer: React.FC<ObserverProps> = ({
  onIntersect,
  threshold = 0.1,
  root = null,
  rootMargin = "0px",
  triggerOnce = false,
  disabled = false,
  children,
  className,
  style,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (disabled || !elementRef.current) {
      return;
    }

    // 检查浏览器支持
    if (!window.IntersectionObserver) {
      console.warn('IntersectionObserver is not supported in this browser');
      return;
    }

    const element = elementRef.current;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (triggerOnce && hasTriggeredRef.current) {
            return;
          }

          onIntersect(entry, observerRef.current!);
          
          if (triggerOnce) {
            hasTriggeredRef.current = true;
            observerRef.current?.unobserve(element);
          }
        }
      });
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin,
      threshold,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onIntersect, threshold, root, rootMargin, triggerOnce, disabled]);

  // 重置触发状态（当 triggerOnce 从 true 变为 false 时）
  useEffect(() => {
    if (!triggerOnce) {
      hasTriggeredRef.current = false;
    }
  }, [triggerOnce]);

  return (
    <div ref={elementRef} className={className} style={style}>
      {children}
    </div>
  );
};