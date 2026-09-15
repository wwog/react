import React, {useRef, useState, type CSSProperties, type FC} from "react";
import {Emitter, useEvent, useEventCallback, useEventValue} from "../../../../src";
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

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: "#fff",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};

/** 一个用 useEvent 订阅的子组件：订阅随它的挂载/卸载建立与释放。 */
const Subscriber: FC<{
  emitter: Emitter<string>;
  id: number;
  onMessage: (line: string) => void;
}> = ({emitter, id, onMessage}) => {
  useEvent(emitter.event, (message) => onMessage(`订阅者 ${id} 收到 ${message}`));
  return <span style={chip}>订阅者 {id}</span>;
};

/**
 * 场景 A：订阅跟着组件生死。被移除的订阅者立刻不再收到事件——因为它的订阅随卸载一起被退掉了。
 */
const SubscriptionOwnerDemo: FC = () => {
  const {t} = useI18n();
  const [emitter] = useState(() => new Emitter<string>());
  const [ids, setIds] = useState<number[]>([1, 2]);
  const [next, setNext] = useState(3);
  const [sent, setSent] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  // 稳定回调：子组件的 handler 里用到它，但它不必随父组件重渲染而变化
  const append = useEventCallback((line: string) => {
    setLog((previous) => [line, ...previous].slice(0, 6));
  });

  return (
    <Demo
      title={t({zh: "示例:订阅随组件生死", en: "Demo: subscriptions follow the component"})}
      hint={t({
        zh: "移除某个订阅者之后再触发，只有还在的订阅者会收到——没有人为退订写一行代码。",
        en: "Remove a subscriber, then fire: only the ones still mounted receive it — nobody wrote an unsubscribe by hand.",
      })}
    >
      <Controls>
        <Button
          onClick={() => {
            setIds((previous) => [...previous, next]);
            setNext((value) => value + 1);
          }}
        >
          {t({zh: "添加订阅者", en: "add subscriber"})}
        </Button>
        <Button onClick={() => setIds((previous) => previous.slice(0, -1))} tone="ghost">
          {t({zh: "移除最后一个", en: "remove last"})}
        </Button>
        <Button
          onClick={() => {
            const value = sent + 1;
            setSent(value);
            emitter.fire(`msg${value}`);
          }}
          tone="ghost"
        >
          {t({zh: "触发一次", en: "fire"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap"}}>
        {ids.length === 0 ? (
          <Muted>{t({zh: "（没有订阅者了）", en: "(nobody subscribed)"})}</Muted>
        ) : (
          ids.map((id) => <Subscriber key={id} emitter={emitter} id={id} onMessage={append} />)
        )}
      </div>

      <div style={{marginTop: 12}}>
        <Label>{t({zh: "收到的内容", en: "received"})}</Label>
        <Output>
          {log.length === 0 ? (
            <Muted>{t({zh: "（还没有）", en: "(nothing yet)"})}</Muted>
          ) : (
            log.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
          )}
        </Output>
      </div>
    </Demo>
  );
};

/** 场景 B：把事件变成可渲染的值。组件自己不存状态，只保存「最近一次载荷」。 */
const ProgressDemo: FC = () => {
  const {t} = useI18n();
  const [uploader] = useState(() => new Emitter<number>());
  const percent = useEventValue(uploader.event, 0);

  return (
    <Demo
      title={t({zh: "示例:事件驱动的值", en: "Demo: a value driven by an event"})}
      hint={t({
        zh: "组件里没有 useState、没有订阅代码：进度从事件来，值可直接渲染。",
        en: "No useState and no subscription code in the component: progress comes from the event and renders straight away.",
      })}
    >
      <Controls>
        <Button onClick={() => uploader.fire(Math.min(100, percent + 20))}>
          {t({zh: "推进 20%", en: "advance 20%"})}
        </Button>
        <Button onClick={() => uploader.fire(100)} tone="ghost">
          {t({zh: "完成", en: "finish"})}
        </Button>
        <Button onClick={() => uploader.fire(0)} tone="ghost">
          {t({zh: "重置", en: "reset"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", alignItems: "center", gap: 12}}>
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 999,
            background: colors.accentSoft,
            border: `1px solid ${colors.accentBorder}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: colors.accent,
              transition: "width 120ms linear",
            }}
          />
        </div>
        <span style={chip}>{percent}%</span>
      </div>
    </Demo>
  );
};

/**
 * 回调引用探针：回答「同一个子组件前后见过几个不同的回调引用」。
 *
 * 用「见过多少个引用」而不是「变没变」：后者需要在渲染期比较并写回上一次的引用，而 StrictMode 会把
 * 渲染跑两遍——第一遍写进去的新引用会被第二遍当成「上一次」的，于是提交出来的那一轮永远显示「没变」。
 * 这里的 Set 只做累加、不参与判断，因此两种模式下的结果都可靠，也不会引起重渲染（不会自激）。
 */
const ReferenceProbe: FC<{label: string; callback: (value: number) => number}> = ({
  label,
  callback,
}) => {
  const {t} = useI18n();
  const seen = useRef(new Set<unknown>()).current;
  seen.add(callback);
  const stable = seen.size === 1;

  return (
    <div
      style={{
        flex: "1 1 220px",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: "#fff",
      }}
    >
      <Label>{label}</Label>
      <div style={{marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap"}}>
        <span style={stable ? chip : {...chip, borderColor: colors.warnBorder, color: colors.warn}}>
          {stable
            ? t({zh: "引用唯一", en: "one reference"})
            : t({zh: `已见过 ${seen.size} 个引用`, en: `${seen.size} references seen`})}
        </span>
        <span style={chip}>× 10 = {callback(10)}</span>
      </div>
    </div>
  );
};

/** 场景 C：回调引用稳定，但仍然读到最新一次渲染的闭包。 */
const StableCallbackDemo: FC = () => {
  const {t} = useI18n();
  const [step, setStep] = useState(1);

  // 稳定引用 + 最新闭包：只建一次，但调用时读到的 step 是当前值
  const stable = useEventCallback((value: number) => value * step);

  return (
    <Demo
      title={t({zh: "示例:稳定引用 + 最新闭包", en: "Demo: stable reference, fresh closure"})}
      hint={t({
        zh: "点几次「重渲染父组件」：左边每轮渲染都产生新引用（数字一直涨），右边从头到尾只有一个——但两者算出的结果都跟着最新的 step。",
        en: "Press re-render a few times: the left side produces a new reference on every render (the count climbs) while the right stays at one — yet both compute with the latest step.",
      })}
    >
      <Controls>
        <Button onClick={() => setStep((previous) => previous + 1)}>
          {t({zh: `重渲染父组件（step = ${step}）`, en: `re-render parent (step = ${step})`})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap"}}>
        <ReferenceProbe
          label={t({zh: "内联箭头函数", en: "inline arrow"})}
          callback={(value) => value * step}
        />
        <ReferenceProbe label="useEventCallback" callback={stable} />
      </div>
    </Demo>
  );
};

export const UseEventDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              事件系统本身与框架无关，落到 React 里只有三件事反复出现：订阅要跟着组件生死、
              「最近发生的事」要能参与渲染、回调既要引用稳定又要读到最新 props。这三个 hook 各管一件，
              其余交给已有的工具（状态用 <InlineCode>createExternalState</InlineCode>，回放用{" "}
              <InlineCode>Event.buffer</InlineCode>，订阅归属用 <InlineCode>DisposableStore</InlineCode>）。
            </>
          ),
          en: (
            <>
              The event system is framework-free; in React only three things keep coming up: a
              subscription must follow the component's life, "the last thing that happened" must be
              renderable, and a callback must be both stable and fresh. One hook covers each — everything
              else stays with the tools that already exist (state with{" "}
              <InlineCode>createExternalState</InlineCode>, replay with{" "}
              <InlineCode>Event.buffer</InlineCode>, ownership with <InlineCode>DisposableStore</InlineCode>).
            </>
          ),
        })}
      </P>

      <ApiTable
        head={[
          t({zh: "场景", en: "situation"}),
          t({zh: "用", en: "use"}),
          t({zh: "要点", en: "key point"}),
        ]}
        rows={[
          [
            t({
              zh: "组件要跟着外部事件更新（socket、键盘、外部 store）",
              en: "A component follows an external event (socket, keyboard, an external store)",
            }),
            <InlineCode>{"useEvent(event, handler)"}</InlineCode>,
            t({
              zh: "挂载订阅、卸载退订；回调始终是最新闭包，重渲染不重订阅。",
              en: "Subscribe on mount, unsubscribe on unmount; the handler is always the latest closure and a re-render never resubscribes.",
            }),
          ],
          [
            t({
              zh: "事件要变成可渲染的值（进度、最近一条错误）",
              en: "An event should become a renderable value (progress, last error)",
            }),
            <InlineCode>{"useEventValue(event, initial)"}</InlineCode>,
            t({
              zh: "保存最近一次载荷；值真的变了才重渲染交给 Event.latch。",
              en: "Keeps the last payload; leave \"only when it really changed\" to Event.latch.",
            }),
          ],
          [
            t({
              zh: "回调要传给子组件或工具，又不想每轮都换引用",
              en: "A callback goes to a child or a utility and must not change every render",
            }),
            <InlineCode>useEventCallback</InlineCode>,
            t({
              zh: "替代为了稳定身份而维护整条依赖数组的 useCallback。",
              en: "Replaces the useCallback whose whole point is to keep the identity stable.",
            }),
          ],
          [
            t({
              zh: "需要跨组件共享、持久化的状态",
              en: "State shared across components, maybe persisted",
            }),
            <InlineCode>createExternalState</InlineCode>,
            t({
              zh: "不是 hook 的活：那是状态，不是事件。",
              en: "Not a hook's job: that is state, not an event.",
            }),
          ],
        ]}
      />

      <Section title={t({zh: "A. 订阅跟着组件生死", en: "A. The subscription follows the component"})}>
        <P>
          {t({
            zh: (
              <>
                最容易写错的是「什么时候退订」：外部事件源（全局 socket、模块级 store、DOM）比组件活得久，
                忘记退订就会把已卸载组件的闭包留在源上。<InlineCode>useEvent</InlineCode> 把订阅建在 effect
                里、退订写在清理函数里，因此组件在，订阅就在；组件不在，订阅自动摘掉。
              </>
            ),
            en: (
              <>
                The easy part to get wrong is *when* to unsubscribe: an external source (a global socket,
                a module-level store, the DOM) outlives the component, so a forgotten unsubscribe keeps a
                mounted-away component's closure alive on it. <InlineCode>useEvent</InlineCode> subscribes
                inside an effect and unsubscribes in the cleanup, so the subscription lives exactly as
                long as the component.
              </>
            ),
          })}
        </P>
        <Code
          code={`function Chat() {
  const [messages, setMessages] = useState<string[]>([])
  // 没有 useEffect、没有退订代码，也没有依赖数组要维护
  useEvent(socket.onMessage, (message) => {
    setMessages((all) => [...all, message])
  })
  return <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
}`}
        />
        <SubscriptionOwnerDemo />
      </Section>

      <Section
        title={t({
          zh: "B. 事件变成可渲染的值",
          en: "B. An event becomes a renderable value",
        })}
      >
        <P>
          {t({
            zh: (
              <>
                <InlineCode>useEvent</InlineCode> 的回调里可以 <InlineCode>setState</InlineCode>，但每个
                「最近一条」都要自己写一次 <InlineCode>useState</InlineCode> 太啰嗦。
                <InlineCode>useEventValue</InlineCode> 就是这件事：保存最近一次载荷并重渲染。
                它是组件本地的「最后一次载荷」而不是状态存储——要反映全局状态请用{" "}
                <InlineCode>createExternalState</InlineCode> + <InlineCode>useSelector</InlineCode>。
              </>
            ),
            en: (
              <>
                You can <InlineCode>setState</InlineCode> inside a{" "}
                <InlineCode>useEvent</InlineCode> handler, but writing a <InlineCode>useState</InlineCode>{" "}
                for every "last one" gets old. <InlineCode>useEventValue</InlineCode> is exactly that:
                keep the most recent payload and re-render. It is a component-local "last payload", not a
                state store — for global state use <InlineCode>createExternalState</InlineCode> +{" "}
                <InlineCode>useSelector</InlineCode>.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 带节奏的输入:先合并，再渲染（组合子负责语义，hook 保持哑）
const text = useEventValue(Event.debounce<string, string>(input.event, (_l, v) => v, 300), "")

// 值真的变了才重渲染
const status = useEventValue(Event.latch(socket.onStatus), "idle")`}
        />
        <Callout>
          {t({
            zh: (
              <>
                React 按 <InlineCode>Object.is</InlineCode> 比较新旧值，所以同一个引用连续触发两次只重渲染
                一次。要「每次触发都算数」就在事件上自增（<InlineCode>Event.map(ev, () =&gt; n++)</InlineCode>），
                而不是给 hook 加参数。
              </>
            ),
            en: (
              <>
                React compares with <InlineCode>Object.is</InlineCode>, so firing twice with the same
                reference re-renders once. When every fire must count, count in the event (
                <InlineCode>Event.map(ev, () =&gt; n++)</InlineCode>) rather than adding a flag to the hook.
              </>
            ),
          })}
        </Callout>
        <ProgressDemo />
      </Section>

      <Section
        title={t({zh: "C. 稳定引用 + 最新闭包", en: "C. Stable reference, fresh closure"})}
      >
        <P>
          {t({
            zh: (
              <>
                <InlineCode>useCallback</InlineCode> 为了「别变」得牺牲「新」：依赖数组写全了引用才稳，
                写漏了就读到旧值。<InlineCode>useEventCallback</InlineCode> 让这件事不再二选一——
                引用在整个生命周期内不变，调用时读到的却是当次渲染的 props / state。
              </>
            ),
            en: (
              <>
                <InlineCode>useCallback</InlineCode> trades freshness for stability: keep the dependency
                list complete and the reference holds, miss one entry and it reads stale values.{" "}
                <InlineCode>useEventCallback</InlineCode> removes the trade-off — one reference for the
                whole lifetime, reading the current render's props/state when called.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 子组件只在 onSelect 变化时重订阅 → 内联箭头会每轮重订阅
<List onSelect={(id) => select(id, filter)} />

// 引用稳定,但 select 里读到的是最新的 filter
const onSelect = useEventCallback((id: string) => select(id, filter))
<List onSelect={onSelect} />

// 传给已有的调度工具同样受益(它们都要求回调引用稳定)
const save = useEventCallback(() => persist(draft))
const saveDebounced = useMemo(() => debounce(save, 300), [save])`}
        />
        <StableCallbackDemo />
      </Section>

      <Section title={t({zh: "D. 注意与边界", en: "D. Cautions and boundaries"})}>
        <ApiTable
          head={[t({zh: "注意", en: "caution"}), t({zh: "原因", en: "why"})]}
          rows={[
            [
              t({zh: "事件必须是稳定引用", en: "The event must be a stable reference"}),
              t({
                zh: "emitter.event 是缓存的，可以直接传；Event.map(ev, fn) 每次调用都是新事件——放进 useMemo 或绑到 store，否则每轮渲染都换源。",
                en: "emitter.event is cached and safe inline; Event.map(ev, fn) returns a new event per call — put it in useMemo or bind it to a store, or every render swaps the source.",
              }),
            ],
            [
              t({
                zh: "渲染到 effect 之间的事件会丢",
                en: "Fires between render and the effect are lost",
              }),
              t({
                zh: "事件是热的。要缓冲用 Event.buffer；要「先有值再跟变更」用 useEventValue 或 ValueWithChangeEvent。",
                en: "Events are hot. Buffer with Event.buffer; for \"a current value plus changes\" use useEventValue or ValueWithChangeEvent.",
              }),
            ],
            [
              t({zh: "StrictMode 下不要自己管 store", en: "Do not own a store yourself under StrictMode"}),
              t({
                zh: "effect 会双跑（挂载 → 卸载 → 再挂载）：把 store 建在 useMemo/useRef 里再在清理函数里 dispose，第二次挂载拿到的就是已释放的 store。让 hook 管，或把 store 建在 effect 内部。",
                en: "Effects run twice (mount → unmount → mount): a store created in useMemo/useRef and disposed in the cleanup is already released on the second mount. Let the hook own it, or create the store inside the effect.",
              }),
            ],
            [
              t({zh: "条件订阅用 Event.None", en: "Conditional subscriptions use Event.None"}),
              t({
                zh: "useEvent(enabled ? event : Event.None, handler)：没有额外参数，Event.None 是稳定单例，订阅它零成本。",
                en: "useEvent(enabled ? event : Event.None, handler): no extra parameter, and Event.None is a stable singleton whose subscription costs nothing.",
              }),
            ],
            [
              t({
                zh: "不要用 useEvent 冒充状态",
                en: "Do not use useEvent as a state substitute",
              }),
              t({
                zh: "「当前选中项」这类要能被随时读到的值属于状态，用 createExternalState / ValueWithChangeEvent；事件只表达「发生了」。",
                en: "\"The currently selected item\" is state — anything that must be readable at any time belongs to createExternalState / ValueWithChangeEvent; an event only expresses that something happened.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
