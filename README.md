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

#### `<If>`, `<Then>`, `<Else>`, `<ElseIf>`

声明式的条件渲染组件，类似于 if-else 语句，但在 JSX 中使用。

```tsx
import { If, Then, Else, ElseIf } from '@wwog/react';

function Example({ count }) {
  return (
    <If condition={count > 10}>
      <Then>
        <p>Count is greater than 10</p>
      </Then>
      <ElseIf condition={count > 5}>
        <p>Count is greater than 5</p>
      </ElseIf>
      <Else>
        <p>Count is 5 or less</p>
      </Else>
    </If>
  );
}
```

#### `<Switch>`, `<Case>`, `<Default>`

类似于 JavaScript 的 switch 语句，但更具声明性和类型安全性。

```tsx
import { Switch, Case, Default } from '@wwog/react';

function Example({ status }) {
  return (
    <Switch value={status}>
      <Case value="loading">
        <Loading />
      </Case>
      <Case value="success">
        <Success />
      </Case>
      <Case value="error">
        <Error />
      </Case>
      <Default>
        <p>Unknown status</p>
      </Default>
    </Switch>
  );
}
```

### 通用组件

#### `<ArrayRender>`

高效渲染数组数据的工具组件，支持过滤和自定义渲染。

```tsx
import { ArrayRender } from '@wwog/react';

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
import { SizeBox } from '@wwog/react';

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
