import {useMemo, useState, type CSSProperties, type FC} from "react";
import {ArrayRender, DateRender, formatDate} from "../../../../src";
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

interface Person {
  id: number;
  name: {zh: string; en: string};
  age: number;
}

const PEOPLE: Person[] = [
  {id: 1, name: {zh: "李雷", en: "Li Lei"}, age: 17},
  {id: 2, name: {zh: "韩梅梅", en: "Han Meimei"}, age: 24},
  {id: 3, name: {zh: "王小明", en: "Wang Xiaoming"}, age: 31},
  {id: 4, name: {zh: "赵敏", en: "Zhao Min"}, age: 15},
];

const personChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "#fff",
  fontSize: 12.5,
  color: colors.text,
};

// ---- ArrayRender ----

const ArrayRenderDemo: FC = () => {
  const {t} = useI18n();
  const [adultsOnly, setAdultsOnly] = useState(false);
  const [byAge, setByAge] = useState(false);
  const [empty, setEmpty] = useState(false);

  const items = empty ? [] : PEOPLE;

  return (
    <Demo
      title={t({zh: "示例:列表的过滤、排序与空态", en: "Demo: filtering, sorting and the empty state"})}
      hint={t({
        zh: "filter 只保留成年人；sort 按年龄升序；renderEmpty 处理空列表。三项可以任意组合。",
        en: "filter keeps adults, sort orders by age, and renderEmpty handles an empty list. Combine them freely.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={adultsOnly}
            onChange={(event) => setAdultsOnly(event.target.checked)}
          />
          {t({zh: "只看成年人（age ≥ 18）", en: "adults only (age >= 18)"})}
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={byAge} onChange={(event) => setByAge(event.target.checked)} />
          {t({zh: "按年龄升序", en: "sort by age"})}
        </label>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input type="checkbox" checked={empty} onChange={(event) => setEmpty(event.target.checked)} />
          {t({zh: "空列表", en: "empty list"})}
        </label>
      </Controls>

      <div style={{marginTop: 14}}>
        <Label>{t({zh: "渲染结果", en: "rendered"})}</Label>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, minHeight: 30}}>
          <ArrayRender
            items={items}
            filter={adultsOnly ? (person) => person.age >= 18 : undefined}
            sort={byAge ? (a, b) => a.age - b.age : undefined}
            renderItem={(person, index) => (
              <span key={person.id} style={personChip}>
                {index}. {t(person.name)} · {person.age}
              </span>
            )}
            renderEmpty={() => <Muted>{t({zh: "没有可渲染的条目", en: "Nothing to render"})}</Muted>}
          />
        </div>
      </div>
    </Demo>
  );
};

// ---- DateRender ----

type FormatMode = "locale" | "custom" | "iso";

const PRESETS: {id: string; label: {zh: string; en: string}; source: Date | string}[] = [
  {id: "now", label: {zh: "现在", en: "now"}, source: new Date()},
  {id: "past", label: {zh: "固定日期", en: "fixed date"}, source: "2026-01-02T03:04:05"},
  {id: "invalid", label: {zh: "非法字符串", en: "invalid string"}, source: "not-a-date"},
];

const DateRenderDemo: FC = () => {
  const {t} = useI18n();
  const [presetId, setPresetId] = useState("now");
  const [mode, setMode] = useState<FormatMode>("locale");

  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];
  // 固定日期每次点按钮都重建 Date，保证「现在」不被冻结成首次渲染的时刻。
  const source = preset.id === "now" ? new Date() : preset.source;

  const format = useMemo(() => {
    if (mode === "custom") return (date: Date) => formatDate("YYYY-MM-DD HH:mm:ss", date);
    if (mode === "iso") return (date: Date) => date.toISOString();
    return undefined;
  }, [mode]);

  return (
    <Demo
      title={t({zh: "示例:格式化日期", en: "Demo: formatting a date"})}
      hint={t({
        zh: "format 省略时用 toLocaleString；传入非法日期时 DateRender 渲染 null（输出区为空）。",
        en: "When format is omitted it uses toLocaleString; with an invalid date DateRender renders null (the output stays empty).",
      })}
    >
      <Controls>
        {PRESETS.map((item) => (
          <Button key={item.id} tone={presetId === item.id ? "primary" : "ghost"} onClick={() => setPresetId(item.id)}>
            {t(item.label)}
          </Button>
        ))}
      </Controls>
      <Controls>
        {(["locale", "custom", "iso"] as FormatMode[]).map((key) => (
          <Button key={key} tone={mode === key ? "primary" : "ghost"} onClick={() => setMode(key)}>
            {key}
          </Button>
        ))}
      </Controls>

      <Output>
        <DateRender source={source} format={format}>
          {(formatted: string) => <span>{formatted}</span>}
        </DateRender>
      </Output>
    </Demo>
  );
};

export const StructDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>Struct</InlineCode> 组里的两个组件把「列表」和「日期」这两种最常见的重复渲染
              收进声明式接口：<InlineCode>ArrayRender</InlineCode> 负责过滤 / 排序 / 空态，
              <InlineCode>DateRender</InlineCode> 负责把日期源格式化成可渲染内容。
            </>
          ),
          en: (
            <>
              The <InlineCode>Struct</InlineCode> group wraps the two most common repeated renders —
              lists and dates — behind declarative props: <InlineCode>ArrayRender</InlineCode> handles
              filtering / sorting / the empty state, and <InlineCode>DateRender</InlineCode> turns a date
              source into renderable content.
            </>
          ),
        })}
      </P>

      <Section title={t({zh: "1. ArrayRender:列表渲染", en: "1. ArrayRender: list rendering"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>items</InlineCode> 为空时直接调用 <InlineCode>renderEmpty</InlineCode>。未传{" "}
                <InlineCode>sort</InlineCode> 时按原数组顺序 <InlineCode>map</InlineCode>，{" "}
                <InlineCode>filter</InlineCode> 在循环内跳过条目（此时 <InlineCode>index</InlineCode>{" "}
                仍是原索引）；传了 <InlineCode>sort</InlineCode> 时先过滤、排序后重新{" "}
                <InlineCode>map</InlineCode>，此时 <InlineCode>index</InlineCode> 是排序后的索引。
              </>
            ),
            en: (
              <>
                An empty <InlineCode>items</InlineCode> calls <InlineCode>renderEmpty</InlineCode>{" "}
                directly. Without <InlineCode>sort</InlineCode> it maps the array in order and{" "}
                <InlineCode>filter</InlineCode> skips items inside the loop (the{" "}
                <InlineCode>index</InlineCode> is then the original one); with{" "}
                <InlineCode>sort</InlineCode> it filters, sorts and maps again, so{" "}
                <InlineCode>index</InlineCode> reflects the sorted position.
              </>
            ),
          })}
        </P>
        <ArrayRenderDemo />
        <Code
          code={`import { ArrayRender } from "@wwog/react";

<ArrayRender
  items={people}
  filter={(person) => person.age >= 18}
  sort={(a, b) => a.age - b.age}
  renderItem={(person, index) => (
    <span key={person.id}>{index}. {person.name}</span>
  )}
  renderEmpty={() => <p>Nothing here</p>}
/>`}
          caption={t({
            zh: "renderItem 返回的元素请自带 key，否则 React 会对数组子节点发出 key 警告。",
            en: "Give the element returned by renderItem its own key, otherwise React warns about keys in the array.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>items</InlineCode>, <InlineCode>T[]</InlineCode>, t({zh: "数据数组；为 null 时打 error 并渲染 null。", en: "Data array; null logs an error and renders null."})],
            [<InlineCode>renderItem</InlineCode>, <InlineCode>{`(item, index) => ReactNode`}</InlineCode>, t({zh: "渲染每一项。", en: "Renders one item."})],
            [<InlineCode>filter</InlineCode>, <InlineCode>{`(item) => boolean`}</InlineCode>, t({zh: "可选过滤。", en: "Optional filter."})],
            [<InlineCode>sort</InlineCode>, <InlineCode>{`(a, b) => number`}</InlineCode>, t({zh: "可选排序，触发拷贝后排序。", en: "Optional sort; copies before sorting."})],
            [<InlineCode>renderEmpty</InlineCode>, <InlineCode>{`() => ReactNode`}</InlineCode>, t({zh: "空结果时渲染。", en: "Rendered when the result is empty."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "2. DateRender:日期格式化渲染", en: "2. DateRender: formatted date rendering"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>source</InlineCode> 接受 <InlineCode>Date</InlineCode>、ISO 字符串或时间戳。
                内部先解析成 <InlineCode>Date</InlineCode>，再用 <InlineCode>format</InlineCode> 转换
                （缺省为 <InlineCode>toLocaleString</InlineCode>），最后把结果交给 render-prop{" "}
                <InlineCode>children</InlineCode>。解析失败或格式化为空时不渲染任何内容。
              </>
            ),
            en: (
              <>
                <InlineCode>source</InlineCode> accepts a <InlineCode>Date</InlineCode>, an ISO string or
                a timestamp. It is parsed into a <InlineCode>Date</InlineCode>, converted with{" "}
                <InlineCode>format</InlineCode> (<InlineCode>toLocaleString</InlineCode> by default), and
                the result is handed to the <InlineCode>children</InlineCode> render prop. Failed parsing
                or an empty formatted value renders nothing.
              </>
            ),
          })}
        </P>
        <DateRenderDemo />
        <Code
          code={`import { DateRender, formatDate } from "@wwog/react";

<DateRender source="2026-01-02T03:04:05">
  {(formatted) => <time>{formatted}</time>}
</DateRender>

<DateRender
  source={Date.now()}
  format={(date) => formatDate("YYYY-MM-DD HH:mm", date)}
>
  {(formatted) => <time>{formatted}</time>}
</DateRender>`}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>source</InlineCode>, <InlineCode>Date | string | number</InlineCode>, t({zh: "日期来源。", en: "The date source."})],
            [<InlineCode>format</InlineCode>, <InlineCode>{`(date: Date) => T`}</InlineCode>, t({zh: "自定义格式化，缺省 toLocaleString。", en: "Custom formatter; defaults to toLocaleString."})],
            [<InlineCode>children</InlineCode>, <InlineCode>{`(formatted: T) => ReactNode`}</InlineCode>, t({zh: "必需，接收格式化结果的 render prop。", en: "Required render prop receiving the formatted value."})],
          ]}
        />
        <Callout>
          {t({
            zh: (
              <>
                <InlineCode>format</InlineCode> 的返回值类型即泛型 <InlineCode>T</InlineCode>，
                所以既可以返回字符串，也可以返回 <InlineCode>ReactNode</InlineCode> 片段。
              </>
            ),
            en: (
              <>
                The return type of <InlineCode>format</InlineCode> is the generic{" "}
                <InlineCode>T</InlineCode>, so it may return a string or even a{" "}
                <InlineCode>ReactNode</InlineCode> fragment.
              </>
            ),
          })}
        </Callout>
      </Section>
    </div>
  );
};
