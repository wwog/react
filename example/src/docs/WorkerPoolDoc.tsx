import {useState, type FC} from "react";
import {WorkerError, WorkerPool} from "../../../src";
import {useI18n} from "../i18n";
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
} from "./ui";

/**
 * 自包含的耗时函数。worker 内源码由 toString() 序列化，因此不能引用任何外部变量——
 * 这里只用 performance，属于 worker 作用域可用的 API。
 */
const spin = (ms: number) => {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* 占住 worker 线程，让后面的任务排队 */
  }
  return ms;
};

/** 在 worker 里生成一个大 buffer 并返回，用于演示回程转移。 */
const makeBuffer = (bytes: number) => {
  const data = new Uint8Array(bytes);
  data.fill(7);
  return {data, bytes};
};

const SCALE_JOBS = 60;
const SCALE_JOB_MS = 5;

interface PoolStats {
  size: number;
  busy: number;
  pending: number;
  stolen: number;
}

const readStats = (pool: WorkerPool): PoolStats => ({
  size: pool.size,
  busy: pool.busy,
  pending: pool.pending,
  stolen: pool.stolen,
});

/** 统计卡片：size / busy / pending / stolen。 */
const StatsRow: FC<{stats: PoolStats | null}> = ({stats}) => {
  const {t} = useI18n();
  return (
    <Stats>
      <Stat label={t({zh: "worker 数", en: "workers"})} value={stats ? stats.size : "–"} />
      <Stat label={t({zh: "忙碌中", en: "busy"})} value={stats ? stats.busy : "–"} />
      <Stat label={t({zh: "排队中", en: "pending"})} value={stats ? stats.pending : "–"} />
      <Stat label={t({zh: "窃取次数", en: "stolen"})} value={stats ? stats.stolen : "–"} />
    </Stats>
  );
};

// ---- 1. 快速开始 ----

const QuickStartDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [results, setResults] = useState<number[] | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const durations = [40, 90, 15, 60, 30, 75];

  const run = async () => {
    setRunning(true);
    setResults(null);
    setElapsed(null);
    const pool = new WorkerPool({maxWorkers: 2});
    const started = performance.now();
    const timer = window.setInterval(() => setStats(readStats(pool)), 40);
    try {
      const values = await Promise.all(durations.map((ms) => pool.run(spin, ms)));
      setResults(values);
      setElapsed(performance.now() - started);
    } finally {
      window.clearInterval(timer);
      // 先取一次统计再销毁：这样看到的是池在运行期间的真实形态（2 个 worker）
      setStats(readStats(pool));
      pool.dispose();
    }
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:提交一批耗时不同的任务", en: "Demo: submit a batch of uneven jobs"})}
      hint={t({
        zh: "6 个任务几乎同时提交，但只有 2 个 worker。观察 size 始终是 2，而 pending 一开始不为 0。",
        en: "Six jobs are submitted at once but only two workers exist. Watch size stay at 2 while pending starts non-zero.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "执行中…", en: "Running…"}) : t({zh: "提交 6 个任务", en: "Submit 6 jobs"})}
        </Button>
        <Label>
          {t({zh: "任务耗时(ms):", en: "durations (ms):"})}{" "}
          <Muted>{durations.join(" / ")}</Muted>
        </Label>
      </Controls>
      <StatsRow stats={stats} />
      {results ? (
        <Output>
          <div>
            {t({zh: "结果", en: "results"})}: [{results.join(", ")}]
          </div>
          <div>
            {t({zh: "总耗时", en: "elapsed"})}:{" "}
            <strong>{elapsed?.toFixed(1)}ms</strong>{" "}
            <Muted>
              {t({
                zh: "(串行需要 310ms；2 个 worker 并行约 150ms)",
                en: "(serial would be 310ms; two workers finish in ~150ms)",
              })}
            </Muted>
          </div>
        </Output>
      ) : null}
    </Demo>
  );
};

// ---- 2. 工作窃取 ----

interface StealEvent {
  label: string;
  at: number;
  heavy: boolean;
}

const StealingDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StealEvent[]>([]);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [total, setTotal] = useState(0);

  const run = async () => {
    setRunning(true);
    setEvents([]);
    setStats(null);
    setTotal(0);

    const pool = new WorkerPool({maxWorkers: 2});
    const started = performance.now();
    const timer = window.setInterval(() => setStats(readStats(pool)), 40);
    const record = (label: string, heavy: boolean) => (value: number) => {
      setEvents((prev) => [...prev, {label, at: performance.now() - started, heavy}]);
      return value;
    };

    const jobs = [
      // 两个占住 worker 的长任务：一个很快做完，一个要 400ms
      pool.run(spin, 20).then(record("job A · 20ms", false)),
      pool.run(spin, 400).then(record("job B · 400ms", true)),
      // 这时两个 worker 都在忙，4 个瞬时任务只能排队：各分到 2 个
      ...Array.from({length: 4}, (_, index) =>
        pool.run(spin, 0).then(record(`job ${index + 1} · 0ms`, false)),
      ),
    ];

    try {
      await Promise.all(jobs);
      setTotal(performance.now() - started);
    } finally {
      window.clearInterval(timer);
      setStats(readStats(pool));
      pool.dispose();
    }
    setRunning(false);
  };

  return (
    <Demo
      title={t({
        zh: "示例:空闲 worker 接管忙碌 worker 尚未开始的任务",
        en: "Demo: an idle worker steals work its peer has not started",
      })}
      hint={t({
        zh: "4 个瞬时任务被平均分给了两个 worker；A 上的 2 个很快做完，B 还在跑 400ms 的长任务——A 于是把 B 队列里剩下的任务「偷」了过来。看每个任务的完成时刻：它们并没有等到 400ms。",
        en: "The four instant jobs were split evenly. A finishes its share quickly while B is still on the 400ms job — so A steals the rest of B's queue. Look at when each job finishes: none of them waits for 400ms.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "执行中…", en: "Running…"}) : t({zh: "运行窃取演示", en: "Run the theft"})}
        </Button>
        {total ? (
          <Label>
            {t({zh: "全部完成", en: "all done in"})} <strong>{total.toFixed(0)}ms</strong>
          </Label>
        ) : null}
      </Controls>
      <StatsRow stats={stats} />
      {events.length > 0 && total > 0 ? (
        <div style={{marginTop: 12}}>
          {events.map((event, index) => (
            <div
              key={index}
              style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 6}}
            >
              <span style={{width: 130, fontSize: 12, color: colors.body}}>{event.label}</span>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  height: 8,
                  background: "#eef1f5",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: `calc(${Math.min(event.at / total, 1) * 100}% - 4px)`,
                    top: -4,
                    width: 8,
                    height: 16,
                    borderRadius: 4,
                    background: event.heavy ? "#dc2626" : colors.accent,
                  }}
                />
              </div>
              <span
                style={{
                  width: 62,
                  textAlign: "right",
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  color: colors.body,
                }}
              >
                {event.at.toFixed(1)}ms
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Demo>
  );
};

// ---- 3. 零拷贝 ----

const TransferDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [inResult, setInResult] = useState<{before: number; after: number; first: number} | null>(
    null,
  );
  const [outResult, setOutResult] = useState<{
    bytes: number;
    copiedMs: number;
    movedMs: number;
    first: number;
  } | null>(null);

  const bytes = 16 * 1024 * 1024;

  const runIn = async () => {
    setRunning(true);
    setInResult(null);
    const buffer = new ArrayBuffer(bytes);
    new Uint8Array(buffer)[0] = 42;
    const pool = new WorkerPool({maxWorkers: 1});
    try {
      const result = await pool.run(
        (buf: ArrayBuffer) => {
          const view = new Uint8Array(buf);
          return {bytes: view.length, first: view[0]};
        },
        buffer,
        {transfer: [buffer]},
      );
      // after 为 0 就是转移的证明：这块内存已经不属于主线程了
      setInResult({before: bytes, after: buffer.byteLength, first: result.first});
    } finally {
      pool.dispose();
    }
    setRunning(false);
  };

  const runOut = async () => {
    setRunning(true);
    setOutResult(null);
    const pool = new WorkerPool({maxWorkers: 1});
    try {
      const copiedStart = performance.now();
      // 只测往返耗时，结果本身不需要
      await pool.run(makeBuffer, bytes);
      const copiedMs = performance.now() - copiedStart;

      const movedStart = performance.now();
      const moved = await pool.run(makeBuffer, bytes, {resultTransfer: ["data"]});
      const movedMs = performance.now() - movedStart;

      setOutResult({bytes, copiedMs, movedMs, first: moved.data[0]});
    } finally {
      pool.dispose();
    }
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:16MB buffer 的来与回", en: "Demo: a 16MB buffer, in and back"})}
      hint={t({
        zh: "入参用 transfer、结果用 resultTransfer，两程都不拷贝。不声明的话，回程会在主线程的消息处理里同步拷贝。",
        en: "transfer for the argument, resultTransfer for the result — neither leg copies. Without the declaration, the return leg is copied synchronously on the main thread.",
      })}
    >
      <Controls>
        <Button onClick={runIn} disabled={running}>
          {t({zh: "传入 16MB(零拷贝)", en: "Send 16MB (zero-copy)"})}
        </Button>
        <Button onClick={runOut} disabled={running} tone="ghost">
          {t({zh: "回传 16MB(对照拷贝与转移)", en: "Return 16MB (copy vs move)"})}
        </Button>
      </Controls>

      {inResult ? (
        <Output>
          <div>
            {t({zh: "入参 buffer 主线程 byteLength", en: "argument buffer byteLength"})}:{" "}
            {inResult.before.toLocaleString()} →{" "}
            <strong style={{color: colors.success}}>{inResult.after}</strong>
          </div>
          <div>
            {t({zh: "worker 读到首字节", en: "worker read first byte"})}: {inResult.first}
          </div>
          <Muted>
            {t({
              zh: "byteLength 变成 0 = 所有权已转移，主线程不再持有这份内存。",
              en: "byteLength 0 means ownership moved — the main thread no longer holds this memory.",
            })}
          </Muted>
        </Output>
      ) : null}

      {outResult ? (
        <Output>
          <div>
            {t({zh: "回传 16MB · 复制", en: "return 16MB · copy"})}:{" "}
            {outResult.copiedMs.toFixed(1)}ms
          </div>
          <div>
            {t({zh: "回传 16MB · resultTransfer", en: "return 16MB · resultTransfer"})}:{" "}
            <strong>{outResult.movedMs.toFixed(1)}ms</strong>
          </div>
          <div>
            {t({zh: "结果首字节", en: "result first byte"})}: {outResult.first}
          </div>
          <Muted>
            {t({
              zh: "具体毫秒数随机器波动，但方向稳定：转移不走字节拷贝。",
              en: "Exact milliseconds vary by machine; the direction is stable: a move copies no bytes.",
            })}
          </Muted>
        </Output>
      ) : null}
    </Demo>
  );
};

// ---- 4. 错误处理 ----

const ErrorDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [caught, setCaught] = useState<{name: string; message: string; raw: string} | null>(null);
  const [recovered, setRecovered] = useState<number | null>(null);

  const run = async () => {
    setRunning(true);
    setCaught(null);
    setRecovered(null);
    const pool = new WorkerPool({maxWorkers: 1});
    try {
      try {
        await pool.run(() => {
          throw new Error("boom from the worker");
        }, null);
      } catch (error) {
        setCaught(
          error instanceof WorkerError
            ? {name: error.name, message: error.message, raw: error.raw}
            : {name: "Unknown", message: String(error), raw: ""},
        );
      }
      // 任务抛错只是这个任务失败：worker 本身还活着，池继续可用
      const value = await pool.run((n: number) => n * 2, 21);
      setRecovered(value);
    } finally {
      pool.dispose();
    }
    setRunning(false);
  };

  return (
    <Demo
      title={t({zh: "示例:任务抛错不拖垮 worker", en: "Demo: a throwing job does not kill the worker"})}
      hint={t({
        zh: "worker 内部把错误包成 WorkerError 回传，然后用同一个池再跑一个任务验证池还可用。",
        en: "The error comes back wrapped in a WorkerError; the same pool then runs another job to prove it survived.",
      })}
    >
      <Controls>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "执行中…", en: "Running…"}) : t({zh: "触发错误并恢复", en: "Throw, then recover"})}
        </Button>
      </Controls>
      {caught ? (
        <Output>
          <div>
            name: <strong>{caught.name}</strong>
          </div>
          <div>message: {caught.message}</div>
          <div>
            {t({zh: "后续任务结果", en: "next job result"})}:{" "}
            <strong style={{color: colors.success}}>{recovered === null ? "…" : recovered}</strong>
          </div>
        </Output>
      ) : null}
    </Demo>
  );
};

// ---- 5. 并发上限 ----

interface ScaleRow {
  workers: number;
  elapsed: number;
  stolen: number;
}

const ScalingDemo: FC = () => {
  const {t} = useI18n();
  const [workers, setWorkers] = useState(2);
  const [rows, setRows] = useState<ScaleRow[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const pool = new WorkerPool({maxWorkers: workers});
    const started = performance.now();
    try {
      await Promise.all(Array.from({length: SCALE_JOBS}, () => pool.run(spin, SCALE_JOB_MS)));
      setRows((prev) => [
        ...prev,
        {workers, elapsed: performance.now() - started, stolen: pool.stolen},
      ]);
    } finally {
      pool.dispose();
    }
    setRunning(false);
  };

  const serial = SCALE_JOBS * SCALE_JOB_MS;

  return (
    <Demo
      title={t({
        zh: `示例:${SCALE_JOBS} 个各 ${SCALE_JOB_MS}ms 的任务,改上限看耗时`,
        en: `Demo: ${SCALE_JOBS} jobs of ${SCALE_JOB_MS}ms each — vary the cap`,
      })}
      hint={t({
        zh: `纯计算任务几乎线性扩展：1 个 worker 约 ${serial}ms，2 个约 ${serial / 2}ms，4 个约 ${serial / 4}ms。可以多跑几次累积对比。`,
        en: `Pure computation scales near-linearly: ~${serial}ms on one worker, ~${serial / 2}ms on two, ~${serial / 4}ms on four. Run it a few times to accumulate rows.`,
      })}
    >
      <Controls>
        <Label>{t({zh: "maxWorkers", en: "maxWorkers"})}</Label>
        <select
          value={workers}
          onChange={(event) => setWorkers(Number(event.target.value))}
          style={controlStyle}
        >
          {[1, 2, 4].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={running}>
          {running ? t({zh: "执行中…", en: "Running…"}) : t({zh: "运行", en: "Run"})}
        </Button>
        <Button onClick={() => setRows([])} disabled={running || rows.length === 0} tone="ghost">
          {t({zh: "清空对比", en: "Clear"})}
        </Button>
      </Controls>

      {rows.length > 0 ? (
        <div style={{marginTop: 12}}>
          <ApiTable
            head={[
              t({zh: "maxWorkers", en: "maxWorkers"}),
              t({zh: "耗时", en: "elapsed"}),
              t({zh: "理想值", en: "ideal"}),
              t({zh: "并行效率", en: "efficiency"}),
              t({zh: "窃取", en: "stolen"}),
            ]}
            rows={rows.map((row) => [
              row.workers,
              `${row.elapsed.toFixed(0)}ms`,
              `${(serial / row.workers).toFixed(0)}ms`,
              `${(((serial / row.workers) / row.elapsed) * 100).toFixed(0)}%`,
              row.stolen,
            ])}
          />
          <Muted>
            {t({
              zh: "效率 = 理想耗时 / 实测耗时。任务很轻时达不到 100% 是正常的：main thread 处理消息也要时间，瓶颈会转移到主线程。",
              en: "Efficiency = ideal / measured. Under 100% on tiny jobs is expected: the main thread spends time on messaging too, and it becomes the bottleneck.",
            })}
          </Muted>
        </div>
      ) : null}
    </Demo>
  );
};

// ---- 文档正文 ----

export const WorkerPoolDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>WorkerPool</InlineCode> 是固定大小的工作池：默认 2 个通用 worker，按需创建但绝不越过
              <InlineCode>maxWorkers</InlineCode>，空闲也不回收。提交的任务按「最轻负载」分配给某个 worker，先完成的
              worker 会去窃取别的 worker 队列里「已分配但尚未开始」的任务。
            </>
          ),
          en: (
            <>
              <InlineCode>WorkerPool</InlineCode> is a fixed-size worker pool: two generic workers by
              default, created on demand and never beyond <InlineCode>maxWorkers</InlineCode>, kept
              while the pool lives. A submitted job lands on the least-loaded worker, and a worker
              that finishes early steals work another worker has queued but not yet started.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              池化最直接的收益是 worker 的启动成本只付一次：worker 一直复用，下一个任务直接开跑。代价是
              worker 必须是通用的——任务自带函数源码，在 worker 内用 <InlineCode>new Function</InlineCode>{" "}
              重建——因此页面 CSP 需要允许 <InlineCode>unsafe-eval</InlineCode>。若 CSP 不允许，可改用{" "}
              <InlineCode>postTransferable</InlineCode> 自行驱动一个预先构建好的 worker 脚本。
            </>
          ),
          en: (
            <>
              The most direct win of pooling is paying worker startup once: a worker is reused, so the
              next job starts immediately. The price is that workers must be generic — each job brings
              its function's source and rebuilds it inside the worker with{" "}
              <InlineCode>new Function</InlineCode> — so the page CSP must allow{" "}
              <InlineCode>unsafe-eval</InlineCode>. If it cannot, drive a pre-built worker script
              yourself through <InlineCode>postTransferable</InlineCode>.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 快速开始", en: "1. Quick start"})}>
        <Code
          code={`import { WorkerPool } from "@wwog/react";

const pool = new WorkerPool({ maxWorkers: 2 });

// 同一批任务铺满两个 worker；先做完的那个会接管另一个的积压
const totals = await Promise.all(chunks.map((chunk) => pool.run(sum, chunk)));

pool.dispose();`}
          caption={t({
            zh: "任务函数必须自包含：源码会被 toString() 序列化，不能捕获外部变量。",
            en: "The job function must be self-contained: its source is serialized with toString(), so it cannot capture outer variables.",
          })}
        />
        <QuickStartDemo />
      </Section>

      <Section title={t({zh: "2. 工作窃取", en: "2. Work stealing"})}>
        <P>
          {t({
            zh: (
              <>
                主线程调度分两步。<strong>分配</strong>：提交时挑「在途 + 排队」最少的 worker，空闲就立即开跑，
                否则任务停在该 worker 的本地队列里。<strong>窃取</strong>：worker 空闲时先清自己的队列，自己没活了就
                找尚未开始任务堆积最多的忙碌 worker，取走等待最久的那个。
              </>
            ),
            en: (
              <>
                The main thread schedules in two steps. <strong>Assign</strong>: pick the worker with
                the fewest outstanding jobs; it starts immediately if idle, otherwise the job waits in
                that worker's local queue. <strong>Steal</strong>: an idle worker drains its own queue
                first, and when it has nothing left it takes the longest-waiting job from the busiest
                worker's queue.
              </>
            ),
          })}
        </P>
        <P>
          {t({
            zh: "尚未开始的任务没有副作用，搬走是免费的；已经在执行的任务无法被搬移。",
            en: "A job that has not started carries no side effects, so moving it is free. A job already running cannot be moved.",
          })}
        </P>
        <Code
          code={`import { WorkerPool } from "@wwog/react";

const pool = new WorkerPool({ maxWorkers: 2 });

// 两个长任务先占住 worker；紧接着的 4 个短任务被平均分给它们排队
const heavy = [pool.run(encode, frameA), pool.run(encode, frameB)];
const light = tiles.map((tile) => pool.run(resize, tile));

// frameA 先做完：同一个 worker 不干等，而是窃取 frameB 队列里等待最久的任务
await Promise.all([...heavy, ...light]);
console.log(pool.stolen); // 窃取次数 > 0

pool.dispose();`}
          caption={t({
            zh: "分配保证每个任务都有归属，窃取保证先空闲的 worker 不空转——两者合起来才是这个池的调度。",
            en: "Assignment gives every job a home; stealing keeps an early-finished worker from idling. Together they are the scheduler.",
          })}
        />
        <StealingDemo />
      </Section>

      <Section title={t({zh: "3. 零拷贝:入参与结果", en: "3. Zero-copy: in and back"})}>
        <P>
          {t({
            zh: (
              <>
                postMessage 会序列化数据。大 buffer 两程都要声明转移：入参用{" "}
                <InlineCode>transfer</InlineCode>，结果用 <InlineCode>resultTransfer</InlineCode>（点分隔的属性
                路径，<InlineCode>&quot;.&quot;</InlineCode> 表示结果本身；TypedArray 会转移其底层 buffer）。
              </>
            ),
            en: (
              <>
                postMessage serializes its data. For large buffers both legs must ask for a move:{" "}
                <InlineCode>transfer</InlineCode> for the argument, <InlineCode>resultTransfer</InlineCode>{" "}
                for the result (dot-separated property paths; <InlineCode>&quot;.&quot;</InlineCode> means
                the result itself, and a TypedArray is transferred as its underlying buffer).
              </>
            ),
          })}
        </P>
        <Code
          code={`const result = await pool.run(
  (img: { buf: ArrayBuffer; width: number; height: number }) => {
    // ... 逐像素处理 img.buf ...
    return { buf: img.buf, width: img.width, height: img.height };
  },
  { buf: pixels.buffer, width, height },
  {
    transfer: [pixels.buffer],  // 入参零拷贝
    resultTransfer: ["buf"],    // 结果零拷贝
  },
);`}
          caption={t({
            zh: "路径解析不到可转移值时会被跳过，退化为拷贝而不是让任务失败。",
            en: "A path that resolves to nothing transferable is skipped — it degrades to a copy instead of failing the job.",
          })}
        />
        <TransferDemo />
      </Section>

      <Section title={t({zh: "4. 错误处理", en: "4. Error handling"})}>
        <P>
          {t({
            zh: (
              <>
                任务在 worker 内抛错时回传为 <InlineCode>WorkerError</InlineCode>；worker 脚本自身出错同样如此。
                单个任务失败只影响那个任务——worker 继续复用，池继续可用。
              </>
            ),
            en: (
              <>
                A job that throws inside the worker comes back as a <InlineCode>WorkerError</InlineCode>,
                as does a failure of the worker script itself. One failing job affects only that job:
                the worker is reused and the pool stays available.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { WorkerError } from "@wwog/react";

try {
  await pool.run(() => {
    throw new Error("boom from the worker");
  }, null);
} catch (error) {
  if (error instanceof WorkerError) {
    console.error(error.message); // Worker function threw: Error: boom from the worker
    console.error(error.raw);     // worker 回传的原始错误消息
  }
}

// 失败只属于这个任务：worker 没有死，同一个池继续可用
const doubled = await pool.run((n: number) => n * 2, 21); // 42`}
          caption={t({
            zh: "worker 侧的失败（任务抛错、脚本报错、数据不可克隆）都归一为 WorkerError，调用方只需 catch 一种类型。",
            en: "Every worker-side failure — a throwing job, a script error, non-cloneable data — is normalized to a WorkerError, so callers catch a single type.",
          })}
        />
        <ErrorDemo />
      </Section>

      <Section title={t({zh: "5. 并发上限", en: "5. Concurrency cap"})}>
        <P>
          {t({
            zh: (
              <>
                池只按需扩张到 <InlineCode>maxWorkers</InlineCode>：顺序任务只会用到 1 个 worker，突发批量才会
                用满。纯计算任务几乎线性扩展；任务很轻时主线程（消息 + 调度）会成为瓶颈，此时再加 worker 收益递减。
              </>
            ),
            en: (
              <>
                The pool only grows to <InlineCode>maxWorkers</InlineCode> as needed: a sequential
                workload uses one worker, a burst uses them all. Pure computation scales near-linearly;
                with very small jobs the main thread (messaging plus scheduling) becomes the bottleneck,
                and extra workers help less.
              </>
            ),
          })}
        </P>
        <Code
          code={`const pool = new WorkerPool({ maxWorkers: 4 });

// 顺序提交：只用到 1 个 worker，池不会为它多开
await pool.run(decode, shardA);
await pool.run(decode, shardB);

// 突发批量：池按需扩张到上限，一批任务铺满 4 个 worker
const started = performance.now();
await Promise.all(jobs.map((job) => pool.run(compress, job)));
console.log(performance.now() - started); // 接近串行耗时的 1/4

pool.dispose();`}
          caption={t({
            zh: "扩张只发生在「所有 worker 都忙」时，且绝不超过 maxWorkers；顺序任务因此只付一个 worker 的成本。",
            en: "The pool grows only when every worker is busy and never past maxWorkers, so a sequential workload pays for a single worker.",
          })}
        />
        <ScalingDemo />
      </Section>

      <Section title={t({zh: "6. API 参考", en: "6. API reference"})}>
        <P>
          <InlineCode>new WorkerPool(options)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>maxWorkers</InlineCode>,
              <InlineCode>number</InlineCode>,
              t({
                zh: "存活 worker 的硬上限，默认 2。按需创建，绝不越界；空闲不回收。",
                en: "Hard cap on live workers, default 2. Created on demand, never exceeded, never recycled.",
              }),
            ],
          ]}
        />
        <P>
          <InlineCode>pool</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>run(fn, arg, options?)</InlineCode>,
              t({
                zh: "提交任务，返回 Promise<Result>。fn 必须自包含。",
                en: "Submit a job; returns Promise<Result>. fn must be self-contained.",
              }),
            ],
            [
              <InlineCode>dispose()</InlineCode>,
              t({
                zh: "终止所有 worker 并 reject 在途与排队任务。",
                en: "Terminate every worker and reject in-flight and queued jobs.",
              }),
            ],
            [
              <InlineCode>size</InlineCode>,
              t({zh: "当前存活的 worker 数。", en: "Live worker count."}),
            ],
            [
              <InlineCode>maxWorkers</InlineCode>,
              t({zh: "配置的上限。", en: "The configured cap."}),
            ],
            [
              <InlineCode>busy</InlineCode>,
              t({zh: "正在执行任务的 worker 数。", en: "Workers currently executing a job."}),
            ],
            [
              <InlineCode>pending</InlineCode>,
              t({
                zh: "已分配但尚未开始的任务数（不含在途）。",
                en: "Jobs assigned but not yet started (excludes in-flight).",
              }),
            ],
            [
              <InlineCode>stolen</InlineCode>,
              t({zh: "累计被窃取的任务数。", en: "How many jobs have been stolen so far."}),
            ],
            [
              <InlineCode>disposed</InlineCode>,
              t({zh: "是否已销毁。", en: "Whether the pool has been disposed."}),
            ],
          ]}
        />
        <P>
          <InlineCode>run</InlineCode> / <InlineCode>runInWorkerWithPool</InlineCode>{" "}
          {t({zh: "的 options", en: "options"})}
        </P>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>transfer</InlineCode>,
              <InlineCode>Transferable[]</InlineCode>,
              t({
                zh: "入参中按零拷贝移入 worker 的对象；转移后主线程失去使用权。",
                en: "Objects in the argument to move into the worker; the main thread loses access.",
              }),
            ],
            [
              <InlineCode>resultTransfer</InlineCode>,
              <InlineCode>string[]</InlineCode>,
              t({
                zh: "结果中要按零拷贝移出的值的路径，例如 ['buf'] / ['meta.bytes'] / ['.']。",
                en: "Paths to values in the result to move back out, e.g. ['buf'] / ['meta.bytes'] / ['.'].",
              }),
            ],
          ]}
        />
        <P>{t({zh: "其他导出", en: "Other exports"})}</P>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>runInWorkerWithPool(fn, arg, options?)</InlineCode>,
              t({
                zh: "在进程内共享池上运行任务（默认 2 个 worker）——最常用的入口。",
                en: "Runs a job on the shared in-process pool (2 workers by default) — the usual entry point.",
              }),
            ],
            [
              <InlineCode>getWorkerPool()</InlineCode>,
              t({zh: "取共享池，首次访问时懒创建。", en: "Get the shared pool, lazily created on first access."}),
            ],
            [
              <InlineCode>disposeWorkerPool()</InlineCode>,
              t({
                zh: "销毁共享池，下次访问会重建。",
                en: "Tear down the shared pool; the next access builds a fresh one.",
              }),
            ],
            [
              <InlineCode>WorkerError</InlineCode>,
              t({
                zh: "所有 worker 相关失败的统一错误类型（含 raw 原始消息）。",
                en: "One error type for every worker failure (with the raw message on .raw).",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "7. 限制与注意", en: "7. Limits and cautions"})}>
        <ApiTable
          head={[t({zh: "限制", en: "limit"}), t({zh: "说明", en: "why it matters"})]}
          rows={[
            [
              t({zh: "CSP 需要 unsafe-eval", en: "CSP must allow unsafe-eval"}),
              t({
                zh: "通用 worker 用 new Function 重建任务函数；这是窃取能力的前提。若 CSP 不允许，可改用 postTransferable 自行驱动一个预先构建好的 worker 脚本。",
                en: "Generic workers rebuild the job function with new Function; that is what enables stealing. If your CSP cannot allow it, drive a pre-built worker script yourself through postTransferable.",
              }),
            ],
            [
              t({zh: "任务函数必须自包含", en: "Job functions must be self-contained"}),
              t({
                zh: "源码经 toString() 序列化，捕获外部变量不会生效（通常表现为 worker 内报错）。",
                en: "The source is serialized via toString(); captured variables do not survive (usually surfacing as an error inside the worker).",
              }),
            ],
            [
              t({zh: "任务不再按函数串行", en: "Jobs are not serialized per function"}),
              t({
                zh: "同一个函数的两次调用可能并行在不同 worker 上，需要顺序时请 await。",
                en: "Two calls of the same function may run in parallel on different workers; await when order matters.",
              }),
            ],
            [
              t({zh: "参数与结果必须可结构化克隆", en: "Arguments and results must be structured-cloneable"}),
              t({
                zh: "不可克隆的值（函数、DOM 节点）会以 WorkerError 失败。",
                en: "Values that cannot be cloned (functions, DOM nodes) fail with a WorkerError.",
              }),
            ],
            [
              t({zh: "worker 常驻", en: "Workers stay alive"}),
              t({
                zh: "池存活期间 worker 不回收，换来零启动延迟；不用时记得 dispose()。",
                en: "Workers are not recycled while the pool lives — that is the zero-startup trade. Call dispose() when done.",
              }),
            ],
            [
              t({zh: "没有共享内存", en: "No shared memory"}),
              t({
                zh: "任务之间不共享状态；需要共享数据要走消息或 SharedArrayBuffer 自行处理。",
                en: "Jobs share no state; sharing data means messages, or handling SharedArrayBuffer yourself.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
