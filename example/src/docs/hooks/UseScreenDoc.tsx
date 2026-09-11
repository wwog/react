import {useEffect, useState, type FC} from "react";
import {
  DefBreakpointDesc,
  breakpoints,
  getCurrentBreakpoint,
  useScreen,
  type BreakpointDesc,
} from "../../../../src";
import {useI18n} from "../../i18n";
import {
  ApiTable,
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
} from "../ui";

/** 独立追踪窗口宽度，只为在示例里展示当前像素值；useScreen 本身不暴露宽度。 */
const useWindowWidth = (): number => {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
};

/** 一套整体缩小、方便在普通窗口里命中的自定义阈值。 */
const CompactDesc: BreakpointDesc = {
  xs: 320,
  sm: 480,
  md: 640,
  lg: 800,
  xl: 960,
  "2xl": 1120,
  "3xl": 1280,
};

const ThresholdChips: FC<{desc: BreakpointDesc; current: string}> = ({desc, current}) => (
  <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4}}>
    {breakpoints
      .filter((name) => name !== "base")
      .map((name) => {
        const active = name === current;
        return (
          <span
            key={name}
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              fontSize: 12.5,
              border: `1px solid ${active ? colors.accentBorder : colors.border}`,
              background: active ? colors.accentSoft : "#fff",
              color: active ? colors.accent : colors.muted,
            }}
          >
            {name} ≥ {desc[name] ?? "—"}
          </span>
        );
      })}
  </div>
);

// ---- 实时读取 ----

const LiveReadoutDemo: FC = () => {
  const {t} = useI18n();
  const current = useScreen();
  const width = useWindowWidth();
  // 纯函数以真实窗口宽度为基准，用来对照 useScreen 的实时值。
  const reference = getCurrentBreakpoint(DefBreakpointDesc, width);
  const disagree = current !== reference;

  return (
    <Demo
      title={t({zh: "示例：当前断点的实时读数", en: "Demo: a live readout of the current breakpoint"})}
      hint={t({
        zh: "缩放浏览器窗口。useScreen() 通过 matchMedia 监听相邻断点；右侧「纯函数参考」是按当前窗口宽度即时算出的真值，两者不一致时说明命中了下方「注意」里的下降边界问题。",
        en: "Resize the browser window. useScreen() watches adjacent breakpoints through matchMedia; the pure reference is computed from the live window width. When they differ, the descending-boundary issue under Cautions below is showing.",
      })}
    >
      <Stats>
        <Stat label="useScreen()" value={current} />
        <Stat label={t({zh: "纯函数参考", en: "pure reference"})} value={reference} />
        <Stat label={t({zh: "窗口宽度", en: "window width"})} value={`${width}px`} />
      </Stats>

      <ThresholdChips desc={DefBreakpointDesc} current={current} />

      {disagree ? (
        <div style={{marginTop: 14}}>
          <Callout tone="warn">
            {t({
              zh: (
                <>
                  useScreen() 报告 <InlineCode>{current}</InlineCode>，但当前宽度实际落在{" "}
                  <InlineCode>{reference}</InlineCode>。这是 hook 在向下跨断点时的已知取整问题：缩小窗口可能跳过相邻断点。
                </>
              ),
              en: (
                <>
                  useScreen() reports <InlineCode>{current}</InlineCode> while the current width is
                  actually in <InlineCode>{reference}</InlineCode>. This is the hook's known descending
                  issue: shrinking can skip the adjacent breakpoint.
                </>
              ),
            })}
          </Callout>
        </div>
      ) : (
        <div style={{marginTop: 12}}>
          <Muted>
            {t({zh: "两者一致。", en: "Both agree."})}
          </Muted>
        </div>
      )}
    </Demo>
  );
};

// ---- 自定义阈值 ----

const CustomDescDemo: FC = () => {
  const {t} = useI18n();
  const [custom, setCustom] = useState(false);
  const width = useWindowWidth();
  const desc = custom ? CompactDesc : DefBreakpointDesc;
  const current = useScreen(desc);

  return (
    <Demo
      title={t({zh: "示例：换一套自定义 breakpointDesc", en: "Demo: swapping in a custom breakpointDesc"})}
      hint={t({
        zh: "CompactDesc 把每个阈值整体缩小，所以普通桌面窗口也能在几档之间移动。切换时对象引用变化，内部用 JSON 稳定化后重跑 effect，读数立即更新。",
        en: "CompactDesc scales every threshold down, so a normal desktop window can move across several steps. Switching changes the object identity; the hook stabilizes it by JSON and re-runs its effect, so the readout updates immediately.",
      })}
    >
      <Controls>
        <Label>{t({zh: "阈值来源", en: "thresholds"})}</Label>
        <button
          type="button"
          onClick={() => setCustom(false)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
            border: `1px solid ${custom ? colors.border : colors.accentBorder}`,
            background: custom ? "#fff" : colors.accentSoft,
            color: custom ? colors.muted : colors.accent,
          }}
        >
          DefBreakpointDesc
        </button>
        <button
          type="button"
          onClick={() => setCustom(true)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
            border: `1px solid ${custom ? colors.accentBorder : colors.border}`,
            background: custom ? colors.accentSoft : "#fff",
            color: custom ? colors.accent : colors.muted,
          }}
        >
          CompactDesc
        </button>
        <Muted>{`${width}px`}</Muted>
      </Controls>

      <div style={{marginTop: 12}}>
        <Stats>
          <Stat label="useScreen(desc)" value={current} />
        </Stats>
        <ThresholdChips desc={desc} current={current} />
      </div>
    </Demo>
  );
};

// ---- 纯函数 ----

const PureDemo: FC = () => {
  const {t} = useI18n();
  const [width, setWidth] = useState(700);
  const name = getCurrentBreakpoint(DefBreakpointDesc, width);
  const compact = getCurrentBreakpoint(CompactDesc, width);

  return (
    <Demo
      title={t({zh: "示例：getCurrentBreakpoint 纯函数", en: "Demo: the pure getCurrentBreakpoint"})}
      hint={t({
        zh: "拖动滑杆改变宽度，结果完全由输入决定，与真实窗口无关。实现从最大的断点往下找第一个满足 width ≥ 阈值的项，都不到则回落到 base。",
        en: "Drag the slider to change the width; the result is a pure function of the input, independent of the real window. It scans from the largest breakpoint down for the first width ≥ threshold, falling back to base.",
      })}
    >
      <Controls>
        <input
          type="range"
          min={0}
          max={2000}
          step={1}
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          style={{width: 300}}
        />
        <Label>{`${width}px`}</Label>
      </Controls>

      <Output>
        <div>
          getCurrentBreakpoint(DefBreakpointDesc, {width}) → <strong>{name}</strong>
        </div>
        <div>
          getCurrentBreakpoint(CompactDesc, {width}) → <strong>{compact}</strong>
        </div>
      </Output>
    </Demo>
  );
};

export const UseScreenDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>useScreen</InlineCode> 返回当前命中的断点名，并在窗口跨过阈值时自动更新；
              配套的纯函数 <InlineCode>getCurrentBreakpoint</InlineCode> 则把「宽度 + 阈值表 → 断点名」
              这一步暴露出来，便于在非 React 环境复用或做单元测试。
            </>
          ),
          en: (
            <>
              <InlineCode>useScreen</InlineCode> returns the breakpoint currently in effect and updates
              as the window crosses thresholds; the companion pure function{" "}
              <InlineCode>getCurrentBreakpoint</InlineCode> exposes the "width + thresholds → name" step
              for reuse outside React or for unit tests.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              本页用到的 <InlineCode>breakpoints</InlineCode> 与 <InlineCode>DefBreakpointDesc</InlineCode>{" "}
              定义在 utils 分组的「基础工具」页；<InlineCode>SizeBox</InlineCode> 等响应式组件也建立在同一套常量上。
            </>
          ),
          en: (
            <>
              The <InlineCode>breakpoints</InlineCode> and <InlineCode>DefBreakpointDesc</InlineCode> used
              here are defined on the utils "Foundations" page; responsive components such as{" "}
              <InlineCode>SizeBox</InlineCode> build on the same constants.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 实时读取当前断点", en: "1. Reading the current breakpoint live"})}>
        <P>
          {t({
            zh: (
              <>
                首个参数是可选的阈值表，默认 <InlineCode>DefBreakpointDesc</InlineCode>。每次渲染前如果传入的是
                字面量对象，引用会变，hook 内部用 <InlineCode>JSON.stringify</InlineCode> 取稳定 key，
                因此effect 不会被无谓地重跑。
              </>
            ),
            en: (
              <>
                The optional first argument is a threshold map, defaulting to{" "}
                <InlineCode>DefBreakpointDesc</InlineCode>. A literal object passed on every render would
                change identity, so the hook derives a stable key with{" "}
                <InlineCode>JSON.stringify</InlineCode> to avoid needless effect re-runs.
              </>
            ),
          })}
        </P>
        <LiveReadoutDemo />
        <Code
          code={`import { useScreen } from "@wwog/react";

const bp = useScreen();
// 等价于：
const bp2 = useScreen(DefBreakpointDesc);

// 断点名："base" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"`}
        />
      </Section>

      <Section title={t({zh: "2. 自定义 breakpointDesc", en: "2. A custom breakpointDesc"})}>
        <P>
          {t({
            zh: (
              <>
                传入自己的阈值表即可整体重定义分档。区间判定与监听都基于同一张表；断点名称仍然取自全局{" "}
                <InlineCode>breakpoints</InlineCode>，只是每档的触发宽度由你决定。
              </>
            ),
            en: (
              <>
                Pass your own threshold map to redefine the scale. Both the range lookup and the
                listeners use that same table; names still come from the global{" "}
                <InlineCode>breakpoints</InlineCode>, but each step's trigger width is yours to choose.
              </>
            ),
          })}
        </P>
        <CustomDescDemo />
        <Code
          code={`import { useScreen, type BreakpointDesc } from "@wwog/react";

const compact: BreakpointDesc = {
  xs: 320, sm: 480, md: 640, lg: 800,
  xl: 960, "2xl": 1120, "3xl": 1280,
};

const bp = useScreen(compact);`}
          caption={t({
            zh: "缺省的档位在该表里没有阈值，会被跳过；建议给出连续、无洞的阈值以保证监听完整。",
            en: "A breakpoint without a threshold in the map is skipped; prefer a contiguous, hole-free map so listeners stay complete.",
          })}
        />
      </Section>

      <Section title={t({zh: "3. 纯函数：由宽度算断点", en: "3. The pure function: width to breakpoint"})}>
        <P>
          {t({
            zh: (
              <>
                没有副作用、没有 DOM 依赖：给定阈值表和宽度，返回断点名。因此它既能给{" "}
                <InlineCode>useScreen</InlineCode> 复用，也能在测试里直接断言。宽于最大阈值时返回最大档，
                窄于最小阈值时返回 <InlineCode>"base"</InlineCode>；阈值为 <InlineCode>NaN</InlineCode>{" "}
                的档位会被跳过。
              </>
            ),
            en: (
              <>
                No side effects and no DOM dependency: given a threshold map and a width it returns a
                name. That makes it reusable by <InlineCode>useScreen</InlineCode> and directly
                assertable in tests. Widths beyond the largest threshold return the largest step, widths
                below the smallest return <InlineCode>"base"</InlineCode>, and a{" "}
                <InlineCode>NaN</InlineCode> threshold is skipped.
              </>
            ),
          })}
        </P>
        <PureDemo />
        <Code
          code={`import { getCurrentBreakpoint, DefBreakpointDesc } from "@wwog/react";

getCurrentBreakpoint(DefBreakpointDesc, 100);  // "base"
getCurrentBreakpoint(DefBreakpointDesc, 900);  // "lg"
getCurrentBreakpoint(DefBreakpointDesc, 4000); // "3xl"

// 只提供 md 一档时，400 与 1200 都得不到中间档
getCurrentBreakpoint({ md: 768 }, 400);   // "base"
getCurrentBreakpoint({ md: 768 }, 1200);  // "md"`}
        />
      </Section>

      <Section title={t({zh: "4. API 参考", en: "4. API reference"})}>
        <P>
          <InlineCode>useScreen(breakpointDesc?)</InlineCode> → <InlineCode>BreakpointName</InlineCode>
        </P>
        <ApiTable
          head={[
            t({zh: "参数", en: "parameter"}),
            t({zh: "类型", en: "type"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>breakpointDesc</InlineCode>,
              <InlineCode>BreakpointDesc</InlineCode>,
              t({
                zh: "阈值表；省略时用 DefBreakpointDesc。",
                en: "Threshold map; defaults to DefBreakpointDesc.",
              }),
            ],
          ]}
        />
        <P>
          <InlineCode>getCurrentBreakpoint(breakpointDesc, width)</InlineCode> →{" "}
          <InlineCode>BreakpointName</InlineCode>
        </P>
        <ApiTable
          head={[
            t({zh: "参数", en: "parameter"}),
            t({zh: "类型", en: "type"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>breakpointDesc</InlineCode>,
              <InlineCode>BreakpointDesc</InlineCode>,
              t({zh: "断点 → 最小宽度阈值。", en: "Breakpoint to minimum-width threshold."}),
            ],
            [
              <InlineCode>width</InlineCode>,
              <InlineCode>number</InlineCode>,
              t({zh: "待判定的像素宽度。", en: "The pixel width to classify."}),
            ],
          ]}
        />
        <P>
          {t({
            zh: "默认阈值",
            en: "Default thresholds",
          })}
        </P>
        <Controls>
          {breakpoints
            .filter((name) => name !== "base")
            .map((name) => (
              <Muted key={name}>
                {name}:{DefBreakpointDesc[name]}
              </Muted>
            ))}
        </Controls>
      </Section>

      <Section title={t({zh: "5. 注意", en: "5. Cautions"})}>
        <ApiTable
          head={[
            t({zh: "注意", en: "caution"}),
            t({zh: "说明", en: "why it matters"}),
          ]}
          rows={[
            [
              t({zh: "放大方向精确，缩小方向会跳档", en: "Growing is exact, shrinking skips"}),
              t({
                zh: "每轮只为「下一档」注册 min-width、却为「上一档的阈值」注册 max-width。当前在 md 时注册的是 max-width: sm-1（639），触发时宽度已落到 xs——于是缩小会跳过紧邻的 sm。放大方向不受影响。",
                en: "Each pass registers min-width for the next step but max-width for the previous step's threshold. At md the query is max-width: sm-1 (639); when it fires the width is already in xs, so shrinking skips the adjacent sm. Growing is unaffected.",
              }),
            ],
            [
              t({zh: "稀疏阈值会产生监听空洞", en: "Sparse maps leave listener holes"}),
              t({
                zh: "若某档没有阈值，夹在它两侧的档位之间不会注册任何监听，跨过该区间的缩放无法被感知；请提供连续阈值。",
                en: "If a step has no threshold, no listener is registered between its neighbors, so a resize across that range is never observed; keep the map contiguous.",
              }),
            ],
            [
              t({zh: "NaN 会抛错", en: "NaN throws"}),
              t({
                zh: "effect 内若发现相邻档位的阈值是 NaN，会直接 throw；阈值必须是有效数字。",
                en: "If an adjacent threshold is NaN the effect throws outright; thresholds must be valid numbers.",
              }),
            ],
            [
              t({zh: "SSR / 无 window 时返回 base", en: "Returns base under SSR / no window"}),
              t({
                zh: "初始状态在 window 不存在时回落为 \"base\"，客户端挂载后再校正。",
                en: "The initial state falls back to \"base\" when window is absent, then corrects itself after client mount.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
