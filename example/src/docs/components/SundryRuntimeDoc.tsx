import {useCallback, useState, type CSSProperties, type FC} from "react";
import {Boundary, FocusTrap, Observer, Portal} from "../../../../src";
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

// ---- Observer ----

// 模块级常量:threshold 是 Observer 的 effect 依赖,写成每次渲染新建的数组会导致
// observer 反复重建、回调反复触发 setState,进而陷入渲染循环。
const OBSERVER_THRESHOLD = [0, 0.5, 1];

const ObserverDemo: FC = () => {
  const {t} = useI18n();
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [hits, setHits] = useState(0);
  const [once, setOnce] = useState(false);
  const [runKey, setRunKey] = useState(0);

  // 稳定引用:onIntersect 被 Observer 放进 effect 依赖,每次渲染新建会导致反复重建 observer
  const onIntersect = useCallback((entry: IntersectionObserverEntry) => {
    setVisible(entry.isIntersecting);
    setRatio(entry.intersectionRatio);
    setHits((value) => value + 1);
  }, []);

  const reset = () => {
    setVisible(false);
    setRatio(0);
    setHits(0);
    setRunKey((value) => value + 1);
  };

  return (
    <Demo
      title={t({zh: "示例:滚动进入视口", en: "Demo: scrolling into view"})}
      hint={t({
        zh: "在灰色盒子内上下滚动。目标块离开视口时 isIntersecting 变 false；打开 triggerOnce 后只触发一次。",
        en: "Scroll inside the grey box. isIntersecting becomes false when the target leaves view; enable triggerOnce to fire once.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={once} onChange={(event) => setOnce(event.target.checked)} />
          triggerOnce
        </label>
        <Button tone="ghost" onClick={reset}>
          {t({zh: "重置", en: "reset"})}
        </Button>
        <Label>
          {t({zh: "触发次数", en: "hits"})}: <strong>{hits}</strong>
        </Label>
      </Controls>

      <div
        style={{
          marginTop: 12,
          height: 150,
          overflowY: "auto",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          background: "#f9fafb",
          padding: 10,
        }}
      >
        <div style={{height: 110}} />
        <Observer key={runKey} onIntersect={onIntersect} threshold={OBSERVER_THRESHOLD} triggerOnce={once}>
          <div
            style={{
              height: 56,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              transition: "background .2s ease",
              background: visible ? colors.successSoft : "#fff",
              border: `1px solid ${visible ? "#a7f3d0" : colors.border}`,
              color: visible ? colors.success : colors.muted,
            }}
          >
            {visible
              ? t({zh: "在视口内", en: "in view"})
              : t({zh: "不在视口内", en: "out of view"})}
          </div>
        </Observer>
        <div style={{height: 160}} />
      </div>

      <Output>
        isIntersecting = <strong>{String(visible)}</strong> · intersectionRatio ={" "}
        <strong>{ratio.toFixed(2)}</strong>
      </Output>
    </Demo>
  );
};

// ---- Portal ----

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  background: colors.accent,
  color: "#fff",
  fontSize: 12.5,
};

const PortalDemo: FC = () => {
  const {t} = useI18n();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [show, setShow] = useState(true);

  // 回调 ref 用 useCallback 固定引用，避免每次渲染都被 React 重新挂载（detach/attach）
  const targetRef = useCallback((el: HTMLElement | null) => setTarget(el), []);

  return (
    <Demo
      title={t({zh: "示例:传送到指定容器", en: "Demo: teleporting into a specific container"})}
      hint={t({
        zh: "Portal 的声明位置在右侧「来源」框，但节点实际渲染进左侧目标框。关闭 Portal 后恢复内联渲染。",
        en: "The Portal element is declared in the right-hand source box, but its node renders into the left target box. Disabling the Portal restores inline rendering.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} />
          {t({zh: "显示内容", en: "show content"})}
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} />
          {t({zh: "disabled（内联渲染）", en: "disabled (inline)"})}
        </label>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap"}}>
        <div style={{flex: "1 1 220px", minHeight: 120}}>
          <Label>{t({zh: "目标容器", en: "target container"})}</Label>
          <div
            ref={targetRef}
            style={{
              marginTop: 8,
              minHeight: 84,
              borderRadius: 10,
              border: `1px dashed ${colors.accentBorder}`,
              background: colors.accentSoft,
              padding: 12,
            }}
          />
        </div>
        <div style={{flex: "1 1 220px", minHeight: 120}}>
          <Label>{t({zh: "来源（Portal 的声明位置）", en: "source (where Portal is declared)"})}</Label>
          <div
            style={{
              marginTop: 8,
              minHeight: 84,
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: "#fff",
              padding: 12,
            }}
          >
            {show && target ? (
              <Portal to={target} disabled={disabled}>
                <span style={badgeStyle}>{t({zh: "我在目标容器里", en: "I live in the target box"})}</span>
              </Portal>
            ) : (
              <Muted>{t({zh: "没有内容", en: "nothing here"})}</Muted>
            )}
          </div>
        </div>
      </div>
    </Demo>
  );
};

// ---- Boundary ----

const Boom: FC<{onBoom: () => void}> = ({onBoom}) => {
  const {t} = useI18n();
  const [explode, setExplode] = useState(false);

  if (explode) {
    throw new Error(t({zh: "渲染时故意抛出的错误", en: "Deliberate error thrown while rendering"}));
  }

  return (
    <Button
      onClick={() => {
        onBoom();
        setExplode(true);
      }}
    >
      {t({zh: "触发渲染错误", en: "Trigger a render error"})}
    </Button>
  );
};

const BoundaryDemo: FC = () => {
  const {t} = useI18n();
  const [caught, setCaught] = useState(0);

  return (
    <Demo
      title={t({zh: "示例:捕获并重置", en: "Demo: catch and reset"})}
      hint={t({
        zh: "子组件在渲染时抛错，Boundary 捕获后渲染 fallback；点击重试会清空错误、重新挂载子树。",
        en: "The child throws while rendering; Boundary catches it and renders fallback. Retry clears the error and remounts the subtree.",
      })}
    >
      <Boundary
        onError={() => setCaught((value) => value + 1)}
        fallback={(error, reset) => (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${colors.warnBorder}`,
              background: colors.warnSoft,
              color: colors.warn,
              fontSize: 13,
            }}
          >
            <div style={{marginBottom: 10}}>
              {t({zh: "已捕获", en: "Caught" })}: {error.message}
            </div>
            <Button tone="ghost" onClick={reset}>
              {t({zh: "重试（reset）", en: "Retry (reset)"})}
            </Button>
          </div>
        )}
      >
        <Boom onBoom={() => setCaught((value) => value + 1)} />
      </Boundary>

      <Output>
        onError {t({zh: "调用次数", en: "calls"})}: <strong>{caught}</strong>
      </Output>
    </Demo>
  );
};

// ---- FocusTrap ----

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(15, 23, 42, 0.45)",
  padding: 20,
};

const FocusTrapDemo: FC = () => {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 13,
    fontFamily: "inherit",
  };

  return (
    <Demo
      title={t({zh: "示例:模态框焦点陷阱", en: "Demo: modal focus trap"})}
      hint={t({
        zh: "打开后焦点进入第一个输入框。Tab / Shift+Tab 与上下方向键都在框内循环，Esc 关闭；关闭后焦点回到「打开弹窗」按钮。",
        en: "Opening moves focus into the first input. Tab / Shift+Tab and the arrow keys cycle within the dialog, Esc closes it, and focus returns to the trigger button.",
      })}
    >
      <Button onClick={() => setOpen(true)}>{t({zh: "打开弹窗", en: "Open dialog"})}</Button>

      {open ? (
        <div
          style={overlayStyle}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <FocusTrap
            autoFocus
            restoreFocus
            keyMap={{ArrowDown: "next", ArrowUp: "prev"}}
            style={{
              width: 320,
              maxWidth: "100%",
              background: "#fff",
              borderRadius: 14,
              padding: 18,
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
            }}
          >
            <div style={{fontSize: 15, fontWeight: 600, marginBottom: 4}}>
              {t({zh: "编辑资料", en: "Edit profile"})}
            </div>
            <div style={{fontSize: 12.5, color: colors.muted, marginBottom: 14, lineHeight: 1.7}}>
              {t({zh: "焦点被限制在这个弹窗内。", en: "Focus is confined to this dialog."})}
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: 10}}>
              <input style={inputStyle} placeholder={t({zh: "姓名", en: "Name"})} />
              <input style={inputStyle} placeholder={t({zh: "邮箱", en: "Email"})} />
            </div>
            <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16}}>
              <Button tone="ghost" onClick={() => setOpen(false)}>
                {t({zh: "取消", en: "Cancel"})}
              </Button>
              <Button onClick={() => setOpen(false)}>{t({zh: "保存", en: "Save"})}</Button>
            </div>
          </FocusTrap>
        </div>
      ) : null}
    </Demo>
  );
};

export const SundryRuntimeDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              Sundry 里与<strong>副作用和交互</strong>相关的四个组件：
              <InlineCode>Observer</InlineCode> 观察视口交叉、<InlineCode>Portal</InlineCode> 改变渲染位置、
              <InlineCode>Boundary</InlineCode> 兜住渲染错误、<InlineCode>FocusTrap</InlineCode> 约束键盘焦点。
              它们都直接对接浏览器 API，因此列表里给了可交互的真实场景。
            </>
          ),
          en: (
            <>
              The four Sundry components about <strong>side effects and interaction</strong>:{" "}
              <InlineCode>Observer</InlineCode> watches viewport intersection,{" "}
              <InlineCode>Portal</InlineCode> changes where nodes render,{" "}
              <InlineCode>Boundary</InlineCode> contains render errors, and{" "}
              <InlineCode>FocusTrap</InlineCode> confines keyboard focus. Each talks to a browser API
              directly, so the demos are real scenarios.
            </>
          ),
        })}
      </P>

      <Section title={t({zh: "1. Observer:交叉观察", en: "1. Observer: intersection observer"})}>
        <P>
          {t({
            zh: (
              <>
                对 <InlineCode>IntersectionObserver</InlineCode> 的声明式封装：
                <InlineCode>onIntersect(entry, observer)</InlineCode> 在交叉变化时回调，
                <InlineCode>threshold</InlineCode> 控制触发比例，<InlineCode>triggerOnce</InlineCode>{" "}
                让回调只发生一次（之后 unobserve）。<InlineCode>root</InlineCode> /{" "}
                <InlineCode>rootMargin</InlineCode> 透传给底层。
              </>
            ),
            en: (
              <>
                A declarative wrapper over <InlineCode>IntersectionObserver</InlineCode>:{" "}
                <InlineCode>onIntersect(entry, observer)</InlineCode> fires on intersection changes,{" "}
                <InlineCode>threshold</InlineCode> controls the trigger ratios, and{" "}
                <InlineCode>triggerOnce</InlineCode> fires the callback once (then unobserves).{" "}
                <InlineCode>root</InlineCode> / <InlineCode>rootMargin</InlineCode> pass through.
              </>
            ),
          })}
        </P>
        <ObserverDemo />
        <Code
          code={`import { Observer } from "@wwog/react";

<Observer onIntersect={(entry) => loadMore()} threshold={0.1} triggerOnce>
  <div>Load more when this scrolls into view</div>
</Observer>`}
          caption={t({
            zh: "onIntersect 会进入 effect 依赖：在组件里用 useCallback 包一层，避免每次渲染都重建 observer。",
            en: "onIntersect is an effect dependency: wrap it in useCallback so the observer is not rebuilt every render.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>onIntersect</InlineCode>, <InlineCode>{`(entry, observer) => void`}</InlineCode>, t({zh: "交叉回调。", en: "Intersection callback."})],
            [<InlineCode>threshold</InlineCode>, <InlineCode>number | number[]</InlineCode>, t({zh: "触发阈值，默认 0.1。", en: "Trigger threshold, default 0.1."})],
            [<InlineCode>root / rootMargin</InlineCode>, "Element | string", t({zh: "底层 observer 选项。", en: "Underlying observer options."})],
            [<InlineCode>triggerOnce</InlineCode>, "boolean", t({zh: "只触发一次，默认 false。", en: "Fire once, default false."})],
            [<InlineCode>disabled</InlineCode>, "boolean", t({zh: "停止观察。", en: "Stop observing."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "2. Portal:指定挂载点", en: "2. Portal: rendering into another node"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>Portal</InlineCode> 用 <InlineCode>createPortal</InlineCode> 把子节点渲染到{" "}
                <InlineCode>to</InlineCode> 指定的 DOM 节点（缺省 <InlineCode>document.body</InlineCode>
                ）。为避免 SSR 或 ref 未就绪时找不到目标，它会等到客户端挂载后才渲染；{" "}
                <InlineCode>disabled</InlineCode> 时退回内联渲染。
              </>
            ),
            en: (
              <>
                <InlineCode>Portal</InlineCode> uses <InlineCode>createPortal</InlineCode> to render its
                children into the <InlineCode>to</InlineCode> node (default{" "}
                <InlineCode>document.body</InlineCode>). To avoid a missing target during SSR or before a
                ref exists, it waits until it mounts on the client; <InlineCode>disabled</InlineCode>{" "}
                falls back to inline rendering.
              </>
            ),
          })}
        </P>
        <PortalDemo />
        <Code
          code={`import { Portal } from "@wwog/react";

<Portal>
  <Modal />
</Portal>

// to 为 null 时会在挂载后回退到 document.body，
// 因此若目标是动态节点，等 ref 就绪后再渲染 Portal
<Portal to={document.getElementById("overlay-root")}>
  <Tooltip />
</Portal>`}
          caption={t({
            zh: "注意：to 首次渲染为 null 时会落到 document.body；动态目标建议等节点就绪后再挂载 Portal。",
            en: "Caution: a null to on first render falls back to document.body; for dynamic targets mount the Portal only after the node exists.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>to</InlineCode>, <InlineCode>Element | null</InlineCode>, t({zh: "目标节点，缺省 body。", en: "Target node; defaults to body."})],
            [<InlineCode>disabled</InlineCode>, "boolean", t({zh: "改为内联渲染。", en: "Render inline instead."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. Boundary:错误边界", en: "3. Boundary: error boundary"})}>
        <P>
          {t({
            zh: (
              <>
                基于 class 的 error boundary 封装，通过 render-prop{" "}
                <InlineCode>fallback(error, reset)</InlineCode> 提供降级 UI 与重置函数。
                <InlineCode>reset</InlineCode> 清空错误状态并重新挂载子树；<InlineCode>onError</InlineCode>{" "}
                可用于上报日志。
              </>
            ),
            en: (
              <>
                A class-based error boundary exposed with a{" "}
                <InlineCode>fallback(error, reset)</InlineCode> render prop for the fallback UI and a
                reset function. <InlineCode>reset</InlineCode> clears the error and remounts the subtree;{" "}
                <InlineCode>onError</InlineCode> is available for logging.
              </>
            ),
          })}
        </P>
        <BoundaryDemo />
        <Code
          code={`import { Boundary } from "@wwog/react";

<Boundary
  onError={(error, info) => report(error, info)}
  fallback={(error, reset) => (
    <div>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <RiskyComponent />
</Boundary>`}
          caption={t({
            zh: "错误边界只捕获渲染 / 生命周期 / 构造函数中的错误，不捕获事件处理器与异步代码中的错误。",
            en: "Error boundaries catch errors in rendering, lifecycle and constructors — not in event handlers or async code.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>fallback</InlineCode>, <InlineCode>{`(error: Error, reset: () => void) => ReactNode`}</InlineCode>, t({zh: "降级 UI，必需。", en: "Fallback UI; required."})],
            [<InlineCode>onError</InlineCode>, <InlineCode>{`(error, info) => void`}</InlineCode>, t({zh: "捕获到错误时的回调。", en: "Called when an error is caught."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "4. FocusTrap:焦点陷阱", en: "4. FocusTrap: confine focus"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>FocusTrap</InlineCode> 在容器上监听 keydown，把 Tab（及{" "}
                <InlineCode>keyMap</InlineCode> 里配置的按键）映射为 next / prev / first / last，
                用 <InlineCode>getTabbableElements</InlineCode> 收集容器内可 Tab 元素并在其中循环。
                <InlineCode>autoFocus</InlineCode> 挂载时聚焦第一个元素，
                <InlineCode>restoreFocus</InlineCode> 卸载时把焦点还给之前的元素。
              </>
            ),
            en: (
              <>
                <InlineCode>FocusTrap</InlineCode> listens for keydown on its container and maps Tab
                (plus keys configured in <InlineCode>keyMap</InlineCode>) to next / prev / first / last,
                cycling through the tabbable elements collected by{" "}
                <InlineCode>getTabbableElements</InlineCode>. <InlineCode>autoFocus</InlineCode> focuses
                the first element on mount and <InlineCode>restoreFocus</InlineCode> returns focus to the
                previous element on unmount.
              </>
            ),
          })}
        </P>
        <FocusTrapDemo />
        <Code
          code={`import { FocusTrap } from "@wwog/react";

<FocusTrap autoFocus restoreFocus keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}>
  <input />
  <button>Save</button>
</FocusTrap>`}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>disabled</InlineCode>, "boolean", t({zh: "禁用劫持，默认 false。", en: "Disable trapping, default false."})],
            [<InlineCode>autoFocus</InlineCode>, "boolean", t({zh: "挂载时聚焦第一个可 Tab 元素。", en: "Focus the first tabbable element on mount."})],
            [<InlineCode>restoreFocus</InlineCode>, "boolean", t({zh: "卸载时恢复先前焦点。", en: "Restore the previous focus on unmount."})],
            [<InlineCode>keyMap</InlineCode>, <InlineCode>{`Record<string, FocusDirection>`}</InlineCode>, t({zh: "按键到方向的映射，默认 { Tab: 'next' }。", en: "Key-to-direction map, default { Tab: 'next' }."})],
            [<InlineCode>onNavigate</InlineCode>, <InlineCode>{`(current, elements, direction) => HTMLElement | null`}</InlineCode>, t({zh: "自定义焦点解析，返回 null 走默认循环。", en: "Custom resolution; returning null uses the default cycle."})],
            [<InlineCode>focusableOptions</InlineCode>, <InlineCode>FocusableOptions</InlineCode>, t({zh: "透传给 getTabbableElements。", en: "Passed to getTabbableElements."})],
          ]}
        />
        <Callout>
          {t({
            zh: (
              <>
                FocusTrap 只做键盘焦点循环，不负责遮罩、滚动锁定或 Esc 关闭——这些需要调用方自己组合
                （演示里的遮罩与 Esc 就是外层实现的）。它只拦截 <InlineCode>keyMap</InlineCode>{" "}
                命中的按键，其余按键照常冒泡。
              </>
            ),
            en: (
              <>
                FocusTrap only cycles keyboard focus; it does not provide a backdrop, scroll lock or Esc
                handling — the caller composes those (the demo's backdrop and Esc live outside). It only
                intercepts keys present in <InlineCode>keyMap</InlineCode>; others bubble normally.
              </>
            ),
          })}
        </Callout>
      </Section>
    </div>
  );
};
