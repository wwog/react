import {useEffect, useRef, useState, type FC, type ReactNode} from "react";
import {
  getFocusableElements,
  getTabIndex,
  getTabbableElements,
  type FocusableOptions,
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
  P,
  Section,
  colors,
  controlStyle,
} from "../ui";

const displayChecks: NonNullable<FocusableOptions["displayCheck"]>[] = [
  "full",
  "full-native",
  "legacy-full",
  "non-zero-area",
  "none",
];

const flashOutline = `2px solid ${colors.accent}`;

const Field: FC<{label: string; children: ReactNode; name: string}> = ({label, children, name}) => (
  <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
    <span style={{width: 150, fontSize: 12, color: colors.muted, flexShrink: 0}}>{label}</span>
    <div data-name={name}>{children}</div>
  </div>
);

/**
 * 面板里混入各种「看起来能聚焦、实际不能」和「看起来不能、实际能」的元素，
 * 再用 getFocusableElements / getTabbableElements 把它算出来。结果列表可点，点了会真正 focus。
 */
const FocusableDemo: FC = () => {
  const {t} = useI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const shadowHostRef = useRef<HTMLDivElement | null>(null);
  const shadowButtonRef = useRef<HTMLButtonElement | null>(null);
  const [includeContainer, setIncludeContainer] = useState(false);
  const [getShadowRoot, setGetShadowRoot] = useState(true);
  const [displayCheck, setDisplayCheck] = useState<NonNullable<FocusableOptions["displayCheck"]>>("full");
  const [mode, setMode] = useState<"focusable" | "tabbable">("tabbable");
  const [result, setResult] = useState<{name: string; tabIndex: number}[] | null>(null);

  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({mode: "open"});
    root.innerHTML = "";
    const inner = document.createElement("button");
    inner.textContent = "shadow 里的按钮";
    inner.dataset.name = "shadow DOM 内的按钮";
    root.appendChild(inner);
    shadowButtonRef.current = inner;
  }, []);

  const collect = (nextMode: "focusable" | "tabbable") => {
    const panel = panelRef.current;
    if (!panel) return;
    const options: FocusableOptions = {includeContainer, getShadowRoot, displayCheck};
    const elements = nextMode === "focusable" ? getFocusableElements(panel, options) : getTabbableElements(panel, options);
    setMode(nextMode);
    setResult(
      elements.map((el) => ({
        name: (el.dataset.name ?? el.closest("[data-name]")?.getAttribute("data-name") ?? el.tagName).slice(0, 40),
        tabIndex: getTabIndex(el),
      })),
    );
  };

  const focusItem = (index: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const options: FocusableOptions = {includeContainer, getShadowRoot, displayCheck};
    const elements = mode === "focusable" ? getFocusableElements(panel, options) : getTabbableElements(panel, options);
    const target = elements[index];
    if (!target) return;
    target.focus();
    target.scrollIntoView({block: "nearest"});
    target.style.outline = flashOutline;
    target.style.outlineOffset = "2px";
    window.setTimeout(() => {
      target.style.outline = "";
      target.style.outlineOffset = "";
    }, 900);
  };

  return (
    <Demo
      title={t({zh: "示例:算出一个容器里的可聚焦 / 可 Tab 元素", en: "Demo: compute focusable / tabbable elements in a container"})}
      hint={t({
        zh: "面板里既有正常控件，也有 disabled、display:none、inert、tabindex=-1/3、contenteditable、details/summary 和一个 shadow DOM 内的按钮。切换选项看结果如何变化。",
        en: "The panel mixes normal controls with disabled, display:none, inert, tabindex=-1/3, contenteditable, details/summary, and a button inside a shadow DOM. Toggle options and watch the result change.",
      })}
    >
      <Controls>
        <Button onClick={() => collect("focusable")} tone={mode === "focusable" ? "primary" : "ghost"}>
          {t({zh: "可聚焦 (focusable)", en: "Focusable"})}
        </Button>
        <Button onClick={() => collect("tabbable")} tone={mode === "tabbable" ? "primary" : "ghost"}>
          {t({zh: "Tab 顺序 (tabbable)", en: "Tabbable"})}
        </Button>
      </Controls>

      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={includeContainer}
            onChange={(event) => setIncludeContainer(event.target.checked)}
          />
          includeContainer
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={getShadowRoot}
            onChange={(event) => setGetShadowRoot(event.target.checked)}
          />
          getShadowRoot
        </label>
        <Label>displayCheck</Label>
        <select
          value={displayCheck}
          onChange={(event) => setDisplayCheck(event.target.value as NonNullable<FocusableOptions["displayCheck"]>)}
          style={controlStyle}
        >
          {displayChecks.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Controls>

      <div
        ref={panelRef}
        tabIndex={includeContainer ? -1 : undefined}
        data-name="容器本身"
        style={{
          marginTop: 12,
          padding: 12,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <Field label={t({zh: "普通按钮", en: "plain button"})} name="普通按钮">
          <button type="button">ok</button>
        </Field>
        <Field label={t({zh: "禁用按钮", en: "disabled button"})} name="禁用按钮">
          <button type="button" disabled>
            disabled
          </button>
        </Field>
        <Field label={t({zh: "链接", en: "link"})} name="链接">
          <a href="#focusable">link</a>
        </Field>
        <Field label={t({zh: "文本输入", en: "text input"})} name="文本输入">
          <input defaultValue="text" />
        </Field>
        <Field label={t({zh: "hidden input", en: "hidden input"})} name="hidden input">
          <input type="hidden" />
        </Field>
        <Field label={t({zh: "tabindex=-1", en: "tabindex=-1"})} name="tabindex=-1 的 div">
          <div tabIndex={-1}>programmatic only</div>
        </Field>
        <Field label={t({zh: "tabindex=3", en: "tabindex=3"})} name="tabindex=3 的 div">
          <div tabIndex={3}>ordered</div>
        </Field>
        <Field label={t({zh: "contenteditable", en: "contenteditable"})} name="contenteditable 的 div">
          <div contentEditable suppressContentEditableWarning>
            edit me
          </div>
        </Field>
        <Field label={t({zh: "details / summary", en: "details / summary"})} name="summary">
          <details>
            <summary>summary</summary>
            body
          </details>
        </Field>
        <Field label={t({zh: "display:none 内", en: "inside display:none"})} name="display:none 容器">
          <div style={{display: "none"}}>
            <button type="button" data-name="display:none 里的按钮">
              hidden
            </button>
          </div>
        </Field>
        <Field label={t({zh: "visibility:hidden 内", en: "inside visibility:hidden"})} name="visibility:hidden 容器">
          <div style={{visibility: "hidden"}}>
            <button type="button" data-name="visibility:hidden 里的按钮">
              invisible
            </button>
          </div>
        </Field>
        <Field label={t({zh: "inert 容器内", en: "inside inert"})} name="inert 容器">
          <div inert>
            <button type="button" data-name="inert 里的按钮">
              inert
            </button>
          </div>
        </Field>
        <Field label={t({zh: "禁用 fieldset", en: "disabled fieldset"})} name="fieldset">
          <fieldset disabled style={{border: `1px solid ${colors.border}`, borderRadius: 6}}>
            <legend>
              <button type="button" data-name="legend 里的按钮">
                legend
              </button>
            </legend>
            <button type="button" data-name="fieldset 里的按钮">
              inside
            </button>
          </fieldset>
        </Field>
        <Field label={t({zh: "shadow DOM 内", en: "inside shadow DOM"})} name="shadow 宿主">
          <div ref={shadowHostRef} />
        </Field>
      </div>

      {result ? (
        <div style={{marginTop: 14}}>
          <Label>
            {mode === "focusable"
              ? t({zh: "可聚焦元素", en: "focusable elements"})
              : t({zh: "按 Tab 顺序排列", en: "tabbable, in tab order"})}{" "}
            <Muted>({result.length})</Muted>
          </Label>
          <div style={{marginTop: 8, display: "grid", gap: 4}}>
            {result.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                onClick={() => focusItem(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                <span style={{width: 22, color: colors.muted, fontSize: 12}}>{index}</span>
                <span style={{flex: 1, color: colors.text}}>{item.name}</span>
                <Muted>tabIndex={item.tabIndex}</Muted>
              </button>
            ))}
            {result.length === 0 ? (
              <Muted>{t({zh: "没有匹配元素。", en: "No matching elements."})}</Muted>
            ) : null}
          </div>
        </div>
      ) : null}
    </Demo>
  );
};

export const FocusableDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              这一组函数回答「容器里哪些元素能获得焦点、顺序如何」。它比 <InlineCode>querySelectorAll</InlineCode>{" "}
              复杂得多：要排除 disabled、<InlineCode>display:none</InlineCode>、<InlineCode>inert</InlineCode>、
              禁用 fieldset，要处理 <InlineCode>tabindex</InlineCode> 的排序，还要能穿透 open shadow root 与{" "}
              <InlineCode>slot</InlineCode>。
            </>
          ),
          en: (
            <>
              This group answers "which elements in a container can receive focus, and in what order".
              It is far more involved than <InlineCode>querySelectorAll</InlineCode>: it must exclude
              disabled controls, <InlineCode>display:none</InlineCode>, <InlineCode>inert</InlineCode>{" "}
              and disabled fieldsets, sort by <InlineCode>tabindex</InlineCode>, and see through open
              shadow roots and <InlineCode>slot</InlineCode>s.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              <b>可聚焦</b>（focusable）与<b>可 Tab</b>（tabbable）不是一回事：
              <InlineCode>tabindex=&quot;-1&quot;</InlineCode> 的元素可以被脚本 <InlineCode>focus()</InlineCode>，
              但不在 Tab 键的循环里。焦点陷阱（FocusTrap）划范围用前者，实现 Tab 循环用后者。
            </>
          ),
          en: (
            <>
              <b>Focusable</b> and <b>tabbable</b> are not the same: a{" "}
              <InlineCode>tabindex=&quot;-1&quot;</InlineCode> element can be focused by script but is
              not in the Tab cycle. A focus trap uses the former to scope, the latter to implement the
              Tab loop.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 交互演示", en: "1. Interactive demo"})}>
        <FocusableDemo />
      </Section>

      <Section title={t({zh: "2. 四个入口", en: "2. Four entry points"})}>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "签名", en: "signature"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>isFocusable</InlineCode>,
              <InlineCode>(node, options?) =&gt; boolean</InlineCode>,
              t({zh: "单个元素能否被程序化 focus（含 tabindex=-1）。", en: "Whether one element can receive programmatic focus (includes tabindex=-1)."}),
            ],
            [
              <InlineCode>isTabbable</InlineCode>,
              <InlineCode>(node, options?) =&gt; boolean</InlineCode>,
              t({zh: "单个元素能否通过 Tab 聚焦。", en: "Whether one element can be focused via Tab."}),
            ],
            [
              <InlineCode>getFocusableElements</InlineCode>,
              <InlineCode>(container, options?) =&gt; HTMLElement[]</InlineCode>,
              t({zh: "容器内所有可聚焦元素（文档顺序）。", en: "All focusable elements in the container (document order)."}),
            ],
            [
              <InlineCode>getTabbableElements</InlineCode>,
              <InlineCode>(container, options?) =&gt; HTMLElement[]</InlineCode>,
              t({zh: "容器内可 Tab 元素，按 tab 顺序排列。", en: "Tabbable elements, sorted by tab order."}),
            ],
            [
              <InlineCode>getTabIndex</InlineCode>,
              <InlineCode>(node) =&gt; number</InlineCode>,
              t({zh: "元素的有效 tab 顺序值（含浏览器默认映射）。", en: "The effective tab order value, including browser defaults."}),
            ],
          ]}
        />
        <Code
          code={`import {
  getFocusableElements,
  getTabbableElements,
  isFocusable,
  isTabbable,
} from "@wwog/react";

const dialog = document.querySelector("#dialog");

// 焦点陷阱的范围:包含 tabindex="-1" 的元素
const scope = getFocusableElements(dialog);

// Tab 循环:只把可 Tab 元素排进顺序
const loop = getTabbableElements(dialog, { includeContainer: false });
const next = loop[(index + 1) % loop.length];

isFocusable(el); // 能被脚本 focus?
isTabbable(el);  // 在 Tab 循环里?`}
        />
      </Section>

      <Section title={t({zh: "3. options", en: "3. Options"})}>
        <ApiTable
          head={[t({zh: "选项", en: "option"}), t({zh: "类型", en: "type"}), t({zh: "默认", en: "default"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>includeContainer</InlineCode>,
              <InlineCode>boolean</InlineCode>,
              <InlineCode>false</InlineCode>,
              t({zh: "是否把容器自身纳入结果。", en: "Whether to include the container itself."}),
            ],
            [
              <InlineCode>getShadowRoot</InlineCode>,
              <InlineCode>boolean | (el) =&gt; ShadowRoot | boolean | undefined</InlineCode>,
              <InlineCode>true</InlineCode>,
              t({zh: "是否遍历 open shadow root；也可传函数自定义解析。", en: "Traverse open shadow roots, or supply a custom resolver function."}),
            ],
            [
              <InlineCode>displayCheck</InlineCode>,
              <InlineCode>"full" | "full-native" | "legacy-full" | "non-zero-area" | "none"</InlineCode>,
              <InlineCode>"full"</InlineCode>,
              t({
                zh: "可见性检查策略；none 不做可见性判断，non-zero-area 只看尺寸是否为 0。",
                en: "Visibility strategy; none skips visibility, non-zero-area only checks for zero size.",
              }),
            ],
          ]}
        />
        <P>
          <Muted>
            {t({
              zh: "inert 子树一律排除，且不受 displayCheck 影响——inert 是比不可见更强的语义。",
              en: "inert subtrees are always excluded, regardless of displayCheck — inert is a stronger signal than invisible.",
            })}
          </Muted>
        </P>
      </Section>
    </div>
  );
};
