import {useEffect, useMemo, useRef, useState} from 'react'
import {type BreakpointDesc, type BreakpointName, DefBreakpointDesc, breakpoints} from '../utils'

const reverseBreakpoints = [...breakpoints].reverse()

const isBrowser = typeof window !== 'undefined'

export function getCurrentBreakpoint(
  breakpointDesc: BreakpointDesc,
  width: number,
): BreakpointName {
  for (const bp of reverseBreakpoints) {
    const bpValue = breakpointDesc[bp]
    if (bpValue !== undefined && !Number.isNaN(bpValue) && width >= bpValue) {
      return bp
    }
  }
  return 'base'
}

export function useScreen(breakpointDesc: BreakpointDesc = DefBreakpointDesc) {
  // 用 JSON 序列化稳定化对象引用，避免调用方每次传字面量对象导致 effect 无限重跑
  const stableKey = useMemo(() => JSON.stringify(breakpointDesc), [breakpointDesc])
  const descRef = useRef(breakpointDesc)
  descRef.current = breakpointDesc

  const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointName>(
    // lazy initializer：SSR 环境下 window 不存在，fallback 到 "base"
    () => (isBrowser ? getCurrentBreakpoint(breakpointDesc, window.innerWidth) : 'base'),
  )

  useEffect(() => {
    if (!isBrowser) return

    let mediaQueries: MediaQueryList[] = []
    let listeners: (() => void)[] = []

    const updateMediaQueries = () => {
      listeners.forEach((removeListener) => removeListener())
      mediaQueries = []
      listeners = []

      const desc = descRef.current
      const currentBp = getCurrentBreakpoint(desc, window.innerWidth)
      setCurrentBreakpoint(currentBp)

      const currentIndex = breakpoints.indexOf(currentBp)

      const nextBp = breakpoints[currentIndex + 1]
      if (nextBp && desc[nextBp] !== undefined) {
        const nextMinWidth = desc[nextBp]
        if (!Number.isNaN(nextMinWidth)) {
          const mediaQuery = window.matchMedia(`(min-width: ${nextMinWidth}px)`)
          mediaQueries.push(mediaQuery)
          const handleMediaChange = () => updateMediaQueries()
          mediaQuery.addEventListener('change', handleMediaChange)
          listeners.push(() => mediaQuery.removeEventListener('change', handleMediaChange))
        } else {
          throw new Error(`Invalid breakpoint value for ${nextBp}: ${desc[nextBp]}`)
        }
      }

      const prevBp = breakpoints[currentIndex - 1]
      if (prevBp && desc[prevBp] !== undefined) {
        const prevMinWidth = desc[prevBp]
        if (!Number.isNaN(prevMinWidth)) {
          const mediaQuery = window.matchMedia(`(max-width: ${prevMinWidth - 1}px)`)
          mediaQueries.push(mediaQuery)
          const handleMediaChange = () => updateMediaQueries()
          mediaQuery.addEventListener('change', handleMediaChange)
          listeners.push(() => mediaQuery.removeEventListener('change', handleMediaChange))
        } else {
          throw new Error(`Invalid breakpoint value for ${prevBp}: ${desc[prevBp]}`)
        }
      }
    }

    updateMediaQueries()

    return () => {
      listeners.forEach((removeListener) => removeListener())
    }
    // stableKey 作为稳定化的依赖，替代直接依赖 breakpointDesc 对象引用
    // biome-ignore lint/correctness/useExhaustiveDependencies: stableKey is the stable proxy for breakpointDesc object identity
  }, [stableKey])

  return currentBreakpoint
}
