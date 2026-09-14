import React, {
  Fragment,
  forwardRef,
  isValidElement,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'

/**
 * @zh 合帧投递：把 props 更新合并为每个帧率窗口至多一次提交。
 *
 * 它不是"节流渲染"，而是"合帧投递"。设间隔 `T = 1000 / fps`，对任意窗口 `[t, t+T)`：
 *
 * 1. 子组件收到的 props 至多更新一次，且携带窗口内最后一次更新的值（最新值胜出）；
 * 2. 若新值与已提交值按 `compare` 判定相等，则不发生任何提交 —— 子组件继续收到上一次的
 *    同一个元素引用，React 在 `memo` 边界直接 bail out；
 * 3. 未提交期间父组件传入的新 props 只进控制器，绝不进入子组件的 props。
 *
 * 父组件可以以任意高的频率重渲染：本组件自身每次都会重新执行（一次 O(1)、零分配的捕获），
 * 但昂贵的子树只在帧边界上渲染一次。这正是"抽离状态层"的收益所在 —— 高频状态放在本组件
 * 外层，昂贵的渲染留在内层。
 *
 * 它由两个已有工具组合而成：`rafSchedule` 当泵、`createLatestValue` 当合并槽。
 *
 * @en Framed delivery: coalesce prop updates into at most one commit per frame window.
 *
 * This is not "throttled rendering" but framed delivery. With `T = 1000 / fps`, for any window
 * `[t, t+T)`:
 *
 * 1. the child receives at most one props update, carrying the LAST value of the window
 *    (latest wins);
 * 2. if the new value compares equal to the committed one (per `compare`), no commit happens at
 *    all — the child keeps receiving the same element reference and React bails out at the
 *    `memo` boundary;
 * 3. updates arriving before a commit reach the controller only, never the child's props.
 *
 * The parent may re-render arbitrarily often: this component re-runs every time (one O(1),
 * allocation-free capture), but the expensive subtree renders only at frame boundaries. That is
 * why extracting the state layer pays off — keep the high-frequency state OUTSIDE and the
 * expensive rendering INSIDE.
 *
 * It is assembled from two existing utilities: `rafSchedule` as the pump and `createLatestValue`
 * as the merge cell.
 */

//#region types

/**
 * @zh 泵的传输层策略。
 * - `'auto'`（默认）：可见时用 `requestAnimationFrame`，隐藏时（仅在 `pauseWhenHidden` 为
 *   false 时才会走到）退化为定时器。
 * - `'raf'`：始终用 `requestAnimationFrame`。与绘制对齐，但标签页隐藏时不会触发。
 * - `'timer'`：始终用 `setTimeout`，节拍与绘制解耦。
 *
 * @en Transport strategy for the pump.
 * - `'auto'` (default): `requestAnimationFrame` while visible, falling back to a timer while
 *   hidden (only reachable when `pauseWhenHidden` is false).
 * - `'raf'`: always `requestAnimationFrame` — aligned with painting, but it does not fire while
 *   the tab is hidden.
 * - `'timer'`: always `setTimeout`, decoupled from painting.
 */
export type FrameStrategy = 'auto' | 'raf' | 'timer'

/**
 * @zh 可注入的帧调度器：接收回调，返回取消函数。默认是 `requestAnimationFrame`。注入它既能
 * 替换传输层（例如改用 `requestIdleCallback`），也让单元测试可以确定性地推进帧而不依赖真实
 * 计时。
 *
 * @en Injectable frame scheduler: receives a callback and returns a cancel function. Defaults to
 * `requestAnimationFrame`. Injecting one both replaces the transport (e.g. to use
 * `requestIdleCallback`) and lets unit tests advance frames deterministically.
 */
export type FrameScheduler = (callback: (time: number) => void) => () => void

/**
 * @zh 相等判定策略。返回 true 表示"相等"，即跳过本次提交。
 * - `'shallow'`（默认）：逐键 `Object.is` 浅比较；
 * - `'reference'`：只比引用。最便宜，但父组件每次新建的字面量对象都会判定为不等，等于每个
 *   窗口都提交；
 * - `'never'`：永不相等，即每次泵触发都提交；
 * - 自定义函数：自行决定，适合用一个廉价的 version 字段代替深比较。
 *
 * @en Equality strategy. True means "equal", i.e. skip this commit.
 * - `'shallow'` (default): per-key `Object.is` shallow compare;
 * - `'reference'`: reference only. Cheapest, but a literal object rebuilt by the parent on every
 *   render always compares unequal, so every window commits;
 * - `'never'`: never equal — commit on every pump tick;
 * - custom function: your call — handy for comparing a cheap version field instead of deep
 *   comparing.
 */
export type FrameCompare =
  | 'shallow'
  | 'reference'
  | 'never'
  | ((prev: unknown, next: unknown) => boolean)

/**
 * @zh `onDrop` 的丢弃原因。只报告"有意义的丢弃"：被更新值覆盖（合帧的正常工况）不计入 ——
 * 一个窗口内 10 次更新有 9 次被覆盖，逐条上报只会是噪音，那个数字看统计里的 `coalesced`。
 *
 * @en Why an update was dropped. Only meaningful drops are reported; being superseded by a newer
 * value is the normal operation of coalescing and is not reported — 9 of 10 updates in a window
 * are superseded routinely, and reporting each would be pure noise. Read `coalesced` instead.
 */
export type FrameDropReason = 'vetoed' | 'cancelled' | 'unmounted'

/**
 * @zh 传给各生命周期钩子的上下文快照。
 * @en Context snapshot handed to the lifecycle callbacks.
 */
export interface FrameRenderContext {
  /**
   * @zh 本阶段的时间戳，与 rAF 回调同一时间线（`performance.now()` 口径）。
   * @en Timestamp of this stage, on the same timeline as rAF callbacks (`performance.now()`).
   */
  time: number
  /**
   * @zh 泵触发过多少次（含最终没有提交的帧）。
   * @en Pump ticks so far, including ticks that did not commit.
   */
  frame: number
  /**
   * @zh 已提交次数。
   * @en Commits so far.
   */
  commits: number
  /**
   * @zh 被合帧抑制的父渲染次数。
   * @en Parent renders suppressed by coalescing.
   */
  coalesced: number
  /**
   * @zh 当前目标帧率。
   * @en Current target frame rate.
   */
  fps: number
}

/**
 * @zh `getStats()` 的返回结构，自挂载起累计。
 * @en Shape returned by `getStats()`, accumulated since mount.
 */
export interface FrameRenderStats {
  /**
   * @zh 泵触发次数。
   * @en Pump ticks.
   */
  frames: number
  /**
   * @zh 捕获到的父渲染次数。自身提交引起的重渲染不计入 —— 那种渲染没有带来新东西。
   * @en Captured parent renders. Re-renders caused by our own commits are not counted — they
   * brought nothing new.
   */
  captures: number
  /**
   * @zh 实际提交次数 —— 子组件渲染次数的上界。
   * @en Actual commits — an upper bound on child renders.
   */
  commits: number
  /**
   * @zh `compare` 判定相等而跳过的次数，这部分完全不渲染。
   * @en Skips where `compare` found the value equal — no render at all.
   */
  skips: number
  /**
   * @zh `shouldCommit` 否决的次数。
   * @en Vetoes by `shouldCommit`.
   */
  vetoes: number
  /**
   * @zh 被合帧抑制的父渲染次数 —— 收益的直接度量。
   * @en Parent renders suppressed by coalescing — the direct measure of the win.
   */
  coalesced: number
  /**
   * @zh 真正被丢弃的次数（否决 + 取消 + 卸载）。
   * @en Truly dropped updates (veto + cancel + unmount).
   */
  dropped: number
  /**
   * @zh 最近若干次提交实测出的提交频率。
   * @en Commit rate measured over the most recent commits.
   */
  commitsPerSecond: number
}

/**
 * @zh 命令式句柄，通过 `ref` 获取。
 * @en Imperative handle, obtained through `ref`.
 */
export interface FrameRenderHandle {
  /**
   * @zh 立即提交待处理的最新值，跳过时间门。用于"这一刻必须新鲜"的场景：用户点击刷新、
   * 导出快照、提交表单前。返回是否真的发生了提交（无待处理值或判定相等时为 false）。
   * @en Commit the latest pending value immediately, bypassing the time gate. For moments that
   * must be fresh: a refresh click, exporting a snapshot, right before submitting a form.
   * Returns whether a commit actually happened (false when nothing is pending or the value
   * compares equal).
   */
  flush(): boolean
  /**
   * @zh 丢弃待处理值并取消已预约的帧。返回是否丢弃了东西。
   * @en Drop the pending value and cancel the booked frame. Returns whether anything was dropped.
   */
  cancel(): boolean
  /**
   * @zh 暂停提交，待处理值保留。
   * @en Pause committing; the pending value is kept.
   */
  pause(): void
  /**
   * @zh 恢复提交；若有待处理值，下一帧提交最新值。
   * @en Resume committing; with a pending value, the latest value commits on the next frame.
   */
  resume(): void
  /**
   * @zh 读取统计快照。用它验证收益，而不是凭感觉。
   * @en Read a stats snapshot. Verify the win instead of guessing.
   */
  getStats(): FrameRenderStats
}

/**
 * @zh `FrameRender` 的 props。泛型 `P` 是子组件的 props 类型：element 形式下由元素推断，
 * 函数形式下由 `props` 与该函数的签名共同决定。
 * @en `FrameRender` props. Generic `P` is the child's props type: inferred from the element in
 * element form, or from `props` together with the render function's signature.
 */
export interface FrameRenderProps<P extends object = Record<string, unknown>> {
  /**
   * @zh 要合帧投递的子元素，或 `(props) => ReactNode` 渲染函数。必须是单个元素：Fragment、
   * 数组、字符串无法提取 props，会报警告并旁路直通。
   *
   * element 形式最顺手，但注意**窗口内子组件渲染的是上一次的 props** —— 这就是换取吞吐的
   * 代价。函数形式适合需要派生的场景，且不存在"陈旧 children"的歧义。
   * @en The child element to deliver frame by frame, or a `(props) => ReactNode` render function.
   * Must be a single element: a Fragment, array or string has no extractable props, so it warns
   * and passes through.
   *
   * The element form reads best, but note that **inside a window the child renders the previous
   * props** — that is the price of throughput. The function form suits cases needing derivation
   * and has no "stale children" ambiguity.
   */
  children: ReactElement<P> | ((props: P) => ReactNode)
  /**
   * @zh 函数形式的 props 包（element 形式不需要）。省略时函数收到 `{}`。
   * @en The props bag for the function form (not needed in element form). Defaults to `{}`.
   */
  props?: P
  /**
   * @zh 目标提交帧率。`T = 1000 / fps`，提交间隔不小于 `T`（含 4ms 相位容差，避免间隔与帧
   * 周期相等时掉到一半帧率）。超过屏幕刷新率没有意义，有效上限就是刷新率。传 `<= 0` 表示旁路
   * （每次父渲染都提交），用于和正常模式对比收益。
   * @default 60
   * @en Target commit frame rate. `T = 1000 / fps`, commits at least `T` apart (with a 4ms phase
   * tolerance so an interval equal to the frame period does not halve the rate). Exceeding the
   * display refresh rate achieves nothing — the refresh rate is the ceiling. `<= 0` bypasses
   * framing (commit on every parent render) for A/B-ing the win.
   */
  fps?: number
  /**
   * @zh 泵的传输层策略。
   * @default 'auto'
   * @en Transport strategy for the pump.
   */
  strategy?: FrameStrategy
  /**
   * @zh 窗口内首个更新是否尽快提交（下一帧，不是同步）。置 false 则首个提交需要等满一个间隔。
   * 与 throttle 的 leading 同义。
   * @default true
   * @en Whether the first update of a window commits as soon as possible (next frame, not
   * synchronously). False makes the first commit wait a full interval. Same as throttle leading.
   */
  leading?: boolean
  /**
   * @zh 窗口内的更新是否算数。置 false 为采样语义：只有落到窗口边界上的那次更新会提交，窗口
   * 内的更新直接忽略。注意 `leading` 与 `trailing` 同为 false 时几乎不会提交。
   * @default true
   * @en Whether updates inside a window count. False means sampling: only the update landing on a
   * window boundary commits, and in-window updates are ignored. With both `leading` and `trailing`
   * false, commits become nearly impossible.
   */
  trailing?: boolean
  /**
   * @zh 暂停提交，待处理值保留；恢复时下一帧提交最新值。适合手势或弹窗打开期间冻结更新。
   * @default false
   * @en Pause committing while keeping the pending value; on resume the latest value commits on the
   * next frame. Handy for freezing updates during a gesture or an open modal.
   */
  paused?: boolean
  /**
   * @zh 完全旁路：不调度、不比较、不统计，每次父渲染直接透传。用于 A/B 对比合帧收益，也用于
   * 排查"是不是合帧导致的问题"。等价于 `fps <= 0`。
   * @default false
   * @en Full bypass: no scheduling, no comparison, no stats — every parent render passes straight
   * through. For A/B-ing the win, or bisecting "is framing causing this?". Equivalent to
   * `fps <= 0`.
   */
  disabled?: boolean
  /**
   * @zh 标签页隐藏时不做提交。这是性能组件的正确默认值：不可见的提交是纯浪费，且 rAF 在隐藏时
   * 本就不触发。注意它会把 `onCommit` 这类副作用的时序推迟到标签页重新可见。
   *
   * 还有一条浏览器行为要知道：`strategy` 为 `'auto'` / `'raf'` 时泵走 rAF，而浏览器不只在
   * `visibilityState === 'hidden'` 时暂停 rAF —— 窗口被其他窗口完全遮挡时同样会暂停。那种情况下
   * 也不会发生提交，效果与暂停等同，窗口回到前台后立即恢复。若需要在被遮挡时仍保持提交节拍，
   * 用 `strategy: 'timer'`。
   * @default true
   * @en Do not commit while the tab is hidden. The right default for a performance component:
   * invisible commits are pure waste, and rAF does not fire while hidden. Note that this defers
   * side effects such as `onCommit` until the tab is visible again.
   *
   * One browser behaviour is worth knowing too: with `strategy` set to `'auto'` / `'raf'` the pump
   * rides on rAF, and the browser suspends rAF not only when `visibilityState === 'hidden'` but also
   * when the window is fully covered by another window. In that state nothing commits either — the
   * effect equals a pause — and it resumes as soon as the window comes back. If you need the commit
   * cadence to hold while covered, use `strategy: 'timer'`.
   */
  pauseWhenHidden?: boolean
  /**
   * @zh 注入自定义帧调度器，替代 `strategy`。也用于让测试确定性地推进帧。
   * @en Inject a custom frame scheduler, replacing `strategy`. Also used to advance frames
   * deterministically in tests.
   */
  scheduler?: FrameScheduler
  /**
   * @zh 只影响**比较**，不影响子组件收到的 props。返回参与比较的字段子集 —— 子组件仍然拿到完整
   * 的 props，但只有选出的字段变化才会触发提交。这是消除"每次渲染都新建的回调 / 字面量"造成
   * 无谓提交的关键。
   * @en Affects the **comparison** only, never what the child receives. Return the subset of fields
   * that participate in comparison — the child still gets the full props, but only a change in the
   * selected fields triggers a commit. The key to eliminating pointless commits caused by
   * per-render callbacks and object literals.
   */
  select?: (props: P) => unknown
  /**
   * @zh 相等判定策略，返回 true 表示相等、跳过提交。
   * @default 'shallow'
   * @en Equality strategy; true means equal, so the commit is skipped.
   */
  compare?: FrameCompare
  /**
   * @zh 提交前的策略否决。返回 false 则丢弃本次待处理值（计入 `vetoes`，并经 `onDrop` 以
   * `'vetoed'` 上报）。例如：标签页隐藏时不做无用渲染、拖拽中冻结、或业务上判定"无实质变化"。
   *
   * 参数是 `select` 之后的值，与 `compare` 看到的一致。
   * @en Policy veto before committing. False drops the pending value (counted in `vetoes` and
   * reported through `onDrop` as `'vetoed'`) — e.g. skip invisible work while hidden, freeze during
   * a drag, or drop business-insignificant changes.
   *
   * Arguments are the post-`select` values, the same ones `compare` sees.
   */
  shouldCommit?: (prev: unknown, next: unknown, ctx: FrameRenderContext) => boolean
  /**
   * @zh 每次泵触发都调用（含最终没有提交的帧）。**不是**通用帧时钟：只有存在待处理更新时才会
   * 泵，空闲时一帧都不跑 —— 这也正是它省电的原因。需要连续帧回调请直接用 `rafSchedule`。
   * @en Called on every pump tick, including ticks that end up not committing. This is **not** a
   * general frame clock: the pump only runs while an update is pending, and runs zero frames when
   * idle — which is exactly why it is cheap. For a continuous frame callback use `rafSchedule`.
   */
  onFrame?: (ctx: FrameRenderContext) => void
  /**
   * @zh 提交之后在 effect 中调用（绝不在渲染期间）。用于埋点、同步外部系统、记录指标。
   * @en Called after a commit, inside an effect (never during render). For instrumentation, syncing
   * external systems, recording metrics.
   */
  onCommit?: (props: P, ctx: FrameRenderContext) => void
  /**
   * @zh 发生"有意义的丢弃"时调用：被否决、被取消、卸载时仍有待处理值。被更新值覆盖（合帧的
   * 正常工况）不上报。
   * @en Called for meaningful drops: vetoed, cancelled, or still pending at unmount. Superseding
   * (the normal operation of coalescing) is not reported.
   */
  onDrop?: (props: P, reason: FrameDropReason, ctx: FrameRenderContext) => void
  /**
   * @zh 是否在开发环境打印一次"只适合无状态子组件"的提示。默认开启；置 false 关闭。
   * @default true
   * @en Whether to print the "stateless children only" notice once in development. On by default;
   * pass false to silence it.
   */
  warn?: boolean
}

//#endregion types

//#region helpers

const NOW = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const EMPTY_PROPS: Record<string, unknown> = {}

const EMPTY_STATS: FrameRenderStats = {
  frames: 0,
  captures: 0,
  commits: 0,
  skips: 0,
  vetoes: 0,
  coalesced: 0,
  dropped: 0,
  commitsPerSecond: 0,
}

/**
 * 相位容差：间隔与帧周期相等时（fps=60 于 60Hz 屏），浮点抖动会让 `elapsed >= interval`
 * 每两帧才成立一次，帧率直接掉一半。留至多 4ms 余量即可稳定落在每一帧上；低帧率时间隔很长，
 * 这点余量可以忽略。
 */
const phaseTolerance = (interval: number): number => Math.min(4, interval / 4)

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const recordA = a as Record<string, unknown>
  const recordB = b as Record<string, unknown>
  const keys = Object.keys(recordA)
  if (keys.length !== Object.keys(recordB).length) return false
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(recordB, key)) return false
    if (!Object.is(recordA[key], recordB[key])) return false
  }
  return true
}

const isEqual = (compare: FrameCompare, prev: unknown, next: unknown): boolean => {
  if (typeof compare === 'function') return compare(prev, next)
  if (compare === 'reference') return Object.is(prev, next)
  if (compare === 'never') return false
  return shallowEqual(prev, next)
}

const isHidden = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'

const defaultRafScheduler: FrameScheduler = (callback) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(id)
  }
  const id = setTimeout(() => callback(NOW()), 16)
  return () => clearTimeout(id)
}

const timerScheduler =
  (interval: number): FrameScheduler =>
  (callback) => {
    const id = setTimeout(() => callback(NOW()), Math.max(1, interval))
    return () => clearTimeout(id)
  }

const isProduction = (): boolean => {
  const scope = globalThis as {process?: {env?: Record<string, string | undefined>}}
  return scope.process?.env?.NODE_ENV === 'production'
}

/**
 * 派生"参与比较的值"：`select` 存在时用它收窄，否则就是源对象本身。初始已提交值必须走同一条
 * 路径，否则挂载后第一次比较会拿完整 props 与收窄后的值相比，凭空多出一次提交。
 */
const derivePayload = <P extends object>(cfg: ResolvedConfig<P>, source: unknown): unknown => {
  if (source === undefined) return undefined
  return cfg.select ? cfg.select(source as P) : source
}

let warnedStateless = false
let warnedChildren = false

const warnStateless = (): void => {
  if (warnedStateless || isProduction()) return
  warnedStateless = true
  console.warn(
    '[FrameRender] 本组件只适合渲染无状态子组件，或状态不频繁更新的子组件。\n' +
      '如果子组件内部有自己的 state、订阅了 context，或在高频定时器 / 订阅中更新，那么它的重渲染不会经过本组件，合帧不会生效。\n' +
      '请把状态抽离到 FrameRender 外层（或 createExternalState 这类外部存储），让 FrameRender 只承担"合帧投递"：外层状态怎么高频更新都行，昂贵的子树每帧只渲染一次。\n' +
      '另请注意：本组件以新鲜度换吞吐，窗口内子组件渲染的是上一次的 props。不要包裹受控输入框、错误提示、加载态，或任何必须即时反映用户操作的 UI。\n' +
      '[FrameRender] This component only suits stateless children, or children whose state updates are infrequent.\n' +
      'If the child keeps its own state, subscribes to context, or updates from a high-frequency timer/subscription, its re-renders do not go through this component and coalescing will not help.\n' +
      'Extract that state OUTSIDE FrameRender (or into an external store such as createExternalState) and let FrameRender do the framed delivery: the outer state may update as often as it likes, while the expensive subtree renders once per frame.\n' +
      'Also note: this trades freshness for throughput — inside a window the child renders the previous props. Never wrap controlled inputs, error messages, loading states, or any UI that must reflect user actions immediately.',
  )
}

const warnChildren = (): void => {
  if (warnedChildren || isProduction()) return
  warnedChildren = true
  console.warn(
    '[FrameRender] children 必须是单个 React 元素，或 (props) => ReactNode 渲染函数；' +
      'Fragment / 数组 / 字符串无法提取 props，已改为旁路直通（不做合帧）。\n' +
      '[FrameRender] children must be a single React element or a (props) => ReactNode render function; ' +
      'a Fragment, array or string has no extractable props, so it passes through without framing.',
  )
}

//#endregion helpers

//#region controller

interface Snapshot {
  element: ReactNode
  /** 每次提交自增，驱动 onCommit 的 effect；0 表示尚未提交过（挂载初始值）。 */
  token: number
}

interface CommitRecord<P extends object> {
  props: P
  ctx: FrameRenderContext
}

interface ResolvedConfig<P extends object> {
  fps: number
  interval: number
  tolerance: number
  strategy: FrameStrategy
  leading: boolean
  trailing: boolean
  paused: boolean
  disabled: boolean
  pauseWhenHidden: boolean
  scheduler?: FrameScheduler
  select?: (props: P) => unknown
  compare: FrameCompare
  shouldCommit?: (prev: unknown, next: unknown, ctx: FrameRenderContext) => boolean
  onFrame?: (ctx: FrameRenderContext) => void
  onCommit?: (props: P, ctx: FrameRenderContext) => void
  onDrop?: (props: P, reason: FrameDropReason, ctx: FrameRenderContext) => void
}

interface Controller<P extends object> {
  cfg: ResolvedConfig<P>
  functionForm: boolean

  latestElement: ReactElement | null
  latestFn: ((props: P) => ReactNode) | null
  latestBag: P

  /** 存在尚未提交的更新。 */
  pending: boolean
  /** 时间门：早于此刻不提交。leading 为 true 时初始为 -Infinity，即首个更新尽快提交。 */
  nextAllowedAt: number
  cancelBook: (() => void) | null
  /**
   * 当前预约是由哪个调度器发出的。预约只对同一个调度器有效：策略、间隔、可见性变化都会换调度器，
   * 此时旧预约必须丢弃 —— 否则在 rAF 因窗口被遮挡而不再触发的情况下，泵会永远卡住，连换成 timer
   * 策略也救不回来。
   */
  bookedScheduler: FrameScheduler | null
  pausedByHandle: boolean

  committedPayload: unknown
  /**
   * 最近一次提交（或挂载）时捕获到的源引用：element 形式是元素对象，函数形式是 props 包。
   * 用它识别"自己提交引起的重渲染"和"父组件确实传了新东西"——前者没有新内容可投递。
   */
  committedSource: unknown
  commitTimes: number[]
  lastCommit: CommitRecord<P> | null
  stats: FrameRenderStats
  timerCache: {interval: number; sched: FrameScheduler} | null

  commit(time: number, ctx: FrameRenderContext): boolean
  tick(time: number): void
  schedule(): void
  cancelBooking(): void
  makeCtx(time: number): FrameRenderContext
  payload(): unknown
  rawProps(): P
  snapshot(): FrameRenderStats
  pausedNow(): boolean
  bypass(): boolean
  scheduler(): FrameScheduler
}

/**
 * 控制器把所有可变状态放进普通对象（而非 state），所以本组件每次父渲染的成本只有一次布局
 * effect 里的几次赋值。它同时让命令式句柄与调度回调全都拥有稳定身份 —— 不需要 useCallback
 * 去维持依赖数组。
 */
const createController = <P extends object>(
  setSnapshot: React.Dispatch<React.SetStateAction<Snapshot>>,
  initialElement: ReactElement | null,
  cfg: ResolvedConfig<P>,
  functionForm: boolean,
  initialPayload: unknown,
  initialSource: unknown,
): Controller<P> => {
  const c: Controller<P> = {
    cfg,
    functionForm,
    latestElement: initialElement,
    latestFn: null,
    latestBag: EMPTY_PROPS as P,
    pending: false,
    nextAllowedAt: cfg.leading ? Number.NEGATIVE_INFINITY : NOW() + cfg.interval,
    cancelBook: null,
    bookedScheduler: null,
    pausedByHandle: false,
    committedPayload: initialPayload,
    committedSource: initialSource,
    commitTimes: [],
    lastCommit: null,
    stats: {...EMPTY_STATS},
    timerCache: null,

    bypass() {
      return c.cfg.disabled || !(c.cfg.fps > 0)
    },

    pausedNow() {
      return c.cfg.paused || c.pausedByHandle
    },

    payload() {
      return derivePayload(c.cfg, c.functionForm ? c.latestBag : c.latestElement?.props)
    },

    rawProps() {
      if (c.functionForm) return c.latestBag
      return (c.latestElement?.props ?? EMPTY_PROPS) as P
    },

    makeCtx(time): FrameRenderContext {
      return {
        time,
        frame: c.stats.frames,
        commits: c.stats.commits,
        coalesced: c.stats.coalesced,
        fps: c.cfg.fps,
      }
    },

    cancelBooking() {
      if (c.cancelBook) {
        c.cancelBook()
        c.cancelBook = null
      }
      c.bookedScheduler = null
    },

    scheduler(): FrameScheduler {
      if (c.cfg.scheduler) return c.cfg.scheduler
      if (c.cfg.strategy === 'raf') return defaultRafScheduler
      const needsTimer = c.cfg.strategy === 'timer' || isHidden()
      if (!needsTimer) return defaultRafScheduler
      if (c.timerCache && c.timerCache.interval === c.cfg.interval) return c.timerCache.sched
      const sched = timerScheduler(c.cfg.interval)
      c.timerCache = {interval: c.cfg.interval, sched}
      return sched
    },

    schedule() {
      if (c.bypass() || c.pausedNow()) return
      if (isHidden() && c.cfg.pauseWhenHidden) return
      const scheduler = c.scheduler()
      // 同一个调度器已经预约过就不用重复预约；但调度器换了（策略、间隔或可见性变化），旧预约已经
      // 不再代表"下一帧会来"，必须丢弃后重约 —— 否则 rAF 被挂起时泵会永久卡住。
      if (c.cancelBook) {
        if (c.bookedScheduler === scheduler) return
        c.cancelBooking()
      }
      c.bookedScheduler = scheduler
      c.cancelBook = scheduler((time) => {
        c.cancelBook = null
        c.bookedScheduler = null
        c.tick(time)
      })
    },

    tick(time) {
      c.stats.frames++
      const ctx = c.makeCtx(time)
      c.cfg.onFrame?.(ctx)
      if (c.bypass() || c.pausedNow()) return
      if (isHidden() && c.cfg.pauseWhenHidden) return
      if (!c.pending) return
      if (time < c.nextAllowedAt) {
        // 时间门未开：顺延到下一帧，保证"有 pending 就一定会提交"。
        c.schedule()
        return
      }
      c.commit(time, ctx)
    },

    commit(time, ctx) {
      if (!c.pending) return false
      const next = c.payload()
      if (next === undefined) {
        c.pending = false
        return false
      }

      if (isEqual(c.cfg.compare, c.committedPayload, next)) {
        c.pending = false
        c.stats.skips++
        return false
      }

      const raw = c.rawProps()
      if (c.cfg.shouldCommit && !c.cfg.shouldCommit(c.committedPayload, next, ctx)) {
        c.pending = false
        c.stats.vetoes++
        c.stats.dropped++
        c.cfg.onDrop?.(raw, 'vetoed', ctx)
        return false
      }

      const element = c.functionForm ? (c.latestFn?.(c.latestBag) ?? null) : c.latestElement
      if (!element) {
        c.pending = false
        return false
      }

      c.committedPayload = next
      c.committedSource = c.functionForm ? c.latestBag : c.latestElement
      c.pending = false
      c.nextAllowedAt = time + c.cfg.interval - c.cfg.tolerance
      c.lastCommit = {props: raw, ctx}

      const stats = c.stats
      stats.commits++
      c.commitTimes.push(time)
      if (c.commitTimes.length > 64) c.commitTimes.shift()
      if (c.commitTimes.length > 1) {
        const span = c.commitTimes[c.commitTimes.length - 1]! - c.commitTimes[0]!
        stats.commitsPerSecond = span > 0 ? ((c.commitTimes.length - 1) * 1000) / span : 0
      }

      setSnapshot((prev) => ({element, token: prev.token + 1}))
      return true
    },

    snapshot() {
      const stats = c.stats
      return {
        frames: stats.frames,
        captures: stats.captures,
        commits: stats.commits,
        skips: stats.skips,
        vetoes: stats.vetoes,
        coalesced: stats.coalesced,
        dropped: stats.dropped,
        commitsPerSecond: Math.round(stats.commitsPerSecond * 10) / 10,
      }
    },
  }

  return c
}

//#endregion controller

//#region commit slot

/**
 * 提交槽。用 `memo` 把未提交的父渲染挡在子组件之外：只要 `element` 引用没变，这里就不重新
 * 渲染，子组件连函数体都不会进。合帧的保证落在这个边界上。
 */
const CommittedSlot = memo(
  function CommittedSlot({element}: {element: ReactNode}) {
    return <>{element}</>
  },
  (prev, next) => prev.element === next.element,
)

CommittedSlot.displayName = 'FrameRenderCommitted'

//#endregion commit slot

//#region component

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const resolveConfig = <P extends object>(props: FrameRenderProps<P>): ResolvedConfig<P> => {
  const fps = props.fps ?? 60
  const interval = fps > 0 ? 1000 / fps : 0
  return {
    fps,
    interval,
    tolerance: fps > 0 ? phaseTolerance(interval) : 0,
    strategy: props.strategy ?? 'auto',
    leading: props.leading ?? true,
    trailing: props.trailing ?? true,
    paused: props.paused ?? false,
    disabled: props.disabled ?? false,
    pauseWhenHidden: props.pauseWhenHidden ?? true,
    scheduler: props.scheduler,
    select: props.select,
    compare: props.compare ?? 'shallow',
    shouldCommit: props.shouldCommit,
    onFrame: props.onFrame,
    onCommit: props.onCommit,
    onDrop: props.onDrop,
  }
}

function FrameRenderInner<P extends object>(
  props: FrameRenderProps<P>,
  ref: Ref<FrameRenderHandle>,
): ReactElement | null {
  const {children} = props
  const functionForm = typeof children === 'function'
  const validElement = !functionForm && isValidElement(children)
  // Fragment 也是合法元素，但它的 props 只有 children，没有可提取的投递对象：合帧只能退化成
  // 时间节流，收益为零。一并归入"形态不受支持"，直通而不是假装在做事。
  const isFragment = validElement && (children as ReactElement).type === Fragment
  const supported = functionForm || (validElement && !isFragment)

  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    element: functionForm
      ? (children as (p: P) => ReactNode)((props.props ?? EMPTY_PROPS) as P)
      : (children as ReactElement<P>),
    token: 0,
  }))

  const controllerRef = useRef<Controller<P> | null>(null)
  if (!controllerRef.current) {
    const cfg = resolveConfig(props)
    const initialElement = validElement ? (children as ReactElement<P>) : null
    const initialBag = (props.props ?? EMPTY_PROPS) as P
    controllerRef.current = createController<P>(
      setSnapshot,
      initialElement,
      cfg,
      functionForm,
      // 初始已提交值即首帧 props（走与运行期同一条 select 派生路径）：挂载后的第一次泵比较
      // 相等会直接跳过，所以首帧不会被重复提交一次（也不会触发 onCommit）。
      derivePayload(cfg, functionForm ? initialBag : initialElement?.props),
      functionForm ? initialBag : initialElement,
    )
  }
  const controller = controllerRef.current

  // 捕获：每次渲染后运行一次。O(1) 赋值、零分配 —— 本组件的全部税负都在这里。
  useIsomorphicLayoutEffect(() => {
    controller.cfg = resolveConfig(props)

    // 旁路与"children 形态不受支持"都不参与合帧：不预约、不计入捕获。后者如果照常跑泵，
    // 每次渲染都会因为 Fragment 的 children 数组是新引用而判定不等，白白触发一次 setState。
    if (controller.bypass() || !supported) {
      controller.cancelBooking()
      controller.pending = false
      return
    }

    if (functionForm) {
      controller.latestFn = props.children as (p: P) => ReactNode
      controller.latestBag = (props.props ?? EMPTY_PROPS) as P
    } else {
      controller.latestElement = props.children as ReactElement<P>
    }

    // 自己提交引起的重渲染：源引用没变，没有新东西要投递。挡掉它才不至于每次提交都多跑一个
    // 必然被跳过的空 tick。
    const source = functionForm ? controller.latestBag : controller.latestElement
    if (!controller.pending && source === controller.committedSource) return
    controller.stats.captures++

    const time = NOW()
    // 窗口内（时间门未开）的更新：trailing 为 false 时按采样语义忽略。最新值仍留在控制器里，
    // 等下一次窗口边界上的更新一并提交。
    if (!controller.cfg.trailing && time < controller.nextAllowedAt) {
      controller.stats.coalesced++
      return
    }

    // 把时间门在此之前就打开的情况也算作"本轮首个更新"：它决定提交能否尽快发生。
    if (controller.pending) controller.stats.coalesced++
    controller.pending = true
    // 暂停期间不预约，但 pending 必须保留 —— 恢复时才有值可提交。
    if (controller.pausedNow()) return
    controller.schedule()
  })

  // 卸载：取消预约、丢弃待处理值。StrictMode 的挂载 → 卸载 → 再挂载会走到这里，所以只在
  // 确实跑过提交之后才上报卸载丢弃，避免开发环境出现误报。
  useEffect(
    () => () => {
      const c = controllerRef.current
      if (!c) return
      c.cancelBooking()
      if (c.pending) {
        c.pending = false
        c.stats.dropped++
        if (c.stats.commits > 0) c.cfg.onDrop?.(c.rawProps(), 'unmounted', c.makeCtx(NOW()))
      }
    },
    [],
  )

  // 开发提示：只打一次，且只在挂载时判断 warn 的取值。
  useEffect(() => {
    if (props.warn === false) return
    warnStateless()
    if (!supported) warnChildren()
    // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载时提示一次
  }, [])

  // 标签页可见性：隐藏时停下，重新可见时若仍有待处理值就继续泵。
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibilityChange = () => {
      const c = controllerRef.current
      if (!c) return
      if (isHidden()) {
        if (c.cfg.pauseWhenHidden) c.cancelBooking()
        return
      }
      if (c.pending) c.schedule()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // onCommit 放在 effect 里，绝不在渲染期间调用用户回调。
  useEffect(() => {
    if (snapshot.token === 0) return
    const record = controllerRef.current?.lastCommit
    if (!record) return
    controllerRef.current?.cfg.onCommit?.(record.props, record.ctx)
  }, [snapshot.token])

  useImperativeHandle(
    ref,
    () => ({
      flush: () => {
        const c = controllerRef.current
        if (!c || c.bypass() || !c.pending) return false
        const time = NOW()
        return c.commit(time, c.makeCtx(time))
      },
      cancel: () => {
        const c = controllerRef.current
        if (!c) return false
        const had = c.pending
        c.pending = false
        c.cancelBooking()
        if (had) {
          c.stats.dropped++
          c.cfg.onDrop?.(c.rawProps(), 'cancelled', c.makeCtx(NOW()))
        }
        return had
      },
      pause: () => {
        const c = controllerRef.current
        if (!c) return
        c.pausedByHandle = true
        c.cancelBooking()
      },
      resume: () => {
        const c = controllerRef.current
        if (!c) return
        c.pausedByHandle = false
        if (c.pending) c.schedule()
      },
      getStats: () => controllerRef.current?.snapshot() ?? EMPTY_STATS,
    }),
    [],
  )

  if (!supported) {
    // children 形态不受支持：旁路直通，不假装做了合帧。
    return <>{children as ReactNode}</>
  }

  const element = controller.bypass()
    ? functionForm
      ? (children as (p: P) => ReactNode)((props.props ?? EMPTY_PROPS) as P)
      : (children as ReactElement<P>)
    : snapshot.element

  return <CommittedSlot element={element} />
}

/**
 * @zh 合帧投递组件。详见模块头与 {@link FrameRenderProps}。
 *
 * @example
 * ```tsx
 * // 状态在外层（高频无所谓），昂贵的子树每帧只渲染一次
 * function Dashboard() {
 *   const ticks = useHighFrequencyTicks()
 *   return (
 *     <FrameRender fps={30}>
 *       <LiveChart ticks={ticks} />
 *     </FrameRender>
 *   )
 * }
 *
 * // 渲染函数形式：需要派生时用，props 包是被合帧投递的对象
 * <FrameRender fps={30} props={{data, theme}}>
 *   {({data, theme}) => <Chart data={data} theme={theme} />}
 * </FrameRender>
 * ```
 *
 * @en Framed delivery component. See the module header and {@link FrameRenderProps}.
 */
export const FrameRender = forwardRef(FrameRenderInner) as unknown as <
  P extends object = Record<string, unknown>,
>(
  props: FrameRenderProps<P> & {ref?: Ref<FrameRenderHandle>},
) => ReactElement | null

//#endregion component
