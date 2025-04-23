# @wwog/react

一个实用的 React 组件库，提供声明式流程控制组件和常用 UI 工具组件，使您的 React 代码更加简洁和可读。

[![npm version](https://img.shields.io/npm/v/@wwog/react.svg)](https://www.npmjs.com/package/@wwog/react)
[![ESM](https://img.shields.io/badge/📦-ESM%20only-brightgreen.svg)](https://nodejs.org/api/esm.html)

## 安装

```bash
# 使用 npm
npm install @wwog/react

# 使用 yarn
yarn add @wwog/react

# 使用 pnpm
pnpm add @wwog/react
```

## 功能特性

- **仅 ESModule**：现代化的模块系统支持
- **完全类型支持**：用 TypeScript 编写，提供完整的类型定义
- **零依赖**：仅依赖 React 和 React DOM 作为 peer dependencies
- **声明式流程控制**：JSX 风格的条件渲染和流程控制组件
- **通用工具组件**：简单实用的常见 UI 工具组件

## 组件和用法

### 流程控制组件

#### `<If>`

声明式的条件渲染组件，类似于 if-else 语句，但在 JSX 中使用。

```tsx
import { If } from "@wwog/react";

function Example({ count }) {
  return (
    <If condition={count > 10}>
      <If.Then>
        <p>Count is greater than 10</p>
      </If.Then>
      <If.ElseIf condition={count > 5}>
        <p>Count is greater than 5</p>
      </If.ElseIf>
      <If.Else>
        <p>Count is 5 or less</p>
      </If.Else>
    </If>
  );
}
```

#### `<Switch>`, `<Case>`, `<Default>`

类似于 JavaScript 的 switch 语句，但更具声明性和类型安全性。

```tsx
import { Switch } from "@wwog/react";

function Example({ status }) {
  return (
    <Switch value={status}>
      <Switch.Case value="loading">
        <Loading />
      </Switch.Case>
      <Switch.Case value="success">
        <Success />
      </Switch.Case>
      <Switch.Case value="error">
        <Error />
      </Switch.Case>
      <Switch.Default>
        <p>Unknown status</p>
      </Switch.Default>
    </Switch>
  );
}
```

#### `<When>` (v1.1.5+)

一个简洁的条件渲染组件，支持多条件逻辑组合。比 <If> 更加简洁，适用于简单的条件渲染场景。

```jsx
import { When } from '@wwog/react';

function Example() {
  const isAdmin = useIsAdmin();
  const isLoading = useIsLoading();
  const hasErrors = useHasErrors();

  return (
    <>
      {/* 所有条件都为真时渲染 */}
      <When all={[isAdmin, !isLoading]}>
        <AdminPanel />
      </When>

      {/* 任一条件为真时渲染 */}
      <When any={[isLoading, hasErrors]} fallback={<ReadyContent />}>
        <LoadingOrErrorMessage />
      </When>

      {/* 所有条件都为假时渲染 */}
      <When none={[isAdmin, isLoading]}>
        <RegularUserContent />
      </When>
    </>
  );
```

#### `<True>` / `<False>` (v1.1.6+)

用于简化条件渲染的辅助组件，适合简单的布尔判断场景。

```tsx
import { True, False } from "@wwog/react";

function Example({ isActive }) {
  return (
    <>
      <True condition={isActive}>
        <p>激活状态</p>
      </True>
      <False condition={isActive}>
        <p>未激活状态</p>
      </False>
    </>
  );
}
```

- `<True condition={...}>`：当 condition 为 true 时渲染子内容。
- `<False condition={...}>`：当 condition 为 false 时渲染子内容。

### 通用组件

#### `<ArrayRender>`

高效渲染数组数据的工具组件，支持过滤和自定义渲染。

```tsx
import { ArrayRender } from "@wwog/react";

function UserList({ users }) {
  return (
    <ArrayRender
      items={users}
      filter={(user) => user.active}
      renderItem={(user, index) => (
        <div key={user.id}>
          {index + 1}. {user.name}
        </div>
      )}
    />
  );
}
```

#### `<SizeBox>`

创建固定尺寸的容器，用于布局调整和间距控制。

```tsx
import { SizeBox } from "@wwog/react";

function Layout() {
  return (
    <div>
      <Header />
      {/* 创建垂直间距 */}
      <SizeBox height={20} />
      <Content />
      {/* 创建具有固定尺寸的容器 */}
      <SizeBox width={200} height={150}>
        <SideContent />
      </SizeBox>
    </div>
  );
}
```

## License

MIT
