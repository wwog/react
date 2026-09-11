import {useEffect, useRef, useState, type CSSProperties, type FC} from "react";
import {flipAnimate} from "../../../../src";
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
  P,
  Section,
  colors,
  controlStyle,
} from "../ui";

const SLOT_COUNT = 4;
const SLOT_LABELS = ["A", "B", "C", "D"];

const cardStyle = (background: string, color: string): CSSProperties => ({
  width: "100%",
  padding: "10px 8px",
  borderRadius: 8,
  textAlign: "center",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5,
  background,
  color,
});

/**
 * FLIP 演示。为了让 flipAnimate 在唯一的 layoutChange 里真正完成 DOM 变更，
 * 这里由 ref 容器内的原生 DOM 驱动，而不是 React state —— React 的调和发生在
 * 渲染之后，无法在测量之间同步改变布局。
 */
const FlipDemo: FC = () => {
  const {t} = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<HTMLDivElement[]>([]);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(300);
  const [easing, setEasing] = useState("ease-in-out");
  const [scale, setScale] = useState(false);
  const [current, setCurrent] = useState(0);
  const [sized, setSized] = useState(false);
  const optsRef = useRef({duration, easing, scale});
  optsRef.current = {duration, easing, scale};

  const build = () => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const slots: HTMLDivElement[] = [];

    for (let index = 0; index < SLOT_COUNT; index++) {
      const slot = document.createElement("div");
      Object.assign(slot.style, {
        flex: "1",
        minWidth: "0",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        alignItems: "center",
        padding: "10px 6px",
        border: `1px dashed ${colors.border}`,
        borderRadius: "10px",
        background: "#fafbfc",
        minHeight: "96px",
      } as CSSProperties);

      const label = document.createElement("div");
      label.textContent = SLOT_LABELS[index]!;
      Object.assign(label.style, {
        fontSize: "11px",
        color: colors.muted,
        fontFamily: "ui-monospace, monospace",
      } as CSSProperties);

      const placeholder = document.createElement("div");
      placeholder.textContent = "·";
      Object.assign(placeholder.style, cardStyle("#eef1f5", colors.muted) as CSSProperties);

      slot.appendChild(label);
      slot.appendChild(placeholder);
      host.appendChild(slot);
      slots.push(slot);
    }

    const mover = document.createElement("div");
    mover.textContent = "mover";
    Object.assign(mover.style, cardStyle(colors.accent, "#fff") as CSSProperties);

    slots[0]!.appendChild(mover);
    moverRef.current = mover;
    slotsRef.current = slots;
    setCurrent(0);
    setSized(false);
  };

  useEffect(() => {
    build();
    // 仅在挂载时构建一次；之后的移动全部是命令式的 FLIP
  }, []);

  const moveTo = (index: number) => {
    const mover = moverRef.current;
    const slot = slotsRef.current[index];
    if (!mover || !slot) return;
    flipAnimate(
      mover,
      () => {
        slot.appendChild(mover);
      },
      optsRef.current,
    );
    setCurrent(index);
  };

  const toggleSize = () => {
    const mover = moverRef.current;
    if (!mover) return;
    const next = sized ? "100%" : "60%";
    flipAnimate(
      mover,
      () => {
        mover.style.width = next;
      },
      {...optsRef.current, scale: true},
    );
    setSized((value) => !value);
  };

  const randomize = () => {
    let next = current;
    while (next === current) next = Math.floor(Math.random() * SLOT_COUNT);
    moveTo(next);
  };

  return (
    <Demo
      title={t({zh: "示例:一张卡片在四个槽位之间移动", en: "Demo: one card moving between four slots"})}
      hint={t({
        zh: "点槽位、或点「随机移动」。卡片先被瞬移到新位置，再用 transform 把它「拽回」旧位置并动画放回——布局只变了一次。打开 scale 后，尺寸变化也会以视觉缩放动画。",
        en: "Click a slot or Randomize. The card jumps to its new position, then a transform briefly drags it back and animates it into place — layout changes exactly once. With scale on, a size change animates as a visual scale too.",
      })}
    >
      <Controls>
        <Label>duration</Label>
        <select
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          style={controlStyle}
        >
          {[120, 300, 600].map((value) => (
            <option key={value} value={value}>
              {value}ms
            </option>
          ))}
        </select>
        <Label>easing</Label>
        <select value={easing} onChange={(event) => setEasing(event.target.value)} style={controlStyle}>
          {["ease-in-out", "linear", "cubic-bezier(0.34, 1.56, 0.64, 1)"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={scale} onChange={(event) => setScale(event.target.checked)} />
          scale
        </label>
      </Controls>

      <div ref={hostRef} style={{display: "flex", gap: 10, marginTop: 12}} />

      <Controls>
        {SLOT_LABELS.map((label, index) => (
          <Button key={label} onClick={() => moveTo(index)} disabled={index === current} tone="ghost">
            {t({zh: `移到 ${label}`, en: `to ${label}`})}
          </Button>
        ))}
        <Button onClick={randomize} tone="ghost">
          {t({zh: "随机移动", en: "Randomize"})}
        </Button>
        <Button onClick={toggleSize} tone="ghost">
          scale: {sized ? t({zh: "缩小", en: "shrink"}) : t({zh: "放大", en: "grow"})}
        </Button>
        <Button onClick={build} tone="ghost">
          {t({zh: "重置", en: "Reset"})}
        </Button>
      </Controls>
    </Demo>
  );
};

export const FlipDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              用布局属性（<InlineCode>top</InlineCode>/<InlineCode>left</InlineCode>/
              <InlineCode>width</InlineCode>/<InlineCode>height</InlineCode>）做动画会让每帧都重算布局——
              主线程一忙就卡。改用 <InlineCode>transform</InlineCode>/
              <InlineCode>opacity</InlineCode> 动画移动的是已绘制的图层，由合成器线程直接处理，
              主线程再忙也不受影响。
            </>
          ),
          en: (
            <>
              Animating layout properties (<InlineCode>top</InlineCode>/<InlineCode>left</InlineCode>/
              <InlineCode>width</InlineCode>/<InlineCode>height</InlineCode>) recomputes layout every
              frame and stutters when the main thread is busy. Animating <InlineCode>transform</InlineCode>/
              <InlineCode>opacity</InlineCode> moves an already-painted layer, handled by the compositor
              thread — a busy main thread cannot stop it.
            </>
          ),
        })}
      </P>

      <P>
        {t({
          zh: (
            <>
              但有些动画的布局确实必须变——比如删除列表项后下方项要上移。FLIP（First, Last, Invert, Play）
              解决这个两难：只触发恰好一次布局变更，整个可见位移交给 transform 插值。
            </>
          ),
          en: (
            <>
              Some animations genuinely require a layout change — e.g. items below a deleted row sliding
              up. FLIP (First, Last, Invert, Play) resolves the dilemma: cause exactly one layout change
              and leave the entire visible movement to a transform interpolation.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              四步：<b>First</b> 测移动前位置 → <b>Last</b> 真正改变布局并测新位置（布局只在这里发生一次）
              → <b>Invert</b> 在新位置施加反向 transform，让它看起来还在旧位置 →
              <b>Play</b> 把该 transform 动画到无。用户眼中它滑过去，实际上它早已到位。
            </>
          ),
          en: (
            <>
              Four steps: <b>First</b> measure the old position → <b>Last</b> perform the layout change
              and measure the new one (layout happens once, here) → <b>Invert</b> apply the inverse
              transform so it looks like it is still in the old position → <b>Play</b> animate that
              transform away. The user sees it glide; in reality it already arrived.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. flipAnimate", en: "1. flipAnimate"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>flipAnimate(element, layoutChange, options?)</InlineCode> 把四步封成一个调用。
                <InlineCode>layoutChange</InlineCode> 里做真正的 DOM 变更——它会在 First 与 Last 测量之间执行。
                返回播放阶段产生的 <InlineCode>Animation</InlineCode>，可以进一步 <InlineCode>cancel()</InlineCode>{" "}
                或监听 <InlineCode>finished</InlineCode>。
              </>
            ),
            en: (
              <>
                <InlineCode>flipAnimate(element, layoutChange, options?)</InlineCode> wraps the four
                steps in one call. The real DOM mutation goes in <InlineCode>layoutChange</InlineCode>,
                which runs between the First and Last measurements. It returns the Animation produced by
                the play phase, which you can further <InlineCode>cancel()</InlineCode> or listen to via{" "}
                <InlineCode>finished</InlineCode>.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { flipAnimate } from "@wwog/react";

// 把元素移到列表顶部,带动画
flipAnimate(el, () => {
  list.prepend(el); // 唯一的一次布局变更
});

// 带选项
flipAnimate(el, () => list.prepend(el), {
  duration: 200,
  easing: "linear",
  scale: false,
});`}
          caption={t({
            zh: "一次调用只负责一个元素。多元素重排时，对每个发生位移的元素各调用一次；注意共享同一次布局变更。",
            en: "One call handles one element. For a multi-element reorder, call it once per displaced element; note that they should share a single layout change.",
          })}
        />
        <FlipDemo />
      </Section>

      <Section title={t({zh: "2. 选项", en: "2. Options"})}>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "默认", en: "default"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>duration</InlineCode>,
              <InlineCode>number</InlineCode>,
              <InlineCode>300</InlineCode>,
              t({zh: "动画时长（毫秒）。", en: "Animation duration in milliseconds."}),
            ],
            [
              <InlineCode>easing</InlineCode>,
              <InlineCode>string</InlineCode>,
              <InlineCode>"ease-in-out"</InlineCode>,
              t({zh: "播放阶段的缓动曲线。", en: "Easing for the play phase."}),
            ],
            [
              <InlineCode>scale</InlineCode>,
              <InlineCode>boolean</InlineCode>,
              <InlineCode>false</InlineCode>,
              t({
                zh: "尺寸变化也用 transform: scale 动画（视觉缩放而非布局缩放）。",
                en: "Animate size changes with transform: scale (visual, not layout, scaling).",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. 使用注意", en: "3. Cautions"})}>
        <ApiTable
          head={[t({zh: "注意", en: "caution"}), t({zh: "说明", en: "why it matters"})]}
          rows={[
            [
              t({zh: "layoutChange 必须同步", en: "layoutChange must be synchronous"}),
              t({
                zh: "Last 的测量紧跟在 layoutChange 之后；异步的变更（React 渲染、await）会让测量拿到旧值。",
                en: "The Last measurement follows layoutChange immediately; asynchronous mutation (a React render, an await) makes it measure the old layout.",
              }),
            ],
            [
              t({zh: "测量会强制布局", en: "Measurement forces layout"}),
              t({
                zh: "getBoundingClientRect 两次，各自强制一次布局；这是 FLIP 的固定成本，别在高频路径上滥用。",
                en: "Two getBoundingClientRect calls, each forcing layout; that is FLIP's fixed cost — do not put it on a high-frequency path.",
              }),
            ],
            [
              t({zh: "同时动画的元素不要太多", en: "Do not animate too many elements at once"}),
              t({
                zh: "每个元素一条独立动画；几百个元素同时 FLIP 仍会压垮合成器。",
                en: "Each element gets its own animation; FLIP-ing hundreds at once still overwhelms the compositor.",
              }),
            ],
            [
              t({zh: "尊重减少动态偏好", en: "Respect reduced motion"}),
              t({
                zh: "用户开启 prefers-reduced-motion 时，可跳过动画直接完成变更。",
                en: "When the user prefers reduced motion, skip the animation and just apply the change.",
              }),
            ],
          ]}
        />
        <Muted>
          {t({
            zh: "Vue 的 TransitionGroup 与 Framer Motion 的布局动画，底层都是 FLIP。",
            en: "Vue's TransitionGroup and Framer Motion's layout animations are FLIP under the hood.",
          })}
        </Muted>
      </Section>
    </div>
  );
};
