import {useState, type FC} from "react";
import {useControlled} from "../../../../src";
import {useI18n} from "../../i18n";
import {
  ApiTable,
  Button,
  Callout,
  Code,
  Controls,
  Demo,
  InlineCode,
  Muted,
  Output,
  P,
  Section,
  Stat,
  Stats,
} from "../ui";

// ---- 受控 / 非受控 ----

interface NumberFieldProps {
  defaultValue: number;
  value?: number;
  onChange?: (next: number) => void;
}

/**
 * 一个同时支持受控 / 非受控的数字输入。是否受控完全由调用方是否传入 `value`
 * 决定，组件自己不写任何判断分支——这正是 useControlled 抽掉的样板代码。
 */
const NumberField: FC<NumberFieldProps> = (props) => {
  const {t} = useI18n();
  const [value, setValue] = useControlled<number>({defaultValue: props.defaultValue, props});

  return (
    <div>
      <Controls>
        <Button onClick={() => setValue((prev) => prev - 1)} tone="ghost">
          −1
        </Button>
        <Stat label={t({zh: "当前值", en: "value"})} value={value} />
        <Button onClick={() => setValue((prev) => prev + 1)}>+1</Button>
        <Button onClick={() => setValue(props.defaultValue)} tone="ghost">
          {t({zh: "重置", en: "reset"})}
        </Button>
      </Controls>
    </div>
  );
};

const ModeSwitchDemo: FC = () => {
  const {t} = useI18n();
  const [controlled, setControlled] = useState(true);
  const [parentValue, setParentValue] = useState(5);

  return (
    <Demo
      title={t({zh: "示例：在受控与非受控之间切换", en: "Demo: switching between controlled and uncontrolled"})}
      hint={t({
        zh: "同一个组件渲染两种形态：受控时传入 value / onChange，非受控时一个都不传。把值在受控模式下改到 9，再切回非受控——它会回到自己的初始 defaultValue（5），而不是 9：受控模式下 hook 从不写内部 state。",
        en: "The same component rendered two ways: controlled passes value / onChange, uncontrolled passes neither. Move the value to 9 while controlled, then switch back — it returns to its initial defaultValue (5), not 9, because in controlled mode the hook never writes internal state.",
      })}
    >
      <Controls>
        <label style={{display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13}}>
          <input
            type="checkbox"
            checked={controlled}
            onChange={(event) => setControlled(event.target.checked)}
          />
          {t({zh: "受控模式", en: "controlled"})}
        </label>
        <Muted>
          {t({zh: "传入的 props", en: "props passed"})}: {controlled ? "value, onChange" : "{ }"}
        </Muted>
      </Controls>

      <div style={{marginTop: 12}}>
        <NumberField
          defaultValue={5}
          {...(controlled ? {value: parentValue, onChange: setParentValue} : {})}
        />
      </div>

      <Output>
        <div>
          {t({zh: "父级持有的值", en: "parent value"})}: <strong>{controlled ? parentValue : "—"}</strong>
        </div>
      </Output>
    </Demo>
  );
};

// ---- onBeforeChange ----

interface Attempt {
  next: number;
  current: number;
  accepted: boolean;
}

const BeforeChangeDemo: FC = () => {
  const {t} = useI18n();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [value, setValue] = useControlled<number>({
    defaultValue: 50,
    onBeforeChange: (next, current) => {
      const accepted = next >= 0 && next <= 100;
      setAttempt({next, current, accepted});
      // 返回 false 取消本次变更；返回其它任何值（含 undefined）都放行
      if (!accepted) return false;
    },
    props: {},
  });

  return (
    <Demo
      title={t({zh: "示例：用 onBeforeChange 否决越界值", en: "Demo: vetoing out-of-range values with onBeforeChange"})}
      hint={t({
        zh: "合法区间是 0–100。150 与 -20 会被 onBeforeChange 返回 false 取消，值不变、onChange 也不会触发。注意它只能「否决」，不能改写：要截断（clamp）必须在调用 setValue 之前自己算好。",
        en: "The valid range is 0–100. 150 and -20 are cancelled when onBeforeChange returns false: the value stays and onChange never fires. It can only veto, not rewrite — to clamp you must compute the clamp before calling setValue.",
      })}
    >
      <Controls>
        <Button onClick={() => setValue((prev) => prev - 10)} tone="ghost">
          {t({zh: "−10", en: "−10"})}
        </Button>
        <Button onClick={() => setValue((prev) => prev + 10)} tone="ghost">
          {t({zh: "+10", en: "+10"})}
        </Button>
        <Button onClick={() => setValue(150)} tone="ghost">
          setValue(150)
        </Button>
        <Button onClick={() => setValue(-20)} tone="ghost">
          setValue(-20)
        </Button>
        <Button onClick={() => setValue(Math.min(100, value + 50))}>
          {t({zh: "自带 clamp 的 +50", en: "clamped +50"})}
        </Button>
        <Button onClick={() => setValue(50)} tone="ghost">
          {t({zh: "重置", en: "reset"})}
        </Button>
      </Controls>

      <Stats>
        <Stat label={t({zh: "当前值", en: "value"})} value={value} />
        <Stat
          label={t({zh: "最近一次尝试", en: "last attempt"})}
          value={attempt ? `${attempt.next}` : "—"}
        />
        <Stat
          label={t({zh: "判定", en: "decision"})}
          value={
            attempt
              ? attempt.accepted
                ? t({zh: "放行", en: "accepted"})
                : t({zh: "否决", en: "rejected"})
              : "—"
          }
        />
      </Stats>

      <Output>
        {attempt ? (
          <div>
            onBeforeChange({attempt.next}, {attempt.current}) → {attempt.accepted ? "void" : "false"}
            {attempt.accepted ? "" : t({zh: "（变更被取消）", en: " (change cancelled)"})}
          </div>
        ) : (
          <Muted>{t({zh: "点上面的按钮看看哪些值会被拒绝。", en: "Click a button to see which values get rejected."})}</Muted>
        )}
      </Output>
    </Demo>
  );
};

// ---- 自定义 valuePropName / trigger ----

interface SwitchProps {
  defaultChecked: boolean;
  checked?: boolean;
  onToggle?: (next: boolean) => void;
}

/**
 * 字段名与回调名都换掉的开关：受控字段叫 `checked`，回调叫 `onToggle`，
 * 而不是默认的 `value` / `onChange`。
 */
const Switch: FC<SwitchProps> = (props) => {
  const {t} = useI18n();
  const [checked, setChecked] = useControlled<boolean>({
    defaultValue: props.defaultChecked,
    valuePropName: "checked",
    trigger: "onToggle",
    props,
  });

  return (
    <Button onClick={() => setChecked((prev) => !prev)} tone={checked ? "primary" : "ghost"}>
      {checked ? t({zh: "开", en: "on"}) : t({zh: "关", en: "off"})}
    </Button>
  );
};

const CustomNamesDemo: FC = () => {
  const {t} = useI18n();
  const [checked, setChecked] = useState(true);
  const [calls, setCalls] = useState(0);

  return (
    <Demo
      title={t({zh: "示例：自定义 valuePropName 与 trigger", en: "Demo: custom valuePropName and trigger"})}
      hint={t({
        zh: "受控实例只认 checked / onToggle 这两个名字。每次点击受控开关 onToggle 都会 +1，证明触发的确实是自定义回调名，而不是默认的 onChange。",
        en: "The controlled instance only looks at checked / onToggle. Every click on it increments the call count, proving the custom trigger name is what fires — not the default onChange.",
      })}
    >
      <Controls>
        <Stat label={t({zh: "自定义回调名", en: "trigger"})} value="onToggle" />
        <Stat label={t({zh: "受控字段名", en: "valuePropName"})} value="checked" />
      </Controls>

      <div style={{marginTop: 12, display: "flex", flexDirection: "column", gap: 10}}>
        <Controls>
          <Muted>{t({zh: "受控（checked + onToggle）", en: "controlled (checked + onToggle)"})}</Muted>
          <Switch
            defaultChecked={false}
            checked={checked}
            onToggle={(next) => {
              setChecked(next);
              setCalls((count) => count + 1);
            }}
          />
        </Controls>
        <Controls>
          <Muted>{t({zh: "非受控（只有 defaultChecked）", en: "uncontrolled (defaultChecked only)"})}</Muted>
          <Switch defaultChecked={true} />
        </Controls>
      </div>

      <Output>
        <div>
          {t({zh: "父级 checked", en: "parent checked"})}: <strong>{String(checked)}</strong>
        </div>
        <div>
          onToggle {t({zh: "调用次数", en: "calls"})}: <strong>{calls}</strong>
        </div>
      </Output>
    </Demo>
  );
};

export const UseControlledDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              <InlineCode>useControlled</InlineCode> 把「一个组件既可能被父级控制、也可能自己管状态」这件事统一成
              一个 hook。它返回当前的 <InlineCode>value</InlineCode> 与一个 <InlineCode>setValue</InlineCode>，
              组件内部不再需要关心自己处于哪种模式。
            </>
          ),
          en: (
            <>
              <InlineCode>useControlled</InlineCode> unifies "this component may be driven by its parent
              or own its state" into a single hook. It returns the current <InlineCode>value</InlineCode>{" "}
              and a <InlineCode>setValue</InlineCode>, and the component never has to branch on which
              mode it is in.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              判定受控只看一个条件：<InlineCode>Object.prototype.hasOwnProperty.call(props, valuePropName)</InlineCode>。
              因此显式传入 <InlineCode>value={"{"}undefined{"}"}</InlineCode> 依然算受控（值是 undefined），
              而完全不传该字段才是非受控。
            </>
          ),
          en: (
            <>
              Controlled detection is a single check:{" "}
              <InlineCode>Object.prototype.hasOwnProperty.call(props, valuePropName)</InlineCode>. Passing{" "}
              <InlineCode>value={"{"}undefined{"}"}</InlineCode> explicitly still counts as controlled
              (with an undefined value); only omitting the key entirely is uncontrolled.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 受控与非受控的统一", en: "1. Controlled and uncontrolled in one hook"})}>
        <P>
          {t({
            zh: (
              <>
                非受控时 <InlineCode>setValue</InlineCode> 写内部 state；受控时它不写内部 state，只调用{" "}
                <InlineCode>props[trigger]</InlineCode>，把新值交还给父级。两条路径都会先经过{" "}
                <InlineCode>onBeforeChange</InlineCode>。
              </>
            ),
            en: (
              <>
                Uncontrolled, <InlineCode>setValue</InlineCode> writes internal state; controlled, it
                does not — it only calls <InlineCode>props[trigger]</InlineCode> and hands the new value
                back to the parent. Both paths pass through <InlineCode>onBeforeChange</InlineCode> first.
              </>
            ),
          })}
        </P>
        <ModeSwitchDemo />
        <Code
          code={`const [value, setValue] = useControlled<number>({
  defaultValue: 0, // 非受控时的初值
  props,           // 组件收到的 props
});

// props 里没有 value → 非受控：setValue 写内部 state
// props 里有 value    → 受控：只调用 props.onChange，由父级决定要不要更新`}
          caption={t({
            zh: "setValue 同时支持函数式更新，但见下方「注意」里关于取值时机的说明。",
            en: "setValue also accepts an updater function — see the timing caveat under Cautions below.",
          })}
        />
      </Section>

      <Section title={t({zh: "2. onBeforeChange：只能否决", en: "2. onBeforeChange: veto only"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>onBeforeChange(newValue, currentValue)</InlineCode> 在写入之前被调用，
                返回 <InlineCode>false</InlineCode> 即取消除这次变更；其它返回值一律放行。
                它拿不到「改写后的值」这一说：想截断或归一化，得在调用 <InlineCode>setValue</InlineCode>{" "}
                之前自己算好。
              </>
            ),
            en: (
              <>
                <InlineCode>onBeforeChange(newValue, currentValue)</InlineCode> runs before the write;
                returning <InlineCode>false</InlineCode> cancels the change, any other return value
                proceeds. It cannot rewrite the value: to clamp or normalize, compute the result before
                calling <InlineCode>setValue</InlineCode>.
              </>
            ),
          })}
        </P>
        <BeforeChangeDemo />
        <Code
          code={`useControlled<number>({
  defaultValue: 50,
  // 返回 false → 本次变更取消；返回 undefined 等其他值 → 放行
  onBeforeChange: (next, current) => next >= 0 && next <= 100,
  props: {},
});

// onBeforeChange 不能改写新值。要截断就先算好再 set：
setValue(Math.min(100, value + 50));`}
        />
      </Section>

      <Section title={t({zh: "3. 自定义 valuePropName 与 trigger", en: "3. Custom valuePropName and trigger"})}>
        <P>
          {t({
            zh: (
              <>
                默认读取 <InlineCode>value</InlineCode> 字段、触发 <InlineCode>onChange</InlineCode> 回调。
                对复选框、开关这类组件，字段名和回调名通常是别的，用{" "}
                <InlineCode>valuePropName</InlineCode> 与 <InlineCode>trigger</InlineCode> 即可改名，
                hook 逻辑不变。
              </>
            ),
            en: (
              <>
                By default it reads the <InlineCode>value</InlineCode> prop and calls{" "}
                <InlineCode>onChange</InlineCode>. For checkboxes and switches the names usually differ;
                point <InlineCode>valuePropName</InlineCode> and <InlineCode>trigger</InlineCode> at them
                and the rest of the logic is unchanged.
              </>
            ),
          })}
        </P>
        <CustomNamesDemo />
        <Code
          code={`const [checked, setChecked] = useControlled<boolean>({
  defaultValue: false,
  valuePropName: "checked", // 受控字段名（默认 "value"）
  trigger: "onToggle",      // 回调 prop 名（默认 "onChange"）
  props,                    // 例如 { checked, onToggle }
});`}
        />
      </Section>

      <Section title={t({zh: "4. API 参考", en: "4. API reference"})}>
        <P>
          <InlineCode>useControlled&lt;T&gt;(options)</InlineCode> →{" "}
          <InlineCode>[T, Dispatch&lt;SetStateAction&lt;T&gt;&gt;]</InlineCode>
        </P>
        <ApiTable
          head={[
            t({zh: "选项", en: "option"}),
            t({zh: "类型", en: "type"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>defaultValue</InlineCode>,
              <InlineCode>T</InlineCode>,
              t({
                zh: "非受控模式下的初值；受控时被 props 里的值覆盖。",
                en: "Initial value in uncontrolled mode; overridden by the prop value when controlled.",
              }),
            ],
            [
              <InlineCode>props</InlineCode>,
              <InlineCode>Record&lt;string, any&gt;</InlineCode>,
              t({
                zh: "组件收到的 props；受控值与该回调都从这里读取。",
                en: "The component's props; both the value and the trigger callback are read from it.",
              }),
            ],
            [
              <InlineCode>valuePropName</InlineCode>,
              <InlineCode>string</InlineCode>,
              t({zh: "受控字段名，默认 \"value\"。", en: "Controlled prop name, default \"value\"."}),
            ],
            [
              <InlineCode>trigger</InlineCode>,
              <InlineCode>string</InlineCode>,
              t({zh: "变更回调名，默认 \"onChange\"。", en: "Change callback name, default \"onChange\"."}),
            ],
            [
              <InlineCode>onBeforeChange</InlineCode>,
              <InlineCode>(newValue: T, currentValue: T) =&gt; boolean | void</InlineCode>,
              t({
                zh: "变更前钩子；返回 false 取消除本次变更。",
                en: "Pre-change hook; return false to cancel the change.",
              }),
            ],
          ]}
        />
        <P>
          {t({
            zh: <>返回值</>,
            en: <>Return value</>,
          })}
        </P>
        <ApiTable
          head={[
            t({zh: "成员", en: "member"}),
            t({zh: "类型", en: "type"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>[0] value</InlineCode>,
              <InlineCode>T</InlineCode>,
              t({
                zh: "受控时来自 props，非受控时来自内部 state。",
                en: "From props when controlled, from internal state otherwise.",
              }),
            ],
            [
              <InlineCode>[1] setValue</InlineCode>,
              <InlineCode>Dispatch&lt;SetStateAction&lt;T&gt;&gt;</InlineCode>,
              t({
                zh: "统一入口：先过 onBeforeChange，再写状态并触发回调。",
                en: "The single entry point: runs onBeforeChange, then writes state and calls the trigger.",
              }),
            ],
          ]}
        />
      </Section>

      <Section title={t({zh: "5. 注意", en: "5. Cautions"})}>
        <ApiTable
          head={[
            t({zh: "注意", en: "caution"}),
            t({zh: "说明", en: "why it matters"}),
          ]}
          rows={[
            [
              t({zh: "显式 undefined 也算受控", en: "Explicit undefined is still controlled"}),
              t({
                zh: "hasOwnProperty 判定的是「有没有这个键」，不是「值是不是 undefined」。要非受控必须整个不传。",
                en: "hasOwnProperty tests for the key, not for undefined. To be uncontrolled you must omit the key entirely.",
              }),
            ],
            [
              t({zh: "onBeforeChange 不能改写新值", en: "onBeforeChange cannot rewrite the value"}),
              t({
                zh: "源码用 `shouldProceed === false` 判定，返回值本身被丢弃——尽管 JSDoc 写了「可修改新值」。截断请在 setValue 之前做。",
                en: "The source only checks `shouldProceed === false` and discards the return value, even though the JSDoc says it can 'modify the new value'. Clamp before calling setValue.",
              }),
            ],
            [
              t({zh: "受控时不兜底", en: "No fallback when controlled"}),
              t({
                zh: "受控模式下若父级忽略 onChange，界面不会更新——hook 不会偷偷退回内部 state。",
                en: "If the parent ignores onChange while controlled, nothing updates — the hook will not silently fall back to internal state.",
              }),
            ],
            [
              t({zh: "同一事件里连续 setValue 不叠加", en: "Back-to-back setValue calls do not compose"}),
              t({
                zh: "函数式更新以本次渲染捕获的 value 为基准，而非最新的排队状态；一次事件里连调两次 setValue((p) => p + 1) 只加 1。",
                en: "An updater resolves against the value captured at render time, not the latest queued state; two setValue((p) => p + 1) calls in one event add 1, not 2.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
