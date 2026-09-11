import {useMemo, useState, type CSSProperties, type FC} from "react";
import {
  False,
  If,
  Pipe,
  Switch,
  True,
  When,
  type WhenProps,
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
  Output,
  P,
  Section,
  colors,
} from "../ui";

// ---- If / Then / ElseIf / Else ----

type Role = "guest" | "member" | "admin";

const ROLES: {value: Role; zh: string; en: string}[] = [
  {value: "guest", zh: "访客", en: "Guest"},
  {value: "member", zh: "会员", en: "Member"},
  {value: "admin", zh: "管理员", en: "Admin"},
];

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 11px",
  borderRadius: 8,
  border: `1px solid ${colors.accentBorder}`,
  background: colors.accentSoft,
  color: "#1e40af",
  fontSize: 13,
  fontWeight: 500,
};

const IfDemo: FC = () => {
  const {t} = useI18n();
  const [loggedIn, setLoggedIn] = useState(true);
  const [role, setRole] = useState<Role>("member");

  return (
    <Demo
      title={t({zh: "示例:登录 + 角色判断", en: "Demo: logged-in + role branching"})}
      hint={t({
        zh: "外层 If 判断是否登录，内层 If 依次尝试 Then / ElseIf / Else。切换下面的开关与角色看分支变化。",
        en: "The outer If checks login, the inner If tries Then / ElseIf / Else in order. Toggle the switch and role to watch the branch change.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={loggedIn}
            onChange={(event) => setLoggedIn(event.target.checked)}
          />
          {t({zh: "已登录", en: "logged in"})}
        </label>
        {ROLES.map((option) => (
          <Button
            key={option.value}
            tone={role === option.value ? "primary" : "ghost"}
            disabled={!loggedIn}
            onClick={() => setRole(option.value)}
          >
            {t({zh: option.zh, en: option.en})}
          </Button>
        ))}
      </Controls>

      <div style={{marginTop: 14}}>
        <Label>{t({zh: "渲染结果", en: "rendered"})}</Label>
        <div style={{marginTop: 8, minHeight: 30}}>
          <If condition={loggedIn}>
            <If.Then>
              <span style={chip}>
                <If condition={role === "admin"}>
                  <If.Then>{t({zh: "管理员控制台", en: "Admin console"})}</If.Then>
                  <If.ElseIf condition={role === "member"}>
                    {t({zh: "会员中心", en: "Member area"})}
                  </If.ElseIf>
                  <If.Else>{t({zh: "访客浏览", en: "Guest browsing"})}</If.Else>
                </If>
              </span>
            </If.Then>
            <If.Else>
              <span style={{...chip, background: colors.warnSoft, borderColor: colors.warnBorder, color: colors.warn}}>
                {t({zh: "请先登录", en: "Please sign in"})}
              </span>
            </If.Else>
          </If>
        </div>
      </div>

      <div style={{marginTop: 14}}>
        <Controls>
          <Label>{t({zh: "True / False 简写:", en: "True / False shorthands:"})}</Label>
          <True condition={loggedIn}>
            <Muted>{t({zh: "condition === true", en: "condition === true"})}</Muted>
          </True>
          <False condition={loggedIn}>
            <Muted>{t({zh: "condition === false", en: "condition === false"})}</Muted>
          </False>
        </Controls>
      </div>
    </Demo>
  );
};

// ---- Switch ----

type Status = "idle" | "loading" | "error" | "unknown";

const STATUS_LABELS: Record<Status, {zh: string; en: string}> = {
  idle: {zh: "空闲", en: "Idle"},
  loading: {zh: "加载中", en: "Loading"},
  error: {zh: "出错", en: "Error"},
  unknown: {zh: "未知（走 Default）", en: "Unknown (falls to Default)"},
};

const SwitchDemo: FC = () => {
  const {t} = useI18n();
  const [status, setStatus] = useState<Status>("loading");

  return (
    <Demo
      title={t({zh: "示例:按状态选择视图", en: "Demo: pick a view by status"})}
      hint={t({
        zh: "value 匹配到哪个 Case 就渲染哪个；没有任何 Case 匹配时渲染 Default。",
        en: "Whichever Case matches value is rendered; when no Case matches, Default is rendered.",
      })}
    >
      <Controls>
        {(Object.keys(STATUS_LABELS) as Status[]).map((key) => (
          <Button key={key} tone={status === key ? "primary" : "ghost"} onClick={() => setStatus(key)}>
            {t(STATUS_LABELS[key])}
          </Button>
        ))}
      </Controls>

      <Output>
        <Switch value={status}>
          <Switch.Case value="idle">
            {t({zh: "没有正在进行的任务。", en: "Nothing in flight."})}
          </Switch.Case>
          <Switch.Case value="loading">
            {t({zh: "正在加载，请稍候…", en: "Loading, please wait…"})}
          </Switch.Case>
          <Switch.Case value="error">
            {t({zh: "请求失败，请重试。", en: "The request failed; please retry."})}
          </Switch.Case>
          <Switch.Default>
            {t({zh: "未识别的状态，使用默认视图。", en: "Unrecognized status, using the default view."})}
          </Switch.Default>
        </Switch>
      </Output>
    </Demo>
  );
};

// ---- When ----

type WhenMode = "all" | "any" | "none";

const WhenDemo: FC = () => {
  const {t} = useI18n();
  const [mode, setMode] = useState<WhenMode>("all");
  const [flags, setFlags] = useState([true, false, true]);

  const whenProps: WhenProps =
    mode === "all" ? {all: flags} : mode === "any" ? {any: flags} : {none: flags};

  return (
    <Demo
      title={t({zh: "示例:all / any / none 三种组合", en: "Demo: all / any / none combinations"})}
      hint={t({
        zh: "三个条件分别是 A、B、C。切换判据：all 全真、any 任一真、none 全假时才渲染 children，否则渲染 fallback。",
        en: "The three conditions are A, B and C. Switch the predicate: children render when all are true, any is true, or none is true respectively; otherwise fallback renders.",
      })}
    >
      <Controls>
        {(["all", "any", "none"] as WhenMode[]).map((key) => (
          <Button key={key} tone={mode === key ? "primary" : "ghost"} onClick={() => setMode(key)}>
            {key}
          </Button>
        ))}
      </Controls>

      <Controls>
        {flags.map((value, index) => (
          <label key={index} style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
            <input
              type="checkbox"
              checked={value}
              onChange={(event) =>
                setFlags((prev) => prev.map((item, i) => (i === index ? event.target.checked : item)))
              }
            />
            {String.fromCharCode(65 + index)}
          </label>
        ))}
      </Controls>

      <div style={{marginTop: 14}}>
        <When {...whenProps} fallback={<Muted>{t({zh: "条件不满足，显示 fallback", en: "Not satisfied, showing fallback"})}</Muted>}>
          <span style={chip}>{t({zh: "条件满足，渲染 children", en: "Satisfied, rendering children"})}</span>
        </When>
      </div>
    </Demo>
  );
};

// ---- Pipe ----

const PipeDemo: FC = () => {
  const {t} = useI18n();
  const [threshold, setThreshold] = useState(5);
  const [values, setValues] = useState<number[]>([3, 7, 1, 9, 4, 10, 2, 8, 5, 6]);

  // 变换链本身用 useMemo 稳定引用:Pipe 内部依赖 transform 的引用做记忆化,
  // 每次渲染都新建数组会让它每帧重算。
  const transform = useMemo(
    () => [
      (data: number[]) => data.filter((value) => value >= threshold),
      (data: number[]) => [...data].sort((a, b) => a - b),
      (data: number[]) => data.map((value) => value * value),
      // 链尾返回 null 时,Pipe 会改用 fallback 渲染
      (data: number[]) => (data.length > 0 ? data : null),
    ],
    [threshold],
  );

  return (
    <Demo
      title={t({zh: "示例:数字管道", en: "Demo: a numeric pipeline"})}
      hint={t({
        zh: "data 依次经过 filter(≥ 阈值) → sort → map(平方) → 空则转 null。拖动滑块或增删数字看结果。",
        en: "data flows through filter (>= threshold) → sort → map (squared) → null when empty. Drag the slider or add/remove numbers.",
      })}
    >
      <Controls>
        <Label>
          {t({zh: "阈值", en: "threshold"})}:{" "}
          <input
            type="range"
            min={1}
            max={10}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </Label>
        <Button tone="ghost" onClick={() => setValues((prev) => [...prev, Math.ceil(Math.random() * 10)])}>
          {t({zh: "加一个", en: "add one"})}
        </Button>
        <Button tone="ghost" onClick={() => setValues([])} disabled={values.length === 0}>
          {t({zh: "清空", en: "clear"})}
        </Button>
      </Controls>

      <div style={{marginTop: 12}}>
        <Label>
          {t({zh: "输入", en: "input"})} <Muted>[{values.join(", ")}]</Muted>
        </Label>
      </div>

      <div style={{marginTop: 10}}>
        <Label>{t({zh: "输出", en: "output"})}</Label>
        <div style={{marginTop: 8, minHeight: 30}}>
          <Pipe
            data={values}
            transform={transform}
            render={(result: number[]) => (
              <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                {result.map((value) => (
                  <span key={value} style={chip}>
                    {value}
                  </span>
                ))}
              </div>
            )}
            fallback={<Muted>{t({zh: "没有满足条件的数字（fallback）", en: "No value passed the filter (fallback)"})}</Muted>}
          />
        </div>
      </div>
    </Demo>
  );
};

export const ProcessControlDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              这一组把 JSX 里的三元表达式与 <InlineCode>&&</InlineCode> 短路提升为组件：
              <InlineCode>If</InlineCode>、<InlineCode>Switch</InlineCode> 表达分支，
              <InlineCode>When</InlineCode> 组合多个布尔条件，<InlineCode>Pipe</InlineCode> 串起数据变换。
              它们都只做渲染决策，不持有状态。
            </>
          ),
          en: (
            <>
              This group lifts JSX ternaries and <InlineCode>&&</InlineCode> short-circuits into
              components: <InlineCode>If</InlineCode> and <InlineCode>Switch</InlineCode> express
              branches, <InlineCode>When</InlineCode> combines boolean conditions, and{" "}
              <InlineCode>Pipe</InlineCode> chains data transforms. All of them only make rendering
              decisions and hold no state.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              <InlineCode>If</InlineCode> / <InlineCode>Switch</InlineCode> 识别子节点靠的是子组件{" "}
              <InlineCode>displayName</InlineCode> <strong>字符串</strong>比较（如{" "}
              <InlineCode>"If_Then"</InlineCode>、<InlineCode>"Switch_Case"</InlineCode>），而不是函数引用
              <InlineCode>===</InlineCode>。因此即使子组件来自另一份打包产物、引用不相等，只要
              displayName 一致仍能被识别。
            </>
          ),
          en: (
            <>
              <InlineCode>If</InlineCode> / <InlineCode>Switch</InlineCode> recognize their children by
              comparing the child type's <InlineCode>displayName</InlineCode> <strong>string</strong>{" "}
              (e.g. <InlineCode>"If_Then"</InlineCode>, <InlineCode>"Switch_Case"</InlineCode>) rather
              than function-reference equality. So children from another bundle are still recognized as
              long as the displayName matches.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. If / Then / ElseIf / Else", en: "1. If / Then / ElseIf / Else"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>If</InlineCode> 按顺序求值：<InlineCode>condition</InlineCode> 为真则渲染{" "}
                <InlineCode>Then</InlineCode>；否则依次找第一个为真的 <InlineCode>ElseIf</InlineCode>
                ；都不满足再渲染 <InlineCode>Else</InlineCode>。只允许一个 <InlineCode>Then</InlineCode>{" "}
                和一个 <InlineCode>Else</InlineCode>，且子节点必须是这三种元素之一，否则会抛错。
              </>
            ),
            en: (
              <>
                <InlineCode>If</InlineCode> evaluates in order: when{" "}
                <InlineCode>condition</InlineCode> is true it renders <InlineCode>Then</InlineCode>;
                otherwise it uses the first truthy <InlineCode>ElseIf</InlineCode>, then{" "}
                <InlineCode>Else</InlineCode>. At most one <InlineCode>Then</InlineCode> and one{" "}
                <InlineCode>Else</InlineCode> are allowed, and every child must be one of these three
                elements or it throws.
              </>
            ),
          })}
        </P>
        <IfDemo />
        <Code
          code={`import { If, True, False } from "@wwog/react";

<If condition={loggedIn}>
  <If.Then>Signed in</If.Then>
  <If.ElseIf condition={isAdmin}>Admin</If.ElseIf>
  <If.Else>Guest</If.Else>
</If>

// 单条件简写:True 仅在 === true 时渲染,False 仅在 === false 时渲染
<True condition={ready}>ready</True>
<False condition={ready}>not ready</False>`}
          caption={t({
            zh: "受控判断，不引入任何 state；分支逻辑与渲染在同一处声明。",
            en: "Controlled branching with no state of its own; the branch logic and the render sit together.",
          })}
        />
        <ApiTable
          head={[t({zh: "组件 / prop", en: "component / prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>If.condition</InlineCode>, "boolean", t({zh: "决定是否走 Then 分支。", en: "Whether the Then branch is taken."})],
            [<InlineCode>If.Then</InlineCode>, "ReactNode", t({zh: "条件为真时渲染，最多一个。", en: "Rendered when true; at most one."})],
            [<InlineCode>If.ElseIf</InlineCode>, <InlineCode>{`{condition, children}`}</InlineCode>, t({zh: "依次匹配，可多个。", en: "Tried in order; may repeat."})],
            [<InlineCode>If.Else</InlineCode>, "ReactNode", t({zh: "全部不满足时渲染，最多一个。", en: "Rendered when nothing matched; at most one."})],
            [<InlineCode>True / False</InlineCode>, <InlineCode>{`{condition, children}`}</InlineCode>, t({zh: "单条件简写，省去 Then/Else。", en: "One-condition shorthands without Then/Else."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "2. Switch / Case / Default", en: "2. Switch / Case / Default"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>Switch</InlineCode> 用 <InlineCode>compare</InlineCode>（默认{" "}
                <InlineCode>===</InlineCode>）把 <InlineCode>value</InlineCode> 与各{" "}
                <InlineCode>Case</InlineCode> 的 <InlineCode>value</InlineCode> 比较，匹配到第一个即渲染；
                都不匹配时渲染 <InlineCode>Default</InlineCode>。重复的 Case 值会抛错。
              </>
            ),
            en: (
              <>
                <InlineCode>Switch</InlineCode> compares <InlineCode>value</InlineCode> against each{" "}
                <InlineCode>Case</InlineCode>'s <InlineCode>value</InlineCode> using{" "}
                <InlineCode>compare</InlineCode> (default <InlineCode>===</InlineCode>) and renders the
                first match; when nothing matches it renders <InlineCode>Default</InlineCode>. Duplicate
                Case values throw.
              </>
            ),
          })}
        </P>
        <SwitchDemo />
        <Code
          code={`import { Switch } from "@wwog/react";

<Switch value={status}>
  <Switch.Case value="idle">Idle</Switch.Case>
  <Switch.Case value="loading">Loading…</Switch.Case>
  <Switch.Default>Unknown</Switch.Default>
</Switch>

// 自定义比较:值不是原始类型时按 id 比较
<Switch value={user} compare={(a, b) => a.id === b.id}>
  <Switch.Case value={adminUser}>Admin</Switch.Case>
</Switch>`}
        />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                非严格模式（<InlineCode>strict</InlineCode> 默认 <InlineCode>false</InlineCode>）下，
                一旦有 Case 匹配，<InlineCode>Switch</InlineCode> 会通过{" "}
                <InlineCode>childrenLoop</InlineCode>（utils 分组）返回 <InlineCode>false</InlineCode>{" "}
                提前中断遍历；严格模式（<InlineCode>strict</InlineCode>）则总是遍历完所有子节点，以便
                发现重复 Case / 多个 Default 等错误。
              </>
            ),
            en: (
              <>
                In non-strict mode (<InlineCode>strict</InlineCode> defaults to{" "}
                <InlineCode>false</InlineCode>) the loop stops as soon as a Case matches, via{" "}
                <InlineCode>childrenLoop</InlineCode> (utils group) returning{" "}
                <InlineCode>false</InlineCode> for an early exit. Strict mode always walks every child so
                it can report duplicate Cases / multiple Defaults.
              </>
            ),
          })}
        </Callout>
        <ApiTable
          head={[t({zh: "prop / 元素", en: "prop / element"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>Switch.value</InlineCode>, "T", t({zh: "要比对的值。", en: "The value to compare."})],
            [<InlineCode>Switch.compare</InlineCode>, <InlineCode>{`(a: T, b: T) => boolean`}</InlineCode>, t({zh: "自定义比较，默认 ===。", en: "Custom comparison; defaults to ===."})],
            [<InlineCode>Switch.strict</InlineCode>, "boolean", t({zh: "是否遍历全部子节点做校验，默认 false。", en: "Whether to walk all children for validation; default false."})],
            [<InlineCode>Switch.Case</InlineCode>, <InlineCode>{`{value: T, children}`}</InlineCode>, t({zh: "一个匹配分支，可多个。", en: "A match branch; may repeat."})],
            [<InlineCode>Switch.Default</InlineCode>, "ReactNode", t({zh: "兜底分支，最多一个。", en: "Fallback branch; at most one."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "3. When", en: "3. When"})}>
        <P>
          {t({
            zh: (
              <>
                比 <InlineCode>If</InlineCode> 更紧凑的多条件写法：
                <InlineCode>all</InlineCode> 要求全真、<InlineCode>any</InlineCode> 要求至少一真、
                <InlineCode>none</InlineCode> 要求全假。三者同时提供时 <InlineCode>all</InlineCode>{" "}
                优先并打印一条 warning。
              </>
            ),
            en: (
              <>
                A more compact multi-condition form than <InlineCode>If</InlineCode>:{" "}
                <InlineCode>all</InlineCode> requires every flag, <InlineCode>any</InlineCode> at least
                one, and <InlineCode>none</InlineCode> requires all false. Supplying several at once makes{" "}
                <InlineCode>all</InlineCode> win and logs a warning.
              </>
            ),
          })}
        </P>
        <WhenDemo />
        <Code
          code={`import { When } from "@wwog/react";

<When all={[isAdmin, hasPermission]}>…
<When any={[isLoading, isFetching]} fallback={<Error />}>…
<When none={[hasError, isOffline]}>…`}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>all</InlineCode>, "boolean[]", t({zh: "全部为真才渲染。", en: "Render only when all are true."})],
            [<InlineCode>any</InlineCode>, "boolean[]", t({zh: "至少一个为真就渲染。", en: "Render when at least one is true."})],
            [<InlineCode>none</InlineCode>, "boolean[]", t({zh: "全部为假才渲染。", en: "Render only when all are false."})],
            [<InlineCode>fallback</InlineCode>, "ReactNode", t({zh: "不满足条件时渲染。", en: "Rendered when the predicate fails."})],
          ]}
        />
      </Section>

      <Section title={t({zh: "4. Pipe", en: "4. Pipe"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>Pipe</InlineCode> 把 <InlineCode>data</InlineCode> 交给{" "}
                <InlineCode>transform</InlineCode> 数组里的函数依次处理，最终结果交给{" "}
                <InlineCode>render</InlineCode> 渲染。整条链用 <InlineCode>useMemo</InlineCode>{" "}
                记忆化，依赖 <InlineCode>data</InlineCode> 与 <InlineCode>transform</InlineCode>；链尾结果为{" "}
                <InlineCode>null</InlineCode> / <InlineCode>undefined</InlineCode> 时改渲染{" "}
                <InlineCode>fallback</InlineCode>。
              </>
            ),
            en: (
              <>
                <InlineCode>Pipe</InlineCode> passes <InlineCode>data</InlineCode> through the functions
                in its <InlineCode>transform</InlineCode> array, then hands the result to{" "}
                <InlineCode>render</InlineCode>. The whole chain is memoized on{" "}
                <InlineCode>data</InlineCode> and <InlineCode>transform</InlineCode>; if the final value
                is <InlineCode>null</InlineCode> / <InlineCode>undefined</InlineCode>,{" "}
                <InlineCode>fallback</InlineCode> is rendered instead.
              </>
            ),
          })}
        </P>
        <PipeDemo />
        <Code
          code={`import { Pipe } from "@wwog/react";

<Pipe
  data={users}
  transform={[
    (data) => data.filter((user) => user.active),
    (data) => data.map((user) => user.name),
  ]}
  render={(names) => <div>{names.join(", ")}</div>}
  fallback={<div>No data</div>}
/>`}
          caption={t({
            zh: "transform 数组建议用 useMemo 稳定引用，否则每次渲染都会重跑整条链。",
            en: "Stabilize the transform array with useMemo, otherwise the whole chain re-runs on every render.",
          })}
        />
        <ApiTable
          head={[t({zh: "prop", en: "prop"}), t({zh: "类型", en: "type"}), t({zh: "说明", en: "description"})]}
          rows={[
            [<InlineCode>data</InlineCode>, "any", t({zh: "初始数据。", en: "The initial data."})],
            [<InlineCode>transform</InlineCode>, <InlineCode>{`((input: any) => any)[]`}</InlineCode>, t({zh: "按顺序应用的变换函数。", en: "Transforms applied in order."})],
            [<InlineCode>render</InlineCode>, <InlineCode>{`(result: any) => ReactNode`}</InlineCode>, t({zh: "渲染最终结果。", en: "Renders the final result."})],
            [<InlineCode>fallback</InlineCode>, "ReactNode", t({zh: "结果为 null / undefined 时渲染。", en: "Rendered when the result is null / undefined."})],
          ]}
        />
      </Section>
    </div>
  );
};
