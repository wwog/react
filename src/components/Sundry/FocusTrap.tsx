import React, { useRef, useEffect, useCallback, type ReactNode } from 'react'
import { getTabbableElements, type FocusableOptions } from '../../utils/focusable'

export type FocusDirection = 'next' | 'prev' | 'first' | 'last'

export interface FocusTrapProps {
  /**
   * @description_en The child elements to trap focus within.
   * @description_zh 需要劫持焦点的子元素。
   */
  children?: ReactNode
  /**
   * @description_en Whether to disable the focus trap.
   * @description_zh 是否禁用焦点劫持。
   * @default false
   */
  disabled?: boolean
  /**
   * @description_en Whether to auto-focus the first tabbable element on mount.
   * @description_zh 是否在挂载时自动聚焦到第一个可 Tab 聚焦的元素。
   * @default false
   */
  autoFocus?: boolean
  /**
   * @description_en Whether to restore focus to the previously focused element on unmount.
   * @description_zh 是否在卸载时恢复焦点到之前聚焦的元素。
   * @default false
   */
  restoreFocus?: boolean
  /**
   * @description_en Custom key-to-direction mapping to extend or override the default Tab-based navigation.
   * @description_zh 自定义按键到焦点方向的映射，用于扩展或覆盖默认的 Tab 导航。
   * @default { Tab: 'next' }
   * @example
   * ```tsx
   * // Arrow up/down navigation
   * keyMap={{ ArrowDown: 'next', ArrowUp: 'prev' }}
   * // Arrow left/right navigation
   * keyMap={{ ArrowRight: 'next', ArrowLeft: 'prev' }}
   * ```
   */
  keyMap?: Partial<Record<string, FocusDirection>>
  /**
   * @description_en Custom focus resolution function. Return the element to focus, or null to use default cycle.
   * @description_zh 自定义焦点解析函数。返回要聚焦的元素，或返回 null 使用默认循环行为。
   * @optional
   */
  onNavigate?: (
    current: HTMLElement | null,
    elements: HTMLElement[],
    direction: FocusDirection,
  ) => HTMLElement | null
  /**
   * @description_en Options passed to getTabbableElements.
   * @description_zh 传递给 getTabbableElements 的选项。
   * @optional
   */
  focusableOptions?: FocusableOptions
  /**
   * @description_en CSS class name for the container.
   * @description_zh 容器元素的 CSS 类名。
   * @optional
   */
  className?: string
  /**
   * @description_en Inline styles for the container.
   * @description_zh 容器元素的内联样式。
   * @optional
   */
  style?: React.CSSProperties
}

const defaultKeyMap: Record<string, FocusDirection> = { Tab: 'next' }

function getTargetIndex(
  currentIndex: number,
  elements: HTMLElement[],
  direction: FocusDirection,
): number {
  const last = elements.length - 1
  switch (direction) {
    case 'next':
      return currentIndex < last ? currentIndex + 1 : 0
    case 'prev':
      return currentIndex > 0 ? currentIndex - 1 : last
    case 'first':
      return 0
    case 'last':
      return last
  }
}

/**
 * @description_zh 焦点陷阱组件，将键盘焦点循环限制在容器内的可聚焦元素中，支持自定义按键映射和导航逻辑。
 * @description_en Focus trap component that constrains keyboard focus cycling to focusable elements within a container, with support for custom key mappings and navigation logic.
 * @component
 * @example
 * ```tsx
 * // Default Tab trapping
 * <FocusTrap>
 *   <input />
 *   <button>Save</button>
 * </FocusTrap>
 *
 * // Arrow key navigation
 * <FocusTrap keyMap={{ ArrowDown: 'next', ArrowUp: 'prev' }}>
 *   <input />
 *   <button>Save</button>
 * </FocusTrap>
 *
 * // With auto-focus and restore
 * <FocusTrap autoFocus restoreFocus>
 *   <input />
 *   <button>Save</button>
 * </FocusTrap>
 *
 * // Cross-list navigation: items from multiple lists are collected
 * // into a single focus order, seamlessly crossing between lists.
 * // ArrowDown from A-2 → B-1, ArrowUp from B-1 → A-2
 * <FocusTrap keyMap={{ ArrowDown: 'next', ArrowUp: 'prev' }}>
 *   <div>
 *     <h3>List A</h3>
 *     <button>A-1</button>
 *     <button>A-2</button>
 *   </div>
 *   <div>
 *     <h3>List B</h3>
 *     <button>B-1</button>
 *     <button>B-2</button>
 *   </div>
 * </FocusTrap>
 * ```
 */
export function FocusTrap({
  children,
  disabled = false,
  autoFocus = false,
  restoreFocus = false,
  keyMap,
  onNavigate,
  focusableOptions,
  className,
  style,
}: FocusTrapProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const getTabbable = useCallback(() => {
    if (!containerRef.current) return []
    return getTabbableElements(containerRef.current, focusableOptions)
  }, [focusableOptions])

  const focusElement = useCallback((element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      element.focus()
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return

      const mergedKeyMap = { ...defaultKeyMap, ...keyMap }
      let direction = mergedKeyMap[e.key]
      if (!direction) return

      e.preventDefault()
      e.stopPropagation()

      const elements = getTabbable()
      if (elements.length === 0) return

      if (e.key === 'Tab' && e.shiftKey) {
        direction = 'prev'
      }

      const currentElement = document.activeElement as HTMLElement | null
      const currentIndex = currentElement ? elements.indexOf(currentElement) : -1

      let target: HTMLElement | null = null

      if (onNavigate) {
        target = onNavigate(currentElement, elements, direction)
      }

      if (!target) {
        const targetIndex = getTargetIndex(currentIndex, elements, direction)
        target = elements[targetIndex]
      }

      focusElement(target)
    },
    [disabled, keyMap, onNavigate, getTabbable, focusElement],
  )

  useEffect(() => {
    if (disabled) return
    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [disabled, handleKeyDown])

  useEffect(() => {
    if (disabled || !autoFocus) return
    const elements = getTabbable()
    if (elements.length > 0) {
      elements[0].focus()
    }
  }, [disabled, autoFocus, getTabbable])

  useEffect(() => {
    if (disabled || !restoreFocus) return

    const prev = document.activeElement as HTMLElement | null
    if (prev && prev !== containerRef.current) {
      previousActiveElement.current = prev
    }

    return () => {
      const prev = previousActiveElement.current
      if (prev && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [disabled, restoreFocus])

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  )
}

FocusTrap.displayName = 'W/FocusTrap'
