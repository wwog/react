# @wwog/react — AGENTS.md

## 项目概述

这是一个 React 工具组件库（`@wwog/react`，版本号见 `package.json`），提供声明式流程控制组件、列表与结构渲染组件、通用工具组件、移动端堆栈导航、性能/调度组件，以及状态管理与算法工具。构建工具为 `unbuild`，测试框架为 `vitest`（browser mode），代码风格工具为 `biome`。

## 常用命令

```bash
pnpm build          # 构建产物到 dist/
pnpm test:unit      # 运行单元测试（headless browser）
pnpm test:types     # TypeScript 类型检查
pnpm all-suites     # format + check + types + unit（完整 CI 流程）
pnpm format         # biome format
pnpm check          # biome check --write
```

## 目录结构

```
src/
  algorithm/          # weekday, weekdayJulian（星期算法）
  components/
    ProcessControl/   # If(.Then/.ElseIf/.Else), True, False, Switch(.Case/.Default), When, Pipe
    Struct/           # ArrayRender, DateRender
    Sundry/           # Boundary, FocusTrap, Observer, Portal, Repeat, Scope, SizeBox, Styles, Toggle
    Navigation/       # AppStackRouter（含 stackStore / useSwipeBack / useAppStack）
    Performance/      # FrameRender
  hooks/              # useControlled, useScreen
  utils/              # createExternalState, cx, reactUtils, sundry, promise, constants, focusable,
                      # yield, batching, priorityQueue, queue, flip, worker, workerPool,
                      # memoize, backpressure
```

## 架构说明

### `createExternalState` 设计模式

模块级单例状态，通过手动维护订阅者集合实现跨组件同步。注册表是 `Set`（退订 O(1)），`__listeners` 只存在于内部类型 `ExternalWithKernel` 上（`createExternalState` 的返回类型仍是 `ExternalState`），是集合的投影快照（每次访问都是新数组），仅供测试使用，不属于公开 API；它只统计原始订阅者（`useState` / `useSelector` / `subscribe`），`subscribeWithSelector` 的门控订阅者另存一个集合，不计入其中。

细粒度订阅（`useSelector`）不改变 `set` 的广播语义，而是在消费者侧做切片缓存：`getSnapshot` 返回「selector 计算 + 相等性比较」后的切片，与上一次**已提交**的切片相等时沿用旧引用，`useSyncExternalStore` 逐引用比较后不调度重渲染。因此任何让 selector 在无关字段变化时返回新引用的改动都会破坏这层优化，需要同步检查相等性函数（`isEqual` / `shallowEqual`）。

`set` 里有两处不显然的约束，改动前请先读注释：通知统一走 `flushSubscribers`，按「原生订阅者 → 门控订阅者 → `onSet` → `onChange`」推进，每个订阅者单独 try/catch（一个订阅者抛错不能让后面的组件收不到更新，也不能让 `createStorageState` 的落盘被跳过）；两个订阅者集合都遍历**副本**（订阅者在通知过程中退订「排在它前面」的订阅者时，活集合的删除会让后面尚未访问的订阅者被整体跳过；副本的代价是每次 `set` 一次数组分配）。`onSet` / `onChange` 始终逐次同步执行，即使是 `notify: 'microtask'` 模式——落盘与用户回调不属于「通知」。

`createStorageState` 的 `lastSerialized` 同时被三条路径维护：创建时从存储恢复成功的原文作为基准、每次真正写入后更新、其它标签页的 `storage` 事件在 `store.set` **之前**对齐（否则 `onSet` 会把远端值再写回去，两个标签页来回弹）。改动这段前先确认这三处仍然一致。

`isProduction()` 刻意用裸标识符读 `process.env.NODE_ENV`，配合模块内 `declare const process`（不引入 `@types/node` 依赖）：打包器会静态替换这个字面量，从而在生产构建里消除 `useSelector` 的开发提示。改成 `globalThis.process?.env?.NODE_ENV` 之类就替换不掉，提示会跟着进生产包。

### `If` / `Switch` 组件的 displayName 匹配

子组件类型识别依赖 `displayName` 字符串比较（而非 `===` 引用比较），这是为了支持跨模块边界的组件识别。修改 displayName 会静默破坏逻辑，需特别注意。

### `childrenLoop` vs `React.Children.forEach`

`childrenLoop`（`src/utils/reactUtils.ts`）是对 `React.Children.forEach` 的替代，支持通过返回 `false` 中断循环，用于 `Switch` 的非严格模式 early exit 优化。

## 测试

测试文件与源文件同目录（`*.test.ts` / `*.test.tsx`），使用 `vitest-browser-react` 在真实浏览器环境运行。新增组件需在同目录添加对应测试文件。

## 文档

新增或改名一个公开导出时，下面几处需要同步，漏掉任一处就会产生「文档写着、实际不存在」（或反之）的漂移：

| 位置 | 内容 |
| --- | --- |
| `use-wwog-react.md` | AI 契约文档：根导入清单 + 每项一个编号小节（下一个编号接在末尾）+ 开头 `description` frontmatter 的触发条件 |
| `example/src/docs/<group>/` | 文档站页面与 `routes.tsx` 路由（分组与 `src/` 顶层目录一一对应，汇总在 `example/src/docs/registry.tsx`） |
| `example/src/i18n.tsx` | 标题等文案的双语词条 |
| `README.md` / `README_zh.md` | 组件与工具的用户文档，两种语言各一份 |
| 同目录 `*.test.tsx` | 见「测试」一节 |

组件的 JSDoc 按现有文件的双语密度写（`@description_zh` / `@description_en`，组件加 `@component` 与 `@example`），实现层面的取舍写进模块头的注释而不是行内注释。

## 发布

构建产物在 `dist/`，同时发布 `src/` 源码（见 `package.json` `files` 字段）。因此 `src/` 下不要留 `.bak` 之类的死文件 —— 它们不进类型检查、不进 `dist`，却会随包发布，并让「某某导出是否还存在」的静态检索得出错误结论。版本号遵循 semver，在 `package.json` 中手动维护。
