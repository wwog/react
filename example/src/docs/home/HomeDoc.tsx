import type {CSSProperties, FC, ReactNode} from "react";
import {useI18n} from "../../i18n";
import {Callout, Code, Section, colors, P} from "../ui";

const GITHUB = "https://github.com/wwog/react";
const NPM = "https://www.npmjs.com/package/@wwog/react";

const badgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  padding: "3px 9px",
  borderRadius: 999,
  border: `1px solid ${colors.accentBorder}`,
  background: colors.accentSoft,
  color: colors.accent,
};

const linkStyle: CSSProperties = {
  color: colors.accent,
  textDecoration: "none",
  fontWeight: 500,
};

/** 首页顶部的徽标：ESM only / 零依赖 等。 */
const Badge: FC<{children: ReactNode}> = ({children}) => <span style={badgeStyle}>{children}</span>;

/** 站外链接（GitHub / npm）。 */
const OutLink: FC<{href: string; children: ReactNode}> = ({href, children}) => (
  <a href={href} target="_blank" rel="noreferrer" style={linkStyle}>
    {children}
  </a>
);

/** 站内 hash 链接，跳到左侧「文档」里的某一页。 */
const DocLink: FC<{id: string; children: ReactNode}> = ({id, children}) => (
  <a href={`#/${id}`} style={linkStyle}>
    {children}
  </a>
);

const CardGrid: FC<{children: ReactNode}> = ({children}) => (
  <div
    style={{
      display: "grid",
      // 两列：每块四张卡，正好排成 2×2；窄屏自动降为单列。
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: 12,
      margin: "0 0 18px",
    }}
  >
    {children}
  </div>
);

/** 概览卡片：标题 + 正文 + 底部链接。 */
const Card: FC<{title: ReactNode; children: ReactNode; footer?: ReactNode}> = ({
  title,
  children,
  footer,
}) => (
  <div
    style={{
      background: colors.panel,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 7,
    }}
  >
    <div style={{fontSize: 14, fontWeight: 600, color: colors.text}}>{title}</div>
    <div style={{fontSize: 13, lineHeight: 1.75, color: colors.body, flex: 1}}>{children}</div>
    {footer ? <div style={{fontSize: 12.5}}>{footer}</div> : null}
  </div>
);

/** 函数名做成等宽小标签，避免在正文里堆一长串 InlineCode。 */
const Chips: FC<{items: string[]}> = ({items}) => (
  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2}}>
    {items.map((item) => (
      <code
        key={item}
        style={{
          fontSize: 11.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "#f3f4f6",
          border: `1px solid ${colors.border}`,
          borderRadius: 5,
          padding: "1px 6px",
          color: colors.body,
        }}
      >
        {item}
      </code>
    ))}
  </div>
);

export const HomeDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <div style={{marginBottom: 30}}>
        <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
          <h1 style={{fontSize: 30, margin: 0, letterSpacing: -0.6}}>@wwog/react</h1>
          <Badge>ESM only</Badge>
          <Badge>{t({zh: "零依赖", en: "Zero deps"})}</Badge>
          <Badge>TypeScript</Badge>
        </div>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.85,
            color: colors.body,
            margin: "14px 0 0",
            maxWidth: 660,
          }}
        >
          {t({
            zh: (
              <>
                一个实用的 React 工具库：用声明式组件表达流程控制与常见 UI 结构，并提供一组面向性能的工具函数
                ——把主线程的工作移到 worker、交给合成器，或者干脆不做。只把 react / react-dom
                作为 peer 依赖，发布 ESM 与完整源码。
              </>
            ),
            en: (
              <>
                A practical React utility library: express flow control and common UI structure with
                declarative components, and reach for a set of performance-oriented utilities — move
                main-thread work to a worker, hand it to the compositor, or skip it altogether. Only
                react / react-dom are peer dependencies; ESM and full source are shipped.
              </>
            ),
          })}
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
            margin: "16px 0 20px",
            fontSize: 13.5,
          }}
        >
          <OutLink href={GITHUB}>GitHub</OutLink>
          <OutLink href={NPM}>npm</OutLink>
        </div>
        <Code
          code={`npm install @wwog/react
# pnpm add @wwog/react  ·  yarn add @wwog/react`}
          caption={t({
            zh: "左侧「文档」里的每个页面都直接 import 本仓库源码，所以改库代码即可在这里实时看到效果。",
            en: "Every page under Docs imports this repository's source directly, so editing the library is reflected here immediately.",
          })}
        />
      </div>

      <Section title={t({zh: "这个仓库是什么", en: "What this repository is"})}>
        <P>
          {t({
            zh: "四类内容：声明式流程控制、通用 UI 组件、两个常用 Hook，以及一组独立的工具/算法函数。下面按用途分成四块。",
            en: "Four kinds of content: declarative flow control, general-purpose UI components, two commonly used hooks, and a set of standalone utility/algorithm functions.",
          })}
        </P>
        <CardGrid>
          <Card
            title={t({zh: "声明式流程控制", en: "Declarative flow control"})}
            footer={<DocLink id="process-control">{t({zh: "阅读文档 →", en: "Read the docs →"})}</DocLink>}
          >
            {t({
              zh: "把分支、条件与数据管道写成 JSX，而不是嵌套三元表达式。",
              en: "Write branching, conditions and data pipelines as JSX instead of nested ternaries.",
            })}
            <Chips items={["If", "Switch / Case", "When", "True / False", "Pipe"]} />
          </Card>
          <Card
            title={t({zh: "通用 UI 组件", en: "General-purpose UI components"})}
            footer={
              <>
                <DocLink id="struct">ArrayRender</DocLink>
                {" · "}
                <DocLink id="sundry">Scope / Styles</DocLink>
                {" · "}
                <DocLink id="sundry-runtime">Observer / Portal</DocLink>
              </>
            }
          >
            {t({
              zh: "列表渲染、局部作用域、可见性观察、错误边界、焦点陷阱等，体量小但反复用到。",
              en: "List rendering, local scope, intersection observation, error boundaries, focus traps — small pieces you keep reaching for.",
            })}
            <Chips items={["ArrayRender", "Repeat", "Scope", "Observer", "Boundary", "FocusTrap"]} />
          </Card>
          <Card
            title={t({zh: "高性能工具函数", en: "High-performance utilities"})}
            footer={<DocLink id="worker-pool">{t({zh: "查看性能专题 →", en: "See the performance pages →"})}</DocLink>}
          >
            {t({
              zh: "Worker 池、常数时间队列、让出主线程、批量合并、记忆化、FLIP 动画——每条都对应一个具体的主线程问题。",
              en: "Worker pools, constant-time queues, yielding the main thread, batching, memoization, FLIP — each one answers a concrete main-thread problem.",
            })}
            <Chips items={["WorkerPool", "Queue", "yieldToMain", "memoize", "flipAnimate"]} />
          </Card>
          <Card
            title={t({zh: "Hooks 与状态", en: "Hooks & state"})}
            footer={
              <>
                <DocLink id="use-controlled">useControlled</DocLink>
                {" · "}
                <DocLink id="use-screen">useScreen</DocLink>
                {" · "}
                <DocLink id="external-state">createExternalState</DocLink>
              </>
            }
          >
            {t({
              zh: "受控/非受控统一、响应式断点，以及组件树之外的外部状态与持久化。",
              en: "Controlled/uncontrolled unification, responsive breakpoints, and state outside the component tree with persistence.",
            })}
            <Chips items={["useControlled", "useScreen", "createStorageState"]} />
          </Card>
        </CardGrid>
      </Section>

      <Section title={t({zh: "高性能函数", en: "High-performance utilities"})}>
        <P>
          {t({
            zh: "这组函数不提供 UI，只解决「主线程被占住」这一类问题。按手段分成四类，每类都有独立的文档页和可运行实例。",
            en: "These functions ship no UI; they answer one class of problem — a blocked main thread. They fall into four approaches, each with its own doc page and runnable demos.",
          })}
        </P>
        <CardGrid>
          <Card
            title={t({zh: "真并行：交给 Worker", en: "Real parallelism: hand it to a worker"})}
            footer={
              <>
                <DocLink id="worker-pool">WorkerPool</DocLink>
                {" · "}
                <DocLink id="worker">Worker 通信</DocLink>
              </>
            }
          >
            {t({
              zh: "固定大小的 worker 池：按需创建、最轻负载分配、空闲 worker 窃取尚未开始的任务，结果零拷贝转移。",
              en: "A fixed-size worker pool: created on demand, least-loaded dispatch, idle workers steal jobs that have not started, and results transfer with zero copy.",
            })}
            <Chips items={["WorkerPool", "postTransferable", "readWorkerReply"]} />
          </Card>
          <Card
            title={t({zh: "控制顺序：谁先跑", en: "Ordering: what runs first"})}
            footer={<DocLink id="queue">Queue 与优先级队列 →</DocLink>}
          >
            {t({
              zh: "主线程无法被中断，顺序就是用户感受到的响应性。摊还 O(1) 的 FIFO 队列，紧急任务插队，已排队的任务事后提升。",
              en: "The main thread cannot be interrupted, so order is the responsiveness users feel. An amortized O(1) FIFO queue with urgent cut-in and later promotion.",
            })}
            <Chips items={["Queue", "createPriorityQueue"]} />
          </Card>
          <Card
            title={t({zh: "消除工作：能不做就不做", en: "Eliminating work: don't do it at all"})}
            footer={
              <>
                <DocLink id="memoize">memoize</DocLink>
                {" · "}
                <DocLink id="backpressure">背压</DocLink>
                {" · "}
                <DocLink id="batching">批量</DocLink>
              </>
            }
          >
            {t({
              zh: "重复计算直接跳过（记忆化）；流入超过吞吐时丢弃最旧的、或只保留最新值（背压）；高频事件合并成每帧/每区间一次。",
              en: "Skip repeated computation (memoize); when inflow beats throughput, drop the oldest or keep only the latest (backpressure); coalesce frequent events to once per frame or interval.",
            })}
            <Chips
              items={["memoize", "createDroppingQueue", "createLatestValue", "debounce", "throttle", "rafSchedule"]}
            />
          </Card>
          <Card
            title={t({zh: "主线程友好：拆开或换个线程画", en: "Main-thread friendly: split it or move the paint"})}
            footer={
              <>
                <DocLink id="yield">拆分与让出</DocLink>
                {" · "}
                <DocLink id="flip">FLIP 动画</DocLink>
                {" · "}
                <DocLink id="batching">布局批处理</DocLink>
              </>
            }
          >
            {t({
              zh: "长任务切成小片并在片段间让出主线程；动画只改一次布局，其余交给合成器；DOM 读写分批，避免布局抖动。",
              en: "Split long tasks and yield between chunks; change layout once and let the compositor animate; batch DOM reads and writes to avoid layout thrashing.",
            })}
            <Chips items={["yieldToMain", "forEachChunked", "forEachInFrames", "flipAnimate", "runLayoutBatch"]} />
          </Card>
        </CardGrid>
        <Callout>
          {t({
            zh: "每个函数在文档里都能点开跑一遍，重点看它「不做会怎样」——那些页面的实例会把卡顿和优化后的差别直接放在一起对比。",
            en: "Every function has a runnable demo in the docs, focused on what happens without it — those pages put the janky and the optimized version side by side.",
          })}
        </Callout>
      </Section>

      <Section title={t({zh: "文档导览", en: "Documentation map"})}>
        <CardGrid>
          <Card title={t({zh: "组件 Components", en: "Components"})} footer={<DocLink id="process-control">{t({zh: "从流程控制开始 →", en: "Start with flow control →"})}</DocLink>}>
            {t({
              zh: "If / Switch / When / Pipe，以及 ArrayRender、Observer、FocusTrap 等结构型组件。",
              en: "If / Switch / When / Pipe, plus structural components such as ArrayRender, Observer and FocusTrap.",
            })}
          </Card>
          <Card title={t({zh: "钩子 Hooks", en: "Hooks"})} footer={<DocLink id="use-controlled">{t({zh: "从 useControlled 开始 →", en: "Start with useControlled →"})}</DocLink>}>
            {t({
              zh: "useControlled 统一受控与非受控；useScreen 返回当前断点，且只监听相邻断点。",
              en: "useControlled unifies controlled and uncontrolled state; useScreen returns the current breakpoint while listening only to adjacent ones.",
            })}
          </Card>
          <Card title={t({zh: "工具 Utils", en: "Utils"})} footer={<DocLink id="worker-pool">{t({zh: "从 WorkerPool 开始 →", en: "Start with WorkerPool →"})}</DocLink>}>
            {t({
              zh: "Worker 池与通信、队列、拆分让出、批量、背压、记忆化、FLIP、外部状态，以及 cx / formatDate 等基础工具。",
              en: "Worker pools and messaging, queues, yielding, batching, backpressure, memoization, FLIP, external state, plus basics like cx and formatDate.",
            })}
          </Card>
          <Card title={t({zh: "算法 Algorithm", en: "Algorithm"})} footer={<DocLink id="zellers-congruence">{t({zh: "查看蔡勒公式 →", en: "See Zeller's congruence →"})}</DocLink>}>
            {t({
              zh: "蔡勒公式：由日期推算星期，含负余数修正与公历/儒略历对照。",
              en: "Zeller's congruence: derive the weekday from a date, with negative-remainder fixes and Gregorian/Julian comparison.",
            })}
          </Card>
        </CardGrid>
      </Section>

      <Section title={t({zh: "AI 友好", en: "AI-friendly"})}>
        <P>
          {t({
            zh: (
              <>
                仓库里的 <code style={{fontFamily: "ui-monospace, monospace"}}>use-wwog-react.md</code>{" "}
                是一份 Claude Code skill（自带 name / description frontmatter）。装上之后，Claude Code
                会优先使用本库的声明式组件，而不是手写等价模式。
              </>
            ),
            en: (
              <>
                The repository ships{" "}
                <code style={{fontFamily: "ui-monospace, monospace"}}>use-wwog-react.md</code> as a
                Claude Code skill (with name / description frontmatter). Once installed, Claude Code
                prefers this library's declarative components over hand-rolled equivalents.
              </>
            ),
          })}
        </P>
        <Code
          code={`# 项目级：提交到仓库，团队共享
cp use-wwog-react.md .claude/skills/use-wwog-react/SKILL.md

# 用户级：所有项目可用
cp use-wwog-react.md ~/.claude/skills/use-wwog-react/SKILL.md`}
          caption={t({
            zh: "文件本身已带合法 frontmatter，无需再配置；下次会话 Claude Code 会自动发现。",
            en: "The file already carries valid frontmatter and needs no further configuration; Claude Code discovers it on the next session.",
          })}
        />
      </Section>

      <P>
        {t({
          zh: (
            <>
              本页只是概览，完整 API 与用法见 README（
              <OutLink href={`${GITHUB}#readme`}>GitHub</OutLink> 或{" "}
              <OutLink href={NPM}>npm</OutLink>），交互实例见左侧「文档」。
            </>
          ),
          en: (
            <>
              This page is only an overview. Full API and usage live in the README (
              <OutLink href={`${GITHUB}#readme`}>GitHub</OutLink> or{" "}
              <OutLink href={NPM}>npm</OutLink>); runnable examples live under Docs in the sidebar.
            </>
          ),
        })}
      </P>
    </div>
  );
};
