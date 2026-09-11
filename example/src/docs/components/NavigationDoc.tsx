import {useState, type CSSProperties, type FC, type ReactNode} from "react";
import {AppStackRouter, useAppStack, useCanPop, useStackSize} from "../../../../src";
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

const screenStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "#fff",
  overflowY: "auto",
};

const Screen: FC<{title: string; children: ReactNode}> = ({title, children}) => (
  <div style={screenStyle}>
    <div style={{fontSize: 14, fontWeight: 700, color: colors.text}}>{title}</div>
    {children}
  </div>
);

const HomeScreen: FC = () => {
  const {t} = useI18n();
  const {push, size} = useAppStack();
  const canPop = useCanPop();
  const [count, setCount] = useState(0);

  return (
    <Screen title={t({zh: "根屏幕 · Home", en: "Root · Home"})}>
      <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
        <Button onClick={() => push(DetailScreen, {id: 1})}>
          {t({zh: "打开详情 #1", en: "Open detail #1"})}
        </Button>
        <Button tone="ghost" onClick={() => push(DetailScreen, {id: 2})}>
          {t({zh: "打开详情 #2", en: "Open detail #2"})}
        </Button>
      </div>

      <div
        style={{
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${colors.border}`,
          background: "#f9fafb",
          fontSize: 13,
        }}
      >
        <div style={{marginBottom: 8, color: colors.muted}}>
          {t({
            zh: "在根屏幕计数，进入详情再返回，计数不会丢（keep-alive）。",
            en: "Count here, go into a detail, then come back — the count survives (keep-alive).",
          })}
        </div>
        <Controls>
          <Button tone="ghost" onClick={() => setCount((value) => value + 1)}>
            +1
          </Button>
          <Label>
            {t({zh: "计数", en: "count"})}: <strong>{count}</strong>
          </Label>
        </Controls>
      </div>

      <Output>
        size = <strong>{size}</strong> · canPop = <strong>{String(canPop)}</strong>
      </Output>
    </Screen>
  );
};

const DetailScreen: FC<{id: number}> = ({id}) => {
  const {t} = useI18n();
  const {push, pop, replace, reset, size} = useAppStack();

  return (
    <Screen title={t({zh: `详情 #${id}`, en: `Detail #${id}`})}>
      <Muted>
        {t({
          zh: "params 会作为 props 透传给屏幕组件。",
          en: "Params are forwarded to the screen component as props.",
        })}
      </Muted>
      <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
        <Button tone="ghost" onClick={pop}>
          {t({zh: "返回（pop）", en: "Back (pop)"})}
        </Button>
        <Button tone="ghost" onClick={() => push(SubScreen)}>
          {t({zh: "再进一层", en: "Push deeper"})}
        </Button>
        <Button tone="ghost" onClick={() => replace(DetailScreen, {id: id + 10})}>
          {t({zh: `替换为 #${id + 10}`, en: `Replace with #${id + 10}`})}
        </Button>
        <Button tone="ghost" onClick={reset}>
          {t({zh: "reset 回到根", en: "reset to root"})}
        </Button>
      </div>
      <Output>
        size = <strong>{size}</strong>
      </Output>
    </Screen>
  );
};

const SubScreen: FC = () => {
  const {t} = useI18n();
  const {pop, reset} = useAppStack();
  // useStackSize 与 useAppStack().size 等价,这里用它演示独立的细粒度订阅
  const size = useStackSize();

  return (
    <Screen title={t({zh: "子屏幕", en: "Sub screen"})}>
      <Muted>
        {t({
          zh: "栈越深，下面的层仍然保留在 DOM 中，只是被遮住。",
          en: "The deeper the stack, the lower layers stay in the DOM, just covered.",
        })}
      </Muted>
      <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
        <Button tone="ghost" onClick={pop}>
          {t({zh: "返回（pop）", en: "Back (pop)"})}
        </Button>
        <Button tone="ghost" onClick={reset}>
          {t({zh: "reset 回到根", en: "reset to root"})}
        </Button>
      </div>
      <Output>
        size = <strong>{size}</strong>
      </Output>
    </Screen>
  );
};

const phoneFrameStyle: CSSProperties = {
  width: "min(100%, 320px)",
  height: 420,
  margin: "0 auto",
  border: "8px solid #0f172a",
  borderRadius: 28,
  overflow: "hidden",
  background: "#fff",
  position: "relative",
};

const StackDemo: FC = () => {
  const {t} = useI18n();

  return (
    <Demo
      title={t({zh: "示例:手机外壳里的堆栈导航", en: "Demo: stack navigation in a phone shell"})}
      hint={t({
        zh: "点「打开详情」压栈，点详情里的「返回」出栈；根屏幕的计数会保留。每个屏幕底部的 Output 会显示当前栈深度。",
        en: "Tap Open detail to push and Back inside the detail to pop; the root screen's counter survives. The Output at the bottom of each screen shows the current depth.",
      })}
    >
      <div style={phoneFrameStyle}>
        <AppStackRouter
          root={<HomeScreen />}
          fullscreen={false}
          safeArea={false}
          transitionDuration={240}
          maxStackSize={4}
          style={{height: "100%"}}
        />
      </div>
    </Demo>
  );
};

export const NavigationDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>AppStackRouter</InlineCode> 是一个移动端 H5 风格的堆栈视图容器：屏幕被压栈后
              keep-alive（不卸载），支持编程式导航、边缘左滑返回、浏览器返回键拦截与安全区域适配，
              且不引入任何额外依赖。
            </>
          ),
          en: (
            <>
              <InlineCode>AppStackRouter</InlineCode> is a mobile-style stack view container: screens are
              pushed and kept alive (not unmounted), with programmatic navigation, edge swipe-back,
              browser back-button interception, and safe-area support — with zero extra dependencies.
            </>
          ),
        })}
      </P>

      <Callout tone="warn">
        {t({
          zh: (
            <>
              Router 挂载时会往浏览器 history 补一条哨兵记录，用来把返回键接管为「出栈」。因此本页挂载
              期间，浏览器的返回操作会先被 Router 消费；卸载时会用 <InlineCode>replaceState</InlineCode>{" "}
              清理哨兵。多个 Router 实例时只有最后活跃的那个响应返回键。
            </>
          ),
          en: (
            <>
              On mount the router pushes a sentinel entry onto browser history so the back button pops
              the stack. While this page is mounted, back therefore goes to the router first; on unmount
              it clears the sentinel with <InlineCode>replaceState</InlineCode>. With several router
              instances only the last active one handles the back button.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 基本用法", en: "1. Basic usage"})}>
        <P>
          {t({
            zh: (
              <>
                把根屏幕传给 <InlineCode>root</InlineCode>，子树里用{" "}
                <InlineCode>useAppStack()</InlineCode> 拿到 <InlineCode>push</InlineCode> /{" "}
                <InlineCode>pop</InlineCode> / <InlineCode>replace</InlineCode> /{" "}
                <InlineCode>reset</InlineCode>。嵌入到已有高度的容器里时设{" "}
                <InlineCode>fullscreen=&#123;false&#125;</InlineCode>，容器用 100% 高度。
              </>
            ),
            en: (
              <>
                Pass the root screen as <InlineCode>root</InlineCode> and call{" "}
                <InlineCode>useAppStack()</InlineCode> in the subtree to get{" "}
                <InlineCode>push</InlineCode> / <InlineCode>pop</InlineCode> /{" "}
                <InlineCode>replace</InlineCode> / <InlineCode>reset</InlineCode>. To embed it inside a
                parent that already has a height, set{" "}
                <InlineCode>fullscreen=&#123;false&#125;</InlineCode> so the container uses 100% height.
              </>
            ),
          })}
        </P>
        <StackDemo />
        <Code
          code={`import { AppStackRouter, useAppStack } from "@wwog/react";

function Home() {
  const { push } = useAppStack();
  return <button onClick={() => push(Profile, { id: 1 })}>Open Profile</button>;
}

function Profile({ id }: { id: number }) {
  const { pop } = useAppStack();
  return <button onClick={pop}>Back</button>;
}

<AppStackRouter root={<Home />} />

// 嵌入到固定高度容器:fullscreen={false}
<AppStackRouter root={<Home />} fullscreen={false} style={{ height: "100%" }} />`}
        />
      </Section>

      <Section title={t({zh: "2. 导航 API 与订阅 hooks", en: "2. Navigation API and subscription hooks"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>useAppStack()</InlineCode> 返回绑定到最近 Router 的 API；{" "}
                <InlineCode>size</InlineCode> 与 <InlineCode>canPop()</InlineCode> 只订阅栈<strong>深度</strong>，
                因此 <InlineCode>replace</InlineCode>（深度不变）不会触发重渲染。
                <InlineCode>useStackSize()</InlineCode> 与 <InlineCode>useCanPop()</InlineCode>{" "}
                是更细粒度的订阅方式。
              </>
            ),
            en: (
              <>
                <InlineCode>useAppStack()</InlineCode> returns the API bound to the nearest router;{" "}
                <InlineCode>size</InlineCode> and <InlineCode>canPop()</InlineCode> subscribe only to the
                stack <strong>depth</strong>, so <InlineCode>replace</InlineCode> (same depth) does not
                re-render. <InlineCode>useStackSize()</InlineCode> and{" "}
                <InlineCode>useCanPop()</InlineCode> are finer-grained subscriptions.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { useAppStack, useCanPop, useStackSize } from "@wwog/react";

const { push, pop, replace, reset, canPop, size } = useAppStack();

const size2 = useStackSize(); // 仅深度变化时重渲染
const canPop2 = useCanPop();  // 仅 canPop 变化时重渲染

push(Detail, { id: 1 });      // 压栈,params 作为 props
pop();                        // 出栈(同步 history.back())
replace(Other, {});           // 替换栈顶,深度不变
reset();                      // 清空整栈,回到根屏幕`}
        />
        <ApiTable
          head={[t({zh: "成员", en: "member"}), t({zh: "类型 / 签名", en: "type / signature"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>push</InlineCode>, <InlineCode>{`<P>(Component, params?) => void`}</InlineCode>, t({zh: "压栈，params 作为 props。", en: "Push; params become props."})],
            [<InlineCode>pop</InlineCode>, <InlineCode>{`() => void`}</InlineCode>, t({zh: "出栈，并同步 history。", en: "Pop and sync history."})],
            [<InlineCode>replace</InlineCode>, <InlineCode>{`<P>(Component, params?) => void`}</InlineCode>, t({zh: "替换栈顶，深度不变。", en: "Replace the top; depth unchanged."})],
            [<InlineCode>reset</InlineCode>, <InlineCode>{`() => void`}</InlineCode>, t({zh: "清空堆栈回到根。", en: "Clear the stack back to root."})],
            [<InlineCode>canPop</InlineCode>, <InlineCode>{`() => boolean`}</InlineCode>, t({zh: "深度是否 > 0。", en: "Whether depth > 0."})],
            [<InlineCode>size</InlineCode>, "number", t({zh: "当前深度（不含根屏幕）。", en: "Current depth (excludes root)."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. AppStackRouter props", en: "3. AppStackRouter props"})}>
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "默认", en: "default"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>root</InlineCode>, "ReactElement", "—", t({zh: "根屏幕，始终渲染。", en: "Root screen, always rendered."})],
            [<InlineCode>maxStackSize</InlineCode>, "number", "∞", t({zh: "超过则丢弃最底层屏幕。", en: "Drop the bottom screen when exceeded."})],
            [<InlineCode>swipeBack</InlineCode>, "boolean", "true", t({zh: "边缘左滑返回手势。", en: "Edge swipe-back gesture."})],
            [<InlineCode>swipeBackEdgeWidth</InlineCode>, "number", "40", t({zh: "触发拖拽的左边缘宽度(px)。", en: "Left-edge width (px) that starts a drag."})],
            [<InlineCode>swipeBackCancelOnReverseRelease</InlineCode>, "boolean", "true", t({zh: "松手回划时识别为取消意图。", en: "Treat a reverse release as cancel."})],
            [<InlineCode>swipeBackCancelVelocity</InlineCode>, "number", "0.1", t({zh: "取消意图的最小瞬时速度。", en: "Min velocity to count as cancel."})],
            [<InlineCode>safeArea</InlineCode>, "boolean", "true", t({zh: "应用 env(safe-area-inset-*)。", en: "Apply env(safe-area-inset-*)."})],
            [<InlineCode>transitionDuration</InlineCode>, "number", "300", t({zh: "进出场过渡时长(ms)，0 禁用。", en: "Transition duration (ms); 0 disables."})],
            [<InlineCode>fullscreen</InlineCode>, "boolean", "true", t({zh: "用 100dvh 撑满屏幕。", en: "Fill the screen with 100dvh."})],
            [<InlineCode>children</InlineCode>, "ReactNode", "—", t({zh: "堆栈之上的全局叠层。", en: "Global overlay above the stack."})],
          ]}
        />
        <Callout>
          {t({
            zh: (
              <>
                <InlineCode>replace</InlineCode> 与 <InlineCode>reset</InlineCode> 会清空正在播放的出场
                屏幕；左滑手势在触摸屏 / 移动端模拟下才可用，桌面鼠标无效。
              </>
            ),
            en: (
              <>
                <InlineCode>replace</InlineCode> and <InlineCode>reset</InlineCode> discard exiting
                screens; the swipe gesture only works on touchscreens or device emulation, not with a
                desktop mouse.
              </>
            ),
          })}
        </Callout>
      </Section>

      <Section title={t({zh: "4. 手势底层:useSwipeBack", en: "4. Gesture layer: useSwipeBack"})}>
        <P>
          {t({
            zh: (
              <>
                边缘左滑由 <InlineCode>useSwipeBack</InlineCode> 实现：用原生（非 passive）触摸监听器
                判断起点是否落在左边缘 <InlineCode>edgeWidth</InlineCode> 内，拖拽中通过 CSS 变量{" "}
                <InlineCode>--appstack-drag-x</InlineCode> 直接改 DOM 而不触发 React 渲染；松手后按
                距离阈值、瞬时速度与是否反向回划决定出栈或回弹。
              </>
            ),
            en: (
              <>
                The edge gesture is implemented by <InlineCode>useSwipeBack</InlineCode>: native
                (non-passive) touch listeners check whether the start lies within{" "}
                <InlineCode>edgeWidth</InlineCode> of the left edge, and during a drag it writes the CSS
                variable <InlineCode>--appstack-drag-x</InlineCode> directly to the DOM without a React
                render; on release it commits a pop or snaps back based on distance, velocity and whether
                the finger reversed direction.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[t({zh: "参数 / 选项", en: "argument / option"}), t({zh: "签名", en: "signature"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>containerRef</InlineCode>, "RefObject&lt;HTMLElement&gt;", t({zh: "绑定触摸监听的容器。", en: "Container that receives the listeners."})],
            [<InlineCode>canPop</InlineCode>, <InlineCode>{`() => boolean`}</InlineCode>, t({zh: "栈非空才激活手势。", en: "Gesture activates only when the stack is non-empty."})],
            [<InlineCode>onCommit</InlineCode>, <InlineCode>{`(releaseX: number) => void`}</InlineCode>, t({zh: "决定出栈时回调。", en: "Called when a pop commits."})],
            [<InlineCode>enabled / edgeWidth / threshold</InlineCode>, "number | boolean", t({zh: "开关、边缘宽度、出栈距离阈值。", en: "Enable flag, edge width, commit distance."})],
            [<InlineCode>velocityThreshold</InlineCode>, "number", t({zh: "超过即出栈的瞬时速度。", en: "Velocity that commits regardless of distance."})],
            [<InlineCode>cancelOnReverseRelease / cancelVelocity</InlineCode>, "boolean | number", t({zh: "反向回划取消的识别。", en: "Reverse-release cancellation detection."})],
          ]}
        />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                限制：<InlineCode>useSwipeBack</InlineCode> 目前只在包内的{" "}
                <InlineCode>Navigation/useSwipeBack.ts</InlineCode> 导出，<strong>未</strong>从{" "}
                <InlineCode>@wwog/react</InlineCode> 入口重新导出，因此无法直接{" "}
                <InlineCode>import</InlineCode>。要用只能通过 <InlineCode>AppStackRouter</InlineCode>{" "}
                的 <InlineCode>swipeBack*</InlineCode> props 配置，或直接引用源码路径。
              </>
            ),
            en: (
              <>
                Limitation: <InlineCode>useSwipeBack</InlineCode> is exported only from the internal{" "}
                <InlineCode>Navigation/useSwipeBack.ts</InlineCode> module and is <strong>not</strong>{" "}
                re-exported from the <InlineCode>@wwog/react</InlineCode> entry, so it cannot be imported
                directly. Use it through <InlineCode>AppStackRouter</InlineCode>'s{" "}
                <InlineCode>swipeBack*</InlineCode> props, or reference the source path.
              </>
            ),
          })}
        </Callout>
      </Section>
    </div>
  );
};
