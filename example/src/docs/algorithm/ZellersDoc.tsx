import {useState, type FC} from "react";
import {weekday, weekdayJulian} from "../../../../src";
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
  controlStyle,
} from "../ui";

type DateParts = [number, number, number];

/** 0 = 周日 … 6 = 周六，与 JS Date.getDay() 同约定。 */
const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad2 = (value: number): string => String(value).padStart(2, "0");

const todayISO = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const parseISODate = (value: string): DateParts | null => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return [parts[0], parts[1], parts[2]];
};

/** 蔡勒公式把 1、2 月归到上一年，这里给出「调整后的年份」。 */
const adjustedYear = (y: number, m: number): number => (m < 3 ? y - 1 : y);

const normalize = (value: number): number => ((value % 7) + 7) % 7;

/**
 * weekdayJulian 的源码实现把「调整后的年份」加了两次；减掉一次才回到
 * 注释里 0 = 周六 的约定。下面的 demo 都采用这一步修正后的索引。
 */
const julianIndex = (y: number, m: number, d: number): number =>
  normalize(weekdayJulian(y, m, d) - adjustedYear(y, m));

/** 把 0 = 周六 的索引换算成 0 = 周日，便于两历法共用一张星期名表比较。 */
const saturdayToSundayIndex = (index: number): number => (index + 6) % 7;

// ---- 示例:公历日期选择器 ----

const GregorianPickerDemo: FC = () => {
  const {t} = useI18n();
  const [value, setValue] = useState(todayISO);
  const name = (index: number) =>
    t({zh: WEEKDAY_ZH[index] ?? "—", en: WEEKDAY_EN[index] ?? "—"});

  const parsed = parseISODate(value);
  const result = parsed
    ? (() => {
        const [y, m, d] = parsed;
        const index = normalize(weekday(y, m, d));
        const jsIndex = new Date(y, m - 1, d).getDay();
        return {y, m, d, index, jsIndex, match: index === jsIndex};
      })()
    : null;

  return (
    <Demo
      title={t({
        zh: "示例:选一个公历日期看星期",
        en: "Demo: pick a Gregorian date and read the weekday",
      })}
      hint={t({
        zh: "weekday 与 Date.getDay() 同为 0 = 周日 … 6 = 周六。1、2 月平年会少一天，下一节的对照表能直接看到。",
        en: "weekday shares Date.getDay()'s convention: 0 = Sunday … 6 = Saturday. January and February are off by one in common years — the cross-check below shows it directly.",
      })}
    >
      <Controls>
        <Label>{t({zh: "公历日期", en: "Gregorian date"})}</Label>
        <input
          type="date"
          value={value}
          min="1583-01-01"
          onChange={(event) => setValue(event.target.value)}
          style={controlStyle}
        />
      </Controls>
      {result ? (
        <Output>
          <div>
            weekday({result.y}, {result.m}, {result.d}) → <strong>{result.index}</strong> ·{" "}
            {name(result.index)}
          </div>
          <div>
            new Date({result.y}, {result.m - 1}, {result.d}).getDay() →{" "}
            <strong>{result.jsIndex}</strong> · {name(result.jsIndex)}
          </div>
          <div>
            {t({zh: "是否一致", en: "match"})}:{" "}
            <strong style={{color: result.match ? colors.success : colors.warn}}>
              {result.match ? t({zh: "一致", en: "yes"}) : t({zh: "差 1 天", en: "off by one"})}
            </strong>
          </div>
        </Output>
      ) : (
        <Output>
          <Muted>{t({zh: "请选择一个有效的日期。", en: "Pick a valid date."})}</Muted>
        </Output>
      )}
    </Demo>
  );
};

// ---- 示例:与 Date.getDay() 逐日对照 ----

const CROSS_CHECK_DATES: DateParts[] = [
  [2026, 9, 11],
  [2025, 9, 11],
  [2025, 1, 1],
  [2024, 2, 29],
  [2000, 1, 1],
  [1900, 1, 1],
  [1582, 10, 15],
  [1582, 10, 4],
];

const CrossCheckDemo: FC = () => {
  const {t} = useI18n();
  const name = (index: number) =>
    t({zh: WEEKDAY_ZH[index] ?? "—", en: WEEKDAY_EN[index] ?? "—"});

  return (
    <Demo
      title={t({
        zh: "示例:逐日对照 Date.getDay()",
        en: "Demo: day-by-day cross-check against Date.getDay()",
      })}
      hint={t({
        zh: "每一行都用两套实现算同一天。3–12 月始终一致；1、2 月在平年（2025-01-01、1900-01-01）相差一天，闰年（2024-02-29、2000-01-01）一致。",
        en: "Each row computes the same day twice. March–December always agree; January and February differ by a day in common years (2025-01-01, 1900-01-01) and agree in leap years (2024-02-29, 2000-01-01).",
      })}
    >
      <ApiTable
        head={[
          t({zh: "日期", en: "date"}),
          t({zh: "weekday()", en: "weekday()"}),
          t({zh: "Date.getDay()", en: "Date.getDay()"}),
          t({zh: "结果", en: "result"}),
        ]}
        rows={CROSS_CHECK_DATES.map(([y, m, d]) => {
          const index = normalize(weekday(y, m, d));
          const jsIndex = new Date(y, m - 1, d).getDay();
          const match = index === jsIndex;
          return [
            <InlineCode>{`${y}-${pad2(m)}-${pad2(d)}`}</InlineCode>,
            `${index} · ${name(index)}`,
            `${jsIndex} · ${name(jsIndex)}`,
            match ? (
              <span style={{color: colors.success}}>{t({zh: "一致", en: "match"})}</span>
            ) : (
              <span style={{color: colors.warn}}>
                {t({zh: "差 1 天（偏小）", en: "off by one (lags)"})}
              </span>
            ),
          ];
        })}
      />
    </Demo>
  );
};

// ---- 示例:公历 vs 儒略历 ----

interface ComparePair {
  label: {zh: string; en: string};
  g: DateParts;
  j: DateParts;
  note: {zh: string; en: string};
}

const COMPARE_PAIRS: ComparePair[] = [
  {
    label: {zh: "现代:2024-09-11", en: "Modern: 2024-09-11"},
    g: [2024, 9, 11],
    j: [2024, 8, 29],
    note: {
      zh: "同一物理日:公历 9/11 对应儒略历 8/29（相差 13 天）。两历法都记为周三。",
      en: "Same physical day: Gregorian 9/11 is Julian 8/29, thirteen days apart. Both calendars reckon Wednesday.",
    },
  },
  {
    label: {zh: "1582 改历:10-15", en: "1582 reform: Oct 15"},
    g: [1582, 10, 15],
    j: [1582, 10, 5],
    note: {
      zh: "公历启用的第一天，它的前一天是儒略历 10/4。相差 10 天，星期仍相同（周五）。",
      en: "The first Gregorian day; the day before it is Julian Oct 4. Ten days apart, yet the same weekday (Friday).",
    },
  },
  {
    label: {zh: "改历前:1582-10-04", en: "Before the reform: 1582-10-04"},
    g: [1582, 10, 4],
    j: [1582, 10, 4],
    note: {
      zh: "同一个日期标签:按外推公历是周一，按当时实际使用的儒略历是周四。公历在 1582 年之前并不存在，weekday 只是外推。",
      en: "One label, two answers: Monday under the proleptic Gregorian rule, Thursday in the Julian calendar actually in use. Gregorian did not exist before 1582; weekday merely extrapolates.",
    },
  },
];

const CompareDemo: FC = () => {
  const {t} = useI18n();
  const [active, setActive] = useState(0);
  const pair = COMPARE_PAIRS[active];
  const [gy, gm, gd] = pair.g;
  const [jy, jm, jd] = pair.j;

  const gIndex = normalize(weekday(gy, gm, gd));
  const rawJulian = weekdayJulian(jy, jm, jd);
  const correctedJulian = julianIndex(jy, jm, jd);
  const julianSundayIndex = saturdayToSundayIndex(correctedJulian);
  const agree = gIndex === julianSundayIndex;
  const name = (index: number) =>
    t({zh: WEEKDAY_ZH[index] ?? "—", en: WEEKDAY_EN[index] ?? "—"});

  return (
    <Demo
      title={t({
        zh: "示例:同一物理日在两种历法下",
        en: "Demo: the same physical day under both calendars",
      })}
      hint={t({
        zh: "选一组日期。左列用 weekday 按公历算，右列用 weekdayJulian 按儒略历算——右侧先减掉重复计入的年份，再换算到 0 = 周日 以便与公历比较。",
        en: "Pick a pair. The left column uses weekday (Gregorian); the right uses weekdayJulian (Julian) after removing the duplicated year and converting to 0 = Sunday so it can be compared with the Gregorian result.",
      })}
    >
      <Controls>
        {COMPARE_PAIRS.map((item, index) => (
          <Button
            key={item.label.en}
            onClick={() => setActive(index)}
            tone={index === active ? "primary" : "ghost"}
          >
            {t(item.label)}
          </Button>
        ))}
      </Controls>
      <Output>
        <div>
          {t({zh: "公历", en: "Gregorian"})} weekday({gy}, {gm}, {gd}) →{" "}
          <strong>{gIndex}</strong> · {name(gIndex)}
        </div>
        <div>
          {t({zh: "儒略历", en: "Julian"})} weekdayJulian({jy}, {jm}, {jd}) →{" "}
          <strong>{rawJulian}</strong>{" "}
          <Muted>{t({zh: "（原始值）", en: "(raw)"})}</Muted>
          {" · "}
          {t({zh: "修正后", en: "corrected"})} <strong>{correctedJulian}</strong> ·{" "}
          {name(julianSundayIndex)}
        </div>
        <div>
          {t({zh: "同一物理日星期相同", en: "same weekday for the same day"})}:{" "}
          <strong style={{color: agree ? colors.success : colors.warn}}>
            {agree ? t({zh: "是", en: "yes"}) : t({zh: "否", en: "no"})}
          </strong>
        </div>
        <Muted>{t(pair.note)}</Muted>
      </Output>
    </Demo>
  );
};

// ---- 页面 ----

export const ZellersDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              蔡勒公式（Zeller's congruence）只用整数运算就能算出任意一天是星期几。它把一年重新编号：
              3 月是一年的开始，1 月和 2 月被当作上一年的第 13、14 个月。闰日因此落在「年末」，
              闰年修正退化成一次整除，公式里不再需要分支。
            </>
          ),
          en: (
            <>
              Zeller's congruence computes the weekday of any date with integer arithmetic alone. It
              renumbers the year so that March begins it: January and February become months 13 and 14
              of the previous year. The leap day then lands at the end of the year, reducing the
              leap-year correction to one integer division and removing any branching from the formula.
            </>
          ),
        })}
      </P>
      <P>
        {t({
          zh: (
            <>
              这个模块导出两个函数：<InlineCode>weekday</InlineCode>（公历）与{" "}
              <InlineCode>weekdayJulian</InlineCode>（儒略历）。两者都很短，但返回值约定并不相同，
              而且当前实现与自己的注释存在偏差——本页把公式、真实行为和这些偏差都摊开讲。
            </>
          ),
          en: (
            <>
              The module exports two functions: <InlineCode>weekday</InlineCode> (Gregorian) and{" "}
              <InlineCode>weekdayJulian</InlineCode> (Julian). Both are short, but their return
              conventions differ, and the current implementation deviates from its own comments —
              this page lays out the formula, the real behaviour, and those deviations.
            </>
          ),
        })}
      </P>

      <Callout>
        {t({
          zh: (
            <>
              <InlineCode>src/algorithm</InlineCode> 已从包根导出，可以直接写成{" "}
              <InlineCode>{'import { weekday, weekdayJulian } from "@wwog/react"'}</InlineCode>。
              但当前实现与自身注释的约定有出入——1、2 月的偏移，以及 <InlineCode>weekdayJulian</InlineCode>{" "}
              把调整后的年份累加了两次。下文逐条说明，并给出修正写法。
            </>
          ),
          en: (
            <>
              <InlineCode>src/algorithm</InlineCode> is exported from the package root, so you can write{" "}
              <InlineCode>{'import { weekday, weekdayJulian } from "@wwog/react"'}</InlineCode>. The
              current implementation deviates from its own comments, though — the January/February drift,
              and <InlineCode>weekdayJulian</InlineCode> adding the adjusted year twice. The sections
              below spell both out and give the corrected forms.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 公式与负余数", en: "1. The formula and the negative remainder"})}>
        <P>
          {t({
            zh: (
              <>
                对公历，蔡勒公式是{" "}
                <InlineCode>h = (q + ⌊13(m + 1) / 5⌋ + K + ⌊K / 4⌋ + ⌊J / 4⌋ − 2J) mod 7</InlineCode>
                ，儒略历则把 <InlineCode>−2J</InlineCode> 换成 <InlineCode>+5 − J</InlineCode>。
                其中 <InlineCode>h</InlineCode> 是星期几，<InlineCode>q</InlineCode> 是月内日期，
                <InlineCode>m</InlineCode> 是重新编号后的月（3…14），<InlineCode>K</InlineCode> 是世纪内年份
                （<InlineCode>Y mod 100</InlineCode>），<InlineCode>J</InlineCode> 是从零开始的世纪数。
              </>
            ),
            en: (
              <>
                For the Gregorian calendar the formula is{" "}
                <InlineCode>h = (q + ⌊13(m + 1) / 5⌋ + K + ⌊K / 4⌋ + ⌊J / 4⌋ − 2J) mod 7</InlineCode>
                ; for the Julian calendar <InlineCode>−2J</InlineCode> becomes{" "}
                <InlineCode>+5 − J</InlineCode>. Here <InlineCode>h</InlineCode> is the weekday,{" "}
                <InlineCode>q</InlineCode> the day of month, <InlineCode>m</InlineCode> the renumbered
                month (3…14), <InlineCode>K</InlineCode> the year within the century (
                <InlineCode>Y mod 100</InlineCode>), and <InlineCode>J</InlineCode> the zero-based
                century.
              </>
            ),
          })}
        </P>
        <P>
          {t({
            zh: (
              <>
                关键在于模的定义：数学意义上的 <InlineCode>−2 mod 7</InlineCode> 等于{" "}
                <InlineCode>5</InlineCode>；但绝大多数语言（包括 JavaScript）的{" "}
                <InlineCode>%</InlineCode> 是截断取余，<InlineCode>−2 % 7</InlineCode> 得到{" "}
                <InlineCode>−2</InlineCode>，会直接污染结果。源码注释给出的修正很直接：把{" "}
                <InlineCode>−2J</InlineCode> 换成 <InlineCode>+5J</InlineCode>、把{" "}
                <InlineCode>−J</InlineCode> 换成 <InlineCode>+6J</InlineCode>，让分子恒为正
                （<InlineCode>−2 ≡ 5</InlineCode>、<InlineCode>−1 ≡ 6 (mod 7)</InlineCode>）。
              </>
            ),
            en: (
              <>
                The catch is the definition of modulo: mathematically{" "}
                <InlineCode>−2 mod 7</InlineCode> is <InlineCode>5</InlineCode>, but in most languages
                (JavaScript included) <InlineCode>%</InlineCode> truncates, so{" "}
                <InlineCode>−2 % 7</InlineCode> is <InlineCode>−2</InlineCode> and poisons the result.
                The source comment applies a direct fix: replace <InlineCode>−2J</InlineCode> with{" "}
                <InlineCode>+5J</InlineCode> and <InlineCode>−J</InlineCode> with{" "}
                <InlineCode>+6J</InlineCode> so the numerator is always non-negative (
                <InlineCode>−2 ≡ 5</InlineCode>, <InlineCode>−1 ≡ 6 (mod 7)</InlineCode>).
              </>
            ),
          })}
        </P>
        <Code
          code={`对于公历:  h = (q + floor(13(m + 1) / 5) + K + floor(K / 4) + floor(J / 4) − 2J) mod 7
对于儒略历: h = (q + floor(13(m + 1) / 5) + K + floor(K / 4) + 5 − J) mod 7

h: 0 = 星期六, 1 = 星期日, …, 6 = 星期五
m: 3 = 三月, …, 12 = 十二月, 13 = 一月, 14 = 二月
K: 世纪内的年份 (Y mod 100)     J: 从零开始的世纪数 (floor(Y / 100))

数学模:   −2 mod 7 = 5
截断取余: −2 % 7 = −2

把负项换成等价正项, 分子恒为正:
公历:   h = (q + floor(13(m + 1) / 5) + K + floor(K / 4) + floor(J / 4) + 5J) mod 7
儒略历: h = (q + floor(13(m + 1) / 5) + K + floor(K / 4) + 5 + 6J) mod 7`}
          caption={t({
            zh: "源码顶部的大段注释给出了这些推导，以及 RFC 3339 附录 B 的四位数年份变体。",
            en: "The long comment at the top of the source derives these forms, plus the four-digit-year variant from RFC 3339 appendix B.",
          })}
        />
      </Section>

      <Section title={t({zh: "2. 公历:选一个日期", en: "2. Gregorian: pick a date"})}>
        <P>
          {t({
            zh: (
              <>
                <InlineCode>weekday(y, m, d)</InlineCode> 返回{" "}
                <InlineCode>0 = 周日 … 6 = 周六</InlineCode>，与{" "}
                <InlineCode>Date.getDay()</InlineCode> 完全同约定，因此可以直接互相对照。
              </>
            ),
            en: (
              <>
                <InlineCode>weekday(y, m, d)</InlineCode> returns{" "}
                <InlineCode>0 = Sunday … 6 = Saturday</InlineCode>, exactly{" "}
                <InlineCode>Date.getDay()</InlineCode>'s convention, so the two can be compared
                directly.
              </>
            ),
          })}
        </P>
        <GregorianPickerDemo />
        <Code
          code={`import { weekday } from "@wwog/react";

weekday(2024, 9, 11);  // 3 → 周三
weekday(2024, 1, 1);   // 1 → 周一
weekday(1582, 10, 15); // 5 → 周五 (公历启用的第一天)

// 与 JS Date 的约定一致 (0 = 周日 … 6 = 周六)
weekday(2024, 9, 11) === new Date(2024, 8, 11).getDay(); // true`}
          caption={t({
            zh: "参数 m 是 1–12 的自然月份，函数内部再折算成 3 月制。",
            en: "The m parameter is the natural 1–12 month; the function folds it into the March-based year internally.",
          })}
        />
      </Section>

      <Section title={t({zh: "3. 与 Date.getDay() 对照", en: "3. Cross-check against Date.getDay()"})}>
        <P>
          {t({
            zh: "对 1583 年以来的所有日期，3–12 月两套实现始终一致；1、2 月只在闰年一致。",
            en: "For every date since 1583 the two implementations always agree from March through December; January and February agree only in leap years.",
          })}
        </P>
        <CrossCheckDemo />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                1、2 月的偏差来自实现细节：这两个月被归到上一年，但代码仍用未调整的{" "}
                <InlineCode>y</InlineCode> 去算闰年项{" "}
                <InlineCode>⌊y/4⌋ − ⌊y/100⌋ + ⌊y/400⌋</InlineCode>。常数项与真实公式相差{" "}
                <InlineCode>6</InlineCode>（<InlineCode>≡ −1 mod 7</InlineCode>），平年就整体偏小 1 天；
                闰年多出的那一项刚好抵消，所以闰年正确。3 月及以后 <InlineCode>adjustedY = y − 2</InlineCode>
                把常数差固定下来，因此始终正确。
              </>
            ),
            en: (
              <>
                The January/February drift is an implementation detail: those months belong to the
                previous year, yet the code still evaluates the leap terms{" "}
                <InlineCode>⌊y/4⌋ − ⌊y/100⌋ + ⌊y/400⌋</InlineCode> against the unadjusted{" "}
                <InlineCode>y</InlineCode>. Its constant term is <InlineCode>6</InlineCode> (
                <InlineCode>≡ −1 mod 7</InlineCode>) away from the correct formula, so common years
                come out one day short; in leap years the extra day cancels it exactly, which is why
                leap years are right. From March onward <InlineCode>adjustedY = y − 2</InlineCode>{" "}
                pins that constant difference down, so those months are always correct.
              </>
            ),
          })}
        </Callout>
      </Section>

      <Section title={t({zh: "4. 公历 vs 儒略历", en: "4. Gregorian vs Julian"})}>
        <P>
          {t({
            zh: (
              <>
                两种历法对「同一个物理日」给出相同的星期——星期是连续计数的，历法只改变日期的标签。
                1582-10-15 公历启用后，两种标签相差 10 天，今天是 13 天；而 <InlineCode>weekday</InlineCode>{" "}
                在 1582 年之前只是把公历规则向外推，那时实际使用的是儒略历。
              </>
            ),
            en: (
              <>
                Both calendars give the same weekday for the same physical day — the weekday advances
                continuously; a calendar only relabels the date. After the Gregorian reform on
                1582-10-15 the two labels were ten days apart and are thirteen apart today. Before
                1582, <InlineCode>weekday</InlineCode> merely extrapolates Gregorian rules backwards,
                while the calendar actually in use was the Julian one.
              </>
            ),
          })}
        </P>
        <CompareDemo />
        <Callout tone="warn">
          {t({
            zh: (
              <>
                <InlineCode>weekdayJulian</InlineCode> 的实现把 <InlineCode>adjustedY</InlineCode>{" "}
                加了两次（先是 <InlineCode>adjustedD = d + adjustedY</InlineCode>，返回值里又出现一次{" "}
                <InlineCode>+ adjustedY</InlineCode>）。因此原始返回值等于「正确的儒略历星期 +{" "}
                <InlineCode>adjustedY mod 7</InlineCode>」，并不落在注释声称的{" "}
                <InlineCode>0 = 周六</InlineCode> 约定上。上面的 demo 先减掉 <InlineCode>adjustedY</InlineCode>{" "}
                再取模，得到的就是注释约定的索引。
              </>
            ),
            en: (
              <>
                The <InlineCode>weekdayJulian</InlineCode> implementation adds{" "}
                <InlineCode>adjustedY</InlineCode> twice (first in{" "}
                <InlineCode>adjustedD = d + adjustedY</InlineCode>, then again in the returned
                expression). Its raw value therefore equals "correct Julian weekday +{" "}
                <InlineCode>adjustedY mod 7</InlineCode>" and does not land on the documented{" "}
                <InlineCode>0 = Saturday</InlineCode> convention. The demo above subtracts{" "}
                <InlineCode>adjustedY</InlineCode> before reducing, which restores the documented
                index.
              </>
            ),
          })}
        </Callout>
        <Code
          code={`import { weekdayJulian } from "@wwog/react";

// 源码注释约定: 0 = 周六, 1 = 周日, …, 6 = 周五
// ⚠ 当前实现把"调整后的年份"加了两次, 原始值并不直接满足该约定。
const adjustedYear = (y, m) => (m < 3 ? y - 1 : y);

const julianWeekday = (y, m, d) => {
  const k = adjustedYear(y, m);
  // 先减掉重复计入的年份, 再归一到 0 = 周六
  return (((weekdayJulian(y, m, d) - k) % 7) + 7) % 7;
};

// 修正后, 同一物理日的两个结果一致:
// weekday(2024, 9, 11) === 3 (周三)
// julianWeekday(2024, 8, 29) === 4 (0 = 周六 约定, 同样是周三)`}
          caption={t({
            zh: "儒略历日期的年份同样按 3 月制调整：1、2 月用 y − 1。",
            en: "The Julian year is adjusted the same March-based way: January and February use y − 1.",
          })}
        />
      </Section>

      <Section title={t({zh: "5. API 参考", en: "5. API reference"})}>
        <ApiTable
          head={[
            t({zh: "导出", en: "export"}),
            t({zh: "签名", en: "signature"}),
            t({zh: "返回", en: "returns"}),
            t({zh: "说明", en: "description"}),
          ]}
          rows={[
            [
              <InlineCode>weekday</InlineCode>,
              <InlineCode>(y: number, m: number, d: number) =&gt; number</InlineCode>,
              <InlineCode>0 = 周日 … 6 = 周六</InlineCode>,
              t({
                zh: "公历；与 Date.getDay() 同约定。3–12 月与 Date.getDay() 完全一致，1、2 月平年偏小 1 天。",
                en: "Gregorian; same convention as Date.getDay(). March–December match Date.getDay() exactly; January and February lag by one day in common years.",
              }),
            ],
            [
              <InlineCode>weekdayJulian</InlineCode>,
              <InlineCode>(y: number, m: number, d: number) =&gt; number</InlineCode>,
              <InlineCode>0 = 周六 … 6 = 周五</InlineCode>,
              t({
                zh: "儒略历；源码注释约定 0 = 周六，但当前实现把调整后的年份加了两次，需先减去再取模（见第 4 节）。",
                en: "Julian; the source comment documents 0 = Saturday, but the implementation adds the adjusted year twice, so subtract it before reducing (see section 4).",
              }),
            ],
          ]}
        />
        <P>
          {t({
            zh: (
              <>
                两个函数参数相同：<InlineCode>y</InlineCode> 是四位年份，<InlineCode>m</InlineCode> 是{" "}
                <InlineCode>1–12</InlineCode>，<InlineCode>d</InlineCode> 是月内日期。注意 JavaScript{" "}
                <InlineCode>Date</InlineCode> 会把 <InlineCode>0–99</InlineCode> 的年份当作 19xx，
                所以本页的对照 demo 把日期下限设为 1583；需要更早年份时应自行构造日期。
              </>
            ),
            en: (
              <>
                Both functions take the same parameters: <InlineCode>y</InlineCode> is a four-digit
                year, <InlineCode>m</InlineCode> is <InlineCode>1–12</InlineCode>, and{" "}
                <InlineCode>d</InlineCode> is the day of month. Note that JavaScript{" "}
                <InlineCode>Date</InlineCode> maps years <InlineCode>0–99</InlineCode> to 19xx, so the
                cross-check demo here floors the picker at 1583; construct dates manually for earlier
                years.
              </>
            ),
          })}
        </P>
      </Section>

      <Section title={t({zh: "6. 注意事项", en: "6. Cautions"})}>
        <ApiTable
          head={[t({zh: "注意", en: "caution"}), t({zh: "说明", en: "why it matters"})]}
          rows={[
            [
              t({zh: "包根导出两个函数", en: "Two functions are exported from the root"}),
              t({
                zh: "@wwog/react 导出 weekday 与 weekdayJulian。src/algorithm/date.ts 里那个命名空间对象（键名拼写为 zllersKongruenz）是历史产物，未从包根导出。",
                en: "@wwog/react exports weekday and weekdayJulian. The namespace object in src/algorithm/date.ts (whose key is misspelled zllersKongruenz) is a leftover and is not exported from the root.",
              }),
            ],
            [
              t({zh: "weekday 的 1、2 月", en: "weekday's January and February"}),
              t({
                zh: "平年结果比真实星期偏小 1 天；闰年正确。3–12 月不受影响。",
                en: "Common years come out one day behind the real weekday; leap years are correct. March–December are unaffected.",
              }),
            ],
            [
              t({zh: "weekdayJulian 重复计年", en: "weekdayJulian double-counts the year"}),
              t({
                zh: "原始返回值 = 正确儒略历星期 + adjustedY (mod 7)；使用前先减去 adjustedY。",
                en: "Raw value = correct Julian weekday + adjustedY (mod 7); subtract adjustedY before using it.",
              }),
            ],
            [
              t({zh: "1582 年之前为外推", en: "Proleptic before 1582"}),
              t({
                zh: "公历自 1582-10-15 起施行；更早日期 weekday 只是按公历规则外推，不代表当时实际使用的历法。",
                en: "The Gregorian calendar began on 1582-10-15; for earlier dates weekday only extrapolates Gregorian rules and does not reflect the calendar actually in use.",
              }),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
