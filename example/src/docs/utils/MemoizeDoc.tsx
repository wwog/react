import {useMemo, useRef, useState, type FC} from "react";
import {memoize} from "../../../../src";
import {useI18n} from "../../i18n";
import {
  ApiTable,
  Button,
  Callout,
  Code,
  Controls,
  Demo,
  InlineCode,
  Muted,
  Output,
  P,
  Section,
  Stat,
  Stats,
  colors,
} from "../ui";

const FIB_SIZES = [20, 25, 30, 35];

interface FibResult {
  n: number;
  naiveMs: number;
  naiveCalls: number;
  memoMs: number;
  memoCalls: number;
  hits: number;
  misses: number;
  value: number;
}

/**
 * 朴素递归 fib 是指数级重复计算：fib(30) 约 270 万次调用，其中同一个子问题被算了无数次。
 * 记忆化把重复调用变成一次 Map 命中。
 */
const FibDemo: FC = () => {
  const {t} = useI18n();
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<FibResult[]>([]);
  const naiveCallsRef = useRef(0);

  const naiveFib = (n: number): number => {
    naiveCallsRef.current += 1;
    return n < 2 ? n : naiveFib(n - 1) + naiveFib(n - 2);
  };

  const run = (n: number) => {
    setRunning(true);
    // 先让按钮禁用状态渲染出来，再做同步的重计算
    window.setTimeout(() => {
      naiveCallsRef.current = 0;
      const naiveStart = performance.now();
      const naiveValue = naiveFib(n);
      const naiveMs = performance.now() - naiveStart;
      const naiveCalls = naiveCallsRef.current;

      let calls = 0;
      const memoFib = memoize((k: number): number => {
        calls += 1;
        return k < 2 ? k : memoFib(k - 1) + memoFib(k - 2);
      });
      const memoStart = performance.now();
      const value = memoFib(n);
      const memoMs = performance.now() - memoStart;

      setRows((prev) => [
        ...prev,
        {
          n,
          naiveMs,
          naiveCalls,
          memoMs,
          memoCalls: calls,
          hits: memoFib.stats.hits,
          misses: memoFib.stats.misses,
          value,
        },
      ]);
      // 两个结果必须一致，否则测量无意义
      console.assert(naiveValue === value, "naive and memoized fib disagree");
      setRunning(false);
    }, 30);
  };

  const latest = rows.length > 0 ? rows[rows.length - 1] : undefined;

  return (
    <Demo
      title={t({zh: "示例:朴素递归 vs 记忆化", en: "Demo: naive recursion vs memoization"})}
      hint={t({
        zh: "同一份 fib 计算。朴素版把同一子问题重复算到指数级；记忆化版每个 n 只算一次，其余全是缓存命中。",
        en: "The same fib computation. The naive version recomputes subproblems exponentially; the memoized one computes each n once and serves the rest from cache.",
      })}
    >
      <Controls>
        {FIB_SIZES.map((n) => (
          <Button key={n} onClick={() => run(n)} disabled={running} tone={n === 35 ? "primary" : "ghost"}>
            fib({n})
          </Button>
        ))}
        <Button onClick={() => setRows([])} disabled={running || rows.length === 0} tone="ghost">
          {t({zh: "清空", en: "Clear"})}
        </Button>
      </Controls>

      {latest ? (
        <>
          <Stats>
            <Stat label={t({zh: "结果", en: "value"})} value={latest.value.toLocaleString()} />
            <Stat
              label={t({zh: "朴素耗时", en: "naive"})}
              value={<span style={{color: "#dc2626"}}>{latest.naiveMs.toFixed(1)}ms</span>}
            />
            <Stat
              label={t({zh: "记忆化耗时", en: "memoized"})}
              value={<span style={{color: colors.success}}>{latest.memoMs.toFixed(2)}ms</span>}
            />
            <Stat label={t({zh: "加速", en: "speedup"})} value={`${(latest.naiveMs / Math.max(latest.memoMs, 0.01)).toFixed(0)}×`} />
          </Stats>
          <Output>
            <div>
              {t({zh: "原函数被调用", en: "original function called"})}:{" "}
              <strong style={{color: "#dc2626"}}>{latest.naiveCalls.toLocaleString()}</strong>{" "}
              {t({zh: "次（朴素） vs ", en: "(naive) vs "})}
              <strong style={{color: colors.success}}>{latest.memoCalls}</strong>{" "}
              {t({zh: "次（记忆化）", en: "(memoized)"})}
            </div>
            <div>
              {t({zh: "缓存命中 / 未命中", en: "cache hits / misses"})}: {latest.hits} / {latest.misses}
            </div>
          </Output>
        </>
      ) : null}

      {rows.length > 1 ? (
        <div style={{marginTop: 12}}>
          <ApiTable
            head={[
              "n",
              t({zh: "朴素调用", en: "naive calls"}),
              t({zh: "记忆化调用", en: "memo calls"}),
              t({zh: "朴素耗时", en: "naive"}),
              t({zh: "记忆化耗时", en: "memoized"}),
            ]}
            rows={rows.map((row) => [
              row.n,
              row.naiveCalls.toLocaleString(),
              row.memoCalls,
              `${row.naiveMs.toFixed(1)}ms`,
              `${row.memoMs.toFixed(2)}ms`,
            ])}
          />
        </div>
      ) : null}
    </Demo>
  );
};

/**
 * 多参数函数的 key 陷阱：若只拿第一个参数当 key，add(1,2) 与 add(1,3) 会共用缓存项。
 * 本库默认在参数多于一个时用 JSON.stringify(args)，因此每个参数都参与 key。
 */
const KeyDemo: FC = () => {
  const {t} = useI18n();
  const [log, setLog] = useState<string[]>([]);

  const add = useMemo(() => memoize((a: number, b: number) => a + b), []);
  const customKey = useMemo(
    () =>
      memoize(
        (user: {id: number; name: string}, scope: string) => `${user.name}@${scope}`,
        (user, scope) => `${user.id}:${scope}`,
      ),
    [],
  );

  const call = (a: number, b: number) => {
    const value = add(a, b);
    setLog((prev) => [
      `add(${a}, ${b}) → ${value}   hits=${add.stats.hits} misses=${add.stats.misses}`,
      ...prev,
    ].slice(0, 6));
  };

  const callCustom = () => {
    // 两个内容相同的对象、不同的引用：自定义 keyFn 让它们命中同一项
    const a = {id: 7, name: "ada"};
    const b = {id: 7, name: "ada"};
    customKey(a, "read");
    const value = customKey(b, "read");
    setLog((prev) => [
      `customKey({id:7}, "read") ×2 → ${value}   hits=${customKey.stats.hits} misses=${customKey.stats.misses}`,
      ...prev,
    ].slice(0, 6));
  };

  return (
    <Demo
      title={t({zh: "示例:key 怎么取", en: "Demo: how the key is derived"})}
      hint={t({
        zh: "add 有两个参数，默认 key 是 JSON.stringify(args)，所以 (1,2) 与 (1,3) 是两个不同的项。(1,2) 调两次则第二次命中。",
        en: "add takes two arguments, so the default key is JSON.stringify(args) — (1,2) and (1,3) are distinct entries, while calling (1,2) twice hits the cache.",
      })}
    >
      <Controls>
        <Button onClick={() => call(1, 2)}>add(1, 2)</Button>
        <Button onClick={() => call(1, 2)} tone="ghost">
          add(1, 2) {t({zh: "再来一次", en: "again"})}
        </Button>
        <Button onClick={() => call(1, 3)} tone="ghost">
          add(1, 3)
        </Button>
        <Button onClick={callCustom} tone="ghost">
          {t({zh: "自定义 keyFn", en: "custom keyFn"})}
        </Button>
        <Button onClick={() => setLog([])} disabled={log.length === 0} tone="ghost">
          {t({zh: "清空", en: "Clear"})}
        </Button>
      </Controls>
      <Output>
        {log.length === 0 ? (
          <Muted>{t({zh: "点上面的按钮，观察 hits / misses。", en: "Click the buttons and watch hits / misses."})}</Muted>
        ) : (
          log.map((line, index) => <div key={index}>{line}</div>)
        )}
      </Output>
    </Demo>
  );
};

export const MemoizeDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              记忆化（memoization）是「消除工作」的第三种方式——跳过重复计算。对性能最好的事是根本不做这件事：
              同一输入必得同一结果的计算，没有理由算第二遍。<InlineCode>memoize</InlineCode>{" "}
              把重复计算的成本钉在零。
            </>
          ),
          en: (
            <>
              Memoization is the third way to eliminate work — skipping repeated computation. The best
              thing for performance is not doing the work in the first place: a computation that gives
              the same result for the same input has no reason to run twice.{" "}
              <InlineCode>memoize</InlineCode> pins the cost of a repeated computation to zero.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              记忆化只对<b>纯函数</b>安全：同样的输入必须给出同样的输出，且没有副作用。若结果依赖时间、
              随机数或外部可变状态，缓存会返回过期值。缓存没有淘汰策略——生命周期内会一直持有结果，
              需要时用 <InlineCode>clear()</InlineCode> 主动清空。
            </>
          ),
          en: (
            <>
              Memoization is only safe for <b>pure functions</b>: same input, same output, no side
              effects. If the result depends on time, randomness or outside mutable state, the cache
              returns stale values. There is no eviction policy — results are held for the lifetime of
              the memoized function; call <InlineCode>clear()</InlineCode> when you need to drop them.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 重复计算", en: "1. Repeated computation"})}>
        <FibDemo />
        <Code
          code={`import { memoize } from "@wwog/react";

// 同一个大 payload 的解析结果在多次调用间复用
const parseConfig = memoize((raw: string) => expensiveParse(raw));
parseConfig(bigPayload); // 计算
parseConfig(bigPayload); // 命中 —— 跳过`}
          caption={t({
            zh: "memoize 返回的函数带有 clear() 与只读的 stats（{ hits, misses }）。",
            en: "The returned function carries clear() and a read-only stats ({ hits, misses }).",
          })}
        />
      </Section>

      <Section title={t({zh: "2. key 的推导规则", en: "2. How the key is derived"})}>
        <P>
          {t({
            zh: (
              <>
                默认 key 的规则很重要，直接决定命中率与正确性：
                函数接受 0 或 1 个参数时，直接用该参数本身作为 key（因此对象按引用比较）；
                接受 2 个及以上参数时，用 <InlineCode>JSON.stringify(args)</InlineCode>，
                让每个参数都参与 key——否则 <InlineCode>f(1, 2)</InlineCode> 与{" "}
                <InlineCode>f(1, 3)</InlineCode> 会静默共用缓存项。
              </>
            ),
            en: (
              <>
                The default key rule decides both hit rate and correctness: with 0 or 1 arguments the
                argument itself is the key (so objects compare by reference); with 2 or more the key is{" "}
                <InlineCode>JSON.stringify(args)</InlineCode>, so every argument participates — without
                it, <InlineCode>f(1, 2)</InlineCode> and <InlineCode>f(1, 3)</InlineCode> would silently
                share an entry.
              </>
            ),
          })}
        </P>
        <P>
          {t({
            zh: (
              <>
                参数不可 JSON 序列化时（循环引用、<InlineCode>Map</InlineCode>/<InlineCode>Set</InlineCode>、
                函数），请显式传 <InlineCode>keyFn</InlineCode> 生成一个原始值 key。
              </>
            ),
            en: (
              <>
                When arguments are not JSON-serializable (circular references,{" "}
                <InlineCode>Map</InlineCode>/<InlineCode>Set</InlineCode>, functions), pass an explicit{" "}
                <InlineCode>keyFn</InlineCode> that produces a primitive key.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 多参数:默认对全部参数取 key,不会串味
const add = memoize((a: number, b: number) => a + b);
add(1, 2); // 3 —— 计算
add(1, 3); // 4 —— key 不同,计算(而不是过期的 3)

// 不可序列化的参数:自己给出 key
const query = memoize(
  (userId: string, scope: string) => buildQuery(userId, scope),
  (userId, scope) => userId + ":" + scope,
);`}
        />
        <KeyDemo />
      </Section>

      <Section title={t({zh: "3. API 参考", en: "3. API reference"})}>
        <P>
          <InlineCode>memoize(fn, keyFn?)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "参数", en: "param"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>fn</InlineCode>,
              <InlineCode>F</InlineCode>,
              t({zh: "要记忆化的纯函数。", en: "The pure function to memoize."}),
            ],
            [
              <InlineCode>keyFn</InlineCode>,
              <InlineCode>(...args) =&gt; unknown</InlineCode>,
              t({
                zh: "可选；从调用参数推导 key。缺省按上面的规则。",
                en: "Optional; derives the key from the arguments. Defaults follow the rule above.",
              }),
            ],
          ]}
        />
        <P>
          <InlineCode>{t({zh: "返回的函数", en: "returned function"})}</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>(...args)</InlineCode>, t({zh: "与原函数同签名；命中时不执行原函数。", en: "Same signature as fn; the original does not run on a hit."})],
            [<InlineCode>clear()</InlineCode>, t({zh: "丢弃所有已记住的结果（stats 不清零）。", en: "Drop all remembered results (stats are not reset)."})],
            [<InlineCode>stats</InlineCode>, t({zh: "只读的 { hits, misses }。", en: "Read-only { hits, misses }."})],
          ]}
        />
        <P>
          <Muted>
            {t({
              zh: "缓存以 Map 语义（SameValueZero）比较 key；缓存 undefined 结果用哨兵值区分，因此「命中但值为 undefined」不会被误判为未命中。",
              en: "Keys are compared with Map semantics (SameValueZero); cached undefined results use a sentinel, so a hit whose value is undefined is not mistaken for a miss.",
            })}
          </Muted>
        </P>
      </Section>
    </div>
  );
};
