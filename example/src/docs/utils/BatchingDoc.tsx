import {useEffect, useRef, useState, type CSSProperties, type FC} from "react";
import {appendBatch, debounce, rafSchedule, runLayoutBatch, throttle} from "../../../../src";
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

type Strategy = "debounce" | "throttle" | "raf";

const BURST_SIZE = 60;
const BURST_INTERVAL = 8; // ms，模拟高频事件（125 次/秒）
const DEBOUNCE_WAIT = 200;
const THROTTLE_WAIT = 100;

interface Mark {
  at: number;
}

/**
 * 同一串高频事件同时喂给 debounce / throttle / rafSchedule，对比各自真正执行的次数与时刻。
 * 三种策略的取舍在这张图上很直观：debounce 只在安静后跑一次，throttle 匀速跑，raf 每帧至多一次。
 */
const BurstDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [marks, setMarks] = useState<Record<Strategy, Mark[]>>({debounce: [], throttle: [], raf: []});
  const [duration, setDuration] = useState(BURST_SIZE * BURST_INTERVAL + DEBOUNCE_WAIT + 120);
  const tickRef = useRef<(key: Strategy, at: number) => void>(() => {});
  const startRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  tickRef.current = (key, at) => {
    setMarks((prev) => ({...prev, [key]: [...prev[key], {at}]}));
  };

  const fnsRef = useRef<ReturnType<typeof buildFns> | null>(null);
  function buildFns() {
    return {
      debounce: debounce(() => tickRef.current("debounce", performance.now() - startRef.current), DEBOUNCE_WAIT),
      throttle: throttle(() => tickRef.current("throttle", performance.now() - startRef.current), THROTTLE_WAIT),
      raf: rafSchedule(() => tickRef.current("raf", performance.now() - startRef.current)),
    };
  }
  if (!fnsRef.current) fnsRef.current = buildFns();

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const run = () => {
    const fns = fnsRef.current!;
    fns.debounce.cancel();
    fns.throttle.cancel();
    fns.raf.cancel();
    clearTimers();
    setMarks({debounce: [], throttle: [], raf: []});
    setDuration(BURST_SIZE * BURST_INTERVAL + DEBOUNCE_WAIT + 120);
    setRunning(true);
    startRef.current = performance.now();

    for (let index = 0; index < BURST_SIZE; index++) {
      const id = window.setTimeout(() => {
        // 三个包装函数收到完全相同的事件序列
        fns.debounce();
        fns.throttle();
        fns.raf();
        if (index === BURST_SIZE - 1) {
          window.setTimeout(() => setRunning(false), DEBOUNCE_WAIT + 120);
        }
      }, index * BURST_INTERVAL);
      timersRef.current.push(id);
    }
  };

  useEffect(
    () => () => {
      const fns = fnsRef.current;
      fns?.debounce.cancel();
      fns?.throttle.cancel();
      fns?.raf.cancel();
      clearTimers();
    },
    [],
  );

  const labels: Record<Strategy, {zh: string; en: string; color: string}> = {
    debounce: {zh: `debounce(${DEBOUNCE_WAIT})`, en: `debounce(${DEBOUNCE_WAIT})`, color: colors.accent},
    throttle: {zh: `throttle(${THROTTLE_WAIT})`, en: `throttle(${THROTTLE_WAIT})`, color: "#7c3aed"},
    raf: {zh: "rafSchedule", en: "rafSchedule", color: colors.success},
  };

  const trackStyle: CSSProperties = {
    position: "relative",
    height: 26,
    borderRadius: 6,
    background: "#f3f4f6",
    overflow: "hidden",
  };

  return (
    <Demo
      title={t({zh: `示例:${BURST_SIZE} 次事件(每 ${BURST_INTERVAL}ms 一次)同时喂给三种策略`, en: `Demo: ${BURST_SIZE} events (one every ${BURST_INTERVAL}ms) fed to all three`})}
      hint={t({
        zh: "灰色区间是事件的持续期。每个彩色竖线是一次真正的执行——数量越少说明合并得越狠。",
        en: "The gray band is the event burst. Each colored tick is a real invocation — fewer ticks means more coalescing.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "事件进行中…", en: "Bursting…"}) : t({zh: "触发事件洪流", en: "Fire the burst"})}
        </Button>
        <Label>
          {t({zh: "事件间隔", en: "event interval"})} <Muted>{BURST_INTERVAL}ms</Muted>
        </Label>
      </Controls>

      <div style={{marginTop: 14, display: "grid", gap: 10}}>
        {(["debounce", "throttle", "raf"] as Strategy[]).map((key) => (
          <div key={key} style={{display: "flex", alignItems: "center", gap: 12}}>
            <span style={{width: 110, fontSize: 12.5, color: colors.body}}>{t(labels[key])}</span>
            <div style={{...trackStyle, flex: 1}}>
              {/* 事件持续期 */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${((BURST_SIZE - 1) * BURST_INTERVAL) / duration * 100}%`,
                  background: "#e5e7eb",
                }}
              />
              {marks[key].map((mark, index) => (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    left: `${Math.min(mark.at / duration, 1) * 100}%`,
                    top: 4,
                    bottom: 4,
                    width: 3,
                    borderRadius: 2,
                    background: labels[key].color,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                width: 46,
                textAlign: "right",
                fontSize: 12.5,
                fontVariantNumeric: "tabular-nums",
                color: colors.body,
              }}
            >
              ×{marks[key].length}
            </span>
          </div>
        ))}
      </div>

      <div style={{marginTop: 10}}>
        <Output>
          <div>
            {t({zh: "原始事件", en: "raw events"})}: <strong>{BURST_SIZE}</strong>
          </div>
          <Muted>
            {t({
              zh: `debounce 只保留最后一次、安静 ${DEBOUNCE_WAIT}ms 后执行；throttle 首次立即执行，之后每 ${THROTTLE_WAIT}ms 至多一次；rafSchedule 每帧至多一次，丢弃帧内多余调用。`,
              en: `debounce keeps only the last call and runs ${DEBOUNCE_WAIT}ms after quiet; throttle runs immediately then at most once per ${THROTTLE_WAIT}ms; rafSchedule runs at most once per frame, dropping the rest.`,
            })}
          </Muted>
        </Output>
      </div>
    </Demo>
  );
};

const THRASH_ROWS = 300;

/**
 * 布局抖动对照：读 offsetWidth 与写 style 交错，会迫使浏览器每轮同步重算布局；
 * 先把读收集完、再统一写，则只算一次。
 */
const LayoutBatchDemo: FC = () => {
  const {t} = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<{mode: string; time: number}[]>([]);
  const [running, setRunning] = useState(false);

  const buildRows = () => {
    const host = hostRef.current;
    if (!host) return [];
    host.innerHTML = "";
    const elements: HTMLDivElement[] = [];
    for (let index = 0; index < THRASH_ROWS; index++) {
      const el = document.createElement("div");
      el.style.width = `${40 + (index % 20)}px`;
      el.style.height = "2px";
      el.style.marginBottom = "1px";
      el.style.background = "#cbd5e1";
      host.appendChild(el);
      elements.push(el);
    }
    return elements;
  };

  const runThrash = () => {
    setRunning(true);
    window.setTimeout(() => {
      const elements = buildRows();
      const start = performance.now();
      for (const el of elements) {
        const width = el.offsetWidth; // 读:需要最新布局
        el.style.width = `${width + 1}px`; // 写:使布局失效
      }
      const time = performance.now() - start;
      setRows((prev) => [...prev, {mode: t({zh: "读写交错", en: "read/write interleaved"}), time}]);
      setRunning(false);
    }, 30);
  };

  const runBatched = () => {
    setRunning(true);
    window.setTimeout(() => {
      const elements = buildRows();
      const start = performance.now();
      runLayoutBatch(
        () => elements.map((el) => el.offsetWidth), // 先把读收集完
        (widths) => {
          elements.forEach((el, index) => {
            el.style.width = `${widths[index]! + 1}px`; // 再统一写
          });
        },
      );
      const time = performance.now() - start;
      setRows((prev) => [...prev, {mode: t({zh: "先读后写", en: "reads then writes"}), time}]);
      setRunning(false);
    }, 30);
  };

  const best = rows.length > 0 ? Math.min(...rows.map((row) => row.time)) : 0;

  return (
    <Demo
      title={t({zh: `示例:${THRASH_ROWS} 个节点的读改写`, en: `Demo: read-modify-write on ${THRASH_ROWS} nodes`})}
      hint={t({
        zh: "同样把每个节点的宽度 +1px。交错写会让浏览器每轮都同步重算布局；先读后写只算一次。",
        en: "Both add 1px to every node's width. Interleaving forces a synchronous layout per iteration; reads-then-writes forces one.",
      })}
    >
      <Controls>
        <Button onClick={runThrash} disabled={running}>
          {t({zh: "读写交错", en: "Interleaved"})}
        </Button>
        <Button onClick={runBatched} disabled={running} tone="ghost">
          {t({zh: "先读后写", en: "Reads then writes"})}
        </Button>
        <Button onClick={() => setRows([])} disabled={running || rows.length === 0} tone="ghost">
          {t({zh: "清空", en: "Clear"})}
        </Button>
      </Controls>

      <div
        ref={hostRef}
        aria-hidden="true"
        style={{
          marginTop: 12,
          maxHeight: 60,
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 6,
          background: "#fff",
        }}
      />

      {rows.length > 0 ? (
        <div style={{marginTop: 10}}>
          {rows.map((row, index) => (
            <div key={index} style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 6}}>
              <span style={{width: 140, fontSize: 12.5, color: colors.body}}>{row.mode}</span>
              <div style={{flex: 1, height: 8, background: "#eef1f5", borderRadius: 4}}>
                <div
                  style={{
                    width: `${best > 0 ? Math.min(row.time / best / 6, 1) * 100 : 0}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: row.time === best ? colors.success : "#dc2626",
                  }}
                />
              </div>
              <span style={{width: 62, textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums"}}>
                {row.time.toFixed(1)}ms
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Demo>
  );
};

const DOM_ROWS = 200;

/**
 * appendBatch：一次挂载 200 个节点（DocumentFragment）对比逐个 appendChild。
 */
const AppendBatchDemo: FC = () => {
  const {t} = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<{oneShot: number; loop: number} | null>(null);
  const [running, setRunning] = useState(false);

  const makeChildren = () =>
    Array.from({length: DOM_ROWS}, (_, index) => {
      const el = document.createElement("span");
      el.textContent = `${index} `;
      el.style.fontSize = "10px";
      return el;
    });

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      const host = hostRef.current;
      if (!host) {
        setRunning(false);
        return;
      }

      host.innerHTML = "";
      let start = performance.now();
      for (const child of makeChildren()) host.appendChild(child);
      const loop = performance.now() - start;

      host.innerHTML = "";
      start = performance.now();
      appendBatch(host, makeChildren());
      const oneShot = performance.now() - start;

      setResult({oneShot, loop});
      setRunning(false);
    }, 30);
  };

  return (
    <Demo
      title={t({zh: `示例:一次挂载 ${DOM_ROWS} 个节点`, en: `Demo: attach ${DOM_ROWS} nodes`})}
      hint={t({
        zh: "两种写法结果相同；区别在于布局与样式失效被触发的次数。",
        en: "Both produce the same DOM; they differ in how many times layout and style invalidation fire.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "挂载中…", en: "Attaching…"}) : t({zh: "运行对照", en: "Run comparison"})}
        </Button>
      </Controls>
      {result ? (
        <Stats>
          <Stat label={t({zh: "逐个 appendChild", en: "appendChild loop"})} value={`${result.loop.toFixed(2)}ms`} />
          <Stat
            label={t({zh: "appendBatch", en: "appendBatch"})}
            value={<span style={{color: colors.success}}>{result.oneShot.toFixed(2)}ms</span>}
          />
        </Stats>
      ) : null}
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{
          marginTop: 10,
          maxHeight: 44,
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 6,
          background: "#fff",
          fontSize: 10,
          lineHeight: 1.4,
        }}
      />
    </Demo>
  );
};

export const BatchingDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              批量（Batching）处理的是「触发过于频繁」的工作：把许多小任务合并为合适大小的一批，
              让渲染管线的固定成本每批只付一次，而不是每条付一次。它和拆分是互补的——拆分对付「太长」，
              批量对付「太频」。
            </>
          ),
          en: (
            <>
              Batching handles work that fires too often: many small tasks are collapsed into a
              suitably sized batch, so the rendering pipeline's fixed cost is paid once per batch
              instead of once per item. It complements splitting — splitting handles tasks that are too
              long, batching handles tasks that are too frequent.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              选哪种合并策略取决于数据的语义：<b>只需要最终结果</b>（搜索联想、窗口 resize 后的重排）用{" "}
              <InlineCode>debounce</InlineCode>；<b>需要稳定节奏</b>（滚动进度、拖拽跟随）用{" "}
              <InlineCode>throttle</InlineCode>；<b>本身就是视觉更新</b>（图表刷新、计数器滚动）用{" "}
              <InlineCode>rafSchedule</InlineCode>——屏幕每帧本来就只画一次。
            </>
          ),
          en: (
            <>
              Which strategy to use depends on the data's meaning: use <InlineCode>debounce</InlineCode>{" "}
              when <b>only the final result matters</b> (search suggestions, reflow after resize);{" "}
              <InlineCode>throttle</InlineCode> when you need a <b>steady cadence</b> (scroll progress,
              drag follow); <InlineCode>rafSchedule</InlineCode> when the work <b>is a visual update</b>{" "}
              (chart refresh, rolling counter) — the screen is drawn once per frame anyway.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 三种合并策略", en: "1. Three coalescing strategies"})}>
        <BurstDemo />
      </Section>

      <Section title={t({zh: "2. debounce:安静后跑一次", en: "2. debounce: run once after quiet"})}>
        <P>
          {t({
            zh: (
              <>
                等待窗口内的每次调用都会重置计时器，只有最后一次调用的参数存活。适合「输入停止后才需要结果」的场景：
                每敲一个字都重建 2000 行 Markdown 预览会让打字掉队，debounce 后只在停止时渲染一次。
                返回的函数带有 <InlineCode>cancel()</InlineCode> 与{" "}
                <InlineCode>flush()</InlineCode>。
              </>
            ),
            en: (
              <>
                Every call during the wait window resets the timer, and only the last call's arguments
                survive. Ideal when the result is only needed once input stops: rebuilding a 2,000-line
                markdown preview on every keystroke makes typing fall behind, while debouncing renders
                once when typing stops. The returned function carries <InlineCode>cancel()</InlineCode>{" "}
                and <InlineCode>flush()</InlineCode>.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { debounce } from "@wwog/react";

// 用户停止输入后,重建一次预览
const renderPreview = debounce(() => renderMarkdown(editor.value), 300);
editor.addEventListener("input", renderPreview);

// 需要立即拿到结果时,手动冲刷
onSubmit(() => renderPreview.flush());`}
        />
      </Section>

      <Section title={t({zh: "3. throttle:每区间最多一次", en: "3. throttle: at most once per interval"})}>
        <P>
          {t({
            zh: (
              <>
                与 debounce 等待安静不同，throttle 保证稳定节奏：首次调用立即执行（leading edge），
                区间内的后续调用只保留最后一次参数，在区间结束时补一次（trailing edge）。
                适合 scroll / resize / pointermove 这类每秒触发几十次、必须持续跟进的处理器。
              </>
            ),
            en: (
              <>
                Unlike debounce, which waits for quiet, throttle guarantees a steady cadence: the first
                call runs immediately (leading edge), later calls in the interval keep only the last
                arguments and fire once at the end (trailing edge). Built for scroll / resize /
                pointermove handlers that fire dozens of times a second and must keep up continuously.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { throttle } from "@wwog/react";

// 无论用户滚得多快,每 100ms 至多算一次阅读位置
const onScroll = throttle(() => updateReadingPosition(), 100);
window.addEventListener("scroll", onScroll, { passive: true });`}
        />
      </Section>

      <Section title={t({zh: "4. rafSchedule:每帧至多一次", en: "4. rafSchedule: at most once per frame"})}>
        <P>
          {t({
            zh: (
              <>
                视觉更新专用。屏幕每帧只画一次，因此把一帧内到达的所有更新合并为一次调用不丢数据——
                每个数据点仍被反映，只是固定渲染成本降为每帧一次。它刻意没有{" "}
                <InlineCode>flush()</InlineCode>：<InlineCode>requestAnimationFrame</InlineCode>{" "}
                无法被同步强制，同步冲刷会破坏它存在的「每帧一次」承诺。
              </>
            ),
            en: (
              <>
                For visual updates. The screen is drawn once per frame, so coalescing every update that
                arrived during a frame into one call loses nothing — every data point is still
                reflected, and the fixed render cost drops to once per frame. There is deliberately no{" "}
                <InlineCode>flush()</InlineCode>: <InlineCode>requestAnimationFrame</InlineCode> cannot
                be forced synchronously, and a synchronous flush would break the once-per-frame
                guarantee it exists to provide.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { rafSchedule } from "@wwog/react";

// 每秒 1000 次 tick,棋盘每帧只重绘一次——每个点都还在
const renderBoard = rafSchedule(() => board.draw());
socket.on("tick", (tick) => {
  board.push(tick);   // 数据一个不丢
  renderBoard();      // 本帧的绘制已经预约过了
});`}
        />
      </Section>

      <Section title={t({zh: "5. DOM 写入的批量", en: "5. Batching DOM writes"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>appendBatch(parent, children)</InlineCode> 用{" "}
                <InlineCode>DocumentFragment</InlineCode> 把多次插入合并为一次；
                <InlineCode>runLayoutBatch(read, write)</InlineCode> 把「读 → 写」组织成两个分离的阶段，
                避免读写交错导致的布局抖动（layout thrashing）。
              </>
            ),
            en: (
              <>
                <InlineCode>appendBatch(parent, children)</InlineCode> collects nodes in an inert{" "}
                <InlineCode>DocumentFragment</InlineCode> and attaches them in one operation;{" "}
                <InlineCode>runLayoutBatch(read, write)</InlineCode> organizes layout reads and writes
                into two separated phases to avoid layout thrashing.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { appendBatch, runLayoutBatch } from "@wwog/react";

// 一次挂载 100 行,而不是 100 次插入
appendBatch(tbody, rows.map((row) => renderRow(row)));

// ✅ 所有读先结束,再统一写 —— 布局只算一次
runLayoutBatch(
  () => elements.map((el) => el.offsetWidth),
  (widths) => elements.forEach((el, i) => (el.style.width = widths[i] + 10 + "px")),
);

// ❌ 读写交错 —— 每次迭代都强制重算布局
for (const el of elements) {
  const width = el.offsetWidth;
  el.style.width = width + 10 + "px";
}`}
          caption={t({
            zh: "appendBatch 接受 Node 或字符串（字符串按文本插入），返回 parent 便于链式调用。",
            en: "appendBatch accepts Nodes or strings (strings are inserted as text) and returns the parent for chaining.",
          })}
        />
        <LayoutBatchDemo />
        <AppendBatchDemo />
      </Section>

      <Section title={t({zh: "6. API 参考", en: "6. API reference"})}>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "签名", en: "signature"}), t({zh: "返回", en: "returns"})]}
          rows={[
            [
              <InlineCode>debounce</InlineCode>,
              <InlineCode>(fn, wait = 200)</InlineCode>,
              t({zh: "带 cancel / flush 的函数。", en: "Function with cancel / flush."}),
            ],
            [
              <InlineCode>throttle</InlineCode>,
              <InlineCode>(fn, wait = 200)</InlineCode>,
              t({zh: "带 cancel 的函数。", en: "Function with cancel."}),
            ],
            [
              <InlineCode>rafSchedule</InlineCode>,
              <InlineCode>(fn)</InlineCode>,
              t({zh: "带 cancel 的函数；每帧至多一次。", en: "Function with cancel; at most once per frame."}),
            ],
            [
              <InlineCode>appendBatch</InlineCode>,
              <InlineCode>(parent, children)</InlineCode>,
              t({zh: "parent 本身。", en: "The parent element."}),
            ],
            [
              <InlineCode>runLayoutBatch</InlineCode>,
              <InlineCode>(read, write)</InlineCode>,
              t({zh: "write 的返回值。", en: "Whatever write returns."}),
            ],
          ]}
        />
        <P>
          <InlineCode>wait</InlineCode>
          <Muted> {t({zh: "的默认值", en: "defaults to"})} </Muted>
          <InlineCode>{t({zh: "均为 200ms", en: "200ms for both"})}</InlineCode>
          <Muted>
            {" "}
            {t({
              zh: "；cancel 会丢弃未执行的调用，flush 会立即执行等待中的调用（rafSchedule 无 flush）。",
              en: "; cancel discards a pending call, flush runs it immediately (rafSchedule has no flush).",
            })}
          </Muted>
        </P>
      </Section>
    </div>
  );
};
