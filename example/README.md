# @wwog/react · 交互式文档（example）

这是 `@wwog/react` 的交互式文档应用：不是静态说明，而是一页页可以直接点、直接跑的实例。
运行方式：

```bash
cd example
npm install
npm run dev     # 本地开发
npm run build   # tsc 类型检查 + vite 构建
```

## 部署（GitHub Pages）

线上地址：<https://wwog.github.io/react/>

推送 `example/**` 或 `src/**` 到主分支后，`.github/workflows/deploy-example.yml` 会自动构建并发布。
生产构建的 `base` 为 `/react/`（见 `vite.config.ts`），因此 `npm run preview` 会在
<http://localhost:4173/react/> 预览，和线上路径完全一致，可以据此确认资源路径是否正确。

发布依赖仓库的 Pages 设置里 **Source = GitHub Actions**（已配置）；若之后被改回分支发布，
工作流会构建成功但无法上线。

## 布局与交互方式

- **主页 + 文档两层**：侧栏顶部是独立的「主页」（`#/home`，默认路由），汇总仓库定位与全部功能入口；其下是「文档」标题，标题内再按组件 / 钩子 / 工具 / 算法分小节。原有页面全部收在「文档」之下。
- **左右布局**：左侧固定侧边栏，右侧是当前功能的「文档 + 交互实例」。两侧各自独立滚动，顶栏吸附。
- **左侧列表做功能路由**：侧边栏按分组列出功能，点击切换右侧内容。路由基于 URL hash（如 `#/worker-pool`），因此浏览器前进/后退、刷新后停在同一页、把链接直接发给别人，都能工作。
- **右上角切换语言**：顶栏右上角的 `中文 / EN` 开关。选择会写入 `localStorage`，刷新后保持；首次进入按浏览器语言自动选择。
- **双语不是两套文档**：每段文案与内容写在同一处（`Localized` 的 `{ zh, en }`），由 `useI18n().t(...)` 按当前语言取出。新增内容时不会出现「中文改了、英文忘了」的漏翻，因为两者物理上挨着。
- **主页内容**：仓库概览、四类能力（声明式流程控制 / 通用 UI 组件 / 高性能工具函数 / Hooks 与状态）、高性能函数的分类索引，以及 AI skill 的安装方式。文案是仓库 README 的浓缩版，完整 API 见 README。

## 目录结构

```
example/src/
  App.tsx               外壳：侧边栏（主页 + 文档分组）+ 顶栏（含语言开关）+ 内容区 + hash 路由
  i18n.tsx              LocaleProvider / useI18n / Localized
  docs/
    registry.tsx        路由表：首页 + 汇总各分组（section / group / 双语标题与简介 / 页面组件）
    types.ts            DocRoute、DocSection、sectionLabels、groups 的定义
    ui.tsx              Section / Demo / Code / ApiTable / Stat 等展示组件
    home/HomeDoc.tsx    首页：仓库概览与高性能函数索引
    components/         routes.tsx + 各组件文档页（对应 src/components/）
    hooks/              routes.tsx + 各 Hook 文档页（对应 src/hooks/）
    utils/              routes.tsx + 各工具文档页（对应 src/utils/）
    algorithm/          routes.tsx + 各算法文档页（对应 src/algorithm/）
```

每个分组各自维护一份 `routes.tsx`，`registry.tsx` 只负责汇总与排序，因此新增分组只需加一行展开。

## 新增一个功能页

1. 在对应分组目录（如 `src/docs/utils/`）下写好页面组件。
2. 在该分组的 `routes.tsx` 里加一项：`id`、`group`、`title`、`blurb`、`component`，其中标题类字段都是 `{ zh, en }`。
3. 完成。左侧「文档」区块会自动出现该项，`#/<id>` 立即可用，不需要改任何路由代码。

页面内所有面向用户的文案都走 `t({ zh: ..., en: ... })`（`t` 支持字符串，也支持 JSX），这样中英切换是全局一致的。

## 当前页面

- **主页**（`#/home`）：仓库定位、安装方式、四类能力概览，以及高性能工具函数（Worker 池、常数时间队列、让出主线程、批量合并、背压、记忆化、FLIP）到文档页的索引。
- **组件 / 钩子 / 工具 / 算法**（「文档」区块）：`src/` 各顶层目录对应的分组，每页都是文档加可交互实例，覆盖流程控制、结构渲染、杂项组件与运行时组件、堆栈导航、两个 Hook、Worker 与队列、拆分与批量、外部状态、蔡勒公式等。

示例直接 import 仓库源码（`../../src`），因此改库代码即可在此实时看到效果。

---

# @wwog/react · Interactive docs (example)

An interactive documentation app for `@wwog/react`: not static prose, but pages you can click and run.

- **Two levels: Home + Docs**: the sidebar starts with a standalone Home entry (`#/home`, the default route) that maps out the repository and every area of the library. Below it is a **Docs** heading, with the existing pages grouped into Components / Hooks / Utils / Algorithm beneath it.
- **Left/right layout**: a fixed sidebar on the left, and the current feature's documentation plus interactive examples on the right. The two columns scroll independently, with a sticky top bar.
- **The left list is the router**: features are grouped in the sidebar; clicking one swaps the right pane. Routing is URL-hash based (`#/worker-pool`), so browser back/forward, refresh, and sharing a link all work.
- **Language switch in the top-right**: the `中文 / EN` toggle lives at the right end of the sticky header. The choice is stored in `localStorage` and restored on reload; on first visit it follows the browser language.
- **Bilingual is not two documents**: each string and its translation sit together as a `Localized` `{ zh, en }` pair, resolved by `useI18n().t(...)`. New content cannot end up half-translated, because both languages live side by side.
- **What Home covers**: a condensed version of the repository README — what the library is, its four kinds of exports (declarative flow control, general-purpose UI components, high-performance utilities, hooks and state), an index of the performance utilities, and how to install the AI skill.

`docs/registry.tsx` aggregates one `routes.tsx` per group (`docs/<group>/routes.tsx`); the home route carries `section: "home"` and everything else is grouped under Docs.

To add a page: write a component under the matching `src/docs/<group>/` directory, append an entry (`id`, `group`, `title`, `blurb`, `component`) to that group's `routes.tsx`, and the sidebar, the `#/<id>` route, and both languages come for free.

The examples import the library source directly (`../../src`), so editing the library is reflected here immediately.

Deployed to GitHub Pages at <https://wwog.github.io/react/>. Pushing `example/**` or `src/**` to `main`
triggers `.github/workflows/deploy-example.yml`, which builds and publishes automatically. Production
builds use a `base` of `/react/` (see `vite.config.ts`), so `npm run preview` serves the exact same paths
at <http://localhost:4173/react/>. The repository's Pages source must stay set to **GitHub Actions** for
the deploy step to succeed.
