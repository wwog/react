import {useEffect, useState, type CSSProperties, type FC} from "react";
import {DisposableStore, Emitter, Event, ValueWithChangeEvent} from "../../../../src";
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

const codeChip: CSSProperties = {...chip, borderColor: colors.accentBorder, color: colors.accent};

/**
 * 场景 A：把「事情发生」和「谁关心」解耦。
 *
 * 订阅建在 effect 内部、退订写在返回的清理函数里。示例应用跑在 StrictMode 下，effect 会经历
 * 「挂载 → 卸载 → 再挂载」，把 store 放到 useMemo/useRef 里再在清理函数中 dispose，第二次挂载
 * 拿到的就是已释放的 store，订阅会静默失效——这正是本页强调「订阅要有归属」的原因。
 */
const SubscriptionDemo: FC = () => {
  const {t} = useI18n();
  const [emitter, setEmitter] = useState(() => new Emitter<number>());
  const [wanted, setWanted] = useState(0);
  const [active, setActive] = useState(0);
  const [fired, setFired] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [disposed, setDisposed] = useState(false);

  useEffect(() => {
    const store = new DisposableStore();
    for (let index = 0; index < wanted; index++) {
      const label = `L${index + 1}`;
      store.add(
        emitter.event((value) => {
          setLog((previous) => [`${label} ← ${value}`, ...previous].slice(0, 6));
        }),
      );
    }
    // 已释放的 emitter 上的订阅只是空操作，所以这里报的是「真正挂上去了几个」
    setActive(emitter.hasListeners() ? wanted : 0);

    return () => {
      store.dispose();
      setActive(0);
    };
  }, [emitter, wanted]);

  return (
    <Demo
      title={t({zh: "示例:订阅、触发、退订", en: "Demo: subscribe, fire, unsubscribe"})}
      hint={t({
        zh: "订阅者只管自己收到什么，不关心谁触发的。退订全部之后再触发就没有任何反应了。",
        en: "A subscriber only knows what it received, never who fired it. With nobody subscribed, firing does nothing at all.",
      })}
    >
      <Controls>
        <Button onClick={() => setWanted((previous) => previous + 1)}>
          {t({zh: "添加订阅者", en: "add subscriber"})}
        </Button>
        <Button
          onClick={() => {
            const value = fired + 1;
            setFired(value);
            emitter.fire(value);
          }}
          tone="ghost"
        >
          {t({zh: "触发一次", en: "fire"})}
        </Button>
        <Button onClick={() => setWanted(0)} tone="ghost">
          {t({zh: "退订全部", en: "unsubscribe all"})}
        </Button>
        <Button
          onClick={() => {
            emitter.dispose();
            setDisposed(true);
            setWanted(0);
            setActive(0);
          }}
          tone="ghost"
        >
          {t({zh: "销毁来源", en: "dispose source"})}
        </Button>
        <Button
          onClick={() => {
            setEmitter(new Emitter<number>());
            setWanted(0);
            setActive(0);
            setFired(0);
            setLog([]);
            setDisposed(false);
          }}
          tone="ghost"
        >
          {t({zh: "重置", en: "reset"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap"}}>
        <span style={chip}>
          {t({zh: "订阅中", en: "subscribed"})}: {active}
        </span>
        <span style={chip}>
          {t({zh: "已触发", en: "fired"})}: {fired}
        </span>
        {disposed && (
          <span style={{...chip, borderColor: colors.warnBorder, color: colors.warn}}>
            {t({zh: "来源已销毁", en: "source disposed"})}
          </span>
        )}
      </div>

      <Label>{t({zh: "订阅者收到的内容", en: "what subscribers received"})}</Label>
      <Output>
        {log.length === 0 ? (
          <Muted>{t({zh: "（还没有）", en: "(nothing yet)"})}</Muted>
        ) : (
          log.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
        )}
      </Output>
    </Demo>
  );
};

/**
 * 场景 C：同一个高频事件，两种处理节奏放在一起对比。
 */
const TimingDemo: FC = () => {
  const {t} = useI18n();
  const [emitter] = useState(() => new Emitter<number>());
  const [raw, setRaw] = useState(0);
  const [debounced, setDebounced] = useState(0);
  const [throttled, setThrottled] = useState(0);

  useEffect(() => {
    const store = new DisposableStore();
    store.add(
      Event.debounce<number, number>(emitter.event, (_last, e) => e, 300)((value) =>
        setDebounced(value),
      ),
    );
    store.add(
      Event.throttle<number, number>(emitter.event, (_last, e) => e, 300)((value) =>
        setThrottled(value),
      ),
    );
    return () => store.dispose();
  }, [emitter]);

  const fire = () => {
    const value = raw + 1;
    setRaw(value);
    emitter.fire(value);
  };

  return (
    <Demo
      title={t({zh: "示例:等停顿 vs 按节奏", en: "Demo: wait for silence vs keep a rhythm"})}
      hint={t({
        zh: "连点几下:防抖要等你停下来 300ms 才给出最后一个值;节流立刻放行第一次，之后每 300ms 汇总一次。",
        en: "Click several times: debounce only delivers the last value once you stop for 300 ms; throttle lets the first through at once and then reports once per 300 ms.",
      })}
    >
      <Controls>
        <Button onClick={fire}>{t({zh: "触发一次", en: "fire once"})}</Button>
        <Button
          onClick={() => {
            for (let i = 0; i < 5; i++) {
              fire();
            }
          }}
          tone="ghost"
        >
          {t({zh: "一口气触发 5 次", en: "fire 5×"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap"}}>
        <span>
          <Muted>{t({zh: "原始事件", en: "raw"})}</Muted> <strong>{raw}</strong>
        </span>
        <span>
          <Muted>debounce(300)</Muted> <strong>{debounced}</strong>
        </span>
        <span>
          <Muted>throttle(300)</Muted> <strong>{throttled}</strong>
        </span>
      </div>
    </Demo>
  );
};

/**
 * 场景 D：两个来源合成一个订阅。订阅方不需要知道消息从哪来，也不知道有几个来源。
 */
const MergeDemo: FC = () => {
  const {t} = useI18n();
  const [push] = useState(() => new Emitter<string>());
  const [poll] = useState(() => new Emitter<string>());
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const store = new DisposableStore();
    store.add(
      Event.any(push.event, poll.event)((message) =>
        setLog((previous) => [message, ...previous].slice(0, 5)),
      ),
    );
    return () => store.dispose();
  }, [push, poll]);

  return (
    <Demo
      title={t({zh: "示例:两个来源，一个订阅", en: "Demo: two sources, one subscription"})}
      hint={t({
        zh: "合并之后触发顺序就是到达顺序。以后再加第三个来源，订阅方一行都不用改。",
        en: "After merging, the order is arrival order. Adding a third source later changes nothing on the subscriber's side.",
      })}
    >
      <Controls>
        <Button onClick={() => push.fire("push: 有新消息")}>
          {t({zh: "来源一:推送", en: "source A: push"})}
        </Button>
        <Button onClick={() => poll.fire("poll: 拉到一条")} tone="ghost">
          {t({zh: "来源二:轮询", en: "source B: poll"})}
        </Button>
        <Button onClick={() => setLog([])} tone="ghost">
          {t({zh: "清空", en: "clear"})}
        </Button>
      </Controls>

      <Label>{t({zh: "合并事件收到的内容", en: "received on the merged event"})}</Label>
      <Output>
        {log.length === 0 ? (
          <Muted>{t({zh: "（还没有）", en: "(nothing yet)"})}</Muted>
        ) : (
          log.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
        )}
      </Output>
    </Demo>
  );
};

/**
 * 场景 F：值 + 变更通知。需要「随时可读」时，纯事件不够用。
 */
const ValueDemo: FC = () => {
  const {t} = useI18n();
  const [value] = useState(() => new ValueWithChangeEvent(0));
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    const subscription = value.onDidChange(() => setNotifications((previous) => previous + 1));
    return () => subscription.dispose();
  }, [value]);

  return (
    <Demo
      title={t({zh: "示例:随时可读的值", en: "Demo: a value you can read at any time"})}
      hint={t({
        zh: "通知不带值，需要时去读 .value。所以「读当前值」按钮不会引起任何变化，它只是把已有的值再读一遍。",
        en: "The notification carries no value — read .value when you need it. That is why the read button changes nothing: it just reads what is already there.",
      })}
    >
      <Controls>
        <Button
          onClick={() => {
            value.value = value.value + 1;
          }}
        >
          {t({zh: "写入新值", en: "write a new value"})}
        </Button>
        <Button
          onClick={() => {
            value.value = value.value;
          }}
          tone="ghost"
        >
          {t({zh: "写入相同的值", en: "write the same value"})}
        </Button>
        <Button
          onClick={() => {
            // 读一次当前值，什么也不会发生——这正是它和事件的区别
            if (value.value < 0) setNotifications((previous) => previous + 1);
          }}
          tone="ghost"
        >
          {t({zh: "读当前值（无事发生）", en: "read the value (nothing happens)"})}
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap"}}>
        <span style={codeChip}>
          {t({zh: "当前值", en: "value"})}: <strong>{value.value}</strong>
        </span>
        <span style={chip}>
          {t({zh: "变更通知次数", en: "notifications"})}: {notifications}
        </span>
      </div>
    </Demo>
  );
};

export const EventDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              事件表达的是「刚刚发生了某件事」，不是「当前是什么状态」。这个区别决定你该选哪套工具:
              事件的订阅者只能收到订阅之后发生的事，晚到的就是错过了;而状态随时可读，谁来读都是最新的。
            </>
          ),
          en: (
            <>
              An event expresses "something just happened", not "what the current state is". That
              distinction decides which tool you want: a subscriber only sees what happened after it
              subscribed — a late arrival has simply missed it — while state is readable at any time and
              is the same for everyone who reads it.
            </>
          ),
        })}
      </P>

      <ApiTable
        head={[
          t({zh: "你真正想要的", en: "what you actually want"}),
          t({zh: "用", en: "use"}),
          t({zh: "典型场景", en: "typical case"}),
        ]}
        rows={[
          [
            t({zh: "通知「刚刚发生了什么」", en: "announce what just happened"}),
            <InlineCode>Emitter</InlineCode>,
            t({
              zh: "保存完成、收到消息、用户点了某处——错过就错过了，补发反而奇怪。",
              en: "A save finished, a message arrived, a click landed — replaying it later would be odd, not helpful.",
            }),
          ],
          [
            t({zh: "「当前值」+「变了告诉我」", en: "a current value plus change notifications"}),
            <InlineCode>ValueWithChangeEvent</InlineCode>,
            t({
              zh: "选中的文件、主题、网络状态——新挂上来的组件要先能读到值，再跟着更新。",
              en: "The selected file, the theme, connectivity — a newly mounted component must read first, then stay updated.",
            }),
          ],
          [
            t({zh: "跨组件共享，甚至要持久化", en: "shared across components, maybe persisted"}),
            <InlineCode>createExternalState</InlineCode>,
            t({
              zh: "整个应用共享的状态，还能按字段粒度订阅(见「外部状态」一页)。",
              en: "App-wide state, subscribable per field (see the external state page).",
            }),
          ],
        ]}
      />

      <Callout>
        {t({
          zh: (
            <>
              本页的 <InlineCode>Emitter</InlineCode> / <InlineCode>Event</InlineCode> 完整迁移自 VS Code
              的 <InlineCode>src/vs/base/common/event.ts</InlineCode>(MIT)，事件语义逐条对齐;与它的差异
              只有四处，列在最后。
            </>
          ),
          en: (
            <>
              The <InlineCode>Emitter</InlineCode> / <InlineCode>Event</InlineCode> here are a full port of
              VS Code's <InlineCode>src/vs/base/common/event.ts</InlineCode> (MIT), with the event semantics
              aligned point by point. The four deviations are at the end of this page.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "A. 把「谁发生」和「谁关心」解耦", en: "A. Decouple who fires from who cares"})}>
        <P>
          {t({
            zh: (
              <>
                要解决的问题是:产生事件的地方(网络回调、定时器、某个组件内部的交互)不该知道谁在监听，
                订阅者也不该知道事件从哪来。事件本身就是函数——调用它即订阅，退订就是释放返回的句柄;
                触发入口留在内部 <InlineCode>fire</InlineCode>，对外只暴露只读的{" "}
                <InlineCode>event</InlineCode>。
              </>
            ),
            en: (
              <>
                The problem: the place where something happens (a network callback, a timer, an
                interaction inside one component) should not know who listens, and a subscriber should
                not know where it came from. An event is a function — call it to subscribe, release the
                returned handle to unsubscribe — while firing stays behind a private{" "}
                <InlineCode>fire</InlineCode> and only a read-only <InlineCode>event</InlineCode> is
                exposed.
              </>
            ),
          })}
        </P>
        <Code
          code={`class Uploader {
  private readonly _onProgress = new Emitter<number>();
  readonly onProgress = this._onProgress.event; // 对外只读

  private tick(percent: number) {
    this._onProgress.fire(percent); // 只有内部能触发
  }
}

const sub = uploader.onProgress(setBar);
sub.dispose(); // 退订`}
        />
        <SubscriptionDemo />
      </Section>

      <Section title={t({zh: "B. 订阅要有归属", en: "B. A subscription needs an owner"})}>
        <P>
          {t({
            zh: (
              <>
                忘记退订是这类代码最常见的泄漏:来源(全局 socket、模块级 store、DOM)比组件活得久，
                订阅便一直挂在它上面，回调还闭包着已经卸载的组件。做法是把订阅交给一个{" "}
                <InlineCode>DisposableStore</InlineCode>，它的所有者一结束就整批释放;需要按对象区分时用{" "}
                <InlineCode>DisposableMap</InlineCode>，覆盖或删除某个 key 只影响那一条。
              </>
            ),
            en: (
              <>
                A forgotten unsubscribe is the classic leak here: the source (a global socket, a
                module-level store, the DOM) outlives the component, so the subscription stays attached
                and its callback keeps a mounted-away component alive. Hand subscriptions to a{" "}
                <InlineCode>DisposableStore</InlineCode> and the whole batch dies with its owner; use{" "}
                <InlineCode>DisposableMap</InlineCode> when ownership is per object, so overwriting or
                deleting a key affects only that one.
              </>
            ),
          })}
        </P>
        <Code
          code={`// React:清理函数就是订阅的归属
useEffect(() => {
  const store = new DisposableStore();        // 建在 effect 内部
  store.add(socket.onMessage(onMessage));
  store.add(socket.onClose(onClose));
  return () => store.dispose();               // 卸载即全部退订
}, [socket]);

// 每组对象一条订阅
const perItem = new DisposableMap<Thing, CompatDisposable>();
perItem.set(thing, thing.onData(handler));
perItem.deleteAndDispose(thing);              // 只释放这一条`}
        />

        <Callout tone="warn">
          {t({
            zh: (
              <>
                <strong>React 里 store 要建在 effect 内部。</strong>StrictMode 会把 effect 跑两遍
                (挂载 → 卸载 → 再挂载):把 store 建在 <InlineCode>useMemo</InlineCode>/
                <InlineCode>useRef</InlineCode> 里、在清理函数中 dispose，第二次挂载拿到的就是已释放的
                store——<InlineCode>add</InlineCode> 被丢弃、订阅却仍然活着，失败是静默的。
              </>
            ),
            en: (
              <>
                <strong>In React, create the store inside the effect.</strong> StrictMode runs effects
                twice (mount → unmount → mount): a store created in <InlineCode>useMemo</InlineCode>/
                <InlineCode>useRef</InlineCode> and disposed in the cleanup is already released on the
                second mount — <InlineCode>add</InlineCode> is dropped while the subscription stays live,
                and it fails silently.
              </>
            ),
          })}
        </Callout>

        <P>
          {t({
            zh: (
              <>
                怀疑已经泄漏时给它一个阈值(也可以用全局的{" "}
                <InlineCode>setGlobalLeakWarningThreshold</InlineCode>):监听器会按调用点统计，同一行
                越堆越多就报 <InlineCode>ListenerLeakError</InlineCode>;远超阈值时直接拒绝新增，报{" "}
                <InlineCode>ListenerRefusalError</InlineCode>。
              </>
            ),
            en: (
              <>
                When you suspect a leak, give the emitter a threshold (or use the global{" "}
                <InlineCode>setGlobalLeakWarningThreshold</InlineCode>): listeners are then counted per
                call site, a pile-up from one line raises <InlineCode>ListenerLeakError</InlineCode>, and
                far past the threshold new listeners are refused with{" "}
                <InlineCode>ListenerRefusalError</InlineCode>.
              </>
            ),
          })}
        </P>
      </Section>

      <Section
        title={t({
          zh: "C. 高频发生，但只该按某个节奏处理",
          en: "C. Fires often, should only be handled at some rhythm",
        })}
      >
        <P>
          {t({
            zh: (
              <>
                每敲一个字、每滚一像素、每来一条消息——事件本身没错，错在每次都干活。下面几个组合子
                对应不同节奏，选哪个取决于「中间那些值能不能丢」。
              </>
            ),
            en: (
              <>
                Every keystroke, every scrolled pixel, every arriving message — the event is not the
                problem, doing work on each one is. These combinators cover the different rhythms, and
                which one you want depends on whether the intermediate values may be dropped.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[
            t({zh: "场景", en: "situation"}),
            t({zh: "用", en: "use"}),
            t({zh: "中间的值", en: "intermediate values"}),
          ]}
          rows={[
            [
              t({
                zh: "输入停下来之后再请求(搜索建议、自动保存)",
                en: "Request after typing stops (suggestions, autosave)",
              }),
              <InlineCode>{"Event.debounce(ev, merge, delay)"}</InlineCode>,
              t({zh: "合并进最后一个。", en: "Merged into the last one."}),
            ],
            [
              t({
                zh: "持续动作里保持稳定节奏(拖拽、滚动进度)",
                en: "Keep a steady rhythm during a continuous action (drag, scroll progress)",
              }),
              <InlineCode>{"Event.throttle(ev, merge, delay)"}</InlineCode>,
              t({zh: "每个窗口合并成一个。", en: "One merged value per window."}),
            ],
            [
              t({
                zh: "每条都要用，只是不想一条条处理(日志、批量写入)",
                en: "Every one matters, you just don't want one-by-one handling (logs, batched writes)",
              }),
              <InlineCode>{"Event.accumulate(ev, delay)"}</InlineCode>,
              t({zh: "一个都不丢，收成数组。", en: "None dropped — collected into an array."}),
            ],
            [
              t({
                zh: "只关心「值真的变了」(同一个窗口被聚焦两次只算一次)",
                en: "Only care that the value really changed (one window focused twice counts once)",
              }),
              <InlineCode>{"Event.latch(ev, equals?)"}</InlineCode>,
              t({zh: "连续重复的丢掉。", en: "Consecutive duplicates dropped."}),
            ],
            [
              t({
                zh: "晚一轮再处理没关系(非关键 UI 更新给关键路径让路)",
                en: "One task later is fine (non-critical UI updates can yield)",
              }),
              <InlineCode>{"Event.defer(ev)"}</InlineCode>,
              t({zh: "合并成一次「变了」。", en: "Coalesced into one signal."}),
            ],
          ]}
        />
        <Code
          code={`// 输入停下来 300ms 才发请求;空串不请求
store.add(
  Event.filter(
    Event.debounce<string, string>(input.event, (_last, text) => text, 300),
    (text) => text.trim().length > 0,
  )(search),
);

// 拖拽时保持每 100ms 一次预览
store.add(Event.throttle<Point, Point>(drag.event, (_last, p) => p, 100)(preview));`}
          caption={t({
            zh: "delay 传 MicrotaskDelay 则在下一个微任务冲刷，省掉定时器(代价是不跨任务合并)。",
            en: "Pass MicrotaskDelay as the delay to flush on the next microtask and skip the timer (at the cost of not coalescing across tasks).",
          })}
        />
        <TimingDemo />
      </Section>

      <Section
        title={t({
          zh: "D. 多个来源，或者来源会换",
          en: "D. Several sources — or a source that changes",
        })}
      >
        <P>
          {t({
            zh: (
              <>
                订阅方通常不关心消息从哪来。固定的一组来源用 <InlineCode>Event.any</InlineCode> 合成
                一个;来源数量会变(列表项增删)用{" "}
                <InlineCode>DynamicListEventMultiplexer</InlineCode>，它按项自动挂钩/摘钩;来源会在运行时
                被换掉用 <InlineCode>Relay</InlineCode>——一条可换输入端的管道，换的时候订阅方无感。
              </>
            ),
            en: (
              <>
                The subscriber usually does not care where a message came from. A fixed set of sources
                merges with <InlineCode>Event.any</InlineCode>; a set that grows and shrinks (list items
                coming and going) uses <InlineCode>DynamicListEventMultiplexer</InlineCode>, which hooks
                and unhooks per item; a source swapped at runtime uses <InlineCode>Relay</InlineCode>, a
                pipe whose input can be re-plugged without the subscriber noticing.
              </>
            ),
          })}
        </P>
        <Code
          code={`// 固定几个来源 → 一个事件(只有有人订阅时才真的挂到各来源上)
store.add(Event.any(socket.onMessage, poller.onResult, worker.onDone)(handle));

// 列表项动态增删:每项的事件跟着挂上/摘下
const multiplexer = new DynamicListEventMultiplexer(
  items, onDidAddItem, onDidRemoveItem, (item) => item.onData,
);
store.add(multiplexer);

// 来源会换:同一批订阅者继续挂在同一个 event 上
relay.input = socketA.onMessage;
relay.input = socketB.onMessage; // 换源,订阅方无感`}
        />
        <MergeDemo />
      </Section>

      <Section
        title={t({
          zh: "E. 等一件事发生，或等所有人做完",
          en: "E. Wait for one thing, or for everyone to finish",
        })}
      >
        <ApiTable
          head={[
            t({zh: "场景", en: "situation"}),
            t({zh: "用", en: "use"}),
            t({zh: "说明", en: "notes"}),
          ]}
          rows={[
            [
              t({
                zh: "等下一次触发再继续(确认、扫码、连接成功)",
                en: "Continue on the next event (a confirmation, a scan, a connection)",
              }),
              <InlineCode>{"Event.toPromise(ev)"}</InlineCode>,
              t({
                zh: "cancel() 只摘监听器，不 reject——promise 永不结算，要超时自己 race。",
                en: "cancel() only detaches; the promise never settles, so race it yourself for a timeout.",
              }),
            ],
            [
              t({
                zh: "只处理第一次，或第一次满足条件的那次",
                en: "Only the first one, or the first that qualifies",
              }),
              <InlineCode>{"Event.once(ev)"}</InlineCode>,
              <InlineCode>{"Event.onceIf(ev, cond)"}</InlineCode>,
            ],
            [
              t({
                zh: "每个参与者都要处理完才轮到下一个(保存前收集各方改动、提交前校验)",
                en: "Each participant must finish before the next runs (collecting edits before a save, validating before a commit)",
              }),
              <InlineCode>{"AsyncEmitter.fireAsync(data, token)"}</InlineCode>,
              t({
                zh: "按顺序 await;监听器可用 waitUntil(p) 延长自己这一轮，token 取消即停止投递。",
                en: "Awaited in order; a listener extends its turn with waitUntil(p); cancelling the token stops delivery.",
              }),
            ],
          ]}
        />
        <Code
          code={`// 等用户确认一次
const confirmed = await Event.toPromise(confirmButton.onClick);

// 保存前让每个参与者处理完(顺序 await，单个失败不中断其余)
await saveEmitter.fireAsync({ reason: "user" }, token);`}
        />
      </Section>

      <Section
        title={t({zh: "F. 需要能读到「当前值」", en: "F. When you need to read the current value"})}
      >
        <P>
          {t({
            zh: (
              <>
                纯事件做不到这件事:订阅之前发生的一切都拿不到。把「值」和「变更通知」放在一起的是{" "}
                <InlineCode>ValueWithChangeEvent</InlineCode>——通知不带载荷，需要时读{" "}
                <InlineCode>.value</InlineCode>，写入相同的值不通知。值固定不变时用{" "}
                <InlineCode>ValueWithChangeEvent.const(v)</InlineCode>，它的事件就是{" "}
                <InlineCode>Event.None</InlineCode>，不产生任何开销。
              </>
            ),
            en: (
              <>
                A plain event cannot do this: everything before you subscribed is unavailable.{" "}
                <InlineCode>ValueWithChangeEvent</InlineCode> pairs the value with the notification — the
                notification carries no payload, you read <InlineCode>.value</InlineCode> when you need
                it, and writing an identical value notifies nobody. For a value that never changes,{" "}
                <InlineCode>ValueWithChangeEvent.const(v)</InlineCode> hands out{" "}
                <InlineCode>Event.None</InlineCode> and costs nothing.
              </>
            ),
          })}
        </P>
        <Code
          code={`const selection = new ValueWithChangeEvent<string | undefined>(undefined);

render(selection.value);                                   // 随时可读
store.add(selection.onDidChange(() => render(selection.value)));

selection.value = "a.ts";  // 通知
selection.value = "a.ts";  // 相同引用 → 不通知`}
        />
        <ValueDemo />
      </Section>

      <Section title={t({zh: "G. 常用 API 速查", en: "G. Quick reference"})}>
        <P>
          {t({
            zh: (
              <>
                这里只列日常最常用的部分;完整清单(还包括 <InlineCode>Event.split</InlineCode>、
                <InlineCode>Event.chain</InlineCode>、<InlineCode>Event.buffer</InlineCode>、
                <InlineCode>Event.fromDOMEventEmitter</InlineCode>、
                <InlineCode>EventBufferer</InlineCode>、<InlineCode>PauseableEmitter</InlineCode>、
                <InlineCode>MicrotaskEmitter</InlineCode>、<InlineCode>trackSetChanges</InlineCode>、
                <InlineCode>EventProfiling</InlineCode> 等)见 README 与各导出的 JSDoc。
              </>
            ),
            en: (
              <>
                Only the everyday surface is listed here; the full set ({" "}
                <InlineCode>Event.split</InlineCode>, <InlineCode>Event.chain</InlineCode>,{" "}
                <InlineCode>Event.buffer</InlineCode>,{" "}
                <InlineCode>Event.fromDOMEventEmitter</InlineCode>,{" "}
                <InlineCode>EventBufferer</InlineCode>, <InlineCode>PauseableEmitter</InlineCode>,{" "}
                <InlineCode>MicrotaskEmitter</InlineCode>, <InlineCode>trackSetChanges</InlineCode>,{" "}
                <InlineCode>EventProfiling</InlineCode> and the rest) lives in the README and in the JSDoc
                of each export.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "一句话", en: "in one line"})]}
          rows={[
            [
              <InlineCode>{"Emitter<T>"}</InlineCode>,
              t({
                zh: ".fire(v) 触发，.event 订阅，.hasListeners() 查询，dispose() 之后订阅都变空操作。",
                en: ".fire(v) to fire, .event to subscribe, .hasListeners() to ask; after dispose() later subscriptions are no-ops.",
              }),
            ],
            [
              <InlineCode>{"Event.map / filter / forEach"}</InlineCode>,
              t({
                zh: "派生:映射、筛选(带类型守卫可收窄)、先跑副作用。派生事件对外暴露时要配 store。",
                en: "Derive: map, filter (a type guard narrows), run a side effect first. Give a derived event a store when others can reach it.",
              }),
            ],
            [
              <InlineCode>{"Event.reduce / latch"}</InlineCode>,
              t({
                zh: "折叠成累加值;压掉连续重复值。",
                en: "Fold into an accumulator; drop consecutive duplicates.",
              }),
            ],
            [
              <InlineCode>{"Event.toPromise / forward / runAndSubscribe"}</InlineCode>,
              t({
                zh: "变成 promise;转给另一个 emitter;订阅并立刻先调一次。",
                en: "Become a promise; forward to another emitter; subscribe and call once immediately.",
              }),
            ],
            [
              <InlineCode>DisposableStore</InlineCode>,
              t({
                zh: "一批订阅的归属，dispose() 一次全退。",
                en: "The owner of a batch of subscriptions; one dispose() releases them all.",
              }),
            ],
            [
              <InlineCode>{"DisposableMap<K, V>"}</InlineCode>,
              t({
                zh: "按 key 归属，覆盖或删除 key 即释放对应订阅。",
                en: "Ownership per key; overwriting or deleting a key releases that subscription.",
              }),
            ],
            [
              <InlineCode>{"ValueWithChangeEvent<T>"}</InlineCode>,
              t({
                zh: "值 + 变更通知，写不同的值才通知。",
                en: "Value plus change notification; only a different value notifies.",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "H. 注意", en: "H. Cautions"})}>
        <ApiTable
          head={[t({zh: "注意", en: "caution"}), t({zh: "原因", en: "why"})]}
          rows={[
            [
              t({zh: "事件是热的", en: "Events are hot"}),
              t({
                zh: "订阅前触发过的不补发(Event.buffer 是唯一例外)。需要当前值就用 ValueWithChangeEvent。",
                en: "Fires before you subscribed are not replayed (Event.buffer is the only exception). Need a current value? Use ValueWithChangeEvent.",
              }),
            ],
            [
              t({
                zh: "联合类型的事件要写显式类型参数",
                en: "Union-typed events need explicit type arguments",
              }),
              t({
                zh: "Event.filter<number, string>(ev, (e): e is number => …) 与 Event.split<number, undefined>(ev, isNumber)——不写会静默退化成不收窄的重载;Event.reduce 不给 initial 时同样要写 Event.reduce<I, O>。",
                en: "Event.filter<number, string>(ev, (e): e is number => …) and Event.split<number, undefined>(ev, isNumber) — without them the non-narrowing overload silently wins. Event.reduce without initial needs Event.reduce<I, O> too.",
              }),
            ],
            [
              t({
                zh: "触发入口要留在内部",
                en: "Keep the firing entry point private",
              }),
              t({
                zh: "对内 fire、对外只读 event;把 emitter 整个暴露出去，等于让任何人都能替你触发事件。",
                en: "Fire internally, expose event read-only; handing out the emitter lets anyone fire your events for you.",
              }),
            ],
            [
              t({
                zh: "释放协议是 dispose()",
                en: "The disposal protocol is dispose()",
              }),
              t({
                zh: "运行时支持时会一并挂上 Symbol.dispose(于是 using 可用)，但它刻意不进公开类型:引用全局 Disposable 会让 lib 停在 esnext.disposable 之前的工程编译不过。",
                en: "Where the runtime supports it, Symbol.dispose is attached too (so using works), but it is deliberately kept out of the public types: naming the global Disposable breaks projects whose lib stops before esnext.disposable.",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "I. 与 VS Code 原版的差异", en: "I. Deviations from VS Code"})}>
        <P>
          {t({
            zh: "事件行为本身是逐条对齐的，只有下面四处为了不引入它的基础层而不同:",
            en: "The event behaviour itself is aligned point by point; only these four differ, so the rest of the VS Code base layer stays out:",
          })}
        </P>
        <ApiTable
          head={[t({zh: "方面", en: "aspect"}), t({zh: "本库的处理", en: "what this library does"})]}
          rows={[
            [
              t({zh: "可释放协议", en: "Disposal protocol"}),
              t({
                zh: "不依赖 vs/base 的 IDisposable/lifecycle，改用 dispose() + 运行时的 Symbol.dispose。",
                en: "No vs/base IDisposable/lifecycle dependency; dispose() plus Symbol.dispose at runtime instead.",
              }),
            ],
            [
              t({zh: "基础层依赖", en: "Base-layer imports"}),
              t({
                zh: "LinkedList、createSingleCallFunction、diffSets 在模块内私有实现;StopWatch 换成 performance.now()。",
                en: "LinkedList, createSingleCallFunction and diffSets are private implementations in the module; StopWatch became performance.now().",
              }),
            ],
            [
              t({zh: "监听器抛错的默认处理", en: "Default listener-error handling"}),
              t({
                zh: "原版在后续事件循环里重新抛出，这里写 console.error——库不该把监听器的异常升级成宿主应用的全局错误;可按 emitter 用 onListenerError 覆盖。",
                en: "The original rethrows on a later turn of the loop; here it goes to console.error — a library should not turn a listener's exception into the host's global error. Override per emitter with onListenerError.",
              }),
            ],
            [
              t({zh: "开发期开关与 observable", en: "Dev switches and observables"}),
              t({
                zh: "开发期判断基于 process.env.NODE_ENV(打包器可静态消除，泄漏告警不会进生产包);fromObservable 只要求 get/reportChanges/addObserver/removeObserver 四个成员。",
                en: "Development checks key off process.env.NODE_ENV (statically replaced by bundlers, so leak warnings never ship); fromObservable only requires get/reportChanges/addObserver/removeObserver.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
