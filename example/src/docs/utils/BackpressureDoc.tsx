import {useEffect, useRef, useState, type FC} from "react";
import {createDroppingQueue, createLatestValue, type DroppingQueue} from "../../../../src";
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

const PRODUCER_MS = 15;
const CONSUMER_MS = 700;
const CAPACITIES = [5, 15, 40];

const DroppingDemo: FC = () => {
  const {t} = useI18n();
  const [capacity, setCapacity] = useState(15);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState({size: 0, pushed: 0, consumed: 0, log: [] as number[]});
  const queueRef = useRef<DroppingQueue<number>>(createDroppingQueue<number>(capacity));
  const counterRef = useRef(0);
  const pushedRef = useRef(0);
  const consumedRef = useRef(0);
  const logRef = useRef<number[]>([]);
  const producerRef = useRef<number | null>(null);
  const consumerRef = useRef<number | null>(null);

  useEffect(() => {
    queueRef.current = createDroppingQueue<number>(capacity);
    counterRef.current = 0;
    pushedRef.current = 0;
    consumedRef.current = 0;
    logRef.current = [];
    setView({size: 0, pushed: 0, consumed: 0, log: []});
  }, [capacity]);

  const stop = () => {
    if (producerRef.current !== null) window.clearInterval(producerRef.current);
    if (consumerRef.current !== null) window.clearInterval(consumerRef.current);
    producerRef.current = null;
    consumerRef.current = null;
    setRunning(false);
  };

  const start = () => {
    stop();
    const queue = queueRef.current;
    setRunning(true);
    producerRef.current = window.setInterval(() => {
      // 生产者远快于消费者:一旦满,最旧的条目被静默丢弃
      queue.push(counterRef.current++);
      pushedRef.current += 1;
    }, PRODUCER_MS);
    consumerRef.current = window.setInterval(() => {
      const items = queue.drainAll();
      consumedRef.current += items.length;
      logRef.current = [...items.slice(-6), ...logRef.current].slice(0, 8);
      setView({
        size: queue.size,
        pushed: pushedRef.current,
        consumed: consumedRef.current,
        log: [...logRef.current],
      });
    }, CONSUMER_MS);
  };

  useEffect(() => stop, []);

  const reset = () => {
    stop();
    queueRef.current = createDroppingQueue<number>(capacity);
    counterRef.current = 0;
    pushedRef.current = 0;
    consumedRef.current = 0;
    logRef.current = [];
    setView({size: 0, pushed: 0, consumed: 0, log: []});
  };

  const dropped = view.pushed - view.consumed - view.size;
  const keepRate = view.pushed > 0 ? view.consumed / view.pushed : 1;

  return (
    <Demo
      title={t({zh: "示例:生产者 66 次/秒,消费者每 700ms 一次", en: "Demo: producing 66/sec, consuming every 700ms"})}
      hint={t({
        zh: "消费者每 700ms 才 drainAll 一次，其间会积压约 46 条。队列容量封顶，超出的最旧条目被丢弃——所以 size 永远不会超过 capacity，而「已丢弃」会持续增长。",
        en: "The consumer drains only every 700ms, during which ~46 items pile up. The queue is capped, so the oldest overflow is dropped — size never exceeds capacity while dropped keeps growing.",
      })}
    >
      <Controls>
        <Label>capacity</Label>
        <select
          value={capacity}
          onChange={(event) => setCapacity(Number(event.target.value))}
          style={controlStyle}
          disabled={running}
        >
          {CAPACITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button onClick={running ? stop : start}>{running ? t({zh: "停止", en: "Stop"}) : t({zh: "开始", en: "Start"})}</Button>
        <Button onClick={reset} tone="ghost">
          {t({zh: "重置", en: "Reset"})}
        </Button>
      </Controls>

      <Stats>
        <Stat label={t({zh: "已生产", en: "produced"})} value={view.pushed} />
        <Stat label={t({zh: "队列中", en: "in queue"})} value={view.size} />
        <Stat label={t({zh: "已消费", en: "consumed"})} value={view.consumed} />
        <Stat
          label={t({zh: "已丢弃", en: "dropped"})}
          value={<span style={{color: dropped > 0 ? "#dc2626" : colors.success}}>{Math.max(dropped, 0)}</span>}
        />
      </Stats>

      <div style={{marginTop: 6}}>
        <div style={{height: 8, borderRadius: 4, background: "#eef1f5", overflow: "hidden"}}>
          <div
            style={{
              width: `${Math.min(keepRate, 1) * 100}%`,
              height: "100%",
              background: keepRate > 0.9 ? colors.success : colors.warn,
              transition: "width 200ms linear",
            }}
          />
        </div>
        <Muted>
          {t({zh: "保留率 ", en: "kept " })}
          {(keepRate * 100).toFixed(0)}%
        </Muted>
      </div>

      <Output>
        <div>
          {t({zh: "最近的批次", en: "recent batches"})}:{" "}
          {view.log.length > 0 ? view.log.join(", ") : <Muted>{t({zh: "尚无", en: "none yet"})}</Muted>}
        </div>
      </Output>
    </Demo>
  );
};

const MERGE_PRODUCER_MS = 4;

const LatestValueDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [view, setView] = useState({sets: 0, applies: 0, last: 0, pending: false});
  const cellRef = useRef(createLatestValue<number>());
  const cell = cellRef.current;
  const setsRef = useRef(0);
  const appliesRef = useRef(0);
  const producerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (producerRef.current !== null) window.clearInterval(producerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    producerRef.current = null;
    rafRef.current = null;
    setRunning(false);
  };

  const start = () => {
    stop();
    setsRef.current = 0;
    appliesRef.current = 0;
    setView({sets: 0, applies: 0, last: 0, pending: false});
    setRunning(true);

    producerRef.current = window.setInterval(() => {
      // 只有最新值有意义:中间值全部被覆盖,消费端永远看不到
      cell.set(setsRef.current++);
    }, MERGE_PRODUCER_MS);

    const tick = () => {
      const latest = cell.take();
      if (latest !== undefined) {
        appliesRef.current += 1;
        setView({
          sets: setsRef.current,
          applies: appliesRef.current,
          last: latest,
          pending: cell.pending,
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  const merged = view.applies > 0 ? view.sets / view.applies : 0;

  return (
    <Demo
      title={t({zh: "示例:每秒约 250 次更新,每帧只应用一次", en: "Demo: ~250 updates/sec, applied once per frame"})}
      hint={t({
        zh: "生产者每 4ms set 一次；消费者每帧 take 一次。无论流入多快，工作量都钉死在「每帧一次」——中间值被合并掉，合并比明显大于 1。",
        en: "The producer sets every 4ms; the consumer takes once per frame. However fast the inflow, the work is pinned to once per frame — intermediate values are merged away and the ratio climbs above 1.",
      })}
    >
      <Controls>
        <Button onClick={running ? stop : start}>{running ? t({zh: "停止", en: "Stop"}) : t({zh: "开始", en: "Start"})}</Button>
      </Controls>

      <Stats>
        <Stat label={t({zh: "set 次数", en: "sets"})} value={view.sets} />
        <Stat label={t({zh: "应用次数", en: "applies"})} value={view.applies} />
        <Stat label={t({zh: "合并比", en: "merged"})} value={`${merged.toFixed(1)}×`} />
        <Stat label={t({zh: "最新值", en: "latest"})} value={view.last} />
      </Stats>

      <Output>
        <div>
          {t({zh: "有值等待", en: "pending"})}: <strong>{view.pending ? "true" : "false"}</strong>
        </div>
        <Muted>
          {t({
            zh: "peek() 看不消费；pending 为 true 表示自上次 take 以来有新值。",
            en: "peek() reads without consuming; pending is true when a new value arrived since the last take.",
          })}
        </Muted>
      </Output>
    </Demo>
  );
};

export const BackpressureDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              批量做得再好，一旦流入速度超过最大吞吐，积压就会无限增长——这就是背压。浏览器没有好办法让服务端放慢，
              所以到了某个程度就得放弃「给多少做多少」。这里提供两种消除流入工作的策略：<b>丢弃</b>与<b>合并</b>。
            </>
          ),
          en: (
            <>
              However good your batching, once inflow exceeds maximum throughput the backlog grows
              without limit — that is backpressure. The browser has no good way to tell the server to
              slow down, so at some point you have to give up on doing everything you are given. Two
              strategies for eliminating incoming work are provided: <b>dropping</b> and{" "}
              <b>merging</b>.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              两者都<b>有损</b>，只是损失的是用户不会注意到的东西：日志尾部丢的是「最旧的历史」，
              行情合并的是「无意义的中间值」。若数据一个都不能少，就不该用它们——而应该让消费端变快或加背压信号。
            </>
          ),
          en: (
            <>
              Both are <b>lossy</b>, but what is lost is what the user would not notice: a log tail drops
              the oldest history, a ticker merges meaningless intermediate values. If no data point may be
              lost, these are the wrong tools — speed up the consumer or propagate a backpressure signal
              instead.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 丢弃:createDroppingQueue", en: "1. Dropping: createDroppingQueue"})}>
        <P>
          {t({
            zh: (
              <>
                有界 FIFO 队列：满时静默丢弃<b>最旧</b>的条目，为最新数据腾位置。适合只是流过的数据——
                直播日志、聊天、监控尾部。跟上「现在」比展示「全部」更重要。
                <InlineCode>drainAll()</InlineCode> 直接移交内部数组（非副本），因此排干是 O(1)。
              </>
            ),
            en: (
              <>
                A bounded FIFO queue: when full it silently drops the <b>oldest</b> item to make room.
                For data that just flows past — live logs, chat, monitoring tails — keeping up with the
                present matters more than showing everything. <InlineCode>drainAll()</InlineCode> hands
                the internal array over (not a copy), so draining is O(1).
              </>
            ),
          })}
        </P>
        <Code
          code={`import { createDroppingQueue } from "@wwog/react";

// 直播日志尾部:最多保留最新 200 行,压力下静默丢弃最旧的
const logs = createDroppingQueue<string>(200);
socket.on("log", (line) => logs.push(line));

setInterval(() => {
  for (const line of logs.drainAll()) appendLogLine(line); // 永远不会积压
}, 500);`}
          caption={t({
            zh: "push 返回本次条目是否被保留；capacity <= 0 时直接丢弃、返回 false。",
            en: "push returns whether this item was kept; with capacity <= 0 it drops and returns false.",
          })}
        />
        <DroppingDemo />
      </Section>

      <Section title={t({zh: "2. 合并:createLatestValue", en: "2. Merging: createLatestValue"})}>
        <P>
          {t({
            zh: (
              <>
                单槽格子「最新值胜出」：每次 <InlineCode>set</InlineCode> 覆盖上一个值，消费端{" "}
                <InlineCode>take()</InlineCode> 取走当前最新值。适合只有最新值有意义的数据——排行榜、
                行情、表单草稿。无论流入多快，工作量都钉死在每个消费周期一次。
              </>
            ),
            en: (
              <>
                A single-slot "latest value wins" cell: each <InlineCode>set</InlineCode> overwrites the
                previous value and <InlineCode>take()</InlineCode> consumes the current latest. For data
                where only the newest value means anything — rankings, tickers, form drafts. However
                fast the inflow, the work is pinned to one application per consume cycle.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { createLatestValue } from "@wwog/react";

// 排行榜每帧至多重绘一次,无论它变了多少次
const board = createLatestValue<Ranking>();
socket.on("ranking", (r) => board.set(r)); // 每秒 50 次更新全部合并

const tick = () => {
  const latest = board.take();
  if (latest) renderBoard(latest); // 只渲染最终值
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);`}
        />
        <LatestValueDemo />
      </Section>

      <Section title={t({zh: "3. API 参考", en: "3. API reference"})}>
        <P>
          <InlineCode>createDroppingQueue&lt;T&gt;(capacity = 100)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>push(item)</InlineCode>,
              t({zh: "入队；满时丢弃最旧。返回本次是否被保留。", en: "Enqueue; drops the oldest when full. Returns whether this item was kept."}),
            ],
            [<InlineCode>shift()</InlineCode>, t({zh: "取出最旧的条目。", en: "Take the oldest item."})],
            [<InlineCode>items()</InlineCode>, t({zh: "当前所有条目（副本），最旧在前。", en: "All held items as a copy, oldest first."})],
            [<InlineCode>drainAll()</InlineCode>, t({zh: "一次性取走全部并清空；O(1) 移交。", en: "Take all and empty; O(1) handover."})],
            [<InlineCode>size</InlineCode>, t({zh: "持有的条目数。", en: "Number of held items."})],
          ]}
        />
        <P>
          <InlineCode>createLatestValue&lt;T&gt;()</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>set(value)</InlineCode>, t({zh: "存入并覆盖上一个值。", en: "Deposit a value, overwriting the previous one."})],
            [<InlineCode>take()</InlineCode>, t({zh: "取走最新值；无新值时返回 undefined。", en: "Take the latest; undefined when nothing new arrived."})],
            [<InlineCode>peek()</InlineCode>, t({zh: "不消费地读取最新值。", en: "Read the latest without consuming it."})],
            [<InlineCode>pending</InlineCode>, t({zh: "是否有新值等待被取走。", en: "Whether a new value is waiting."})],
          ]}
        />
        <P>
          <Muted>
            {t({
              zh: "第三种消除工作的方式——跳过重复计算——见 memoize 页。",
              en: "The third way to eliminate work — skipping repeated computation — is on the memoize page.",
            })}
          </Muted>
        </P>
      </Section>
    </div>
  );
};
