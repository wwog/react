# @wwog/react · 交互式文档（example）

这是 `@wwog/react` 的交互式文档应用：不是静态说明，而是一页页可以直接点、直接跑的实例。
运行方式：

```bash
cd example
npm install
npm run dev     # 本地开发
npm run build   # tsc 类型检查 + vite 构建
```

## 布局与交互方式

- **左右布局**：左侧固定侧边栏，右侧是当前功能的「文档 + 交互实例」。两侧各自独立滚动，顶栏吸附。
- **左侧列表做功能路由**：侧边栏按分组列出功能，点击切换右侧内容。路由基于 URL hash（如 `#/worker-pool`），因此浏览器前进/后退、刷新后停在同一页、把链接直接发给别人，都能工作。
- **右上角切换语言**：顶栏右上角的 `中文 / EN` 开关。选择会写入 `localStorage`，刷新后保持；首次进入按浏览器语言自动选择。
- **双语不是两套文档**：每段文案与内容写在同一处（`Localized` 的 `{ zh, en }`），由 `useI18n().t(...)` 按当前语言取出。新增内容时不会出现「中文改了、英文忘了」的漏翻，因为两者物理上挨着。

## 目录结构

```
example/src/
  App.tsx               外壳：侧边栏 + 顶栏（含语言开关）+ 内容区 + hash 路由
  i18n.tsx              LocaleProvider / useI18n / Localized
  docs/
    registry.tsx        路由表：分组 + 双语标题与简介 + 页面组件
    ui.tsx              Section / Demo / Code / ApiTable / Stat 等展示组件
    WorkerPoolDoc.tsx   WorkerPool 文档页与 5 个交互实例
  AppStackExample.tsx   既有示例，以路由形式保留
  FocusTrapExample.tsx  既有示例，以路由形式保留
```

## 新增一个功能页

1. 在 `src/docs/` 下写好页面组件。
2. 在 `src/docs/registry.tsx` 的 `routes` 数组里加一项：`id`、`group`、`title`、`blurb`、`component`，其中标题类字段都是 `{ zh, en }`。
3. 完成。左侧列表会自动出现该项，`#/<id>` 立即可用，不需要改任何路由代码。

页面内所有面向用户的文案都走 `t({ zh: ..., en: ... })`（`t` 支持字符串，也支持 JSX），这样中英切换是全局一致的。

## 当前页面

- **WorkerPool**（工具）：固定大小 worker 池——按需创建、不超过 `maxWorkers`、最轻负载分配、空闲 worker 窃取「已分配但尚未开始」的任务、结果可按零拷贝转移。含 5 个可交互实例：批量提交与实时统计、工作窃取时序、16MB buffer 的双程零拷贝、任务抛错后的恢复、`maxWorkers` 扩展性对比。
- **AppStackRouter / FocusTrap**（组件）：改造前已有的示例，现在作为路由页保留。

示例直接 import 仓库源码（`../../src`），因此改库代码即可在此实时看到效果。

---

# @wwog/react · Interactive docs (example)

An interactive documentation app for `@wwog/react`: not static prose, but pages you can click and run.

- **Left/right layout**: a fixed sidebar on the left, and the current feature's documentation plus interactive examples on the right. The two columns scroll independently, with a sticky top bar.
- **The left list is the router**: features are grouped in the sidebar; clicking one swaps the right pane. Routing is URL-hash based (`#/worker-pool`), so browser back/forward, refresh, and sharing a link all work.
- **Language switch in the top-right**: the `中文 / EN` toggle lives at the right end of the sticky header. The choice is stored in `localStorage` and restored on reload; on first visit it follows the browser language.
- **Bilingual is not two documents**: each string and its translation sit together as a `Localized` `{ zh, en }` pair, resolved by `useI18n().t(...)`. New content cannot end up half-translated, because both languages live side by side.

To add a page: write a component under `src/docs/`, append an entry (`id`, `group`, `title`, `blurb`, `component`) to `routes` in `src/docs/registry.tsx`, and the sidebar, the `#/<id>` route, and both languages come for free.

The examples import the library source directly (`../../src`), so editing the library is reflected here immediately.
