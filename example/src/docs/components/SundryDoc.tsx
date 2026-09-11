import {useState, type CSSProperties, type FC} from "react";
import {Repeat, Scope, SizeBox, Styles, Toggle, cx} from "../../../../src";
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
  padding: "5px 11px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "#fff",
  fontSize: 13,
  color: colors.text,
};

// ---- Repeat ----

const RepeatDemo: FC = () => {
  const {t} = useI18n();
  const [times, setTimes] = useState(3);

  return (
    <Demo
      title={t({zh: "示例:骨架屏占位", en: "Demo: skeleton placeholders"})}
      hint={t({
        zh: "Repeat 只负责调用 children(index) 若干次；times ≤ 0 时返回 null。给每项加 key 由调用方负责。",
        en: "Repeat only calls children(index) a number of times; times <= 0 returns null. Adding a key is the caller's job.",
      })}
    >
      <Controls>
        <Label>
          {t({zh: "times", en: "times"})}: <strong>{times}</strong>
        </Label>
        <Button tone="ghost" onClick={() => setTimes((value) => Math.max(0, value - 1))}>
          −1
        </Button>
        <Button tone="ghost" onClick={() => setTimes((value) => Math.min(8, value + 1))}>
          +1
        </Button>
      </Controls>

      <div style={{marginTop: 14, display: "flex", flexDirection: "column", gap: 8}}>
        <Repeat times={times}>
          {(index) => (
            <div
              key={index}
              style={{
                height: 14,
                borderRadius: 7,
                background: `linear-gradient(90deg, #eef2f7, #e2e8f0 ${20 + index * 8}%, #eef2f7)`,
                width: `${100 - index * 6}%`,
              }}
            />
          )}
        </Repeat>
        {times === 0 ? <Muted>{t({zh: "times 为 0，什么都不渲染", en: "times is 0, nothing renders"})}</Muted> : null}
      </div>
    </Demo>
  );
};

// ---- Scope ----

const ScopeDemo: FC = () => {
  const {t} = useI18n();
  const [count, setCount] = useState(2);
  const [empty, setEmpty] = useState(false);

  return (
    <Demo
      title={t({zh: "示例:局部作用域变量", en: "Demo: local scope variables"})}
      hint={t({
        zh: "let 可以是对象，也可以是接收 props 的函数。函数形式更适合需要基于 props 计算的场景。",
        en: "let can be an object or a function of props; the function form fits values derived from props.",
      })}
    >
      <Controls>
        <Label>
          {t({zh: "items.length", en: "items.length"})}: <strong>{count}</strong>
        </Label>
        <Button tone="ghost" onClick={() => setCount((value) => Math.max(0, value - 1))}>
          −1
        </Button>
        <Button tone="ghost" onClick={() => setCount((value) => Math.min(6, value + 1))}>
          +1
        </Button>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={empty} onChange={(event) => setEmpty(event.target.checked)} />
          {t({zh: "空 scope", en: "empty scope"})}
        </label>
      </Controls>

      <Output>
        <Scope
          let={empty ? {} : (props: {items: number[]}) => ({total: props.items.length, doubled: props.items.length * 2})}
          props={{items: Array(count).fill(0)}}
          fallback={<Muted>{t({zh: "scope 为空，走 fallback", en: "Empty scope, using fallback"})}</Muted>}
        >
          {({total, doubled}) => (
            <div>
              total = <strong>{total}</strong>, doubled = <strong>{doubled}</strong>
            </div>
          )}
        </Scope>
      </Output>
    </Demo>
  );
};

// ---- Toggle ----

const THEME_STYLES: Record<string, CSSProperties> = {
  light: {background: "#ffffff", color: "#111827", borderColor: colors.border},
  dark: {background: "#111827", color: "#f9fafb", borderColor: "#111827"},
  auto: {background: colors.accentSoft, color: "#1e40af", borderColor: colors.accentBorder},
};

const ToggleDemo: FC = () => {
  const {t} = useI18n();

  return (
    <Demo
      title={t({zh: "示例:主题切换（默认 + 自定义 next）", en: "Demo: theme toggle (default + custom next)"})}
      hint={t({
        zh: "默认 next 是 (index + 1) % options.length；也可以传入自定义函数实现反向切换。",
        en: "The default next is (index + 1) % options.length; pass a custom function to cycle backwards.",
      })}
    >
      <Controls>
        <Toggle
          options={["light", "dark", "auto"]}
          render={(theme, toggle) => (
            <button
              type="button"
              onClick={toggle}
              style={{
                ...chip,
                ...THEME_STYLES[theme],
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "8px 14px",
              }}
            >
              {t({zh: "主题", en: "theme"})}: {theme} · {t({zh: "点击切换", en: "click to toggle"})}
            </button>
          )}
        />
        <Toggle
          options={["A", "B", "C", "D"]}
          index={2}
          next={(curIndex, options) => (curIndex - 1 + options.length) % options.length}
          render={(letter, toggle) => (
            <Button tone="ghost" onClick={toggle}>
              {t({zh: "反向", en: "reverse" })}: {letter}
            </Button>
          )}
        />
      </Controls>
    </Demo>
  );
};

// ---- SizeBox ----

const SizeBoxDemo: FC = () => {
  const {t} = useI18n();
  const [size, setSize] = useState(96);

  const inner = (): CSSProperties => ({
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px dashed ${colors.accentBorder}`,
    background: colors.accentSoft,
    color: "#1e40af",
    fontSize: 12,
  });

  return (
    <Demo
      title={t({zh: "示例:size 与 w / h 的优先级", en: "Demo: precedence of size vs w / h"})}
      hint={t({
        zh: "size 会同时覆盖宽高；未传 size 时才使用 w / h（或 width / height）。容器固定 flexShrink: 0，不会被压缩。",
        en: "size overrides both dimensions; w / h (or width / height) apply only when size is absent. The box is flexShrink: 0, so it never gets squeezed.",
      })}
    >
      <Controls>
        <Label>
          {t({zh: "size", en: "size"})}: <strong>{size}px</strong>
        </Label>
        <input
          type="range"
          min={40}
          max={160}
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
        />
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap"}}>
        <SizeBox size={size}>
          <div style={inner()}>size</div>
        </SizeBox>
        <SizeBox w={140} h={72}>
          <div style={inner()}>w=140 h=72</div>
        </SizeBox>
        <SizeBox w="40%" h={72}>
          <div style={inner()}>w=40%</div>
        </SizeBox>
      </div>
    </Demo>
  );
};

// ---- Styles ----

const STYLES_CSS = `
.sd-box { font: inherit; padding: 10px 16px; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; color: #111827; cursor: pointer; transition: box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease; }
.sd-round { border-radius: 999px; }
.sd-large { padding: 14px 22px; font-size: 15px; }
.sd-accent { background: #2563eb; color: #fff; border-color: transparent; }
.sd-hover:hover { box-shadow: 0 6px 18px rgba(37,99,235,.35); }
.sd-nested-outer { border-color: #2563eb; }
.sd-nested-inner { background: #eff6ff; color: #1e40af; letter-spacing: .5px; }
`;

const StylesDemo: FC = () => {
  const {t} = useI18n();
  const [accent, setAccent] = useState(true);
  const [rounded, setRounded] = useState(false);
  const [large, setLarge] = useState(false);

  const descriptor = {
    base: ["sd-box", ...(large ? ["sd-large"] : [])],
    shape: rounded ? "sd-round" : undefined,
    color: accent ? "sd-accent" : undefined,
    hover: "sd-hover",
  };
  const classString = cx(...Object.values(descriptor));

  return (
    <Demo
      title={t({zh: "示例:分类描述对象", en: "Demo: a categorized descriptor"})}
      hint={t({
        zh: "Styles 把描述对象各分组的类名展开、去重后合并到唯一子元素上；hover 类产生真实的悬停阴影。",
        en: "Styles flattens and de-duplicates the descriptor groups and merges them onto its single child; the hover class produces a real hover shadow.",
      })}
    >
      <style>{STYLES_CSS}</style>
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={accent} onChange={(event) => setAccent(event.target.checked)} />
          accent
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={rounded} onChange={(event) => setRounded(event.target.checked)} />
          rounded
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={large} onChange={(event) => setLarge(event.target.checked)} />
          large
        </label>
      </Controls>

      <div style={{marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap"}}>
        <Styles className={descriptor}>
          <button type="button">{t({zh: "悬停我", en: "hover me"})}</button>
        </Styles>
        <Styles className="sd-nested-outer">
          <Styles className="sd-nested-inner">
            <button type="button">{t({zh: "嵌套合并", en: "nested merge"})}</button>
          </Styles>
        </Styles>
      </div>

      <Output>
        {t({zh: "计算出的 className", en: "computed className"})}: <strong>{classString}</strong>
      </Output>
      <Muted>
        {t({
          zh: "嵌套时内层类名在前、外层注入的类名在后：",
          en: "When nested, the inner class comes first and the outer-injected class follows:",
        })}{" "}
        <InlineCode>sd-nested-inner sd-nested-outer</InlineCode>
      </Muted>
    </Demo>
  );
};

export const SundryDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              Sundry 是「不好归到别处」的一组小工具。这一页收录与<strong>结构组织</strong>相关的五个：
              <InlineCode>Repeat</InlineCode>、<InlineCode>Scope</InlineCode>、<InlineCode>Toggle</InlineCode>、
              <InlineCode>SizeBox</InlineCode>、<InlineCode>Styles</InlineCode>；观察 / 传送门 / 边界 / 焦点
              这几个与副作用和交互有关的组件在下一页。
            </>
          ),
          en: (
            <>
              Sundry is the grab-bag group. This page covers the five about{" "}
              <strong>structure</strong>: <InlineCode>Repeat</InlineCode>,{" "}
              <InlineCode>Scope</InlineCode>, <InlineCode>Toggle</InlineCode>,{" "}
              <InlineCode>SizeBox</InlineCode> and <InlineCode>Styles</InlineCode>. The interaction /
              side-effect components (observer, portal, boundary, focus trap) live on the next page.
            </>
          ),
        })}
      </P>

      <Section title={t({zh: "1. Repeat:重复渲染", en: "1. Repeat: repeat rendering"})}>
        <P>
          {t({
            zh: (
              <>
                接收 <InlineCode>times</InlineCode> 与 render-prop <InlineCode>children(index)</InlineCode>，
                适合骨架屏、占位符等固定次数重复的场景。
              </>
            ),
            en: (
              <>
                Takes a <InlineCode>times</InlineCode> count and a{" "}
                <InlineCode>children(index)</InlineCode> render prop — handy for skeletons and fixed-count
                placeholders.
              </>
            ),
          })}
        </P>
        <RepeatDemo />
        <Code
          code={`import { Repeat } from "@wwog/react";

<Repeat times={3}>
  {(i) => <div key={i} className="skeleton" />}
</Repeat>`}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>times</InlineCode>, "number", t({zh: "重复次数；≤ 0 时返回 null。", en: "Repeat count; <= 0 returns null."})],
            [<InlineCode>children</InlineCode>, <InlineCode>{`(index: number) => ReactNode`}</InlineCode>, t({zh: "按索引渲染每一项。", en: "Renders one item by index."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "2. Scope:局部变量作用域", en: "2. Scope: local variable scope"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>let</InlineCode> 定义局部变量，<InlineCode>children</InlineCode>{" "}
                以 render-prop 形式读取。它不产生任何运行时容器，只是把「临时计算」收进声明式结构里，
                避免在组件外定义一次性变量。
              </>
            ),
            en: (
              <>
                <InlineCode>let</InlineCode> defines local variables and{" "}
                <InlineCode>children</InlineCode> reads them via a render prop. No runtime container is
                produced; it just keeps one-off computations inside the declarative structure.
              </>
            ),
          })}
        </P>
        <ScopeDemo />
        <Code
          code={`import { Scope } from "@wwog/react";

<Scope let={{ count: 1, text: "Hello" }}>
  {({ count, text }) => <div>{text} {count}</div>}
</Scope>

<Scope
  let={(props) => ({ total: props.items.length })}
  props={{ items: [1, 2] }}
  fallback={<div>Empty</div>}
>
  {({ total }) => <div>Total: {total}</div>}
</Scope>`}
          caption={t({
            zh: "children 缺失或 scope 没有任何键时渲染 fallback。",
            en: "Renders fallback when children is missing or the scope has no keys.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>let</InlineCode>, <InlineCode>{`object | (props) => object`}</InlineCode>, t({zh: "局部变量对象或函数。", en: "Local variables, an object or a function."})],
            [<InlineCode>props</InlineCode>, "any", t({zh: "传给 let 函数的参数。", en: "Argument passed to the let function."})],
            [<InlineCode>children</InlineCode>, <InlineCode>{`(scope) => ReactNode`}</InlineCode>, t({zh: "读取 scope 的 render prop。", en: "Render prop reading the scope."})],
            [<InlineCode>fallback</InlineCode>, "ReactNode", t({zh: "无 scope / children 时渲染。", en: "Rendered with no scope / children."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. Toggle:受控切换", en: "3. Toggle: cycle through options"})}>
        <P>
          {t({
            zh: (
              <>
                在 <InlineCode>options</InlineCode> 中循环取值，通过 render-prop 把当前值和{" "}
                <InlineCode>toggle()</InlineCode> 一起交给调用方。默认按{" "}
                <InlineCode>(index + 1) % length</InlineCode> 前进，可用{" "}
                <InlineCode>next</InlineCode> 自定义。
              </>
            ),
            en: (
              <>
                Cycles through <InlineCode>options</InlineCode> and hands the current value plus{" "}
                <InlineCode>toggle()</InlineCode> to the caller via a render prop. It advances by{" "}
                <InlineCode>(index + 1) % length</InlineCode> by default; supply{" "}
                <InlineCode>next</InlineCode> to customize.
              </>
            ),
          })}
        </P>
        <ToggleDemo />
        <Code
          code={`import { Toggle } from "@wwog/react";

<Toggle
  options={["light", "dark", "auto"]}
  render={(theme, toggle) => <button onClick={toggle}>{theme}</button>}
/>

// 自定义切换方向（向前）
<Toggle
  options={["A", "B", "C"]}
  next={(i, options) => (i - 1 + options.length) % options.length}
  render={(value, toggle) => <button onClick={toggle}>{value}</button>}
/>`}
          caption={t({
            zh: "初始 index 越界时会在 effect 里抛错；options 保持非空即可避免。",
            en: "An out-of-bounds initial index throws inside an effect; keep options non-empty to avoid it.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>options</InlineCode>, <InlineCode>T[]</InlineCode>, t({zh: "可切换的值数组。", en: "The values to cycle through."})],
            [<InlineCode>index</InlineCode>, "number", t({zh: "初始索引，默认 0。", en: "Initial index, default 0."})],
            [<InlineCode>next</InlineCode>, <InlineCode>{`(index, options) => number`}</InlineCode>, t({zh: "自定义下一个索引。", en: "Custom next index."})],
            [<InlineCode>render</InlineCode>, <InlineCode>{`(value, toggle) => ReactNode`}</InlineCode>, t({zh: "渲染当前值并暴露 toggle。", en: "Renders the value and exposes toggle."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "4. SizeBox:固定尺寸容器", en: "4. SizeBox: a fixed-size box"})}>
        <P>
          {t({
            zh: (
              <>
                只是对 <InlineCode>div</InlineCode> 的样式包装：
                <InlineCode>size</InlineCode> 同时设置宽高，<InlineCode>w / h</InlineCode>（或
                <InlineCode>width / height</InlineCode>）分别设置，且固定{" "}
                <InlineCode>flexShrink: 0</InlineCode>，在 flex 布局里不会被压扁。取值可以是数字或任意
                CSS 长度字符串。
              </>
            ),
            en: (
              <>
                A thin style wrapper around a <InlineCode>div</InlineCode>:{" "}
                <InlineCode>size</InlineCode> sets both dimensions, <InlineCode>w / h</InlineCode> (or{" "}
                <InlineCode>width / height</InlineCode>) set them individually, and{" "}
                <InlineCode>flexShrink: 0</InlineCode> keeps it from being squashed in a flex row. Values
                may be numbers or any CSS length string.
              </>
            ),
          })}
        </P>
        <SizeBoxDemo />
        <Code
          code={`import { SizeBox } from "@wwog/react";

<SizeBox size={80}>…</SizeBox>     // 宽高都是 80
<SizeBox w={120} h={48}>…</SizeBox> // 分别设置
<SizeBox size="100%" h={200}>…</SizeBox> // size 优先于 h`}
          caption={t({
            zh: "优先级：size > w / h > width / height。注意没有 style prop，尺寸以外的样式需作用在子元素上。",
            en: "Precedence: size > w / h > width / height. There is no style prop; style other things on the child.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>size</InlineCode>, <InlineCode>number | string</InlineCode>, t({zh: "同时设宽高。", en: "Sets both width and height."})],
            [<InlineCode>w / width</InlineCode>, <InlineCode>number | string</InlineCode>, t({zh: "设置宽度。", en: "Sets the width."})],
            [<InlineCode>h / height</InlineCode>, <InlineCode>number | string</InlineCode>, t({zh: "设置高度。", en: "Sets the height."})],
            [<InlineCode>className</InlineCode>, "string", t({zh: "容器类名。", en: "Container class name."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "5. Styles:类名组合与嵌套", en: "5. Styles: class composition and nesting"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>Styles</InlineCode> 接受字符串或「分类描述对象」，把各分组的类名用{" "}
                <InlineCode>cx</InlineCode> 展开去重后，合并到唯一的子元素上；嵌套的{" "}
                <InlineCode>Styles</InlineCode> 会把外层类名继续向下传递。传{" "}
                <InlineCode>asWrapper</InlineCode> 时改为用一个标签包裹，类名落在包裹层而非子元素。
              </>
            ),
            en: (
              <>
                <InlineCode>Styles</InlineCode> accepts a string or a categorized descriptor, flattens
                and de-duplicates each group's classes with <InlineCode>cx</InlineCode>, then merges them
                onto its single child; nested <InlineCode>Styles</InlineCode> keep passing outer classes
                down. With <InlineCode>asWrapper</InlineCode> the classes land on a wrapper tag instead
                of the child.
              </>
            ),
          })}
        </P>
        <StylesDemo />
        <Code
          code={`import { Styles } from "@wwog/react";

<Styles className={{ base: "p-2", hover: "hover:bg-blue", color: "text-blue" }}>
  <button>Click</button>
</Styles>

<Styles className="outer">
  <Styles className="inner">
    <button>Nested — gets "inner outer"</button>
  </Styles>
</Styles>

<Styles className="wrapper" asWrapper="section">
  <button>Classes land on <section></button>
</Styles>`}
        />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                <InlineCode>Styles</InlineCode> 只接受<strong>一个</strong>子元素：多于一个或子元素非法时
                会打印 <InlineCode>console.error</InlineCode> 并原样返回，不注入任何类名。
              </>
            ),
            en: (
              <>
                <InlineCode>Styles</InlineCode> accepts exactly <strong>one</strong> child: with several
                children or an invalid child it logs <InlineCode>console.error</InlineCode> and returns
                them unchanged without injecting classes.
              </>
            ),
          })}
        </Callout>
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>className</InlineCode>, <InlineCode>{`string | StylesDescriptor`}</InlineCode>, t({zh: "类名字符串或分类描述对象。", en: "A class string or categorized descriptor."})],
            [<InlineCode>asWrapper</InlineCode>, <InlineCode>{`boolean | HTMLElementType`}</InlineCode>, t({zh: "用一个标签包裹；true 时为 div。", en: "Wrap in a tag; true means div."})],
          ]}
        />
      </Section>
    </div>
  );
};
