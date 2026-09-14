import React, {act as reactAct, useState, type ReactNode} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, render} from 'vitest-browser-react'
import {
  FrameRender,
  type FrameRenderHandle,
  type FrameRenderProps,
  type FrameScheduler,
} from './FrameRender'

/**
 * React 的 act 封装。vitest-browser-react 会在它自己的 act 结束后把
 * `IS_REACT_ACT_ENVIRONMENT` 复位成 false，于是这里每次状态更新都会打出"未配置 act"的告警。
 * 在自己的 act 期间把标志位置回 true，结束后还原。
 */
const act = (callback: () => void): void => {
  const scope = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}
  const previous = scope.IS_REACT_ACT_ENVIRONMENT
  scope.IS_REACT_ACT_ENVIRONMENT = true
  try {
    reactAct(callback)
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = previous
  }
}

//#region 帧调度与可控时钟

interface ManualFrames {
  scheduler: FrameScheduler
  /** 触发当前已预约的帧（本次新预约的帧留到下一次），默认用当前时钟。 */
  runFrame: (time?: number) => void
  /** 当前已预约但未触发的帧数。 */
  booked: () => number
}

/**
 * 可控时钟。组件的捕获阶段读 `performance.now()`，泵的帧时间由注入的调度器给出，两者共用
 * 同一个时钟，所以时间门（含 4ms 相位容差）在测试里是完全确定的。
 */
let clockMs = 0

const advance = (ms: number): void => {
  clockMs += ms
}

const createFrames = (): ManualFrames => {
  const tasks = new Map<number, (time: number) => void>()
  let seq = 0
  return {
    scheduler: (callback) => {
      const id = ++seq
      tasks.set(id, callback)
      return () => {
        tasks.delete(id)
      }
    },
    runFrame: (time = clockMs) => {
      const booked = [...tasks.values()]
      tasks.clear()
      for (const callback of booked) callback(time)
    },
    booked: () => tasks.size,
  }
}

interface ProbeProps {
  value: number
  onClick?: () => void
}

const createProbe = () => {
  const record = {renders: 0, props: [] as ProbeProps[]}
  const Probe = (props: ProbeProps) => {
    record.renders++
    record.props.push(props)
    return <span data-testid="probe">{props.value}</span>
  }
  return {record, Probe}
}

interface HostOptions {
  /** 覆盖 fps / leading / trailing / select 等配置。 */
  config?: Partial<FrameRenderProps<ProbeProps>>
  /** 由父组件状态推导子组件 props，用来制造"值相等但引用不同"等场景。 */
  childProps?: (value: number) => ProbeProps
}

interface HostState {
  /** 改变传给子组件的值。 */
  set: (value: number) => void
  /** 只让父组件重渲染，不改动传给子组件的值。 */
  bump: () => void
}

const createHost = (
  frames: ManualFrames,
  Probe: (props: ProbeProps) => ReactNode,
  handle: {current: FrameRenderHandle | null},
  options: HostOptions = {},
) => {
  const childProps = options.childProps ?? ((value: number): ProbeProps => ({value}))
  const state: HostState = {set: () => {}, bump: () => {}}
  const Host = () => {
    const [value, setValue] = useState(0)
    const [, setNoise] = useState(0)
    state.set = setValue
    state.bump = () => setNoise((n) => n + 1)
    return (
      <FrameRender<ProbeProps>
        fps={10}
        scheduler={frames.scheduler}
        warn={false}
        {...options.config}
        ref={handle}
      >
        <Probe {...childProps(value)} />
      </FrameRender>
    )
  }
  return {Host, state}
}

const originalNow = performance.now

beforeEach(() => {
  clockMs = 0
  Object.defineProperty(performance, 'now', {
    configurable: true,
    writable: true,
    value: () => clockMs,
  })
})

afterEach(() => {
  Object.defineProperty(performance, 'now', {
    configurable: true,
    writable: true,
    value: originalNow,
  })
})

//#endregion 帧调度与可控时钟

describe('FrameRender', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    cleanup()
    container.remove()
  })

  // 提示在整个模块内只打一次，所以这条必须最先跑。
  it('开发环境挂载时提示一次：只适合无状态子组件', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const frames = createFrames()
    const Plain = () => <span data-testid="probe">plain</span>

    render(
      <FrameRender<Record<string, never>> scheduler={frames.scheduler}>
        <Plain />
      </FrameRender>,
      {container},
    )

    expect(spy).toHaveBeenCalledTimes(1)
    const message = String(spy.mock.calls[0]![0])
    expect(message).toContain('只适合渲染无状态子组件')
    expect(message).toContain('抽离到 FrameRender 外层')
    expect(message).toContain('stateless children')
    spy.mockRestore()
  })

  it('窗口内多次父渲染只提交一次，且携带最新值', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle)

    render(<Host />, {container})
    for (const value of [1, 2, 3, 4, 5]) act(() => state.set(value))

    // 5 次父渲染之后，子组件仍停在挂载时的那一次
    expect(record.renders).toBe(1)

    act(() => frames.runFrame())

    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(5)
    const stats = handle.current!.getStats()
    expect(stats.commits).toBe(1)
    expect(stats.captures).toBe(5)
    // 5 次父渲染里有 4 次被合帧抑制
    expect(stats.coalesced).toBe(4)
  })

  it('值相等时跳过提交：子组件连 props 都不会再收到一次', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle)

    render(<Host />, {container})

    // 父组件重渲染 3 次，每次都新建元素与 props 对象，但值完全一样
    for (let i = 0; i < 3; i++) act(() => state.bump())
    act(() => frames.runFrame())

    expect(handle.current!.getStats().skips).toBe(1)
    expect(record.renders).toBe(1)
    // 子组件只拿到过一个 props 对象 —— 这就是"props 不会重复传递"
    expect(record.props).toHaveLength(1)
  })

  it('挂载后不预约任何帧：空闲成本为零', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host} = createHost(frames, Probe, handle)

    render(<Host />, {container})

    // 首帧已在初始渲染里交付，没有待处理值，所以连帧都不预约
    expect(frames.booked()).toBe(0)
    act(() => frames.runFrame())
    expect(record.renders).toBe(1)
    const stats = handle.current!.getStats()
    expect(stats.commits).toBe(0)
    expect(stats.frames).toBe(0)
  })

  it('fps 时间门：门未开不提交，开门后提交', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle)

    render(<Host />, {container})

    act(() => state.set(1))
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)

    // fps=10 → 间隔 100ms，容差 4ms，所以下个窗口从上次提交 +96ms 起算
    act(() => state.set(2))
    advance(10)
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    // 被门挡住的 tick 必须重新预约，否则待处理值就永远丢了
    expect(frames.booked()).toBe(1)

    advance(90)
    act(() => frames.runFrame())
    expect(record.renders).toBe(3)
    expect(record.props[2]!.value).toBe(2)
  })

  it('leading 为 false 时首个提交要等满一个间隔', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle, {config: {leading: false}})

    render(<Host />, {container})
    act(() => state.set(1))

    advance(50)
    act(() => frames.runFrame())
    expect(record.renders).toBe(1)

    advance(50)
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)
  })

  it('trailing 为 false 时是采样语义：窗口内的更新被忽略', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle, {config: {trailing: false}})

    render(<Host />, {container})

    act(() => state.set(1))
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)

    // 窗口内的更新直接忽略，不留待提交
    act(() => state.set(2))
    advance(10)
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    expect(handle.current!.getStats().coalesced).toBe(1)

    // 落到窗口边界上的那次才会提交
    advance(90)
    act(() => state.set(3))
    expect(frames.booked()).toBe(1)
    act(() => frames.runFrame())
    expect(record.renders).toBe(3)
    expect(record.props[2]!.value).toBe(3)
  })

  it('select 只影响比较，子组件仍收到完整且最新的 props', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle, {
      config: {select: (props) => ({value: props.value})},
      // onClick 每次渲染都是新函数：不做 select 的话它会让每个窗口都判定为不等
      childProps: (value) => ({value, onClick: () => value}),
    })

    render(<Host />, {container})
    const mountOnClick = record.props[0]!.onClick

    // value 没变，只有 onClick 换了引用 → 判定相等 → 不提交
    act(() => state.bump())
    act(() => frames.runFrame())
    expect(handle.current!.getStats().skips).toBe(1)
    expect(record.renders).toBe(1)

    act(() => state.set(2))
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    // 投递的是完整 props，而不是 select 出来的子集
    expect(record.props[1]!.onClick).not.toBe(mountOnClick)
    expect(record.props[1]!.onClick!()).toBe(2)
  })

  it('compare 为 never 时每次泵触发都提交', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle, {config: {compare: 'never'}})

    render(<Host />, {container})
    act(() => state.set(1))
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)

    // 值没变，但 never 策略要求每轮都提交
    advance(100)
    act(() => state.bump())
    act(() => frames.runFrame())
    expect(record.renders).toBe(3)
    expect(handle.current!.getStats().commits).toBe(2)
  })

  it('shouldCommit 否决时丢弃并以 vetoed 上报', () => {
    const frames = createFrames()
    const {Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const onDrop = vi.fn()
    const {Host, state} = createHost(frames, Probe, handle, {
      config: {shouldCommit: () => false, onDrop},
    })

    render(<Host />, {container})
    act(() => state.set(1))
    act(() => frames.runFrame())

    expect(handle.current!.getStats().vetoes).toBe(1)
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop.mock.calls[0]![1]).toBe('vetoed')
  })

  it('onFrame 每次泵触发都调用，onCommit 只在提交后调用', () => {
    const frames = createFrames()
    const {Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const onFrame = vi.fn()
    const onCommit = vi.fn()
    const {Host, state} = createHost(frames, Probe, handle, {config: {onFrame, onCommit}})

    render(<Host />, {container})
    expect(onCommit).not.toHaveBeenCalled()

    act(() => state.set(1))
    act(() => frames.runFrame())
    expect(onFrame).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0]![0]).toEqual({value: 1})

    // 被门挡住的帧也算一次泵触发，但不算提交
    act(() => state.set(2))
    advance(10)
    act(() => frames.runFrame())
    expect(onFrame).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenCalledTimes(1)

    advance(90)
    act(() => frames.runFrame())
    expect(onFrame).toHaveBeenCalledTimes(3)
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('paused 为 true 期间不提交，改回 false 后提交最新值', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const controls: {setPaused: (paused: boolean) => void; set: (value: number) => void} = {
      setPaused: () => {},
      set: () => {},
    }
    const Host = () => {
      const [paused, setPaused] = useState(true)
      const [value, setValue] = useState(0)
      controls.setPaused = setPaused
      controls.set = setValue
      return (
        <FrameRender<ProbeProps>
          fps={10}
          scheduler={frames.scheduler}
          warn={false}
          paused={paused}
          ref={handle}
        >
          <Probe value={value} />
        </FrameRender>
      )
    }

    render(<Host />, {container})
    act(() => controls.set(1))
    advance(500)
    act(() => frames.runFrame())
    // 暂停期间既不提交也不预约
    expect(record.renders).toBe(1)
    expect(frames.booked()).toBe(0)

    act(() => controls.setPaused(false))
    expect(frames.booked()).toBe(1)
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)
  })

  it('disabled 旁路：每次父渲染都渲染子组件', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle, {config: {disabled: true}})

    render(<Host />, {container})
    for (const value of [1, 2, 3]) act(() => state.set(value))

    expect(record.renders).toBe(4)
    expect(frames.booked()).toBe(0)
    expect(handle.current!.getStats().commits).toBe(0)
  })

  it('flush 立即提交，cancel 丢弃并以 cancelled 上报', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const onDrop = vi.fn()
    const {Host, state} = createHost(frames, Probe, handle, {config: {onDrop}})

    render(<Host />, {container})

    // 还没到帧边界就要求新鲜：flush 跳过时间门直接提交
    act(() => state.set(1))
    let flushed = false
    act(() => {
      flushed = handle.current!.flush()
    })
    expect(flushed).toBe(true)
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)

    act(() => state.set(2))
    let cancelled = false
    act(() => {
      cancelled = handle.current!.cancel()
    })
    expect(cancelled).toBe(true)
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop.mock.calls[0]![1]).toBe('cancelled')
    expect(handle.current!.getStats().dropped).toBe(1)

    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
  })

  it('pause / resume 句柄可冻结与恢复提交', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle)

    render(<Host />, {container})

    act(() => handle.current!.pause())
    act(() => state.set(1))
    expect(frames.booked()).toBe(0)
    advance(500)
    act(() => frames.runFrame())
    expect(record.renders).toBe(1)

    act(() => handle.current!.resume())
    expect(frames.booked()).toBe(1)
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)
  })

  it('卸载时待处理值以 unmounted 上报，之后不再提交', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const onDrop = vi.fn()
    const {Host, state} = createHost(frames, Probe, handle, {config: {onDrop}})
    const view = render(<Host />, {container})

    act(() => state.set(1))
    act(() => frames.runFrame())
    expect(record.renders).toBe(2)

    act(() => state.set(2))
    act(() => view.unmount())

    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop.mock.calls[0]![1]).toBe('unmounted')
    expect(frames.booked()).toBe(0)
  })

  it('标签页隐藏时停下，重新可见后继续', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const {Host, state} = createHost(frames, Probe, handle)

    render(<Host />, {container})

    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'})
    document.dispatchEvent(new Event('visibilitychange'))

    act(() => state.set(1))
    expect(frames.booked()).toBe(0)
    advance(500)
    act(() => frames.runFrame())
    expect(record.renders).toBe(1)

    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'})
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.booked()).toBe(1)

    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)
  })

  it('渲染函数形式同样合帧，props 包被投递', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const state: {set: (value: number) => void} = {set: () => {}}
    const Host = () => {
      const [value, setValue] = useState(0)
      state.set = setValue
      return (
        <FrameRender<ProbeProps>
          fps={10}
          scheduler={frames.scheduler}
          warn={false}
          ref={handle}
          props={{value}}
        >
          {({value: delivered}) => <Probe value={delivered * 2} />}
        </FrameRender>
      )
    }

    render(<Host />, {container})
    for (const value of [1, 2, 3]) act(() => state.set(value))
    expect(record.renders).toBe(1)

    act(() => frames.runFrame())
    expect(record.renders).toBe(2)
    // 渲染函数拿到的是窗口内最新的 props 包
    expect(record.props[1]!.value).toBe(6)
    expect(handle.current!.getStats().coalesced).toBe(2)
  })

  it('StrictMode 下不重复提交，也不误报卸载丢弃', () => {
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const onDrop = vi.fn()
    const onCommit = vi.fn()
    const {Host, state} = createHost(frames, Probe, handle, {
      config: {onDrop, onCommit},
    })

    render(
      <React.StrictMode>
        <Host />
      </React.StrictMode>,
      {container},
    )
    act(() => state.set(1))
    act(() => frames.runFrame())

    // StrictMode 会双调用渲染函数，所以子组件的渲染次数翻倍：挂载 2 次 + 一次提交 2 次。
    // 真正要保证的是"只提交一次"，提交计数不受双调用影响。
    expect(record.renders).toBe(4)
    expect(handle.current!.getStats().commits).toBe(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    // StrictMode 的挂载 → 卸载 → 再挂载不该被当成"卸载时还有待处理值"
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('更换调度器时丢弃旧预约，泵立刻恢复', () => {
    const stalled = createFrames()
    const fresh = createFrames()
    const {record, Probe} = createProbe()
    const handle: {current: FrameRenderHandle | null} = {current: null}
    const controls: {
      setScheduler: (updater: () => FrameScheduler) => void
      set: (value: number) => void
    } = {setScheduler: () => {}, set: () => {}}
    const Host = () => {
      const [scheduler, setScheduler] = useState<FrameScheduler>(() => stalled.scheduler)
      const [value, setValue] = useState(0)
      controls.setScheduler = setScheduler
      controls.set = setValue
      return (
        <FrameRender<ProbeProps> fps={10} scheduler={scheduler} warn={false} ref={handle}>
          <Probe value={value} />
        </FrameRender>
      )
    }

    render(<Host />, {container})
    act(() => controls.set(1))
    // 旧调度器把帧预约走了却永不触发 —— 模拟 rAF 因窗口被遮挡而挂起
    expect(stalled.booked()).toBe(1)
    expect(record.renders).toBe(1)

    // 传函数给 setState 会被当成 updater，所以这里必须用 updater 形式交出调度器
    act(() => controls.setScheduler(() => fresh.scheduler))
    expect(fresh.booked()).toBe(1)

    act(() => fresh.runFrame())
    expect(record.renders).toBe(2)
    expect(record.props[1]!.value).toBe(1)
  })

  it('children 不是单个元素时旁路直通并给出警告', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const frames = createFrames()
    const {record, Probe} = createProbe()
    const state: {set: (value: number) => void} = {set: () => {}}
    const Host = () => {
      const [value, setValue] = useState(0)
      state.set = setValue
      return (
        <FrameRender<ProbeProps> fps={10} scheduler={frames.scheduler}>
          <>
            <Probe value={value} />
            <Probe value={value} />
          </>
        </FrameRender>
      )
    }

    render(<Host />, {container})
    for (const value of [1, 2]) act(() => state.set(value))

    // 两次父渲染都直通，每次渲染两个探测组件
    expect(record.renders).toBe(6)
    expect(frames.booked()).toBe(0)
    expect(String(spy.mock.calls[0]?.[0])).toContain('Fragment')
    spy.mockRestore()
  })
})
