# @wwog/react — CLAUDE.md

## 项目概述

这是一个 React 工具组件库（`@wwog/react` v1.3.x），提供声明式流程控制组件、布局组件、状态管理工具和校验工具。构建工具为 `unbuild`，测试框架为 `vitest`（browser mode），代码风格工具为 `biome`。

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
  components/
    ProcessControl/   # If, Switch/Case/Default, Pipe, When
    Layout/           # Flex（未完成）
    Struct/           # ArrayRender, DateRender
    Sundry/           # Observer, Scope, Styles, Toggle, SizeBox
  hooks/
    useControlled.ts  # 受控/非受控统一 hook
    useScreen.ts      # 响应式断点 hook
  utils/
    createExternalState.ts  # 模块级外部状态管理
    ruleChecker.ts          # 类型安全表单校验
    cx.ts                   # className 合并（类 clsx）
    sundry.ts               # formatDate, Counter
    promise.ts              # Promise.try / Promise.withResolvers polyfill
    constants.ts            # 断点定义
```

## 架构说明

### `createExternalState` 设计模式

模块级单例状态，通过手动维护 listener 数组实现跨组件同步。`__listeners` 字段通过 `@ts-expect-error` 暴露，仅供测试使用，不属于公开 API。

### `If` / `Switch` 组件的 displayName 匹配

子组件类型识别依赖 `displayName` 字符串比较（而非 `===` 引用比较），这是为了支持跨模块边界的组件识别。修改 displayName 会静默破坏逻辑，需特别注意。

### `childrenLoop` vs `React.Children.forEach`

`childrenLoop`（`src/utils/reactUtils.ts`）是对 `React.Children.forEach` 的替代，支持通过返回 `false` 中断循环，用于 `Switch` 的非严格模式 early exit 优化。

## 测试

测试文件与源文件同目录（`*.test.ts` / `*.test.tsx`），使用 `vitest-browser-react` 在真实浏览器环境运行。新增组件需在同目录添加对应测试文件。

## 发布

构建产物在 `dist/`，同时发布 `src/` 源码（见 `package.json` `files` 字段）。版本号遵循 semver，在 `package.json` 中手动维护。
