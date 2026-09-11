import {useRef, useState, type CSSProperties, type FC} from "react";
import {Queue, createPriorityQueue, type PriorityQueue} from "../../../../src";
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
  colors,
} from "../ui";

/**
 * 队列语义演示：一个可交互的 Queue 快照。push 到队尾、pushFront 插队首、
 * pop 从队首取出——注意 pushFront 之间是后进先出。
 */
const SemanticsDemo: FC = () => {
  const {t} = useI18n();
  const queueRef = useRef(new Queue<string>());
  const [snapshot, setSnapshot] = useState<string[]>([]);
  const [lastPopped, setLastPopped] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const counterRef = useRef(0);

  const sync = () => setSnapshot(queueRef.current.toArray());

  const push = () => {
    const label = `t${counterRef.current++}`;
    queueRef.current.push(label);
    sync();
  };
  const pushFront = () => {
    const label = `!${counterRef.current++}`;
    queueRef.current.pushFront(label);
    sync();
  };
  const pop = () => {
    const value = queueRef.current.pop();
    setLastPopped(value ?? null);
    sync();
  };
  const removeSecond = () => {
    // 演示 remove(predicate)：按条件挑出并移除，扫描是 O(n)，只用于偶发提升。
    const target = queueRef.current.toArray()[1];
    if (target === undefined) {
      setRemoved(null);
      return;
    }
    setRemoved(queueRef.current.remove((item) => item === target) ?? null);
    sync();
  };
  const clear = () => {
    queueRef.current.clear();
    setLastPopped(null);
    setRemoved(null);
    sync();
  };

  const chip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
    padding: "5px 10px",
    borderRadius: 8,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12.5,
    border: `1px solid ${colors.border}`,
    background: "#fff",
    color: colors.text,
  };

  return (
    <Demo
      title={t({zh: "示例:推入、插队与取出", en: "Demo: push, cut the line, pop" })}
      hint={t({
        zh: "左端是队首。常规 push 加到右侧；pushFront 加到左端且后进先出；pop 永远从左端取。",
        en: "The left end is the front. push appends to the right; pushFront inserts on the left, LIFO among themselves; pop always takes from the left.",
      })}
    >
      <Controls>
        <Button onClick={push}>
          {t({zh: "push 普通", en: "push normal"})}
        </Button>
        <Button onClick={pushFront} tone="ghost">
          {t({zh: "pushFront 紧急", en: "pushFront urgent"})}
        </Button>
        <Button onClick={pop} tone="ghost">
          {t({zh: "pop", en: "pop"})}
        </Button>
        <Button onClick={removeSecond} tone="ghost">
          {t({zh: "remove 第二个", en: "remove 2nd"})}
        </Button>
        <Button onClick={clear} tone="ghost">
          {t({zh: "clear", en: "clear"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, marginBottom: 10}}>
        <Label>
          {t({zh: "当前队列", en: "queue"})}{" "}
          <Muted>
            {t({zh: "(length = ", en: "(length = "})}
            {snapshot.length}
            {")"}
          </Muted>
        </Label>
        <div style={{display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, minHeight: 30}}>
          {snapshot.length === 0 ? (
            <Muted>{t({zh: "空", en: "empty"})}</Muted>
          ) : (
            snapshot.map((item, index) => (
              <span
                key={`${item}-${index}`}
                style={{
                  ...chip,
                  background: item.startsWith("!") ? colors.warnSoft : "#fff",
                  borderColor: item.startsWith("!") ? colors.warnBorder : colors.border,
                  color: item.startsWith("!") ? colors.warn : colors.text,
                }}
              >
                {item}
              </span>
            ))
          )}
        </div>
      </div>

      <Output>
        <div>
          {t({zh: "最近 pop", en: "last pop"})}: <strong>{lastPopped ?? "—"}</strong>
        </div>
        <div>
          {t({zh: "最近 remove", en: "last remove"})}: <strong>{removed ?? "—"}</strong>
        </div>
      </Output>
    </Demo>
  );
};

interface BenchRow {
  size: number;
  naive: number;
  queue: number;
}

const SIZES = [10_000, 50_000, 200_000];

/**
 * 复杂度对照：数组 shift 每取一个元素都要前移剩余元素，排干 n 个是 O(n²)；
 * Queue 用游标 + 摊还回收做到 O(1)。数字随机器波动，但量级差异是稳定的。
 */
const BenchmarkDemo: FC = () => {
  const {t} = useI18n();
  const [rows, setRows] = useState<BenchRow[]>([]);
  const [running, setRunning] = useState(false);

  const run = (size: number) => {
    setRunning(true);
    // 让按钮的禁用状态先渲染出来，再做这段同步的耗时测量。
    window.setTimeout(() => {
      const naiveItems = Array.from({length: size}, (_, index) => index);
      let sink = 0;
      const naiveStart = performance.now();
      while (naiveItems.length > 0) sink += naiveItems.shift()!;
      const naive = performance.now() - naiveStart;

      const queue = new Queue<number>();
      for (let index = 0; index < size; index++) queue.push(index);
      const queueStart = performance.now();
      while (queue.length > 0) sink += queue.pop()!;
      const fast = performance.now() - queueStart;

      // sink 参与输出，避免引擎把纯读取的循环整个优化掉。
      if (sink < 0) console.log(sink);
      setRows((prev) => [...prev, {size, naive, queue: fast}]);
      setRunning(false);
    }, 30);
  };

  return (
    <Demo
      title={t({zh: "示例:排干 n 个元素的耗时", en: "Demo: draining n items"})}
      hint={t({
        zh: "同一份数据、同一个循环，只把 Array.shift 换成 Queue.pop。200k 时朴素数组会有数秒的主线程停顿——这正是这个队列要消除的形态。",
        en: "Same data, same loop — only Array.shift is swapped for Queue.pop. At 200k the plain array stalls the main thread for seconds, which is exactly the shape this queue removes.",
      })}
    >
      <Controls>
        {SIZES.map((size) => (
          <Button key={size} onClick={() => run(size)} disabled={running} tone="ghost">
            {t({zh: `排干 ${size / 1000}k`, en: `drain ${size / 1000}k`})}
          </Button>
        ))}
        <Button onClick={() => setRows([])} disabled={running || rows.length === 0} tone="ghost">
          {t({zh: "清空", en: "clear"})}
        </Button>
      </Controls>

      {rows.length > 0 ? (
        <div style={{marginTop: 12}}>
          <ApiTable
            head={[
              t({zh: "元素数", en: "items"}),
              t({zh: "Array.shift", en: "Array.shift"}),
              t({zh: "Queue.pop", en: "Queue.pop"}),
              t({zh: "倍数", en: "ratio"}),
            ]}
            rows={rows.map((row) => [
              row.size.toLocaleString(),
              `${row.naive.toFixed(1)}ms`,
              `${row.queue.toFixed(1)}ms`,
              row.queue > 0 ? `${(row.naive / row.queue).toFixed(0)}×` : "—",
            ])}
          />
          <Muted>
            {t({
              zh: "Queue 的耗时增长大致线性；Array.shift 则随元素数平方增长，两者差距会随 batch 变大而拉大。",
              en: "Queue grows roughly linearly; Array.shift grows quadratically, so the gap widens as the batch grows.",
            })}
          </Muted>
        </div>
      ) : null}
    </Demo>
  );
};

// ---- 优先级队列 ----

type PhotoState = "waiting" | "generating" | "done";

const PHOTO_COUNT = 8;
const PHOTO_MS = 260;

const PriorityDemo: FC = () => {
  const {t} = useI18n();
  const [states, setStates] = useState<PhotoState[]>(() => Array(PHOTO_COUNT).fill("waiting"));
  const [order, setOrder] = useState<number[]>([]);
  const [size, setSize] = useState(0);
  const [running, setRunning] = useState(false);
  const [promoted, setPromoted] = useState<number | null>(null);
  const [rejected, setRejected] = useState<number | null>(null);
  const queueRef = useRef<PriorityQueue<number> | null>(null);
  const completedRef = useRef(0);

  const setOne = (index: number, value: PhotoState) =>
    setStates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  const run = () => {
    const queue = createPriorityQueue<number>({onError: (error) => console.error(error)});
    queueRef.current = queue;
    completedRef.current = 0;
    setStates(Array(PHOTO_COUNT).fill("waiting"));
    setOrder([]);
    setPromoted(null);
    setRejected(null);
    setRunning(true);
    setSize(queue.size);

    const timer = window.setInterval(() => setSize(queue.size), 50);

    for (let index = 0; index < PHOTO_COUNT; index++) {
      queue.post({
        tag: index,
        run: () => {
          setOne(index, "generating");
          return new Promise<void>((resolve) => {
            window.setTimeout(() => {
              setOne(index, "done");
              setOrder((prev) => [...prev, index]);
              completedRef.current += 1;
              if (completedRef.current === PHOTO_COUNT) {
                window.clearInterval(timer);
                setSize(0);
                setRunning(false);
              }
              resolve();
            }, PHOTO_MS);
          });
        },
      });
    }
  };

  const promote = (index: number) => {
    if (!running || states[index] !== "waiting") return;
    const moved = queueRef.current?.promote(index) ?? false;
    setPromoted(moved ? index : null);
    setRejected(moved ? null : index);
  };

  const stop = () => {
    queueRef.current?.clear();
    queueRef.current = null;
    setSize(0);
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:十张预览图,点谁先出谁", en: "Demo: previews generate in order — click to jump the line"})}
      hint={t({
        zh: "任务按 0→7 顺序入队，每个 260ms。点一张还在排队（waiting）的图，它的任务会被 promote 到队首；已经 generating 的无法再提升。",
        en: "Jobs are queued 0→7, 260ms each. Click one that is still waiting and its job is promoted to the front; one already generating cannot be moved.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "生成中…", en: "Generating…"}) : t({zh: "重新入队 8 张", en: "Queue 8 previews"})}
        </Button>
        <Button onClick={stop} disabled={!running} tone="ghost">
          {t({zh: "clear 队列", en: "clear queue"})}
        </Button>
        <Label>
          {t({zh: "queue.size", en: "queue.size"})} <Muted>{size}</Muted>
        </Label>
      </Controls>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
          gap: 8,
          marginTop: 14,
        }}
      >
        {states.map((state, index) => {
          const palette: Record<PhotoState, {bg: string; border: string; text: string}> = {
            waiting: {bg: "#fff", border: colors.border, text: colors.muted},
            generating: {bg: colors.accentSoft, border: colors.accentBorder, text: colors.accent},
            done: {bg: colors.successSoft, border: "#a7f3d0", text: colors.success},
          };
          const tone = palette[state];
          return (
            <button
              key={index}
              type="button"
              onClick={() => promote(index)}
              disabled={!running || state !== "waiting"}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 10,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                color: tone.text,
                fontFamily: "inherit",
                fontSize: 12,
                cursor: running && state === "waiting" ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <strong style={{fontSize: 15}}>#{index}</strong>
              <span>{state}</span>
              {promoted === index ? <span>⬆︎</span> : null}
            </button>
          );
        })}
      </div>

      <div style={{marginTop: 12}}>
        <Output>
          <div>
            {t({zh: "完成顺序", en: "finish order"})}:{" "}
            <strong>{order.length > 0 ? order.map((i) => `#${i}`).join(" → ") : "—"}</strong>
          </div>
          {rejected !== null ? (
            <Muted>
              {t({
                zh: `promote(#${rejected}) 返回 false：该任务已开始执行或不在队列中。`,
                en: `promote(#${rejected}) returned false: the job already started or is no longer queued.`,
              })}
            </Muted>
          ) : null}
        </Output>
      </div>
    </Demo>
  );
};

export const QueueDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>Queue</InlineCode> 与 <InlineCode>createPriorityQueue</InlineCode>{" "}
              解决的是主线程上「任务多到需要排队」时的两个问题：排干一条长队伍本身不能退化成平方级开销，
              以及排队顺序本身要能被干预——在无法中断的主线程上，顺序就是用户感受到的响应性。
            </>
          ),
          en: (
            <>
              <InlineCode>Queue</InlineCode> and <InlineCode>createPriorityQueue</InlineCode> cover two
              problems once there is enough work to line up on the main thread: draining a long line must
              not degrade into quadratic cost, and the order itself must be steerable — on a main thread
              that cannot be interrupted, order is the responsiveness the user feels.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              这两者常被误用：<InlineCode>Queue</InlineCode> 是数据结构，不调度任何东西；
              <InlineCode>createPriorityQueue</InlineCode> 才是调度器——它通过{" "}
              <InlineCode>MessageChannel</InlineCode> 每个宏任务只跑一个 job，从而在每个 job
              之间给输入与渲染留出空隙。
            </>
          ),
          en: (
            <>
              These two are easy to confuse: <InlineCode>Queue</InlineCode> is a data structure and
              schedules nothing; <InlineCode>createPriorityQueue</InlineCode> is the scheduler — it
              drains one job per macrotask via <InlineCode>MessageChannel</InlineCode>, leaving gaps
              for input and rendering between jobs.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. Queue 语义", en: "1. Queue semantics"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>push</InlineCode> 追加到队尾，<InlineCode>pushFront</InlineCode> 插到队首，
                <InlineCode>pop</InlineCode> 从队首取出。队首区是一个后进先出的栈，因此连续{" "}
                <InlineCode>pushFront</InlineCode> 的项会以相反顺序被取出；<InlineCode>remove</InlineCode>{" "}
                按条件扫描并移除（O(n)，只用于偶发的「提升某个任务」）。
              </>
            ),
            en: (
              <>
                <InlineCode>push</InlineCode> appends at the back, <InlineCode>pushFront</InlineCode>{" "}
                inserts at the front, <InlineCode>pop</InlineCode> removes from the front. The front
                region is a LIFO stack, so consecutive <InlineCode>pushFront</InlineCode> calls pop
                back out in reverse order; <InlineCode>remove</InlineCode> scans by predicate (O(n),
                for occasional promotion only).
              </>
            ),
          })}
        </P>
        <Code
          code={`import { Queue } from "@wwog/react";

const queue = new Queue<string>();
queue.push("a");
queue.push("b");
queue.pushFront("urgent");
queue.pop(); // "urgent"
queue.pop(); // "a"
queue.toArray(); // ["b"]  最前面的在前`}
        />
        <SemanticsDemo />
      </Section>

      <Section title={t({zh: "2. 为什么不是数组", en: "2. Why not an array"})}>
        <P>
          {t({
            zh: (
              <>
                数组 + <InlineCode>push</InlineCode>/<InlineCode>shift</InlineCode> 的直觉写法里，
                只有 <InlineCode>push</InlineCode> 是 O(1)：<InlineCode>shift</InlineCode> 会把剩余元素
                整体前移一格，排干 n 个即 O(n²)。Queue 用游标标记活跃区起点，身后留下死前缀，
                等前缀值得回收时一次性搬移——每 O(n) 次 pop 才发生一次，摊还到每个元素是 O(1)。
              </>
            ),
            en: (
              <>
                In the intuitive array + <InlineCode>push</InlineCode>/<InlineCode>shift</InlineCode>{" "}
                setup only <InlineCode>push</InlineCode> is O(1): <InlineCode>shift</InlineCode> moves
                every remaining element down one slot, making a full drain O(n²). Queue keeps a cursor
                at the start of the live range, leaves a dead prefix behind, and copies the live tail
                down once it is worth reclaiming — once per O(n) pops, so O(1) amortized per item.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 🌱 直觉写法:demo 上没事,真实批量上平方爆炸
const items = [...bigBatch];
while (items.length > 0) process(items.shift()!);

// 🌱 Queue:同样的循环,摊还 O(1)
const queue = new Queue<Job>();
for (const job of bigBatch) queue.push(job);
while (queue.length > 0) process(queue.pop()!);`}
          caption={t({
            zh: "pop 时会被取出的引用被立即清空，长队列上被弹出的任务不会一直可达直到回收。",
            en: "A popped slot is cleared immediately, so on a deep queue the popped job does not stay reachable until compaction.",
          })}
        />
        <BenchmarkDemo />
      </Section>

      <Section title={t({zh: "3. 优先级:紧急插队与事后提升", en: "3. Priority: cut the line, or be promoted later"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>post(job, urgent)</InlineCode> 让紧急任务直接插到队首；
                <InlineCode>promote(tag)</InlineCode> 则把已经排队的任务提到队首——即
                「idle-until-urgent」：空闲时按序提前干活，用户点开哪个就立刻优先哪个。
                每个 job 独占一个宏任务，所以 job 之间输入与渲染永远有机会插入。
              </>
            ),
            en: (
              <>
                <InlineCode>post(job, urgent)</InlineCode> puts urgent work at the front;{" "}
                <InlineCode>promote(tag)</InlineCode> moves already-queued work to the front — the
                "idle-until-urgent" pattern: get ahead on work while idle, then rush whatever the user
                asks for. Each job owns one macrotask, so input and rendering can always slip in
                between jobs.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { createPriorityQueue } from "@wwog/react";

const queue = createPriorityQueue<number>();

files.forEach((file, i) => {
  queue.post({
    tag: i,
    run: () => createPreview(file, i), // 可以返回 Promise
  });
});

// 用户点了一张还没就绪的图 → 把它提到队首
onClickPhoto((i) => queue.promote(i)); // true 表示找到并提升了`}
          caption={t({
            zh: "任务抛错或 reject 不会阻塞后面的任务；错误交给 onError，缺省时打到 console.error。",
            en: "A throwing or rejecting job never blocks the ones behind it; errors go to onError, or console.error by default.",
          })}
        />
        <PriorityDemo />
      </Section>

      <Section title={t({zh: "4. API 参考", en: "4. API reference"})}>
        <P>
          <InlineCode>new Queue&lt;T&gt;()</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>push(item)</InlineCode>, t({zh: "追加到队尾。", en: "Append at the back."})],
            [
              <InlineCode>pushFront(item)</InlineCode>,
              t({zh: "插到队首；连续调用之间后进先出。", en: "Insert at the front; LIFO among consecutive calls."}),
            ],
            [
              <InlineCode>pop()</InlineCode>,
              t({zh: "取出队首元素，空队列返回 undefined。", en: "Remove the frontmost item, or undefined when empty."}),
            ],
            [
              <InlineCode>remove(predicate)</InlineCode>,
              t({zh: "移除最前面的匹配项并返回；O(n)。", en: "Remove the frontmost match and return it; O(n)."}),
            ],
            [<InlineCode>clear()</InlineCode>, t({zh: "清空。", en: "Remove everything."})],
            [<InlineCode>toArray()</InlineCode>, t({zh: "最前面在前的快照；O(n)。", en: "Snapshot, frontmost first; O(n)."})],
            [<InlineCode>length</InlineCode>, t({zh: "等待中的元素数。", en: "Number of waiting items."})],
          ]}
        />
        <P>
          <InlineCode>createPriorityQueue(options?)</InlineCode> → <InlineCode>PriorityQueue&lt;TTag&gt;</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>post(job, urgent?)</InlineCode>,
              t({zh: "入队一个 job；urgent 为 true 时插到队首。", en: "Queue a job; urgent places it at the front."}),
            ],
            [
              <InlineCode>promote(tag)</InlineCode>,
              t({zh: "按 tag 把已排队任务提到队首，返回是否找到。", en: "Move a queued job matched by tag to the front; returns whether it was found."}),
            ],
            [<InlineCode>clear()</InlineCode>, t({zh: "清空排队任务（正在执行的除外）。", en: "Drop queued jobs (the one executing is unaffected)."})],
            [<InlineCode>size</InlineCode>, t({zh: "等待中的任务数（不含执行中的）。", en: "Waiting job count (excludes the executing one)."})],
          ]}
        />
        <P>
          <InlineCode>job</InlineCode> / <InlineCode>options</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "字段", en: "field"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>job.run</InlineCode>,
              <InlineCode>() =&gt; void | Promise&lt;void&gt;</InlineCode>,
              t({zh: "要执行的工作；同步任务不分配 Promise。", en: "The work; synchronous jobs allocate no Promise."}),
            ],
            [
              <InlineCode>job.tag</InlineCode>,
              <InlineCode>TTag</InlineCode>,
              t({zh: "供 promote 定位的标签。", en: "Tag used by promote to locate the job."}),
            ],
            [
              <InlineCode>options.onError</InlineCode>,
              <InlineCode>(error, job) =&gt; void</InlineCode>,
              t({zh: "任务失败时的回调；缺省打到 console.error。", en: "Called on job failure; defaults to console.error."}),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "5. 注意", en: "5. Cautions"})}>
        <ApiTable
          head={[t({zh: "注意", en: "caution"}), t({zh: "说明", en: "why it matters"})]}
          rows={[
            [
              t({zh: "promote 只对未开始的任务有效", en: "promote only affects not-yet-started jobs"}),
              t({
                zh: "已经在执行的 job 无法被搬移，promote 返回 false。",
                en: "A job already running cannot be moved; promote returns false.",
              }),
            ],
            [
              t({zh: "总工作量不变", en: "Total work is unchanged"}),
              t({
                zh: "优先级只改变顺序，不减少计算；要减少计算用 memoize 或背压。",
                en: "Priority changes order, not the amount of computation; use memoize or backpressure to do less.",
              }),
            ],
            [
              t({zh: "MessageChannel 不能跨 realm 复用", en: "MessageChannel is not realm-portable"}),
              t({
                zh: "队列句柄绑定创建它的线程；每个队列实例各自持有一个 channel。",
                en: "The handle is bound to the thread that created it; each instance owns its own channel.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
