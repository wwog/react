import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
  type CSSProperties,
  type ComponentType,
} from 'react'
import {cx} from '../../utils/cx'
import {createStackStore, type StackEntry, type StackStore} from './stackStore'
import {useSwipeBack} from './useSwipeBack'

const SENTINEL_STATE = {appStackSentinel: true}

function hasSentinel(entry: unknown): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    (entry as Record<string, unknown>).appStackSentinel === true
  )
}

const PARALLAX = 0.3

/**
 * @zh `useAppStack()` 返回的导航 API。每个方法绑定到最近的 `AppStackRouter` 实例。
 * @en Navigation API returned by `useAppStack()`. Each method is bound to the nearest `AppStackRouter`.
 */
export interface AppStackApi {
  /**
   * @zh 压入一个新屏幕到栈顶。`params` 会作为 props 透传给该组件。
   * @en Push a new screen onto the top. `params` are forwarded as props.
   */
  push: <P = any>(Component: ComponentType<P>, params?: P) => void
  /**
   * @zh 弹出栈顶屏幕。栈空时为空操作。
   * @en Pop the top screen. No-op when empty.
   */
  pop: () => void
  /**
   * @zh 替换栈顶屏幕,不改变栈深度。空栈时退化为 push。
   * @en Replace the top screen without changing depth. Degrades to push on an empty stack.
   */
  replace: <P = any>(Component: ComponentType<P>, params?: P) => void
  /**
   * @zh 清空整个堆栈,回到根屏幕(无过渡动画)。
   * @en Clear the entire stack, returning to the root screen (no transition).
   */
  reset: () => void
  /**
   * @zh 当前栈是否可出栈(深度 > 0)。
   * @en Whether the stack can be popped (depth > 0).
   */
  canPop: () => boolean
  /**
   * @zh 当前栈深度(不含根屏幕)。
   * @en Current stack depth (excludes the root screen).
   */
  size: number
}

interface ExitingView {
  entry: StackEntry
  startX: number
}

interface AppStackContextValue {
  store: StackStore
  /**
   * @zh 程序式 pop。与浏览器返回键触发的 pop 不同:程序式 pop 会同步 `history.back()` 以保持历史一致。
   * @en Programmatic pop. Unlike a browser-back-triggered pop, this also calls `history.back()` to
   * keep the history stack consistent.
   */
  programmaticPop: () => void
  /**
   * @zh replace 的实现(含出场视图清理)。
   * @en replace implementation (includes exiting-view cleanup).
   */
  doReplace: <P = any>(Component: ComponentType<P>, params?: P) => void
  /**
   * @zh reset 的实现(含出场视图清理)。
   * @en reset implementation (includes exiting-view cleanup).
   */
  doReset: () => void
}

const AppStackContext = createContext<AppStackContextValue | null>(null)

/**
 * @zh 在 `AppStackRouter` 内部任意子组件中获取导航 API。在 Router 外调用会抛错。
 *
 * 注意:`size` 与 `canPop()` 会在堆栈变化时同步更新(内部通过 `useSyncExternalStore` 订阅)。
 * @en Obtain the navigation API from any descendant of `AppStackRouter`. Throws when used outside.
 *
 * Note: `size` and `canPop()` stay in sync with the stack (subscribed internally via
 * `useSyncExternalStore`).
 */
export function useAppStack(): AppStackApi {
  const ctx = useContext(AppStackContext)
  if (!ctx) {
    throw new Error(
      'useAppStack() must be used within an <AppStackRouter>. Wrap your tree with <AppStackRouter root={...}>.',
    )
  }
  const {store, programmaticPop, doReplace, doReset} = ctx
  // 订阅堆栈,使 size / canPop 在栈变化时触发重渲染
  const stack = store.useStack()
  const size = stack.length

  return useMemo<AppStackApi>(
    () => ({
      push: store.push,
      pop: programmaticPop,
      replace: doReplace,
      reset: doReset,
      canPop: store.canPop,
      size,
    }),
    [store, programmaticPop, doReplace, doReset, size],
  )
}

export interface AppStackRouterProps {
  /**
   * @description_zh 根屏幕,始终位于栈底并被渲染。刷新后回到这里。
   * @description_en Root screen, always at the bottom and rendered. The app returns here on refresh.
   */
  root: React.ReactElement
  /**
   * @description_zh 最大栈深度,超过则丢弃最底层屏幕以释放内存。默认无限制。
   * @description_en Max stack depth; the bottom screen is dropped when exceeded. Default unlimited.
   * @optional
   */
  maxStackSize?: number
  /**
   * @description_zh 是否启用边缘左滑返回手势。
   * @description_en Whether the edge swipe-back gesture is enabled.
   * @default true
   */
  swipeBack?: boolean
  /**
   * @description_zh 触发拖拽的左边缘宽度(px)。
   * @description_en Left-edge width (px) that starts a drag.
   * @default 40
   */
  swipeBackEdgeWidth?: number
  /**
   * @description_zh 松手时若手指正朝"取消"方向(向左)运动,则强制回弹、不出栈,
   * 即使当前位移已超过阈值。设为 false 则仅按距离/速度判定。典型场景:向右划出后反悔、
   * 向左划回,松手时位置仍在阈值之上但意图是取消返回。
   * @description_en When the finger is moving towards the "cancel" direction (leftwards) on release,
   * force a snap-back instead of committing a pop, even if the offset already exceeds the threshold.
   * Set to false to judge only by distance/velocity. Typical scenario: drag out to the right, change
   * your mind and drag back left; on release the position is still above the threshold but the intent
   * is to cancel.
   * @default true
   */
  swipeBackCancelOnReverseRelease?: boolean
  /**
   * @description_zh 判定"朝取消方向运动"的最小瞬时速度(px / ms)。
   * @description_en Minimum instantaneous velocity (px/ms) to count as a clear "cancel" motion.
   * @default 0.1
   */
  swipeBackCancelVelocity?: number
  /**
   * @description_zh 是否启用安全区域(env(safe-area-inset-*))内边距。
   * @description_en Whether to apply safe-area (env(safe-area-inset-*)) padding.
   * @default true
   */
  safeArea?: boolean
  /**
   * @description_zh 进出场过渡时长(ms)。设为 0 可禁用过渡。
   * @description_en Enter/exit transition duration (ms). Set to 0 to disable.
   * @default 300
   */
  transitionDuration?: number
  /**
   * @description_zh 是否以视口高度(100dvh)撑满整个屏幕。移动端单页应用建议保持开启;
   * 若需嵌入到已具备高度的父容器内,可设为 false(此时容器高度为 100%,依赖父级高度)。
   * @description_en Whether to fill the whole screen via viewport height (100dvh). Recommended on for
   * mobile SPAs; set to false to embed inside a parent that already has a height (the container then
   * uses 100% height, depending on the parent).
   * @default true
   */
  fullscreen?: boolean
  /**
   * @description_zh 容器 className。
   * @description_en Container className.
   * @optional
   */
  className?: string
  /**
   * @description_zh 容器内联样式。
   * @description_en Container inline style.
   * @optional
   */
  style?: CSSProperties
  /**
   * @description_zh 渲染在堆栈之上的全局叠层(如 toast)。不受手势/过渡影响。
   * @description_en Global overlay rendered above the stack (e.g. toast). Unaffected by gestures/transitions.
   * @optional
   */
  children?: ReactNode
}

/**
 * @description_zh 移动端 H5 单页应用风格的堆栈视图容器。屏幕切换后被压入堆栈并 keep-alive(不卸载),
 * 支持编程式导航、边缘左滑返回、拦截浏览器返回键、安全区域适配。不引入任何额外依赖。
 *
 * 使用前建议在 HTML 中设置 `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
 * 以让 `env(safe-area-inset-*)` 生效。
 *
 * @description_en A mobile-app-style stack view container for H5 SPAs. Screens are pushed onto a
 * stack and kept alive (not unmounted). Supports programmatic navigation, edge swipe-back, browser
 * back-button interception, and safe-area adaptation. Zero extra dependencies.
 *
 * For `env(safe-area-inset-*)` to take effect, set
 * `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` in HTML.
 * @component
 * @example
 * ```tsx
 * function Home() {
 *   const { push } = useAppStack()
 *   return <button onClick={() => push(Profile, { id: 1 })}>Open Profile</button>
 * }
 *
 * function Profile({ id }: { id: number }) {
 *   const { pop } = useAppStack()
 *   return <button onClick={pop}>Back</button>
 * }
 *
 * <AppStackRouter root={<Home />} />
 * ```
 */
export function AppStackRouter({
  root,
  maxStackSize,
  swipeBack = true,
  swipeBackEdgeWidth = 40,
  swipeBackCancelOnReverseRelease = true,
  swipeBackCancelVelocity = 0.1,
  safeArea = true,
  transitionDuration = 300,
  fullscreen = true,
  className,
  style,
  children,
}: AppStackRouterProps): ReactNode {
  const store = useMemo(() => createStackStore(maxStackSize), [maxStackSize])
  const stack = store.useStack()

  const containerRef = useRef<HTMLDivElement>(null)

  // 跟踪容器实际宽度:视差位移 / 入场位移 / 拖拽阻尼都应基于容器宽度,
  // 而非 window.innerWidth(容器可能小于视口,如居中的手机外壳)。
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 标记正在执行程序式 history.back(),避免其触发的 popstate 再次出栈造成双弹
  const handlingProgrammaticBackRef = useRef(false)

  // 出场中的屏幕(过渡完成前保留,以保证 pop 动画播放)
  const [exitingViews, setExitingViews] = useState<ExitingView[]>([])

  // --- pop 的核心:从活跃栈移除顶层,加入 exiting 直到过渡结束 ---
  // 所有 pop 路径(浏览器返回键 / 程序式 / 左滑)都汇聚到这里,统一获得出场动画
  const performPop = useCallback(
    (startX = 0) => {
      const prev = store.getStack()
      if (prev.length === 0) return
      const removed = prev[prev.length - 1]
      store.pop()
      setExitingViews((cur) => [...cur, {entry: removed, startX}])
    },
    [store],
  )

  // 过渡结束后清理 exiting
  useEffect(() => {
    if (exitingViews.length === 0) return
    const t = window.setTimeout(
      () => setExitingViews([]),
      transitionDuration + 60,
    )
    return () => window.clearTimeout(t)
  }, [exitingViews, transitionDuration])

  // --- 浏览器返回键拦截 ---
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasSentinel(window.history.state)) {
      window.history.pushState(SENTINEL_STATE, '')
    }

    const onPopstate = () => {
      if (handlingProgrammaticBackRef.current) {
        handlingProgrammaticBackRef.current = false
        // 程序式 back 消耗了哨兵,补回一个以维持拦截层
        window.history.pushState(SENTINEL_STATE, '')
        return
      }
      if (store.canPop()) {
        // 用户按了浏览器返回:出栈(走 performPop 以获得动画),并补一个哨兵维持拦截层
        performPop(0)
        window.history.pushState(SENTINEL_STATE, '')
      }
      // 栈空则放行:不补哨兵,允许真正离开页面
    }

    window.addEventListener('popstate', onPopstate)
    return () => {
      window.removeEventListener('popstate', onPopstate)
      // 卸载时若遗留哨兵,清理掉以免污染历史
      if (hasSentinel(window.history.state)) {
        handlingProgrammaticBackRef.current = true
        window.history.back()
      }
    }
  }, [store, performPop])

  // --- 程序式 pop:先出栈(带动画),再用 history.back() 同步历史 ---
  const programmaticPop = useCallback(() => {
    if (!store.canPop()) return
    performPop(0)
    if (typeof window !== 'undefined') {
      handlingProgrammaticBackRef.current = true
      window.history.back()
    }
  }, [store, performPop])

  // --- 左滑返回手势(原生监听器,可阻止滚动) ---
  const {dragX, isDragging} = useSwipeBack(
    containerRef,
    store.canPop,
    (releaseX) => performPop(releaseX),
    {
      enabled: swipeBack,
      edgeWidth: swipeBackEdgeWidth,
      cancelOnReverseRelease: swipeBackCancelOnReverseRelease,
      cancelVelocity: swipeBackCancelVelocity,
    },
  )

  // --- replace / reset:清空出场视图后操作栈(避免残留动画) ---
  const doReplace = useCallback(
    <P = any,>(Component: ComponentType<P>, params?: P) => {
      setExitingViews([])
      store.replace(Component, params)
    },
    [store],
  )
  const doReset = useCallback(() => {
    setExitingViews([])
    store.reset()
  }, [store])

  const contextValue = useMemo<AppStackContextValue>(
    () => ({store, programmaticPop, doReplace, doReset}),
    [store, programmaticPop, doReplace, doReset],
  )

  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    // fullscreen: 用视口高度撑满屏幕(不依赖父级高度);否则用 100%,需父级提供高度
    ...(fullscreen
      ? {height: '100dvh'}
      : {height: '100%'}),
    ...(safeArea
      ? {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }
      : null),
    ...style,
  }

  const exitingIds = useMemo(
    () => new Set(exitingViews.map((v) => v.entry.id)),
    [exitingViews],
  )
  const activeViews = stack.filter((e) => !exitingIds.has(e.id))

  return (
    <AppStackContext.Provider value={contextValue}>
      <div ref={containerRef} className={cx(className)} style={containerStyle}>
        {/* 根屏幕 */}
        <ScreenLayer
          kind="root"
          isTop={activeViews.length === 0}
          isExiting={false}
          dragX={dragX}
          isDragging={isDragging}
          parallax={PARALLAX}
          transitionDuration={transitionDuration}
          width={containerWidth}
        >
          {root}
        </ScreenLayer>

        {/* 活跃堆栈屏幕 */}
        {activeViews.map((entry, i) => {
          const isTop = i === activeViews.length - 1
          // 拖拽顶层时,正下方的被覆盖层也要同步跟随露出(否则顶层右侧留白)。
          // 因此拖拽期间,所有活跃层都接收 dragX 与 isDragging。
          return (
            <ScreenLayer
              key={entry.id}
              kind="stack"
              entry={entry}
              isTop={isTop}
              isExiting={false}
              dragX={dragX}
              isDragging={isDragging}
              parallax={PARALLAX}
              transitionDuration={transitionDuration}
              width={containerWidth}
            />
          )
        })}

        {/* 出场中屏幕 */}
        {exitingViews.map((view) => (
          <ScreenLayer
            key={view.entry.id}
            kind="stack"
            entry={view.entry}
            isTop={false}
            isExiting
            exitStartX={view.startX}
            dragX={0}
            isDragging={false}
            parallax={PARALLAX}
            transitionDuration={transitionDuration}
            width={containerWidth}
          />
        ))}

        {children}
      </div>
    </AppStackContext.Provider>
  )
}

interface ScreenLayerBaseProps {
  kind: 'root' | 'stack'
  isTop: boolean
  isExiting: boolean
  dragX: number
  isDragging: boolean
  parallax: number
  transitionDuration: number
  /** @zh 容器宽度(px),用于计算视差/入场/出场位移 */
  width: number
}

interface ScreenLayerRootProps extends ScreenLayerBaseProps {
  kind: 'root'
  children: ReactNode
}

interface ScreenLayerStackProps extends ScreenLayerBaseProps {
  kind: 'stack'
  entry: StackEntry
  /** @zh 出场起始位移(px),仅 isExiting 时使用 */
  exitStartX?: number
}

type ScreenLayerProps = ScreenLayerRootProps | ScreenLayerStackProps

/**
 * 单个屏幕层。目标位移由其在栈中的角色决定,CSS transition 负责动画:
 * - 根层:顶层时归位,被覆盖时随拖拽按比例露出(视差)
 * - 顶层活跃:拖拽中跟手(dragX),否则 0
 * - 被覆盖活跃:隐藏在视差位置,拖拽时按比例露出
 * - 进入层:首帧 width,下一帧切到目标以触发入场动画
 * - 出场层:首帧停在 exitStartX,下一帧滑到 width 触发出场动画
 */
function ScreenLayer(props: ScreenLayerProps): ReactNode {
  const {
    kind,
    isTop,
    isExiting,
    dragX,
    isDragging,
    parallax,
    transitionDuration,
    width,
  } = props

  // 进入/出场都依赖"首帧用初始值,下一帧切到目标值"来触发 CSS transition
  const [transitioned, setTransitioned] = useState(false)

  useEffect(() => {
    if (kind === 'root') return
    const raf = requestAnimationFrame(() => setTransitioned(true))
    return () => cancelAnimationFrame(raf)
  }, [kind])

  // 容器宽度由父级传入(基于实际容器尺寸,而非 window.innerWidth)
  const w = width

  let translateX: number
  if (kind === 'root') {
    // 根屏幕:顶层时归位,被覆盖时随拖拽按比例露出(视差)
    translateX = isTop ? 0 : -parallax * w + dragX * parallax
  } else if (isExiting) {
    // 出场:首帧停在拖拽释放位置,下一帧滑出屏幕右侧
    const startX = props.exitStartX ?? 0
    translateX = transitioned ? w : startX
  } else if (!transitioned) {
    // 进入首帧:从屏幕右侧外切入
    translateX = w
  } else if (isTop) {
    translateX = isDragging ? dragX : 0
  } else {
    // 被覆盖:隐藏在视差位置,拖拽时按比例露出
    translateX = -parallax * w + dragX * parallax
  }

  const layerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transform: `translateX(${translateX}px)`,
    transition: isDragging
      ? 'none'
      : `transform ${transitionDuration}ms ease-out`,
    willChange: 'transform',
    background: '#fff',
    pointerEvents: isTop && !isExiting ? 'auto' : 'none',
  }

  return (
    <div style={layerStyle}>
      {kind === 'root' ? (
        props.children
      ) : (
        <props.entry.Component {...props.entry.params} />
      )}
    </div>
  )
}

AppStackRouter.displayName = 'W/AppStackRouter'
