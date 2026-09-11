import {useEffect, useRef, useState, type FC} from "react";
import {forEachChunked, forEachInFrames} from "../../../../src";
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
  controlStyle,
} from "../ui";

/**
 * 一段自包含的忙等：占住主线程 ms 毫秒。用它构造「长任务」，
 * 观察阻塞期间动画是否停摆。
 */
const spin = (ms: number) => {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* hold the main thread */
  }
};

/**
 * 逐帧间隙计：在 rAF 回调里记录时间戳，事后取相邻最大间隔。
 * 阻塞主线程时 rAF 不会触发，这个间隔就会被拉大。
 */
const useFrameGap = () => {
  const [maxGap, setMaxGap] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [frames, setFrames] = useState(0);
  const framesRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const measuringRef = useRef(false);

  const start = (): number => {
    const begin = performance.now();
    // 以开始时刻作为第一个「帧」：阻塞期间可能一帧都不触发，
    // 若不预置这个锚点，间隙数组为空，最长间隔会被误报为 0。
    framesRef.current = [begin];
    measuringRef.current = true;
    setMaxGap(null);
    setElapsed(null);
    setFrames(0);
    const loop = (timestamp: number) => {
      if (!measuringRef.current) return;
      framesRef.current.push(timestamp);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return begin;
  };

  const stop = (begin: number) => {
    measuringRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    // 再补一个结束时刻，把「最后一帧到结束」这段也算进间隙里
    const stamps = [...framesRef.current, performance.now()];
    let gap = 0;
    for (let index = 1; index < stamps.length; index++) {
      gap = Math.max(gap, stamps[index]! - stamps[index - 1]!);
    }
    const measured = {maxGap: gap, elapsed: performance.now() - begin, frames: stamps.length - 1};
    setFrames(measured.frames);
    setMaxGap(measured.maxGap);
    setElapsed(measured.elapsed);
    return measured;
  };

  useEffect(
    () => () => {
      measuringRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return {start, stop, maxGap, elapsed, frames};
};

/**
 * 主线程驱动的指示器：每帧在 rAF 回调里推进指针位置与帧号。
 *
 * 关键点——它只有主线程能推动。CSS 的 transform/opacity 动画由合成器线程驱动，
 * 主线程被阻塞时仍会继续播放（这正是 FLIP 页所推荐的特性），所以拿它当「阻塞指示器」
 * 会得出反效果：明明卡了两百毫秒，方块照转。这里改操作 left（布局属性）并每帧写
 * textContent，全部依赖主线程，阻塞时指针与帧号会同时定住。
 */
const MainThreadTicker: FC = () => {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const countRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      countRef.current += 1;
      const phase = (countRef.current % 120) / 120;
      const offset = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
      if (markerRef.current) markerRef.current.style.left = `${offset * 100}%`;
      if (frameRef.current) frameRef.current.textContent = String(countRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{display: "flex", alignItems: "center", gap: 10, flexShrink: 0}}>
      <div
        style={{
          position: "relative",
          width: 120,
          height: 6,
          borderRadius: 3,
          background: "#e5e7eb",
        }}
      >
        <div
          ref={markerRef}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "0%",
            width: 14,
            borderRadius: 3,
            background: colors.accent,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: colors.muted,
          fontVariantNumeric: "tabular-nums",
          minWidth: 58,
        }}
      >
        frame <span ref={frameRef}>0</span>
      </span>
    </div>
  );
};

const ITEMS = 2000;
const ITEM_SPIN_MS = 0.05;
const SCALES = [1, 2, 4];

/**
 * 对照演示：同样的一批片段，一次性跑完 vs 每 20 个让出一次。
 * 看两处——指示器（阻塞时会定住）和 maxGap（阻塞时跳到百毫秒级，分片时稳定在帧长附近）。
 */
const SplitCompareDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [scale, setScale] = useState(2);
  const [result, setResult] = useState<{mode: string; gap: number; time: number; frames: number} | null>(
    null,
  );
  const meter = useFrameGap();

  const runBlocking = () => {
    setRunning(true);
    setResult(null);
    const count = ITEMS * scale;
    const begin = meter.start();
    for (let index = 0; index < count; index++) spin(ITEM_SPIN_MS);
    const measured = meter.stop(begin);
    setResult({
      mode: t({zh: "一次性跑完", en: "all at once"}),
      gap: measured.maxGap,
      time: measured.elapsed,
      frames: measured.frames,
    });
    setRunning(false);
  };

  const runChunked = async () => {
    setRunning(true);
    setResult(null);
    const count = ITEMS * scale;
    const begin = meter.start();
    await forEachChunked(
      Array.from({length: count}, (_, index) => index),
      () => spin(ITEM_SPIN_MS),
      {chunkSize: 20},
    );
    const measured = meter.stop(begin);
    setResult({
      mode: t({zh: "每 20 个让出", en: "yield every 20"}),
      gap: measured.maxGap,
      time: measured.elapsed,
      frames: measured.frames,
    });
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:同一份工作,一次跑完 vs 分片让出", en: "Demo: same work, blocking vs chunked"})}
      hint={t({
        zh: "盯着上面的指针与 frame 计数：阻塞执行时它们会一起定住。放大工作量会让冻结更明显。maxGap 是执行期间相邻两帧的最大间隔，近似等于「用户能感知到的最长冻结」。",
        en: "Watch the marker and frame counter above: both freeze during the blocking run. Raising the workload makes the freeze more obvious. maxGap is the largest gap between adjacent frames during the run — roughly the longest freeze a user would feel.",
      })}
    >
      <Controls>
        <MainThreadTicker />
        <Label>{t({zh: "工作量", en: "workload"})}</Label>
        <select
          value={scale}
          onChange={(event) => setScale(Number(event.target.value))}
          style={controlStyle}
          disabled={running}
        >
          {SCALES.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
        <Button onClick={runBlocking} disabled={running}>
          {t({zh: "阻塞执行", en: "Run blocking"})}
        </Button>
        <Button onClick={runChunked} disabled={running} tone="ghost">
          {t({zh: "分片执行", en: "Run chunked"})}
        </Button>
      </Controls>

      {result ? (
        <>
          <Stats>
            <Stat
              label={t({zh: "方式", en: "mode"})}
              value={<span style={{fontSize: 13}}>{result.mode}</span>}
            />
            <Stat
              label={t({zh: "最长帧间隔", en: "max frame gap"})}
              value={
                <span style={{color: result.gap > 100 ? "#dc2626" : colors.success}}>
                  {result.gap.toFixed(0)}ms
                </span>
              }
            />
            <Stat
              label={t({zh: "捕获帧数", en: "frames"})}
              value={
                <span style={{color: result.frames < 2 ? "#dc2626" : colors.success}}>
                  {result.frames}
                </span>
              }
            />
            <Stat label={t({zh: "总耗时", en: "elapsed"})} value={`${result.time.toFixed(0)}ms`} />
          </Stats>
          <Output>
            <div>
              {result.frames < 2
                ? t({
                    zh: "阻塞执行期间几乎一帧都没渲染出来——这段时间页面完全无法响应。",
                    en: "Almost no frame rendered during the blocking run — the page was completely unresponsive for that stretch.",
                  })
                : t({
                    zh: "分片执行期间渲染持续发生：每个 yield 之间都留出了让绘制与输入插入的缝隙。",
                    en: "Rendering continued throughout the chunked run: every yield left a gap for paint and input to slip in.",
                  })}
            </div>
            <Muted>
              {t({
                zh: "分片不会让总耗时变短（甚至略长），它只是把「不可中断」拆成「可插入」——让渲染和输入有机会执行。",
                en: "Chunking does not shorten total time (it can even add a little); it breaks one uninterruptible stretch into interruptible ones so paint and input get a turn.",
              })}
            </Muted>
          </Output>
        </>
      ) : null}
    </Demo>
  );
};

const CHUNK_SIZES = [1, 5, 20, 100];
const CHUNK_ITEMS = 2000;

const ChunkedDemo: FC = () => {
  const {t} = useI18n();
  const [chunkSize, setChunkSize] = useState(20);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setRunning(true);
    setProgress(0);
    setElapsed(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    let done = 0;
    try {
      await forEachChunked(
        Array.from({length: CHUNK_ITEMS}, (_, index) => index),
        () => {
          spin(0.01);
          done += 1;
          if (done % 20 === 0) setProgress(done / CHUNK_ITEMS);
        },
        {chunkSize, signal: controller.signal},
      );
      setProgress(1);
      setElapsed(performance.now() - started);
    } catch {
      // 被 abort:保留当前进度即可
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const pct = Math.round(progress * 100);

  return (
    <Demo
      title={t({zh: "示例:可中断的批量循环", en: "Demo: an interruptible bulk loop"})}
      hint={t({
        zh: `每处理 chunkSize 个让出一次。调小切得更碎（响应更好但开销占比高），调大接近长任务。共 ${CHUNK_ITEMS} 个条目。`,
        en: `Yields after every chunkSize items. Smaller slices are more responsive but pay more overhead; larger ones approach a long task. ${CHUNK_ITEMS} items total.`,
      })}
    >
      <Controls>
        <Label>chunkSize</Label>
        <select
          value={chunkSize}
          onChange={(event) => setChunkSize(Number(event.target.value))}
          style={controlStyle}
          disabled={running}
        >
          {CHUNK_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "运行中…", en: "Running…"}) : t({zh: "开始", en: "Start"})}
        </Button>
        <Button onClick={cancel} disabled={!running} tone="ghost">
          {t({zh: "中止", en: "Abort"})}
        </Button>
        {elapsed !== null ? (
          <Label>
            {t({zh: "耗时", en: "elapsed"})} <strong>{elapsed.toFixed(0)}ms</strong>
          </Label>
        ) : null}
      </Controls>

      <div style={{marginTop: 12}}>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: "#eef1f5",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: colors.accent,
              transition: "width 80ms linear",
            }}
          />
        </div>
        <div style={{marginTop: 6, fontSize: 12, color: colors.muted}}>{pct}%</div>
      </div>
    </Demo>
  );
};

const FRAME_ITEMS = 4000;

const FramesDemo: FC = () => {
  const {t} = useI18n();
  const [budgetMs, setBudgetMs] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{time: number; frames: number} | null>(null);
  const meter = useFrameGap();

  const run = async () => {
    setRunning(true);
    setResult(null);
    const begin = meter.start();
    await forEachInFrames(
      Array.from({length: FRAME_ITEMS}, (_, index) => index),
      () => {
        let sum = 0;
        for (let index = 0; index < 400; index++) sum += Math.sqrt(index);
        if (sum < 0) console.log(sum);
      },
      {budgetMs},
    );
    const measured = meter.stop(begin);
    setResult({time: measured.elapsed, frames: measured.frames});
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:与动画共存的逐帧预算", en: "Demo: a per-frame budget that coexists with animation"})}
      hint={t({
        zh: "每帧只花 budgetMs 做后台工作，剩下的留给动画、样式与绘制。指针与 frame 计数（同为 rAF 驱动）会持续推进，不会定住。",
        en: "Each frame spends only budgetMs on background work, leaving the rest for animation, style and paint. The marker and frame counter (also rAF-driven) keep advancing instead of freezing.",
      })}
    >
      <Controls>
        <MainThreadTicker />
        <Label>budgetMs</Label>
        <select
          value={budgetMs}
          onChange={(event) => setBudgetMs(Number(event.target.value))}
          style={controlStyle}
          disabled={running}
        >
          {[1, 2, 5, 10].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "运行中…", en: "Running…"}) : t({zh: `处理 ${FRAME_ITEMS} 项`, en: `Process ${FRAME_ITEMS}`})}
        </Button>
      </Controls>
      {result ? (
        <Stats>
          <Stat label={t({zh: "总耗时", en: "elapsed"})} value={`${result.time.toFixed(0)}ms`} />
          <Stat label={t({zh: "经过的帧", en: "frames"})} value={result.frames} />
          <Stat
            label={t({zh: "最长帧间隔", en: "max gap"})}
            value={<span style={{color: colors.success}}>{(meter.maxGap ?? 0).toFixed(0)}ms</span>}
          />
        </Stats>
      ) : null}
    </Demo>
  );
};

export const YieldDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              主线程是单线程的：一个任务运行期间，渲染管线（样式 / 布局 / 绘制）与用户输入都无法处理。
              超过 ~50ms 的任务即「长任务」，表现为卡顿。这一组工具把长工作切开、在片段之间让出主线程——
              让积压的输入和帧生产在空隙中得到处理。
            </>
          ),
          en: (
            <>
              The main thread is single-threaded: while one task runs, the rendering pipeline and user
              input cannot be processed. Anything past ~50ms is a "long task" and shows up as jank. This
              group splits long work into pieces and yields the main thread between them, so backlogged
              input and frame production get their turn in the gaps.
            </>
          ),
        })}
      </P>

      <Callout tone="warn">
        {t({
          zh: (
            <>
              让出<b>不会让工作变快</b>。总耗时不变，甚至因调度开销略增；它买到的是响应性。
              真正要减少工作量，请看 <InlineCode>memoize</InlineCode>、背压与批量。
            </>
          ),
          en: (
            <>
              Yielding does <b>not</b> make work faster. Total time is unchanged, or slightly longer
              from scheduling overhead; what you buy is responsiveness. To do less work, reach for{" "}
              <InlineCode>memoize</InlineCode>, backpressure or batching.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 让出主线程", en: "1. Yielding the main thread"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>yieldToMain()</InlineCode> 会优先用 <InlineCode>MessageChannel</InlineCode>{" "}
                （无最小延迟的宏任务，也是 React scheduler 用的传输层）恢复；因此渲染与输入能插进来。
                <InlineCode>scheduler.yield()</InlineCode> 只作为没有 MessageChannel 时的兜底——
                它的恢复优先级会饿死帧生产，所以刻意不作为首选。
              </>
            ),
            en: (
              <>
                <InlineCode>yieldToMain()</InlineCode> prefers <InlineCode>MessageChannel</InlineCode>{" "}
                — a macrotask with no minimum delay, the transport React's scheduler uses — so paint and
                input can slip in. <InlineCode>scheduler.yield()</InlineCode> is only a fallback for
                runtimes without MessageChannel: its resume priority starves frame production, so it is
                deliberately not preferred.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { yieldToMain } from "@wwog/react";

async function renderChats(chats) {
  let count = 0;
  for (const chat of chats) {
    appendChatNode(chat);
    if (++count % 20 === 0) {
      await yieldToMain(); // 积压的输入与绘制在这里得到机会
    }
  }
}`}
          caption={t({
            zh: "yieldToMain 可选接收 AbortSignal；中断时返回的 Promise 立即以中断原因 reject。",
            en: "yieldToMain optionally takes an AbortSignal; when aborted the returned promise rejects immediately with the reason.",
          })}
        />
        <SplitCompareDemo />
      </Section>

      <Section title={t({zh: "2. forEachChunked:按条数让出", en: "2. forEachChunked: yield by count"})}>
        <P>
          {t({
            zh: (
              <>
                最常用的入口：每处理 <InlineCode>chunkSize</InlineCode> 条让出一次。默认 20。
                必须传正整数——传 0 / 负数 / 小数会抛 <InlineCode>RangeError</InlineCode>，而不是静默取消让出。
                切换太碎会适得其反（让出开销超过工作本身），太粗则又变回长任务。
              </>
            ),
            en: (
              <>
                The usual entry point: yield after every <InlineCode>chunkSize</InlineCode> items, 20 by
                default. It must be a positive integer — 0, negative or fractional throws a{" "}
                <InlineCode>RangeError</InlineCode> instead of silently disabling yields. Too fine and the
                yield overhead outweighs the work; too coarse and it is a long task again.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { forEachChunked } from "@wwog/react";

socket.on("messages", (chats) => {
  // 画完这波洪流,每 20 条让出一次
  await forEachChunked(chats, (chat) => appendChatNode(chat), {
    chunkSize: 20,
    signal, // 可选:中断即停止迭代并 reject
  });
});`}
        />
        <ChunkedDemo />
      </Section>

      <Section title={t({zh: "3. forEachInFrames:按帧预算让出", en: "3. forEachInFrames: yield by frame budget"})}>
        <P>
          {t({
            zh: (
              <>
                当工作必须与正在运行的动画共存时用它：每帧只花 <InlineCode>budgetMs</InlineCode>（默认 5ms）。
                它以帧的开始时间戳为锚，因此多个回调共享同一帧时，「用 5ms」自动缩水成「用到帧开始后 5ms」；
                且每帧至少推进一项，绝不空转。恢复经由 <InlineCode>requestAnimationFrame</InlineCode>，
                恰好落在下一帧绘制之前。
              </>
            ),
            en: (
              <>
                Use this when the work must coexist with running animations: each frame spends only{" "}
                <InlineCode>budgetMs</InlineCode> (5 by default). It anchors to the frame's start
                timestamp, so "use 5ms" becomes "use until 5ms after the frame started" and shrinks by
                whatever earlier callbacks consumed; at least one item runs per frame, so it never
                stalls. Resumption lands via <InlineCode>requestAnimationFrame</InlineCode>, just before
                the next frame is drawn.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { forEachInFrames } from "@wwog/react";

// 重算 4000 个粒子,同时不毁掉 60fps 动画
await forEachInFrames(particles, (p) => p.applyForces(), { budgetMs: 5 });

// 条目极轻时,把读时钟的频率调低(每 16 条一次)换取吞吐
await forEachInFrames(rows, (row) => row.markDirty(), {
  budgetMs: 5,
  clockSampleEvery: 16,
});`}
          caption={t({
            zh: "async 的 fn 会让循环在每项之后等到下一帧（每帧至多一个异步项）；要满帧吞吐请用同步 fn。",
            en: "An async fn makes the loop wait for the next frame after each item (at most one async item per frame); use a synchronous fn for full per-frame throughput.",
          })}
        />
        <FramesDemo />
      </Section>

      <Section title={t({zh: "4. API 参考", en: "4. API reference"})}>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "签名", en: "signature"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>yieldToMain</InlineCode>,
              <InlineCode>(signal?) =&gt; Promise&lt;void&gt;</InlineCode>,
              t({zh: "让出主线程，在一个全新任务里恢复。", en: "Yield the main thread; resolves in a fresh task."}),
            ],
            [
              <InlineCode>forEachChunked</InlineCode>,
              <InlineCode>(items, fn, options?) =&gt; Promise&lt;void&gt;</InlineCode>,
              t({zh: "每 chunkSize 条让出一次。", en: "Yields after every chunkSize items."}),
            ],
            [
              <InlineCode>forEachInFrames</InlineCode>,
              <InlineCode>(items, fn, options?) =&gt; Promise&lt;void&gt;</InlineCode>,
              t({zh: "每帧最多花 budgetMs。", en: "Spends at most budgetMs per frame."}),
            ],
          ]}
        />
        <P>
          <InlineCode>options</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "默认", en: "default"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>chunkSize</InlineCode>,
              <InlineCode>number</InlineCode>,
              <InlineCode>20</InlineCode>,
              t({zh: "正整数；否则抛 RangeError。", en: "Positive integer; otherwise RangeError."}),
            ],
            [
              <InlineCode>budgetMs</InlineCode>,
              <InlineCode>number</InlineCode>,
              <InlineCode>5</InlineCode>,
              t({zh: "正有限数；否则抛 RangeError。", en: "Positive finite number; otherwise RangeError."}),
            ],
            [
              <InlineCode>clockSampleEvery</InlineCode>,
              <InlineCode>number</InlineCode>,
              <InlineCode>1</InlineCode>,
              t({zh: "多少次条目读一次时钟；正整数。", en: "Items between clock reads; positive integer."}),
            ],
            [
              <InlineCode>signal</InlineCode>,
              <InlineCode>AbortSignal</InlineCode>,
              "—",
              t({zh: "中断后停止迭代并以中断原因 reject。", en: "Stops iteration and rejects with the abort reason."}),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
