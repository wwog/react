import {useRef, useState, type FC} from "react";
import {createExternalState, createStorageState, type ExternalState} from "../../../../src";
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
        zh: "createStorageState 在 createExternalState 之上，把 set 的结果 JSON 序列化写入存储；刷新页面后初值从存储恢复。",
        en: "createStorageState layers on createExternalState: every set is JSON-serialized into storage, and the initial value is restored from storage on reload.",
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

      <Section title={t({zh: "3. 持久化:createStorageState", en: "3. Persistence: createStorageState"})}>
        <StorageDemo />
        <Code
          code={`import { createStorageState } from "@wwog/react";

// 每次 set 都会 JSON 序列化写入 localStorage;刷新后从存储恢复初值
const note = createStorageState("app-note", "");

// 或 sessionStorage
const draft = createStorageState("draft", "", { storageType: "session" });`}
          caption={t({
            zh: "存储值解析失败时回退到 initialState 并 console.warn；SSR 环境（无 window）下不读写存储。",
            en: "A parse failure falls back to initialState with a console.warn; in SSR (no window) storage is not touched.",
          })}
        />
      </Section>

      <Section title={t({zh: "4. API 参考", en: "4. API reference"})}>
        <P>
          <InlineCode>createExternalState(initialState, options?)</InlineCode>
        </P>
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>get()</InlineCode>, t({zh: "读取当前值。", en: "Read the current value."})],
            [
              <InlineCode>set(next)</InlineCode>,
              t({zh: "写入新值或 updater 函数 (prev) => next。", en: "Write a value or an updater (prev) => next."}),
            ],
            [
              <InlineCode>useState()</InlineCode>,
              t({zh: "返回 [value, set]，用法同 React useState。", en: "Returns [value, set], like React useState."}),
            ],
            [
              <InlineCode>useGetter()</InlineCode>,
              t({zh: "只订阅并返回 value。", en: "Subscribe to and return the value only."}),
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
              t({zh: "使用 localStorage 或 sessionStorage。", en: "Use localStorage or sessionStorage."}),
            ],
            [
              <InlineCode>onSet</InlineCode>,
              <InlineCode>callback</InlineCode>,
              t({zh: "写入存储之后调用。", en: "Called after writing to storage."}),
            ],
            [<InlineCode>onChange</InlineCode>, <InlineCode>callback</InlineCode>, t({zh: "透传给 createExternalState。", en: "Passed through to createExternalState."})],
          ]}
        />
      </Section>
    </div>
  );
};
