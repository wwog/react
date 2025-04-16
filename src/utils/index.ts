import React from "react";
/**
 * @description 性能优化，替代 React.Children.forEach, 回调可以返回 false 来中断循环
 * @description_en Replace React.Children.forEach, the callback can return false to interrupt the loop
 */
export function childrenLoop(
  children: React.ReactNode | undefined,
  callback: (child: React.ReactNode, index: number) => boolean | void
): void {
  if (children === undefined) return;
  let index = 0;
  if (Array.isArray(children)) {
    for (const child of children) {
      const shouldContinue = callback(child, index++);
      if (shouldContinue === false) {
        break;
      }
    }
  } else {
    callback(children, index);
  }
}
