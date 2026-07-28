import {type RefObject, useEffect, useRef, useState} from 'react'

export interface UseSwipeBackOptions {
  /**
   * @zh 是否启用手势。
   * @en Whether the gesture is enabled.
   * @default true
   */
  enabled?: boolean
  /**
   * @zh 触发拖拽的左边缘宽度(px)。
   * @en Left-edge width (px) that starts a drag.
   * @default 40
   */
  edgeWidth?: number
  /**
   * @zh 触发出栈的拖拽距离阈值(px)。未达到则回弹。
   * @en Drag distance (px) threshold to commit a pop. Below it the screen snaps back.
   * @default 80
   */
  threshold?: number
  /**
   * @zh 触发出栈的最大瞬时速度(px / ms)。超过即出栈,即使距离未达标。
   * @en Max instantaneous velocity (px/ms) that commits a pop regardless of distance.
   * @default 0.5
   */
  velocityThreshold?: number
  /**
   * @zh 松手时若手指正朝"取消"方向(向左,即朝屏幕内侧)运动,则强制回弹、不出栈,
   * 即使当前位移已超过 `threshold`。设为 false 则仅按距离/速度判定,忽略松手方向。
   *
   * 典型场景:先向右划 200px,反悔后再向左划回,松手时位置仍可能在阈值之上,
   * 但意图是"取消返回"。开启此项即可识别该意图并回弹。
   * @en When the finger is moving towards the "cancel" direction (leftwards, i.e. back into the
   * screen) on release, force a snap-back instead of committing a pop, even if the current offset
   * already exceeds `threshold`. Set to false to judge only by distance/velocity and ignore the
   * release direction.
   *
   * Typical scenario: drag right 200px, change your mind and drag back left; on release the position
   * may still be above the threshold, but the intent is "cancel". Enable this to recognize that
   * intent and snap back.
   * @default true
   */
  cancelOnReverseRelease?: boolean
  /**
   * @zh 判定"朝取消方向运动"的最小瞬时速度(px / ms)。松手瞬时速度(向左为负)的绝对值
   * 超过该值才视为明确的取消意图。过低会误判缓慢回划,过高则难以触发取消。
   * @en Minimum instantaneous velocity (px/ms) to count as a clear "cancel" motion. The absolute
   * value of the release velocity (leftwards is negative) must exceed this. Too low misjudges slow
   * drag-backs; too high makes canceling hard to trigger.
   * @default 0.1
   */
  cancelVelocity?: number
}

export interface UseSwipeBackResult {
  /**
   * @zh 是否正在拖拽(用于禁用 transition 以跟手)。
   * @en Whether a drag is in progress (used to disable transition for finger-following).
   */
  isDragging: boolean
}

/**
 * @zh 边缘左滑返回手势 hook。通过原生(非 passive)触摸监听器绑定到容器,确保拖拽时可阻止页面滚动。
 * 仅当触摸起点落在容器左边缘 `edgeWidth` 范围内且栈非空时激活。松手后根据距离、速度与松手方向
 * 决定出栈或回弹。
 *
 * @en Edge swipe-back gesture hook. Binds to the container via native (non-passive) touch listeners so
 * that page scrolling can be prevented during a drag. Activates only when the touch starts within
 * `edgeWidth` of the left edge and the stack is non-empty. On release, commits a pop or snaps back
 * based on distance, velocity, and release direction.
 *
 * @param containerRef 容器元素 ref / container element ref
 * @param canPop 当前栈是否可出栈 / whether the stack can be popped
 * @param onCommit 决定出栈时回调,接收松手时的横向位移 / callback when a pop commits, receives release offset
 */
export function useSwipeBack(
  containerRef: RefObject<HTMLElement | null>,
  canPop: () => boolean,
  onCommit: (releaseX: number) => void,
  options: UseSwipeBackOptions = {},
): UseSwipeBackResult {
  const {
    enabled = true,
    edgeWidth = 40,
    threshold = 80,
    velocityThreshold = 0.5,
    cancelOnReverseRelease = true,
    cancelVelocity = 0.1,
  } = options

  // isDragging 用 state(低频:仅 touchstart/touchend 触发),用于切换 transition 开关
  const [isDragging, setIsDragging] = useState(false)

  // 拖拽状态用 ref 存,避免每次 move 都触发依赖重建
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  // 最近两次 move 的位置/时间,用于计算松手时的瞬时速度与方向
  const prevMoveXRef = useRef(0)
  const prevMoveTimeRef = useRef(0)
  const lastMoveXRef = useRef(0)
  const lastMoveTimeRef = useRef(0)
  const decidedAxisRef = useRef(false) // 是否已确定主轴(横向)
  const onCommitRef = useRef(onCommit)
  const canPopRef = useRef(canPop)

  // 保持回调最新,但不重新绑定监听器
  useEffect(() => {
    onCommitRef.current = onCommit
    canPopRef.current = canPop
  })

  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    // 直接通过 CSS 变量更新拖拽位移,绕过 React 渲染(60-120fps 的 touchmove 不触发重渲染)
    const setDragVar = (x: number) => {
      el.style.setProperty('--appstack-drag-x', `${x}px`)
    }

    const onStart = (e: TouchEvent) => {
      if (!canPopRef.current()) return
      const touch = e.touches[0]
      if (!touch) return
      // 以容器左边缘为基准判断是否落在触发区域内,支持容器非全屏(如居中手机外壳)的场景
      const rect = el.getBoundingClientRect()
      if (touch.clientX - rect.left > edgeWidth) return

      draggingRef.current = true
      decidedAxisRef.current = false
      startXRef.current = touch.clientX
      startYRef.current = touch.clientY
      prevMoveXRef.current = touch.clientX
      prevMoveTimeRef.current = Date.now()
      lastMoveXRef.current = touch.clientX
      lastMoveTimeRef.current = prevMoveTimeRef.current
      setIsDragging(true)
    }

    const onMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      const touch = e.touches[0]
      if (!touch) return

      const dx = touch.clientX - startXRef.current
      const dy = touch.clientY - startYRef.current

      // 首次 move 判定主轴:若竖向位移更大,则放弃本次手势,交还给浏览器滚动
      if (!decidedAxisRef.current) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) {
          draggingRef.current = false
          setIsDragging(false)
          setDragVar(0)
          return
        }
        if (Math.abs(dx) > 4) {
          decidedAxisRef.current = true
        }
      }

      if (!decidedAxisRef.current) return

      // 横向拖拽时阻止页面滚动(原生非 passive 监听器才能生效)
      e.preventDefault()

      const now = Date.now()
      // 滚动采样窗口:保留上一帧,便于松手时计算瞬时速度
      prevMoveXRef.current = lastMoveXRef.current
      prevMoveTimeRef.current = lastMoveTimeRef.current
      lastMoveXRef.current = touch.clientX
      lastMoveTimeRef.current = now

      // 只允许向右拖(出栈方向),向左夹到 0。直接写 CSS 变量,不触发 React 渲染
      setDragVar(Math.max(0, dx))
    }

    const finish = () => {
      if (!draggingRef.current) return
      // 松手时的位移(以起点为基准,向右为正)
      const distance = Math.max(0, lastMoveXRef.current - startXRef.current)

      // 瞬时速度:用最近两帧的位移差 / 时间差,符号保留(向右为正,向左为负)
      const dt = Math.max(1, lastMoveTimeRef.current - prevMoveTimeRef.current)
      const instantVelocity = (lastMoveXRef.current - prevMoveXRef.current) / dt

      draggingRef.current = false
      setIsDragging(false)
      // 重置 CSS 变量,交回 React 控制回弹/滑出过渡
      setDragVar(0)

      // 1) 取消意图:松手时手指正朝"取消"方向(向左)运动且速度足够,强制回弹
      if (
        cancelOnReverseRelease &&
        instantVelocity < 0 &&
        Math.abs(instantVelocity) >= cancelVelocity
      ) {
        return
      }

      // 2) 否则按距离 / 速度判定是否出栈
      const shouldCommit = distance >= threshold || Math.abs(instantVelocity) >= velocityThreshold
      if (shouldCommit) {
        onCommitRef.current(distance)
      }
    }

    const onEnd = () => finish()
    const onCancel = () => {
      draggingRef.current = false
      setIsDragging(false)
      setDragVar(0)
    }

    // passive: false 才能在 touchmove 里 preventDefault 阻止滚动
    el.addEventListener('touchstart', onStart, {passive: true})
    el.addEventListener('touchmove', onMove, {passive: false})
    el.addEventListener('touchend', onEnd, {passive: true})
    el.addEventListener('touchcancel', onCancel, {passive: true})

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [
    enabled,
    edgeWidth,
    threshold,
    velocityThreshold,
    cancelOnReverseRelease,
    cancelVelocity,
    containerRef,
  ])

  return {isDragging}
}
