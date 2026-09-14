import {useRef, useState, type FC, type ReactNode} from "react";
import {createExternalState, createStorageState, shallowEqual, type ExternalState} from "../../../../src";
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

type Theme = "light" | "dark";

/**
 * 模块级单例：状态活在组件树之外，任何组件 import 它都能读写同一份值。
 * 这里刻意放在模块作用域，就是为了演示「跨组件、跨层级共享」。
 */
const themeState = createExternalState<Theme>("light");

/** 一个只读消费者：用 useGetter 只取 value，不拿 setter。 */
const ThemeReadout: FC<{title: string}> = ({title}) => {
  const {t} = useI18n();
  const theme = themeState.useGetter();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 150,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: "#fff",
      }}
    >
      <div style={{fontSize: 12, color: colors.muted}}>{title}</div>
      <div style={{fontSize: 20, fontWeight: 600, marginTop: 4}}>{theme}</div>
      <div style={{fontSize: 12, color: colors.muted, marginTop: 4}}>
        {t({zh: "useGetter() · 只读", en: "useGetter() · read-only"})}
      </div>
    </div>
  );
};

/** 一个可读写消费者：useState 返回 [value, set]，与 React useState 用法一致。 */
const ThemeConsumer: FC<{title: string}> = ({title}) => {
  const {t} = useI18n();
  const [theme, setTheme] = themeState.useState();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 150,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: theme === "dark" ? "#111827" : "#fff",
        color: theme === "dark" ? "#e5e7eb" : colors.text,
      }}
    >
      <div style={{fontSize: 12, opacity: 0.7}}>{title}</div>
      <div style={{fontSize: 20, fontWeight: 600, marginTop: 4}}>{theme}</div>
      <button
        type="button"
        onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        style={{
          marginTop: 8,
          padding: "5px 10px",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: theme === "dark" ? "#1f2937" : "#fff",
          color: "inherit",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
        }}
      >
        {t({zh: "切换", en: "toggle"})}
      </button>
    </div>
  );
};

const SharedDemo: FC = () => {
  const {t} = useI18n();
  const [showSecond, setShowSecond] = useState(true);

  return (
    <Demo
      title={t({zh: "示例:两个互不相邻的组件共享同一份状态", en: "Demo: two unrelated components sharing one state"})}
      hint={t({
        zh: "state 定义在模块作用域，不在任何 Provider 里。任一消费者切换主题，其他消费者同步更新；把其中一个卸载再挂载，值也不会丢。",
        en: "The state lives at module scope, outside any Provider. Toggling in one consumer updates the others; unmount and remount one and the value survives.",
      })}
    >
      <Controls>
        <Button onClick={() => setShowSecond((value) => !value)} tone="ghost">
          {showSecond ? t({zh: "卸载第二个消费者", en: "Unmount the second"}) : t({zh: "挂载第二个消费者", en: "Mount the second"})}
        </Button>
      </Controls>
      <div style={{display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap"}}>
        <ThemeConsumer title={t({zh: "消费者 A · useState()", en: "Consumer A · useState()"})} />
        {showSecond ? <ThemeConsumer title={t({zh: "消费者 B · useState()", en: "Consumer B · useState()"})} /> : null}
        <ThemeReadout title={t({zh: "只读者 C", en: "Readout C"})} />
      </div>
    </Demo>
  );
};

/**
 * onSet 每次 set 都触发（即使值没变），onChange 只在存储值真正变化时触发。
 * 用两个按钮把这条区别打出来。
 */
const CallbackDemo: FC = () => {
  const {t} = useI18n();
  const [log, setLog] = useState<string[]>([]);
  const [value, setValue] = useState(0);
  const storeRef = useRef<ExternalState<number> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createExternalState(0, {
      onSet: (next, prev) => setLog((prevLog) => [`onSet ${prev} → ${next}`, ...prevLog].slice(0, 7)),
      onChange: (next, prev) => setLog((prevLog) => [`onChange ${prev} → ${next}`, ...prevLog].slice(0, 7)),
    });
  }
  const store = storeRef.current;

  const writeSame = () => {
    store.set(value); // 值没变:onSet 触发,onChange 不触发
    setValue((prev) => prev);
  };
  const writeNext = () => {
    const next = value + 1;
    store.set(next); // 值变了:两者都触发
    setValue(next);
  };

  return (
    <Demo
      title={t({zh: "示例:onSet 与 onChange 的区别", en: "Demo: onSet vs onChange"})}
      hint={t({
        zh: "onSet 当作「有人调用了 set」的信号；onChange 当作「值真的变了」的信号，用 Object.is 判断。",
        en: "Treat onSet as 'someone called set'; onChange as 'the value actually changed', compared with Object.is.",
      })}
    >
      <Controls>
        <Label>
          {t({zh: "当前值", en: "value"})} <Muted>{value}</Muted>
        </Label>
        <Button onClick={writeSame} tone="ghost">
          {t({zh: `set 到相同值 (${value})`, en: `set to the same value (${value})`})}
        </Button>
        <Button onClick={writeNext}>{t({zh: "set 到新值", en: "set to a new value"})}</Button>
        <Button onClick={() => setLog([])} disabled={log.length === 0} tone="ghost">
          {t({zh: "清空日志", en: "Clear log"})}
        </Button>
      </Controls>
      <Output>
        {log.length === 0 ? (
          <Muted>{t({zh: "点上面的按钮看回调触发情况。", en: "Click the buttons to see the callbacks fire."})}</Muted>
        ) : (
          log.map((line, index) => <div key={index}>{line}</div>)
        )}
      </Output>
    </Demo>
  );
};

/**
 * 选择性订阅演示：一份对象状态，五个消费者各自订阅不同的切片。
 * 每张卡片显示自己的渲染次数——写一个字段，只有切片真的变了的卡片会 +1。
 */
const sliceState = createExternalState({name: "wwog", age: 1, theme: "light"});

const SliceCard: FC<{title: ReactNode; value: ReactNode; renders: number}> = ({title, value, renders}) => (
  <div
    style={{
      flex: 1,
      minWidth: 150,
      padding: 12,
      borderRadius: 10,
      border: `1px solid ${colors.border}`,
      background: "#fff",
    }}
  >
    <div style={{fontSize: 12, color: colors.muted}}>{title}</div>
    <div style={{fontSize: 18, fontWeight: 600, marginTop: 4}}>{value}</div>
    <div style={{fontSize: 12, color: colors.muted, marginTop: 4}}>
      renders: <strong style={{fontVariantNumeric: "tabular-nums"}}>{renders}</strong>
    </div>
  </div>
);

/** 演示用的渲染计数器：渲染次数写在 ref 里，不额外触发渲染。 */
const useRenderCount = () => {
  const renders = useRef(0);
  renders.current++;
  return renders.current;
};

const NameSliceCard: FC = () => {
  const {t} = useI18n();
  const name = sliceState.useSelector((s) => s.name);
  return (
    <SliceCard
      title={t({zh: "useSelector(s => s.name)", en: "useSelector(s => s.name)"})}
      value={name}
      renders={useRenderCount()}
    />
  );
};

const AgeSliceCard: FC = () => {
  const {t} = useI18n();
  const age = sliceState.useSelector((s) => s.age);
  return (
    <SliceCard
      title={t({zh: "useSelector(s => s.age)", en: "useSelector(s => s.age)"})}
      value={age}
      renders={useRenderCount()}
    />
  );
};

/** 合成对象：每次调用都是新引用，必须给 shallowEqual 才不会被误判成「变了」。 */
const ComposedSliceCard: FC = () => {
  const {t} = useI18n();
  const head = sliceState.useSelector((s) => ({name: s.name, age: s.age}), shallowEqual);
  return (
    <SliceCard
      title={t({zh: "({name, age}) + shallowEqual", en: "({name, age}) + shallowEqual"})}
      value={`${head.name} / ${head.age}`}
      renders={useRenderCount()}
    />
  );
};

const ThemeSliceCard: FC = () => {
  const {t} = useI18n();
  const theme = sliceState.useSelector((s) => s.theme);
  return (
    <SliceCard
      title={t({zh: "useSelector(s => s.theme)", en: "useSelector(s => s.theme)"})}
      value={theme}
      renders={useRenderCount()}
    />
  );
};

/** 对照组：整份 state 的消费者，任意字段变化都会重渲染。 */
const FullStateCard: FC = () => {
  const {t} = useI18n();
  const [full] = sliceState.useState();
  return (
    <SliceCard
      title={t({zh: "useState() 整份 state", en: "useState() whole state"})}
      value={`${full.name} / ${full.age} / ${full.theme}`}
      renders={useRenderCount()}
    />
  );
};

const SelectorDemo: FC = () => {
  const {t} = useI18n();

  return (
    <Demo
      title={t({zh: "示例:只订阅自己关心的字段", en: "Demo: subscribe to one slice only"})}
      hint={t({
        zh: "点按钮改字段，看每张卡片的 renders:改 theme 只有 theme 卡片和整份 state 卡片增加;改 name / age 会同时影响合成对象卡片。",
        en: "Write fields and watch the render counters: writing theme only bumps the theme card and the whole-state card, while name / age also affect the composed-object card.",
      })}
    >
      <Controls>
        <Button onClick={() => sliceState.set((prev) => ({...prev, name: `${prev.name}!`}))}>
          {t({zh: "改 name", en: "write name"})}
        </Button>
        <Button onClick={() => sliceState.set((prev) => ({...prev, age: prev.age + 1}))}>
          {t({zh: "改 age", en: "write age"})}
        </Button>
        <Button
          onClick={() =>
            sliceState.set((prev) => ({...prev, theme: prev.theme === "light" ? "dark" : "light"}))
          }
          tone="ghost"
        >
          {t({zh: "改 theme", en: "write theme"})}
        </Button>
      </Controls>
      <div style={{display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap"}}>
        <NameSliceCard />
        <AgeSliceCard />
        <ComposedSliceCard />
        <ThemeSliceCard />
        <FullStateCard />
      </div>
    </Demo>
  );
};

const storageRef = {current: null as ExternalState<string> | null};

const StorageDemo: FC = () => {
  const {t} = useI18n();
  const [raw, setRaw] = useState<string>(() => {
    try {
      return localStorage.getItem("wwog-demo-note") ?? "null";
    } catch {
      return "unavailable";
    }
  });

  if (!storageRef.current) {
    storageRef.current = createStorageState<string>("wwog-demo-note", "");
  }
  const [note, setNote] = storageRef.current.useState();

  const syncRaw = () => {
    try {
      setRaw(localStorage.getItem("wwog-demo-note") ?? "null");
    } catch {
      setRaw("unavailable");
    }
  };

  return (
    <Demo
      title={t({zh: "示例:写入 localStorage 的状态", en: "Demo: state persisted to localStorage"})}
      hint={t({
        zh: "createStorageState 在 createExternalState 之上，把 set 的结果 JSON 序列化写入存储；刷新页面后初值从存储恢复。序列化结果与已存内容相同时跳过写入。",
        en: "createStorageState layers on createExternalState: every set is JSON-serialized into storage, and the initial value is restored from storage on reload. A write whose serialized result matches what is stored is skipped.",
      })}
    >
      <Controls>
        <input
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            // onSet 在 set 内同步写入存储,因此这里可以立刻读到新值
            syncRaw();
          }}
          placeholder={t({zh: "输入内容…", en: "type something…"})}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            fontSize: 13,
            fontFamily: "inherit",
            minWidth: 220,
          }}
        />
        <Button onClick={syncRaw} tone="ghost">
          {t({zh: "读取存储原文", en: "Read raw storage"})}
        </Button>
        <Button
          onClick={() => {
            setNote("");
            syncRaw();
          }}
          tone="ghost"
        >
          {t({zh: "清空", en: "Clear"})}
        </Button>
      </Controls>
      <Output>
        <div>
          localStorage["wwog-demo-note"] = <strong>{raw}</strong>
        </div>
        <Muted>{t({zh: "刷新页面后，输入框会从这条存储里恢复。", en: "After a reload the input restores from this entry."})}</Muted>
      </Output>
    </Demo>
  );
};

/**
 * 跨标签页同步演示。真实的 storage 事件只在「其它标签页」写入时由浏览器触发,同一个标签页写入不会
 * 触发,所以这里手动派发一个 StorageEvent 来扮演另一个标签页,并如实把这件事写在界面上。
 */
const crossTabRef = {current: null as ExternalState<string> | null};

const CrossTabDemo: FC = () => {
  const {t} = useI18n();
  const [log, setLog] = useState<string[]>([]);

  if (!crossTabRef.current) {
    crossTabRef.current = createStorageState<string>("wwog-demo-crosstab", "", {
      syncAcrossTabs: true,
    });
  }
  const store = crossTabRef.current;
  const [note, setNote] = store.useState();

  const fakeOtherTab = (value: string | null) => {
    const key = "wwog-demo-crosstab";
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    // 派发一个与浏览器行为一致的 storage 事件(key 为 null 表示对方 clear())
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: value === null ? null : key,
        newValue: value === null ? null : JSON.stringify(value),
        storageArea: localStorage,
      })
    );
    setLog((prev) =>
      [value === null ? "其它标签页 removeItem / clear()" : `其它标签页写入 ${value}`, ...prev].slice(0, 5)
    );
  };

  return (
    <Demo
      title={t({zh: "示例:跟随其它标签页的写入", en: "Demo: following another tab's writes"})}
      hint={t({
        zh: "开启 syncAcrossTabs 后,其它标签页写入的值会经 set 同步进来。浏览器只在其它标签页写入时触发 storage 事件,所以下面两个按钮手动派发该事件来扮演另一个标签页。",
        en: "With syncAcrossTabs on, a value written by another tab is applied through set. The browser only fires storage events for other tabs' writes, so the buttons below dispatch one to play that role.",
      })}
    >
      <Controls>
        <Button onClick={() => fakeOtherTab("from-other-tab")}>
          {t({zh: "模拟其它标签页写入", en: "simulate another tab's write"})}
        </Button>
        <Button onClick={() => fakeOtherTab(null)} tone="ghost">
          {t({zh: "模拟其它标签页 clear()", en: "simulate another tab clearing"})}
        </Button>
        <Button onClick={() => store.set("local-write")} tone="ghost">
          {t({zh: "本标签页写入", en: "write from this tab"})}
        </Button>
      </Controls>
      <Output>
        <div>
          {t({zh: "当前值", en: "current value"})}: <strong>{note === "" ? "—" : note}</strong>
        </div>
        {log.map((line, index) => (
          <Muted key={index}>{line}</Muted>
        ))}
      </Output>
      <P>
        <Muted>
          {t({
            zh: "其它标签页写入的值不会被写回存储(否则两个标签页会来回弹);对方 clear() 时状态回到初值,同样不写回",
            en: "A remote value is never written back (otherwise the two tabs would bounce it back and forth); a remote clear() returns the state to the initial value, also without writing back.",
          })}
        </Muted>
      </P>
    </Demo>
  );
};

export const ExternalStateDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>createExternalState</InlineCode> 创建一份活在组件树之外的状态：模块级定义，
              任意位置的组件都能读写同一份值，无需 Provider、无层级穿透。它用{" "}
              <InlineCode>useSyncExternalStore</InlineCode> 订阅，因此并发渲染下读取安全。
            </>
          ),
          en: (
            <>
              <InlineCode>createExternalState</InlineCode> creates state that lives outside the
              component tree: define it at module scope and any component can read and write the same
              value — no Provider, no prop drilling. It subscribes via{" "}
              <InlineCode>useSyncExternalStore</InlineCode>, so reads are safe under concurrent
              rendering.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              它是<b>模块级单例</b>：同一次页面会话内只有一份。这对主题、当前用户、全局设置很合适；
              需要「按实例隔离」的状态（每个列表项、每个表单），仍应使用 React 自己的{" "}
              <InlineCode>useState</InlineCode>。
            </>
          ),
          en: (
            <>
              It is a <b>module-level singleton</b>: one value per page session. Great for theme, current
              user, global settings; per-instance state (each list row, each form) should still use
              React's own <InlineCode>useState</InlineCode>.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 跨组件共享", en: "1. Sharing across components"})}>
        <SharedDemo />
        <Code
          code={`import { createExternalState } from "@wwog/react";

// 模块作用域,组件树之外
const themeState = createExternalState<"light" | "dark">("light", {
  onChange: (next, prev) => console.log(prev + " -> " + next),
});

// 组件外的读写
themeState.get();
themeState.set("dark");
themeState.set((prev) => (prev === "light" ? "dark" : "light"));

// 组件内:与 useState 用法一致
function ThemeLabel() {
  const [theme, setTheme] = themeState.useState();
  return <span>{theme}</span>;
}

// 只想读值时
function Readout() {
  return <span>{themeState.useGetter()}</span>;
}`}
        />
      </Section>

      <Section title={t({zh: "2. 回调语义", en: "2. Callback semantics"})}>
        <CallbackDemo />
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "触发时机", en: "fires when"}), t({zh: "参数", en: "args"})]}
          rows={[
            [
              <InlineCode>onSet</InlineCode>,
              t({zh: "每次调用 set 后，即使值未变化。", en: "After every set call, even when the value is unchanged."}),
              <InlineCode>(newState, prevState)</InlineCode>,
            ],
            [
              <InlineCode>onChange</InlineCode>,
              t({zh: "仅当 Object.is(newState, prevState) 为 false。", en: "Only when Object.is(newState, prevState) is false."}),
              <InlineCode>(newState, prevState)</InlineCode>,
            ],
            [
              <InlineCode>notify</InlineCode>,
              t({
                zh: "'sync'(默认):set 返回前通知完毕。'microtask':同一轮任务内多次 set 只通知一次,中间态被跳过;onSet / onChange 仍逐次同步执行。",
                en: "'sync' (default): notification completes before set returns. 'microtask': several set calls in one task notify once and intermediate states are skipped, while onSet / onChange still run per set.",
              }),
              <InlineCode>{"'sync' | 'microtask'"}</InlineCode>,
            ],
          ]}
        />
        <P>
          <Muted>
            {t({
              zh: "回调可以返回 Promise：异步回调在状态更新之后执行，不会阻塞更新；抛错会以 catch 记录到 console.error，请把异步副作用放到 useEffect 里。",
              en: "Callbacks may return a Promise: async callbacks run after the state update without blocking it; a throw is caught and logged to console.error. Prefer useEffect for async side effects.",
            })}
          </Muted>
        </P>
      </Section>

      <Section title={t({zh: "3. 选择性订阅:useSelector", en: "3. Selective subscription: useSelector"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>useState()</InlineCode> 订阅整份 state，任一字段变化都会重渲染。用{" "}
                <InlineCode>useSelector(selector, isEqual?)</InlineCode> 只订阅自己关心的切片：
                切片没变就不重渲染。相等性默认是 <InlineCode>Object.is</InlineCode>，比较基准是上一次
                <b>已提交</b>的切片，因此每次 render 都换引用的内联 selector 既不会多渲染，也不会读到旧值。
              </>
            ),
            en: (
              <>
                <InlineCode>useState()</InlineCode> subscribes to the whole state and re-renders on any
                field. <InlineCode>useSelector(selector, isEqual?)</InlineCode> subscribes to one slice
                and skips the re-render when it is unchanged. Equality defaults to{" "}
                <InlineCode>Object.is</InlineCode> and compares against the last <b>committed</b> slice,
                so an inline selector whose identity changes every render neither over-renders nor reads
                a stale value.
              </>
            ),
          })}
        </P>
        <SelectorDemo />
        <Code
          code={`import { shallowEqual } from "@wwog/react";

const appState = createExternalState({ name: "wwog", age: 1, theme: "light" });

// 只订阅 name:改 age / theme 都不会让这个组件重渲染
function NameLabel() {
  const name = appState.useSelector((s) => s.name);
  return <span>{name}</span>;
}

// 合成对象:每次调用都是新引用,必须给相等函数
function HeadLabel() {
  const head = appState.useSelector((s) => ({ name: s.name, age: s.age }), shallowEqual);
  return (
    <span>
      {head.name} / {head.age}
    </span>
  );
}

// 组件外按切片订阅:切片没变就不会回调
const stop = appState.subscribeWithSelector(
  (s) => s.age,
  (age, prevAge) => console.log(prevAge + " -> " + age),
  { fireImmediately: false },
);
stop();`}
        />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                selector 返回<b>新对象 / 新数组</b>时（<InlineCode>{"s => ({a: s.a})"}</InlineCode>、
                <InlineCode>{"s => s.list.filter(...)"}</InlineCode>）默认的{" "}
                <InlineCode>Object.is</InlineCode> 永远判定为「变了」，无关字段变化也会重渲染——此时必须传{" "}
                <InlineCode>isEqual</InlineCode>（如 <InlineCode>shallowEqual</InlineCode>）。
                另外 <InlineCode>shallowEqual</InlineCode> 只逐键比较数组与普通对象；{" "}
                <InlineCode>Date</InlineCode> / <InlineCode>Map</InlineCode> / 类实例退化为引用比较，宁可多渲染
                一次，也不会漏掉更新。
              </>
            ),
            en: (
              <>
                A selector that returns a <b>new object / array</b> (
                <InlineCode>{"s => ({a: s.a})"}</InlineCode>,{" "}
                <InlineCode>{"s => s.list.filter(...)"}</InlineCode>) makes the default{" "}
                <InlineCode>Object.is</InlineCode> always report a change, so unrelated writes re-render
                too — pass an <InlineCode>isEqual</InlineCode> such as <InlineCode>shallowEqual</InlineCode>.
                Note that <InlineCode>shallowEqual</InlineCode> compares arrays and plain objects key-wise
                only; <InlineCode>Date</InlineCode> / <InlineCode>Map</InlineCode> / class instances fall
                back to reference equality, so it costs an extra render rather than a missed update.
              </>
            ),
          })}
        </Callout>
        <P>
          <Muted>
            {t({
              zh: "一次 set 仍会通知所有订阅者，但每个消费者只做一次切片比较，因此不相关组件付出的是比较成本而不是渲染成本；本库不做变更批处理，同一 tick 内 N 次 set 会通知 N 次，由此产生的重渲染交给 React 合并。set 必须返回新引用：原地修改与旧值 Object.is 相等，不会触发任何更新。",
              en: "A set still notifies every subscriber, but each consumer only compares its slice, so an unrelated component pays a comparison instead of a render. There is no change batching: N writes in one tick notify N times, and React coalesces the resulting renders. set must return a new reference — mutating in place is Object.is-equal to the previous value and updates nothing.",
            })}
          </Muted>
        </P>
        <P>
          <Muted>
            {t({
              zh: "开发构建下，若 selector 每次返回新引用但内容浅比较相等，控制台会按 hook 实例提示一次（建议传 isEqual）；生产构建里这段提示会被打包器消除。上面第一张卡片故意这么写，所以你会看到它。",
              en: "In development, a selector that returns a new reference with shallow-equal contents logs one hint per hook (suggesting isEqual); production builds drop it. The first card above is written that way on purpose, so you will see it.",
            })}
          </Muted>
        </P>
      </Section>

      <Section title={t({zh: "4. 持久化:createStorageState", en: "4. Persistence: createStorageState"})}>
        <StorageDemo />
        <Code
          code={`import { createStorageState } from "@wwog/react";

// 每次 set 都会 JSON 序列化写入 localStorage(序列化结果与已存内容相同时跳过);刷新后从存储恢复初值
const note = createStorageState("app-note", "");

// 或 sessionStorage
const draft = createStorageState("draft", "", { storageType: "session" });`}
          caption={t({
            zh: "存储值解析失败时回退到 initialState 并 console.warn；SSR 环境（无 window）下不读写存储。",
            en: "A parse failure falls back to initialState with a console.warn; in SSR (no window) storage is not touched.",
          })}
        />
        <CrossTabDemo />
      </Section>

      <Section title={t({zh: "5. API 参考", en: "5. API reference"})}>
        <P>
          <InlineCode>createExternalState(initialState, options?)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>get()</InlineCode>, t({zh: "读取当前值。", en: "Read the current value."})],
            [
              <InlineCode>set(next)</InlineCode>,
              t({
                zh: "写入新值或 updater 函数 (prev) => next；updater 必须返回新引用，原地修改不会触发更新。",
                en: "Write a value or an updater (prev) => next. An updater must return a new reference; mutating in place triggers nothing.",
              }),
            ],
            [
              <InlineCode>useState()</InlineCode>,
              t({zh: "返回 [value, set]，用法同 React useState。", en: "Returns [value, set], like React useState."}),
            ],
            [
              <InlineCode>useGetter()</InlineCode>,
              t({zh: "只订阅并返回 value。", en: "Subscribe to and return the value only."}),
            ],
            [
              <InlineCode>useSelector(selector, isEqual?)</InlineCode>,
              t({
                zh: "只订阅 selector 选出的切片;切片相等时不重渲染(默认 Object.is)。",
                en: "Subscribe to the slice returned by selector; no re-render while it compares equal (Object.is by default).",
              }),
            ],
            [
              <InlineCode>subscribe(listener)</InlineCode>,
              t({
                zh: "组件外订阅任意变化,返回退订函数。",
                en: "Subscribe to any change outside components; returns an unsubscribe function.",
              }),
            ],
            [
              <InlineCode>subscribeWithSelector(selector, listener, options?)</InlineCode>,
              t({
                zh: "组件外按切片订阅,切片没变就不回调;options 支持 isEqual 与 fireImmediately。",
                en: "Subscribe to a slice outside components; the listener is skipped while the slice is unchanged. options supports isEqual and fireImmediately.",
              }),
            ],
          ]}
        />
        <P>
          <InlineCode>createStorageState(key, initialState, options?)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>storageType</InlineCode>,
              <InlineCode>"local" | "session"</InlineCode>,
              t({zh: "使用 localStorage 或 sessionStorage,默认 local。", en: "Use localStorage or sessionStorage, local by default."}),
            ],
            [
              <InlineCode>syncAcrossTabs</InlineCode>,
              <InlineCode>boolean</InlineCode>,
              t({
                zh: "跟随其它标签页的写入,默认 false。远端值经 set 同步进来且不写回;对方 clear() 时回到初值且不写回。sessionStorage 收不到该事件。",
                en: "Follow writes from other tabs, false by default. A remote value is applied through set and never written back; a remote clear() returns to the initial value without writing back. sessionStorage gets no such event.",
              }),
            ],
            [
              <InlineCode>onSet</InlineCode>,
              <InlineCode>callback</InlineCode>,
              t({zh: "写入存储之后调用。", en: "Called after writing to storage."}),
            ],
            [<InlineCode>onChange</InlineCode>, <InlineCode>callback</InlineCode>, t({zh: "透传给 createExternalState。", en: "Passed through to createExternalState."})],
          ]}
        />
        <P>
          <InlineCode>shallowEqual(a, b)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>{"(a: unknown, b: unknown) => boolean"}</InlineCode>,
              t({
                zh: "数组与普通对象逐键 Object.is 浅比较,可直接作为 isEqual 传给 useSelector / subscribeWithSelector。",
                en: "One-level, key-wise Object.is compare for arrays and plain objects; pass it as isEqual to useSelector / subscribeWithSelector.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
