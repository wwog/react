import {useEffect, useRef, useState, type CSSProperties, type FC} from "react";
import {FrameRender, type FrameRenderHandle, type FrameStrategy} from "../../../../src";
import {useI18n} from "../../i18n";
import {
  ApiTable,
  Button,
  Callout,
  Code,
  Controls,
  Demo,
  InlineCode,
  Label,
  Muted,
  Output,
  P,
  Section,
  Stat,
  Stats,
  colors,
} from "../ui";

//#region 演示用的高频信号源

/** 波形：三个不同周期的正弦叠加，看起来像真实遥测数据，且完全是 tick 的纯函数。 */
const wave = (t: number): number =>
  Math.sin(t / 5) + Math.sin(t / 13) * 0.6 + Math.sin(t / 31) * 0.3;

const SIGNAL_SAMPLES = 80;

/**
 * 把最近 80 个采样点连成 polyline。它是 tick 的纯函数（不依赖历史状态），所以两根管线的
 * 输入相同就必然画出完全一样的曲线 —— 这正是演示要的：输出一样，渲染次数差一个数量级。
 */
const polyline = (tick: number): string => {
  const points: string[] = [];
  for (let index = 0; index < SIGNAL_SAMPLES; index++) {
    const t = tick - SIGNAL_SAMPLES + index + 1;
    const x = (index / (SIGNAL_SAMPLES - 1)) * 100;
    const y = 50 - wave(t) * 14;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
};

/**
 * 一个"并不便宜"的叶子组件：每次渲染都要重算 80 个点的曲线。它只是把 tick 画出来，
 * 不持有任何状态 —— 这是 FrameRender 唯一推荐的子组件形态。
 */
const WavePane: FC<{tick: number; color: string; onRender: () => void}> = ({
  tick,
  color,
  onRender,
}) => {
  const points = polyline(tick);
  // 无依赖数组的 effect 每次渲染后都会跑，用它统计真实渲染次数
  useEffect(() => {
    onRender();
  });

  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{display: "block", width: "100%", height: 64}}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{fontSize: 11.5, color: colors.muted, marginTop: 4}}>
        tick {tick} · sine {(wave(tick)).toFixed(3)}
      </div>
    </div>
  );
};

/** 面板外框：标题 + 渲染次数徽标 + 内容。 */
const Pane: FC<{title: string; tone: "plain" | "framed"; renders: number; children: React.ReactNode}> = ({
  title,
  tone,
  renders,
  children,
}) => (
  <div
    style={{
      flex: "1 1 220px",
      minWidth: 200,
      border: `1px solid ${tone === "framed" ? colors.accentBorder : colors.border}`,
      background: tone === "framed" ? colors.accentSoft : "#f9fafb",
      borderRadius: 10,
      padding: 12,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <span style={{fontSize: 12.5, fontWeight: 600, color: colors.text}}>{title}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: tone === "framed" ? colors.accent : colors.warn,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {renders}
      </span>
    </div>
    {children}
  </div>
);

/** 高频数据源：按给定频率自增的 tick，停止时保留当前值。 */
const useTickSource = (hz: number, running: boolean): number => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const period = Math.max(4, Math.round(1000 / hz));
    const id = window.setInterval(() => setTick((value) => value + 1), period);
    return () => window.clearInterval(id);
  }, [hz, running]);
  return tick;
};

//#endregion 演示用的高频信号源

//#region 1. 合帧投递

const FRAME_RATES = [120, 60, 30, 15, 5];
const SOURCE_RATES = [250, 120, 60];
const STRATEGIES: FrameStrategy[] = ["auto", "raf", "timer"];

const FrameRateDemo: FC = () => {
  const {t} = useI18n();
  const [hz, setHz] = useState(250);
  const [fps, setFps] = useState(30);
  const [strategy, setStrategy] = useState<FrameStrategy>("auto");
  const [running, setRunning] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [leading, setLeading] = useState(true);
  const [trailing, setTrailing] = useState(true);
  const [logEnabled, setLogEnabled] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const tick = useTickSource(hz, running);
  const handleRef = useRef<FrameRenderHandle | null>(null);
  const countersRef = useRef({plain: 0, framed: 0});

  const appendLog = (line: string) => {
    setLog((entries) => [line, ...entries].slice(0, 6));
  };

  // 每 tick 都重渲染，所以这里读到的是最新统计
  const stats = handleRef.current?.getStats();

  return (
    <Demo
      title={t({
        zh: "示例:同一份数据的两种投递方式",
        en: "Demo: one data source, two delivery paths",
      })}
      hint={t({
        zh: "左边的曲线每次更新都重渲染，右边的曲线被 FrameRender 合帧。两根曲线的输入完全相同，所以画出来的形状完全相同 —— 差别只在渲染次数上。",
        en: "The left curve re-renders on every update; the right one is framed by FrameRender. Both curves get exactly the same input, so they draw exactly the same shape — the only difference is the render count.",
      })}
    >
      <Controls>
        <Label>{t({zh: "数据源", en: "source"})}</Label>
        {SOURCE_RATES.map((rate) => (
          <Button key={rate} tone={hz === rate ? "primary" : "ghost"} onClick={() => setHz(rate)}>
            {rate} Hz
          </Button>
        ))}
        <Button tone="ghost" onClick={() => setRunning((value) => !value)}>
          {running ? t({zh: "暂停", en: "pause"}) : t({zh: "继续", en: "resume"})}
        </Button>
      </Controls>

      <Controls>
        <Label>fps</Label>
        {FRAME_RATES.map((rate) => (
          <Button key={rate} tone={fps === rate ? "primary" : "ghost"} onClick={() => setFps(rate)}>
            {rate}
          </Button>
        ))}
      </Controls>

      <Controls>
        <Label>strategy</Label>
        {STRATEGIES.map((mode) => (
          <Button
            key={mode}
            tone={strategy === mode ? "primary" : "ghost"}
            onClick={() => setStrategy(mode)}
          >
            {mode}
          </Button>
        ))}
      </Controls>

      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={leading} onChange={(event) => setLeading(event.target.checked)} />
          leading
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={trailing}
            onChange={(event) => setTrailing(event.target.checked)}
          />
          trailing
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} />
          {t({zh: "旁路(disabled)", en: "bypass (disabled)"})}
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={logEnabled}
            onChange={(event) => setLogEnabled(event.target.checked)}
          />
          {t({zh: "记录提交日志", en: "commit log"})}
        </label>
      </Controls>

      <Controls>
        <Label>{t({zh: "ref 句柄", en: "ref handle"})}</Label>
        <Button tone="ghost" onClick={() => handleRef.current?.flush()}>
          flush()
        </Button>
        <Button tone="ghost" onClick={() => handleRef.current?.cancel()}>
          cancel()
        </Button>
        <Button tone="ghost" onClick={() => handleRef.current?.pause()}>
          pause()
        </Button>
        <Button tone="ghost" onClick={() => handleRef.current?.resume()}>
          resume()
        </Button>
      </Controls>

      <div style={{display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14}}>
        <Pane
          title={t({zh: "裸传:每次更新都渲染", en: "Direct: renders on every update"})}
          tone="plain"
          renders={countersRef.current.plain}
        >
          <WavePane
            tick={tick}
            color={colors.warn}
            onRender={() => {
              countersRef.current.plain += 1;
            }}
          />
        </Pane>
        <Pane
          title={t({zh: `FrameRender fps=${fps}`, en: `FrameRender fps=${fps}`})}
          tone="framed"
          renders={countersRef.current.framed}
        >
          <FrameRender<{tick: number; color: string; onRender: () => void}>
            fps={fps}
            strategy={strategy}
            disabled={disabled}
            leading={leading}
            trailing={trailing}
            ref={handleRef}
            onCommit={() => {
              if (logEnabled) appendLog(t({zh: "提交", en: "commit"}));
            }}
            onDrop={(_props, reason) => {
              if (logEnabled) appendLog(`${t({zh: "丢弃", en: "drop" })}: ${reason}`);
            }}
          >
            <WavePane
              tick={tick}
              color={colors.accent}
              onRender={() => {
                countersRef.current.framed += 1;
              }}
            />
          </FrameRender>
        </Pane>
      </div>

      <Stats>
        <Stat label={t({zh: "裸传渲染", en: "direct renders"})} value={countersRef.current.plain} />
        <Stat label={t({zh: "合帧渲染", en: "framed renders"})} value={countersRef.current.framed} />
        <Stat label={t({zh: "提交", en: "commits"})} value={stats?.commits ?? 0} />
        <Stat label={t({zh: "相等跳过", en: "skips"})} value={stats?.skips ?? 0} />
        <Stat label={t({zh: "合帧抑制", en: "coalesced"})} value={stats?.coalesced ?? 0} />
        <Stat
          label={t({zh: "实测提交频率", en: "commits/sec"})}
          value={stats?.commitsPerSecond ?? 0}
        />
        <Stat label={t({zh: "泵触发", en: "frames"})} value={stats?.frames ?? 0} />
      </Stats>

      {logEnabled ? (
        <Output>
          {log.length === 0 ? <Muted>{t({zh: "等待事件…", en: "waiting…"})}</Muted> : null}
          {log.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </Output>
      ) : null}

      <div style={{fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 1.7}}>
        {t({
          zh: (
            <>
              开发环境里 React StrictMode 会把渲染次数翻倍，所以看两条管线的比例比看绝对值更有意义。
              另外数据源频率超过屏幕刷新率后，合帧也顶多做到“每帧一次”——有效上限是刷新率。
              <br />
              最后一条是浏览器行为，不是组件的问题：窗口不在前台（被其他窗口遮挡）时，浏览器会暂停{" "}
              <InlineCode>requestAnimationFrame</InlineCode> 并节流定时器。默认的{" "}
              <InlineCode>auto</InlineCode> 策略走 rAF，所以此时不会提交任何东西 —— 这正是
              “不做不可见的工作”。在这个页面里切到 <InlineCode>timer</InlineCode>{" "}
              策略即可看到后台也持续提交的效果。
            </>
          ),
          en: (
            <>
              Under React StrictMode in development every render count is doubled, so read the ratio
              between the two paths rather than the absolute numbers. And once the source outruns the
              display refresh rate, framing can still only reach “once per frame” — the refresh rate
              is the ceiling.
              <br />
              The last point is browser behaviour, not a component problem: when the window is not in
              the foreground (covered by another window) the browser suspends{" "}
              <InlineCode>requestAnimationFrame</InlineCode> and throttles timers. The default{" "}
              <InlineCode>auto</InlineCode> strategy rides on rAF, so nothing commits in that state —
              which is exactly “do no invisible work”. Switch this demo to the{" "}
              <InlineCode>timer</InlineCode> strategy to see commits continue in the background.
            </>
          ),
        })}
      </div>
    </Demo>
  );
};

//#endregion 1. 合帧投递

//#region 2. 比较与拦截

type CompareMode = "shallow" | "reference" | "never";

const CompareDemo: FC = () => {
  const {t} = useI18n();
  const [noiseHz, setNoiseHz] = useState(250);
  const [running, setRunning] = useState(true);
  const [useSelect, setUseSelect] = useState(false);
  const [compare, setCompare] = useState<CompareMode>("shallow");
  const [vetoHidden, setVetoHidden] = useState(false);
  const [value, setValue] = useState(7);

  const noise = useTickSource(noiseHz, running);
  const handleRef = useRef<FrameRenderHandle | null>(null);
  const rendersRef = useRef({framed: 0});

  const stats = handleRef.current?.getStats();

  return (
    <Demo
      title={t({
        zh: "示例:让无谓的提交彻底消失",
        en: "Demo: making pointless commits disappear",
      })}
      hint={t({
        zh: "父组件被噪声源以高频重渲染，但传给子组件的值固定不变，而且每次都新建一个 style 对象与回调。依次打开 select、切换 compare，观察“相等跳过”如何把提交压到 0。这个演示固定用 timer 策略：它要说的是比较，不该受制于传输层，这样窗口不在前台时也照样能看到效果。",
        en: "The parent re-renders at high frequency, but the value handed to the child never changes — while a style object and a callback are rebuilt every time. Turn on select and switch compare to watch skips drive commits to zero. This demo pins the timer strategy: it is about comparison and should not be hostage to the transport, so it keeps working even when the window is not in the foreground.",
      })}
    >
      <Controls>
        <Label>{t({zh: "父组件噪点", en: "parent noise"})}</Label>
        {SOURCE_RATES.map((rate) => (
          <Button key={rate} tone={noiseHz === rate ? "primary" : "ghost"} onClick={() => setNoiseHz(rate)}>
            {rate} Hz
          </Button>
        ))}
        <Button tone="ghost" onClick={() => setRunning((next) => !next)}>
          {running ? t({zh: "暂停", en: "pause"}) : t({zh: "继续", en: "resume"})}
        </Button>
      </Controls>

      <Controls>
        <Label>compare</Label>
        {(["shallow", "reference", "never"] as CompareMode[]).map((mode) => (
          <Button key={mode} tone={compare === mode ? "primary" : "ghost"} onClick={() => setCompare(mode)}>
            {mode}
          </Button>
        ))}
      </Controls>

      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={useSelect}
            onChange={(event) => setUseSelect(event.target.checked)}
          />
          {t({zh: "select 只比较 value", en: "select: compare value only"})}
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={vetoHidden}
            onChange={(event) => setVetoHidden(event.target.checked)}
          />
          {t({zh: "shouldCommit 否决（模拟不可见）", en: "shouldCommit veto (simulate invisible)"})}
        </label>
        <Button tone="ghost" onClick={() => setValue((current) => current + 1)}>
          {t({zh: "改一次 value", en: "change value once"})}
        </Button>
      </Controls>

      <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
        <Pane
          title={t({zh: "子组件渲染次数", en: "child renders"})}
          tone="framed"
          renders={rendersRef.current.framed}
        >
          <FrameRender<{value: number; onPing: () => void; style: CSSProperties}>
            fps={30}
            strategy="timer"
            compare={compare}
            select={useSelect ? (props) => ({value: props.value}) : undefined}
            shouldCommit={
              vetoHidden
                ? () => false
                : undefined
            }
            ref={handleRef}
          >
            <ProbePanel
              value={value}
              onPing={() => setValue((current) => current)}
              style={{borderColor: colors.accentBorder}}
              onRender={() => {
                rendersRef.current.framed += 1;
              }}
            />
          </FrameRender>
          <div style={{fontSize: 11.5, color: colors.muted, marginTop: 6}}>
            {t({zh: "父组件已重渲染", en: "parent re-renders"})} {noise} {t({zh: "次", en: ""})}
          </div>
        </Pane>
      </div>

      <Stats>
        <Stat label={t({zh: "提交", en: "commits"})} value={stats?.commits ?? 0} />
        <Stat label={t({zh: "相等跳过", en: "skips"})} value={stats?.skips ?? 0} />
        <Stat label={t({zh: "否决", en: "vetoes"})} value={stats?.vetoes ?? 0} />
        <Stat label={t({zh: "捕获父渲染", en: "captures"})} value={stats?.captures ?? 0} />
        <Stat label={t({zh: "合帧抑制", en: "coalesced"})} value={stats?.coalesced ?? 0} />
      </Stats>
    </Demo>
  );
};

/** 只读地展示自己拿到的 props：样式是每次渲染都新建的对象，回调也是新函数。 */
const ProbePanel: FC<{
  value: number;
  onPing: () => void;
  style: CSSProperties;
  onRender: () => void;
}> = ({value, onPing, style, onRender}) => {
  useEffect(() => {
    onRender();
  });

  return (
    <div
      style={{
        ...style,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 9,
        padding: "8px 10px",
        background: "#fff",
        fontSize: 12.5,
        color: colors.body,
      }}
    >
      value = <b>{value}</b>
      <button
        type="button"
        onClick={onPing}
        style={{
          marginLeft: 10,
          fontSize: 12,
          padding: "2px 8px",
          borderRadius: 6,
          border: `1px solid ${colors.border}`,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        ping
      </button>
    </div>
  );
};

//#endregion 2. 比较与拦截

export const FrameRenderDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>FrameRender</InlineCode> 做的是<strong>合帧投递</strong>，不是"节流渲染"。
              设间隔 <InlineCode>T = 1000 / fps</InlineCode>，在任意窗口{" "}
              <InlineCode>[t, t+T)</InlineCode> 内，子组件至多收到一次 props 更新，并且携带窗口内
              最后一次的值（最新值胜出）。父组件可以按任意高的频率重渲染 ——{" "}
              <InlineCode>FrameRender</InlineCode> 自己每次都会重新执行，但昂贵的子树只在帧边界上
              渲染一次。
            </>
          ),
          en: (
            <>
              <InlineCode>FrameRender</InlineCode> does <strong>framed delivery</strong>, not
              "throttled rendering". With <InlineCode>T = 1000 / fps</InlineCode>, the child receives
              at most one props update per window <InlineCode>[t, t+T)</InlineCode>, carrying the last
              value of that window (latest wins). The parent may re-render arbitrarily often —{" "}
              <InlineCode>FrameRender</InlineCode> itself re-runs every time, but the expensive
              subtree renders only at frame boundaries.
            </>
          ),
        })}
      </P>

      <Callout tone="warn">
        {t({
          zh: (
            <>
              它只适合<strong>无状态</strong>子组件，或状态<strong>不频繁更新</strong>的子组件。
              如果子组件内部有自己的 state、订阅了 context、或在高频定时器 / 订阅里更新，那些
              重渲染不会经过 <InlineCode>FrameRender</InlineCode>，合帧不会生效。正确做法是把状态
              抽离到<strong>外层</strong>（或 <InlineCode>createExternalState</InlineCode> 这类外部
              存储），只让 <InlineCode>FrameRender</InlineCode> 承担投递：外层怎么高频更新都行，
              昂贵的子树每帧只渲染一次。
              <br />
              另外，它用<strong>新鲜度换吞吐</strong>：窗口内子组件渲染的是上一次的 props。因此
              <strong>不要</strong>包裹受控输入框、错误提示、加载态，或任何必须即时反映用户操作的
              UI。
            </>
          ),
          en: (
            <>
              It only suits <strong>stateless</strong> children, or children whose state updates are
              infrequent. If the child keeps its own state, subscribes to context, or updates from a
              high-frequency timer/subscription, those re-renders never pass through{" "}
              <InlineCode>FrameRender</InlineCode> and framing will not help. Extract that state{" "}
              <strong>outside</strong> (or into an external store such as{" "}
              <InlineCode>createExternalState</InlineCode>) and let <InlineCode>FrameRender</InlineCode>{" "}
              do the delivery: the outer state may update as often as it likes, while the expensive
              subtree renders once per frame.
              <br />
              It also trades <strong>freshness for throughput</strong>: inside a window the child
              renders the previous props. So never wrap controlled inputs, error messages, loading
              states, or any UI that must reflect user actions immediately.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 合帧投递:同一份数据,两种投递", en: "1. Framed delivery: one source, two paths"})}>
        <P>
          {t({
            zh: (
              <>
                两条管线拿到的是同一个 <InlineCode>tick</InlineCode>，子组件也是同一个"每次渲染都要
                重算 80 个采样点"的纯展示组件。差别只在于右边包了一层 <InlineCode>FrameRender</InlineCode>
                ：把 fps 调到 5，右边会慢下来而左边照旧；勾上"旁路（disabled）"，右边立刻退化成
                和左边一样 —— 这个开关就是用来对照收益的。
              </>
            ),
            en: (
              <>
                Both paths receive the same <InlineCode>tick</InlineCode> and use the same pure
                presentational child that recomputes 80 sample points on every render. The only
                difference is that the right one is wrapped in <InlineCode>FrameRender</InlineCode>:
                set fps to 5 and the right side slows down while the left side does not. Tick "bypass
                (disabled)" and the right side immediately degrades to the left one — that switch
                exists to A/B the win.
              </>
            ),
          })}
        </P>
        <FrameRateDemo />
        <Code
          code={`import { FrameRender } from "@wwog/react";

// ✅ 状态在外层（高频无所谓），昂贵的子树每帧只渲染一次
function Dashboard() {
  const ticks = useHighFrequencyTicks();      // 这里可能 250Hz
  return (
    <FrameRender fps={30}>
      <LiveChart ticks={ticks} />              {/* 无状态纯展示 */}
    </FrameRender>
  );
}

// ✅ 渲染函数形式：需要派生时用，props 包是被合帧投递的对象
<FrameRender fps={30} props={{ data, theme }}>
  {({ data, theme }) => <Chart data={data} theme={theme} />}
</FrameRender>

// 🚫 受控输入被合帧会出现回显延迟与光标跳动
<FrameRender fps={30}>
  <input value={keyword} onChange={onChange} />
</FrameRender>`}
          caption={t({
            zh: "子组件保持无状态、只做展示，是这套用法成立的前提。",
            en: "Keeping the child stateless and presentational is what makes this pattern work.",
          })}
        />
        <ApiTable
          head={[
            t({zh: "prop", en: "prop"}),
            t({zh: "类型 / 默认值", en: "type / default"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>children</InlineCode>,
              <InlineCode>{"ReactElement<P> | ((props: P) => ReactNode)"}</InlineCode>,
              t({
                zh: "要合帧投递的单个元素，或渲染函数。Fragment / 数组 / 字符串无法提取 props，会警告并旁路直通。",
                en: "One element or a render function. A Fragment, array or string has no extractable props, so it warns and passes through.",
              }),
            ],
            [
              <InlineCode>props</InlineCode>,
              <InlineCode>P</InlineCode>,
              t({
                zh: "函数形式的 props 包，省略时函数收到 {}。",
                en: "The props bag for the function form; defaults to {}.",
              }),
            ],
            [
              <InlineCode>fps</InlineCode>,
              <InlineCode>number · 60</InlineCode>,
              t({
                zh: "目标提交帧率，间隔不小于 1000/fps（含 4ms 相位容差）。传 ≤ 0 等于旁路。",
                en: "Target commit rate; at least 1000/fps apart (with a 4ms phase tolerance). ≤ 0 bypasses framing.",
              }),
            ],
            [
              <InlineCode>strategy</InlineCode>,
              <InlineCode>{"'auto' | 'raf' | 'timer' · 'auto'"}</InlineCode>,
              t({
                zh: "泵的传输层。auto 可见时用 rAF，隐藏时退化定时器。",
                en: "Pump transport. auto uses rAF while visible and a timer while hidden.",
              }),
            ],
            [
              <InlineCode>leading</InlineCode>,
              <InlineCode>boolean · true</InlineCode>,
              t({
                zh: "窗口内首个更新是否尽快提交（下一帧，非同步）。false 则首个提交要等满一个间隔。",
                en: "Whether the first update of a window commits as soon as possible (next frame, not synchronous). False waits a full interval.",
              }),
            ],
            [
              <InlineCode>trailing</InlineCode>,
              <InlineCode>boolean · true</InlineCode>,
              t({
                zh: "窗口内的更新是否算数。false 为采样语义：只有落到窗口边界上的那次会提交。",
                en: "Whether in-window updates count. False means sampling: only the update landing on a window boundary commits.",
              }),
            ],
            [
              <InlineCode>paused</InlineCode>,
              <InlineCode>boolean · false</InlineCode>,
              t({
                zh: "暂停提交但保留待处理值；恢复后下一帧提交最新值。",
                en: "Pause committing while keeping the pending value; on resume the latest value commits next frame.",
              }),
            ],
            [
              <InlineCode>disabled</InlineCode>,
              <InlineCode>boolean · false</InlineCode>,
              t({
                zh: "完全旁路：不调度、不比较、不统计，每次父渲染直通。用来对比收益。",
                en: "Full bypass: no scheduling, no comparison, no stats. Use it to A/B the win.",
              }),
            ],
            [
              <InlineCode>pauseWhenHidden</InlineCode>,
              <InlineCode>boolean · true</InlineCode>,
              t({
                zh: "标签页隐藏时不做提交。注意它会把 onCommit 这类副作用的时序推迟到重新可见。",
                en: "Do not commit while the tab is hidden. Note this defers side effects such as onCommit until the tab is visible again.",
              }),
            ],
            [
              <InlineCode>scheduler</InlineCode>,
              <InlineCode>{"(cb) => cancel"}</InlineCode>,
              t({
                zh: "注入自定义帧调度器，替代 strategy；单元测试也用它确定性地推进帧。",
                en: "Inject a custom frame scheduler, replacing strategy; unit tests use it to advance frames deterministically.",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "2. 比较与拦截:把无谓的提交消掉", en: "2. Comparison and veto: deleting pointless commits"})}>
        <P>
          {t({
            zh: (
              <>
                合帧只是把提交频率钉在 fps 上；真正"一次都不提交"靠的是比较。
                <InlineCode>select</InlineCode> 只影响<strong>比较</strong>，不影响子组件收到的 props ——
                它把参与比较的字段收窄，于是每次渲染都新建的 style 对象、内联回调都不再造成提交。
                <InlineCode>shouldCommit</InlineCode> 则是提交前的策略否决：不可见、拖拽中、业务上"无
                实质变化"，都可以直接丢弃。
              </>
            ),
            en: (
              <>
                Framing only pins the commit rate to fps; the "commit nothing at all" case comes from
                comparison. <InlineCode>select</InlineCode> affects the <strong>comparison</strong> only,
                never what the child receives: it narrows the compared fields, so per-render style
                objects and inline callbacks stop causing commits.{" "}
                <InlineCode>shouldCommit</InlineCode> is the policy veto before committing — invisible,
                mid-drag, or business-insignificant updates can be dropped outright.
              </>
            ),
          })}
        </P>
        <CompareDemo />
        <Code
          code={`// select 只收窄比较范围：子组件仍拿到完整 props
<FrameRender
  fps={30}
  select={(props) => ({ value: props.value })}
  compare="shallow"
>
  <Panel value={value} style={{ color: "blue" }} onPing={handlePing} />
</FrameRender>

// shouldCommit 在提交前做策略否决
<FrameRender
  fps={30}
  shouldCommit={() => document.visibilityState === "visible"}
  onDrop={(props, reason) => report(props, reason)}   // reason: 'vetoed'
>
  <Chart data={data} />
</FrameRender>

// 自定义 compare：用廉价的 version 字段代替深比较
<FrameRender fps={30} compare={(prev, next) => prev.version === next.version}>
  <Board rows={rows} version={version} />
</FrameRender>`}
        />
        <ApiTable
          head={[
            t({zh: "prop", en: "prop"}),
            t({zh: "类型 / 默认值", en: "type / default"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>select</InlineCode>,
              <InlineCode>{"(props: P) => unknown"}</InlineCode>,
              t({
                zh: "返回参与比较的字段子集。只影响比较，子组件仍收到完整 props。",
                en: "Returns the subset of fields that participate in comparison. Comparison only — the child still receives the full props.",
              }),
            ],
            [
              <InlineCode>compare</InlineCode>,
              <InlineCode>{"'shallow' | 'reference' | 'never' | fn · 'shallow'"}</InlineCode>,
              t({
                zh: "返回 true 表示相等、跳过提交。reference 最便宜但内联字面量每次都判定不等。",
                en: "True means equal and the commit is skipped. reference is cheapest, but inline literals always compare unequal.",
              }),
            ],
            [
              <InlineCode>shouldCommit</InlineCode>,
              <InlineCode>{"(prev, next, ctx) => boolean"}</InlineCode>,
              t({
                zh: "提交前的策略否决。false 则丢弃，计入 vetoes 并经 onDrop 以 'vetoed' 上报。",
                en: "Policy veto before committing. False drops the value, counted in vetoes and reported through onDrop as 'vetoed'.",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. 生命周期与统计", en: "3. Lifecycle and stats"})}>
        <P>
          {t({
            zh: (
              <>
                每个阶段都有钩子：<InlineCode>onFrame</InlineCode> 在每次泵触发时调用（含最终没有提交的
                帧），<InlineCode>onCommit</InlineCode> 在提交后于 effect 中调用，{" "}
                <InlineCode>onDrop</InlineCode> 只上报"有意义的丢弃"。statistics 用 ref 上的{" "}
                <InlineCode>getStats()</InlineCode> 读取 —— 验证收益靠数字，而不是靠感觉。
              </>
            ),
            en: (
              <>
                Every stage has a hook: <InlineCode>onFrame</InlineCode> fires on each pump tick
                (including ticks that end up not committing), <InlineCode>onCommit</InlineCode> runs
                after a commit inside an effect, and <InlineCode>onDrop</InlineCode> reports only
                meaningful drops. Read statistics through <InlineCode>getStats()</InlineCode> on the
                ref — verify the win with numbers, not with a feeling.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[
            t({zh: "prop / 方法", en: "prop / method"}),
            t({zh: "签名", en: "signature"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>onFrame</InlineCode>,
              <InlineCode>{"(ctx) => void"}</InlineCode>,
              t({
                zh: "每次泵触发都调用。不是通用帧时钟：空闲时一帧都不跑。",
                en: "Called on every pump tick. Not a general frame clock: it runs zero frames when idle.",
              }),
            ],
            [
              <InlineCode>onCommit</InlineCode>,
              <InlineCode>{"(props, ctx) => void"}</InlineCode>,
              t({
                zh: "提交后于 effect 中调用，绝不在渲染期间。",
                en: "Called after a commit, inside an effect — never during render.",
              }),
            ],
            [
              <InlineCode>onDrop</InlineCode>,
              <InlineCode>{"(props, reason, ctx) => void"}</InlineCode>,
              t({
                zh: "reason 为 'vetoed' | 'cancelled' | 'unmounted'。被更新值覆盖不上报。",
                en: "reason is 'vetoed' | 'cancelled' | 'unmounted'. Superseding is not reported.",
              }),
            ],
            [
              <InlineCode>warn</InlineCode>,
              <InlineCode>boolean · true</InlineCode>,
              t({
                zh: "是否在开发环境打印一次“只适合无状态子组件”的提示。",
                en: "Whether to print the 'stateless children only' notice once in development.",
              }),
            ],
            [
              <InlineCode>flush()</InlineCode>,
              <InlineCode>{"() => boolean"}</InlineCode>,
              t({
                zh: "立即提交待处理值，跳过时间门。用于“这一刻必须新鲜”的场景。",
                en: "Commit the pending value immediately, bypassing the time gate. For moments that must be fresh.",
              }),
            ],
            [
              <InlineCode>cancel()</InlineCode>,
              <InlineCode>{"() => boolean"}</InlineCode>,
              t({
                zh: "丢弃待处理值并取消已预约的帧。",
                en: "Drop the pending value and cancel the booked frame.",
              }),
            ],
            [
              <InlineCode>pause() / resume()</InlineCode>,
              <InlineCode>{"() => void"}</InlineCode>,
              t({
                zh: "命令式暂停 / 恢复，与 paused prop 等效。",
                en: "Imperative pause/resume, equivalent to the paused prop.",
              }),
            ],
            [
              <InlineCode>getStats()</InlineCode>,
              <InlineCode>{"() => FrameRenderStats"}</InlineCode>,
              t({
                zh: "读取 frames / captures / commits / skips / vetoes / coalesced / dropped 快照。",
                en: "Read a snapshot of frames / captures / commits / skips / vetoes / coalesced / dropped.",
              }),
            ],
          ]}
        />
        <Code
          code={`const ref = useRef<FrameRenderHandle>(null);

// 用户点击"刷新"时不要等下一帧 —— 直接 flush
<Button onClick={() => ref.current?.flush()}>刷新</Button>

// 提交后埋点、同步外部系统
<FrameRender
  fps={30}
  ref={ref}
  onCommit={(props, ctx) => track("chart_commit", { frame: ctx.frame })}
  onDrop={(props, reason) => report(props, reason)}
>
  <Chart data={data} />
</FrameRender>

// 用数字验证收益
console.log(ref.current?.getStats());
// { frames: 61, captures: 243, commits: 61, skips: 0,
//   vetoes: 0, coalesced: 182, dropped: 0, commitsPerSecond: 30.1 }`}
          caption={t({
            zh: "captures 是父组件真正传了新东西的次数，coalesced 是被合帧挡住的次数 —— 两者之差就是这套机制省下来的渲染。",
            en: "captures counts parent renders that actually brought something new; coalesced counts the ones framing stopped — the gap between them is the rendering you saved.",
          })}
        />
      </Section>

      <Section title={t({zh: "4. 什么时候不该用它", en: "4. When not to use it"})}>
        <P>
          {t({
            zh: (
              <>
                合帧的本质是"这次不更新，等下个窗口一起更新"，所以任何"必须立刻反映"的东西都不该
                放进来。反过来，如果子组件本来就不贵，包一层只是多了一次 <InlineCode>memo</InlineCode>{" "}
                比较的成本 —— 先用 <InlineCode>getStats()</InlineCode> 量一下再说。
              </>
            ),
            en: (
              <>
                Framing means "skip this update, deliver it with the next window", so anything that
                must reflect immediately does not belong inside. And if the child is not expensive to
                begin with, wrapping it only adds one <InlineCode>memo</InlineCode> comparison — measure
                with <InlineCode>getStats()</InlineCode> first.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 🚫 受控输入：合帧 → 回显延迟、光标跳动
<FrameRender fps={30}><input value={keyword} onChange={setKeyword} /></FrameRender>

// 🚫 状态在昂贵的子树内部 —— FrameRender 帮不上，它只能看见 props
<FrameRender fps={30}><LiveChart /></FrameRender>   // LiveChart 内部自己 setState

// 🚫 布局测量 / 动画：它们本来就要求按帧同步，合帧只会让它们错位
<FrameRender fps={30}><ScrollSyncIndicator /></FrameRender>

// ✅ 高频数据 + 昂贵渲染 + 必须即时反映的操作在外层
function Telemetry() {
  const [range, setRange] = useState("1h");     // 用户操作，立即反馈
  const series = useLiveSeries(range);          // 250Hz 流入
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      <FrameRender fps={30}>
        <SeriesChart series={series} />
      </FrameRender>
    </>
  );
}`}
        />
      </Section>
    </div>
  );
};
