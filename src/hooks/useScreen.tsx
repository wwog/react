import React, { createContext, useContext, useEffect, useState } from "react";
import {
  breakpoints,
  DefBreakpointDesc,
  type BreakpointDesc,
  type BreakpointName,
} from "../utils";

const reverseBreakpoints = [...breakpoints].reverse();

export function getCurrentBreakpoint(
  breakpointDesc: BreakpointDesc,
  width: number
): BreakpointName {
  for (const bp of reverseBreakpoints) {
    const bpValue = breakpointDesc[bp];
    if (bpValue !== undefined && !Number.isNaN(bpValue) && width >= bpValue) {
      return bp;
    }
  }
  return "base";
}

export function useScreen(breakpointDesc: BreakpointDesc = DefBreakpointDesc) {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointName>(
    getCurrentBreakpoint(breakpointDesc, window.innerWidth)
  );

  useEffect(() => {
    let mediaQueries: MediaQueryList[] = [];
    let listeners: (() => void)[] = [];

    const updateMediaQueries = () => {
      // 清理旧的监听器
      listeners.forEach((removeListener) => removeListener());
      mediaQueries = [];
      listeners = [];

      // 计算当前断点
      const currentBp = getCurrentBreakpoint(breakpointDesc, window.innerWidth);
      setCurrentBreakpoint(currentBp);

      // 找到当前断点的索引
      const currentIndex = breakpoints.indexOf(currentBp);

      // 监听下一个断点（min-width）
      const nextBp = breakpoints[currentIndex + 1];
      if (nextBp && breakpointDesc[nextBp] !== undefined) {
        const nextMinWidth = breakpointDesc[nextBp];
        if (!Number.isNaN(nextMinWidth)) {
          const mediaQuery = window.matchMedia(
            `(min-width: ${nextMinWidth}px)`
          );
          mediaQueries.push(mediaQuery);
          const handleMediaChange = () => updateMediaQueries();
          mediaQuery.addEventListener("change", handleMediaChange);
          listeners.push(() =>
            mediaQuery.removeEventListener("change", handleMediaChange)
          );
        } else {
          throw new Error(
            `Invalid breakpoint value for ${nextBp}: ${breakpointDesc[nextBp]}`
          );
        }
      }

      // 监听上一个断点（max-width）
      const prevBp = breakpoints[currentIndex - 1];
      if (prevBp && breakpointDesc[prevBp] !== undefined) {
        const prevMinWidth = breakpointDesc[prevBp];
        if (!Number.isNaN(prevMinWidth)) {
          const mediaQuery = window.matchMedia(
            `(max-width: ${prevMinWidth - 1}px)`
          );
          mediaQueries.push(mediaQuery);
          const handleMediaChange = () => updateMediaQueries();
          mediaQuery.addEventListener("change", handleMediaChange);
          listeners.push(() =>
            mediaQuery.removeEventListener("change", handleMediaChange)
          );
        } else {
          throw new Error(
            `Invalid breakpoint value for ${prevBp}: ${breakpointDesc[prevBp]}`
          );
        }
      }
    };

    // 初次执行
    updateMediaQueries();

    // 清理函数
    return () => {
      listeners.forEach((removeListener) => removeListener());
    };
  }, [breakpointDesc]);

  return currentBreakpoint;
}

const BreakpointContext = createContext<BreakpointName>("base");

export function BreakpointProvider({
  children,
  breakpointDesc,
}: {
  children: React.ReactNode;
  breakpointDesc?: BreakpointDesc;
}) {
  const breakpoint = useScreen(breakpointDesc);
  return (
    <BreakpointContext.Provider value={breakpoint}>
      {children}
    </BreakpointContext.Provider>
  );
}

export function useBreakpoint() {
  return useContext(BreakpointContext);
}
