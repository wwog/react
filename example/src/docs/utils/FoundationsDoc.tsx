import {useEffect, useRef, useState, type FC} from "react";
import {
  Counter,
  DefBreakpointDesc,
  breakpoints,
  childrenLoop,
  cx,
  formatDate,
  safePromiseTry,
  safePromiseWithResolvers,
} from "../../../../src";
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

// ---- cx ----

const CxDemo: FC = () => {
  const {t} = useI18n();
  const [active, setActive] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const className = cx(
    "btn",
    active && "btn-active",
    ["btn-array"],
    {btnDisabled: disabled, btnLarge: false},
  );

  return (
    <Demo
      title={t({zh: "示例:把条件拼成 className", en: "Demo: composing className from conditions"})}
      hint={t({
        zh: "支持字符串、字符串数组、以及 {类名: 布尔} 对象；重复的类名会被 Set 去重，falsy 输入自动跳过。",
        en: "Accepts strings, string arrays, and {className: boolean} objects; duplicates are removed by a Set and falsy inputs are skipped.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          active
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} />
          disabled
        </label>
      </Controls>
      <Output>
        cx(...) → <strong>{className || <Muted>(空字符串)</Muted>}</strong>
      </Output>
    </Demo>
  );
};

// ---- formatDate ----

const FormatDateDemo: FC = () => {
  const {t} = useI18n();
  const [schema, setSchema] = useState("YYYY-MM-DD HH:mm:ss");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Demo
      title={t({zh: "示例:按 schema 格式化当前时间", en: "Demo: format the current time with a schema"})}
      hint={t({
        zh: "改 schema 看输出变化。未识别的字符原样保留。",
        en: "Edit the schema and watch the output change. Unrecognized characters pass through unchanged.",
      })}
    >
      <Controls>
        <input
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            fontSize: 13,
            fontFamily: "ui-monospace, monospace",
            minWidth: 280,
          }}
        />
      </Controls>
      <Output>
        formatDate(schema) → <strong>{formatDate(schema, now)}</strong>
      </Output>
      <Muted>
        {t({
          zh: "注意：实现里 Z / ZZ 是写死的 +08:00 / +0800，不按运行环境时区计算。",
          en: "Note: in this implementation Z / ZZ are hard-coded to +08:00 / +0800 rather than derived from the runtime timezone.",
        })}
      </Muted>
    </Demo>
  );
};

// ---- Counter ----

const CounterDemo: FC = () => {
  const {t} = useI18n();
  const counterRef = useRef(new Counter());
  const [last, setLast] = useState<number | null>(null);

  return (
    <Demo
      title={t({zh: "示例:一个最小计数器", en: "Demo: a minimal counter"})}
      hint={t({
        zh: "next() 返回自增前的值（count++），且不考虑越界——它只是给「生成稳定序号」用的最小工具。",
        en: "next() returns the pre-increment value (count++) and does not handle overflow — a minimal helper for generating stable ids.",
      })}
    >
      <Controls>
        <Button onClick={() => setLast(counterRef.current.next())}>{t({zh: "next()", en: "next()"})}</Button>
      </Controls>
      <Output>
        <div>
          next() {t({zh: "返回", en: "returned"})}: <strong>{last ?? "—"}</strong>
        </div>
        <div>
          count {t({zh: "当前值", en: "now"})}: <strong>{counterRef.current.count}</strong>
        </div>
      </Output>
    </Demo>
  );
};

// ---- childrenLoop ----

const CHILDREN = ["甲", "乙", "丙", "丁", "戊"];

const ChildrenLoopDemo: FC = () => {
  const {t} = useI18n();
  const [visited, setVisited] = useState<string[]>([]);

  const run = () => {
    const log: string[] = [];
    childrenLoop(CHILDREN, (child, index) => {
      log.push(`${index}:${child}`);
      // 返回 false 中断循环——这是相对 React.Children.forEach 的关键区别
      if (index >= 2) return false;
    });
    setVisited(log);
  };

  return (
    <Demo
      title={t({zh: "示例:提前中断遍历", en: "Demo: breaking out of the loop early"})}
      hint={t({
        zh: "5 个子节点，回调在第 3 个（index 2）返回 false，遍历立即停止。React.Children.forEach 做不到这一点。",
        en: "Five children; the callback returns false on the third (index 2) and iteration stops immediately. React.Children.forEach cannot do this.",
      })}
    >
      <Controls>
        <Button onClick={run}>{t({zh: "遍历", en: "Iterate"})}</Button>
        <Button onClick={() => setVisited([])} disabled={visited.length === 0} tone="ghost">
          {t({zh: "清空", en: "Clear"})}
        </Button>
      </Controls>
      <Output>
        {t({zh: "访问顺序", en: "visited"})}:{" "}
        {visited.length > 0 ? visited.join(" → ") : <Muted>{t({zh: "尚未遍历", en: "not yet"})}</Muted>}
      </Output>
    </Demo>
  );
};

// ---- promise ----

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const PromiseDemo: FC = () => {
  const {t} = useI18n();
  const [log, setLog] = useState<string[]>([]);
  const deferredRef = useRef<Deferred<number> | null>(null);

  const push = (line: string) => setLog((prev) => [line, ...prev].slice(0, 6));

  const runTry = async () => {
    // 同步返回值 → 已兑现的 Promise
    const value = await safePromiseTry(() => 21 * 2);
    push(`safePromiseTry(() => 42) → ${value}`);
  };

  const runThrow = async () => {
    // 同步抛错 → 已拒绝的 Promise，而不是同步抛出
    try {
      await safePromiseTry(() => {
        throw new Error("sync boom");
      });
    } catch (error) {
      push(`safePromiseTry(throw) → caught ${(error as Error).message}`);
    }
  };

  const runDeferred = () => {
    const deferred = safePromiseWithResolvers<number>();
    deferredRef.current = deferred;
    deferred.promise.then((value) => push(`deferred.promise → resolved ${value}`));
    push("已创建 deferred，等待手动 resolve");
  };

  const resolveDeferred = () => {
    deferredRef.current?.resolve(7);
    deferredRef.current = null;
  };

  return (
    <Demo
      title={t({zh: "示例:同步异常也能安全地变成 Promise", en: "Demo: sync throws become safe Promises"})}
      hint={t({
        zh: "safePromiseTry 优先使用原生 Promise.try，缺失时回退到内置 polyfill；safePromiseWithResolvers 同理对应 Promise.withResolvers。",
        en: "safePromiseTry prefers the native Promise.try and falls back to a built-in polyfill; safePromiseWithResolvers mirrors Promise.withResolvers the same way.",
      })}
    >
      <Controls>
        <Button onClick={runTry}>{t({zh: "同步返回", en: "sync return"})}</Button>
        <Button onClick={runThrow} tone="ghost">
          {t({zh: "同步抛错", en: "sync throw"})}
        </Button>
        <Button onClick={runDeferred} tone="ghost">
          {t({zh: "创建 deferred", en: "create deferred"})}
        </Button>
        <Button onClick={resolveDeferred} disabled={!deferredRef.current} tone="ghost">
          resolve(7)
        </Button>
      </Controls>
      <Output>
        {log.length === 0 ? (
          <Muted>{t({zh: "点上面的按钮。", en: "Click the buttons."})}</Muted>
        ) : (
          log.map((line, index) => <div key={index}>{line}</div>)
        )}
      </Output>
    </Demo>
  );
};

export const FoundationsDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              这一页是几个体量很小、但到处都在用的基础工具：className 合并、日期格式化、计数器、子节点遍历、
              Promise 兼容层与断点常量。它们各自都只有一个函数或常量，合在一起看更省事。
            </>
          ),
          en: (
            <>
              This page collects the small utilities used everywhere: className merging, date
              formatting, a counter, child iteration, Promise compatibility helpers, and the breakpoint
              constants. Each is a single function or constant, so they are easier to read together.
            </>
          ),
        })}
      </P>

      <Section title={t({zh: "1. cx:className 合并", en: "1. cx: className merging"})}>
        <CxDemo />
        <Code
          code={`import { cx } from "@wwog/react";

cx("btn", isActive && "btn-active");          // "btn btn-active"
cx(["btn", "btn-lg"]);                        // 数组展开
cx({ btnDisabled: disabled, btnLarge: false }); // 只有 true 的键被采纳
cx("btn", "btn");                             // 去重后 "btn"`}
          caption={t({
            zh: "输入类型为 string | string[] | Record<string, boolean> | undefined | null | false。",
            en: "Input type is string | string[] | Record<string, boolean> | undefined | null | false.",
          })}
        />
      </Section>

      <Section title={t({zh: "2. formatDate:按 schema 格式化", en: "2. formatDate: schema-based formatting"})}>
        <FormatDateDemo />
        <Code
          code={`import { formatDate } from "@wwog/react";

formatDate("YYYY-MM-DD");          // 2026-09-11
formatDate("MMM D, YYYY", date);   // Sep 11, 2026
formatDate("dddd HH:mm:ss");       // Thursday 09:30:00
formatDate("hh:mm A");             // 09:30 AM

formatDate("YYYY-MM-DD", new Date("2026-01-02")); // 第二个参数省略时用当前时间`}
        />
        <ApiTable
          head={[t({zh: "片段", en: "token"}), t({zh: "输出", en: "output"}), t({zh: "片段", en: "token"}), t({zh: "输出", en: "output"})]}
          rows={[
            [<InlineCode>YY / YYYY</InlineCode>, t({zh: "两位 / 四位年", en: "2- / 4-digit year"}), <InlineCode>M / MM</InlineCode>, t({zh: "月 1-12 / 01-12", en: "month 1-12 / 01-12"})],
            [<InlineCode>MMM / MMMM</InlineCode>, t({zh: "月缩写 / 全称", en: "abbr / full month"}), <InlineCode>D / DD</InlineCode>, t({zh: "日 1-31 / 01-31", en: "day 1-31 / 01-31"})],
            [<InlineCode>d / dd</InlineCode>, t({zh: "星期 0-6 / Su-Sa", en: "weekday 0-6 / Su-Sa"}), <InlineCode>ddd / dddd</InlineCode>, t({zh: "星期缩写 / 全称", en: "short / full weekday"})],
            [<InlineCode>H / HH</InlineCode>, t({zh: "24 小时制", en: "24-hour"}), <InlineCode>h / hh</InlineCode>, t({zh: "12 小时制", en: "12-hour"})],
            [<InlineCode>m / mm</InlineCode>, t({zh: "分钟", en: "minute"}), <InlineCode>s / ss</InlineCode>, t({zh: "秒", en: "second"})],
            [<InlineCode>SSS</InlineCode>, t({zh: "毫秒", en: "millisecond"}), <InlineCode>A / a</InlineCode>, t({zh: "AM / am", en: "AM / am"})],
            [<InlineCode>Z / ZZ</InlineCode>, t({zh: "+08:00 / +0800（写死）", en: "+08:00 / +0800 (hard-coded)"}), <InlineCode>—</InlineCode>, "—"],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. Counter:自增序号", en: "3. Counter: an incrementing id"})}>
        <CounterDemo />
        <Code
          code={`import { Counter } from "@wwog/react";

const counter = new Counter();
counter.next(); // 0
counter.next(); // 1
counter.count;  // 2`}
        />
      </Section>

      <Section title={t({zh: "4. childrenLoop:可中断的遍历", en: "4. childrenLoop: an interruptible iteration"})}>
        <ChildrenLoopDemo />
        <Code
          code={`import { childrenLoop } from "@wwog/react";

// 回调返回 false 即可中断 —— Switch 的非严格模式靠它做 early exit
childrenLoop(children, (child, index) => {
  if (match(child)) return false;
});

// 等价于 React.Children.forEach,但支持中断
React.Children.forEach(children, (child, index) => {
  // 无法中断
});`}
        />
      </Section>

      <Section title={t({zh: "5. Promise 兼容层", en: "5. Promise compatibility helpers"})}>
        <PromiseDemo />
        <Code
          code={`import { safePromiseTry, safePromiseWithResolvers } from "@wwog/react";

// 同步返回值、抛错或返回 Promise 都能包成一个 Promise
safePromiseTry(() => 42);              // fulfilled
safePromiseTry(() => { throw new Error("boom"); }); // rejected，而不是同步抛出
safePromiseTry((a, b) => a + b, 1, 2); // 额外参数会被透传

// Promise.withResolvers 的兼容版本
const { promise, resolve, reject } = safePromiseWithResolvers<number>();`}
          caption={t({
            zh: "两者都优先使用运行时的原生实现；库发布了 src 源码，这样无需依赖特定的 TypeScript lib 配置即可通过类型检查。",
            en: "Both prefer the runtime's native implementation; because the library ships its src, this keeps consuming projects compiling without a specific TypeScript lib setting.",
          })}
        />
      </Section>

      <Section title={t({zh: "6. 断点常量", en: "6. Breakpoint constants"})}>
        <Callout>
          {t({
            zh: (
              <>
                <InlineCode>breakpoints</InlineCode> 与 <InlineCode>DefBreakpointDesc</InlineCode> 是响应式
                体系的基础，<InlineCode>useScreen</InlineCode>（hooks 分组）与{" "}
                <InlineCode>SizeBox</InlineCode>（组件分组）都建立在它们之上。
              </>
            ),
            en: (
              <>
                <InlineCode>breakpoints</InlineCode> and <InlineCode>DefBreakpointDesc</InlineCode>{" "}
                underpin the responsive layer: <InlineCode>useScreen</InlineCode> (hooks group) and{" "}
                <InlineCode>SizeBox</InlineCode> (components group) are built on them.
              </>
            ),
          })}
        </Callout>
        <Code
          code={`import { breakpoints, DefBreakpointDesc } from "@wwog/react";
import type { BreakpointName, Responsive } from "@wwog/react";

breakpoints;        // ["base", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"]
DefBreakpointDesc;  // { xs: 475, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536, "3xl": 1920 }

// Responsive<T>:要么给单值,要么按断点给值
const width: Responsive<number> = { base: 1, md: 2 };`}
        />
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>breakpoints</InlineCode>, "readonly string[]", t({zh: "断点名称，由小到大。", en: "Breakpoint names, smallest first."})],
            [
              <InlineCode>DefBreakpointDesc</InlineCode>,
              <InlineCode>BreakpointDesc</InlineCode>,
              t({zh: "默认断点像素阈值。", en: "Default breakpoint pixel thresholds."}),
            ],
            [<InlineCode>BreakpointName</InlineCode>, t({zh: "联合类型", en: "union type"}), t({zh: "断点名的联合。", en: "Union of breakpoint names."})],
            [<InlineCode>BreakpointDesc</InlineCode>, t({zh: "Partial 映射", en: "Partial map"}), t({zh: "断点 → 阈值。", en: "Breakpoint to threshold."})],
            [<InlineCode>Responsive&lt;T&gt;</InlineCode>, t({zh: "泛型", en: "generic"}), t({zh: "单值或按断点的值。", en: "A single value or a per-breakpoint map."})],
          ]}
        />
        <Controls>
          <Label>{t({zh: "默认阈值", en: "defaults"})}</Label>
          {breakpoints
            .filter((name) => name !== "base")
            .map((name) => (
              <Muted key={name}>
                {name}:{DefBreakpointDesc[name]}
              </Muted>
            ))}
        </Controls>
      </Section>
    </div>
  );
};
