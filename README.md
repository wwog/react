# @wwog/react

一个实用的 React 组件库，提供声明式流程控制组件和常用 UI 工具组件，使您的 React 代码更加简洁和可读。

[![npm version](https://img.shields.io/npm/v/@wwog/react.svg)](https://www.npmjs.com/package/@wwog/react)
[![ESM](https://img.shields.io/badge/📦-ESM%20only-brightgreen.svg)](https://nodejs.org/api/esm.html)

---

[English Documentation](./README_en.md)

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

#### `<Toggle>` (v1.2.0+)

声明式切换组件，在预定义选项中切换值，并通过指定属性传递给子组件，支持自定义切换逻辑。

> v1.2.1 Indexing is now used to fix bugs with arbitrary values

```tsx
import { Toggle } from "@wwog/react";

<Toggle
  options={["light", "dark"]}
  render={(value, toggle) => {
    /* xxx */
  }}
/>;
```

- `options`：可切换的值数组。
- `index`：默认:0。
- `next`：自定义切换逻辑函数。
- `render`：渲染函数。

### 通用组件

#### `<ArrayRender>`

内部仅单次循环。高效渲染数组数据的工具组件，支持过滤和自定义渲染。

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

#### `<Pipe>` (v1.1.7+)

声明式的数据管道处理组件，适合多步骤数据转换和链式处理。

> 声明式数据处理，替代嵌套函数调用。
> 提高代码可读性，逻辑清晰。
> 适合数据清洗、格式化等场景。

```tsx
import { Pipe } from "@wwog/react";

function Example({ users }) {
  return (
    <Pipe
      data={users}
      transform={[
        (data) => data.filter((user) => user.active),
        (data) => data.map((user) => user.name),
      ]}
      render={(names) => <div>{names.join(", ")}</div>}
      fallback={<div>No Data</div>}
    />
  );
}
```

- `data`：初始数据。
- `transform`：数据转换函数数组，按顺序依次处理。
- `render`：渲染最终结果。
- `fallback`：结果为 null/undefined 时的兜底内容。

#### `<Scope>` (v1.1.7+)

为子节点提供局部作用域，声明式定义临时变量，简化复杂渲染逻辑。

> 避免在组件外定义临时状态或计算。
> 声明式定义局部变量，增强代码自包含性。
> 适合表单、计算密集型渲染等场景。

```tsx
import { Scope } from "@wwog/react";

function Example() {
  return (
    <Scope let={{ count: 1, text: "Hello" }}>
      {({ count, text }) => (
        <div>
          {text} {count}
        </div>
      )}
    </Scope>
  );
}

// 支持函数式 let
<Scope
  let={(props) => ({ total: props.items.length })}
  props={{ items: [1, 2] }}
  fallback={<div>Empty</div>}
>
  {({ total }) => <div>Total: {total}</div>}
</Scope>;
```

- `let`：对象或函数，定义作用域变量。
- `props`：传递给 let 函数的参数。
- `children`：作用域变量的渲染函数。
- `fallback`：无内容时的兜底渲染。

#### `<DateRender>` (v1.2.3+)

一个声明式组件，用于格式化并渲染日期，简单易用且支持自定义格式化。

```tsx
import { DateRender } from "@wwog/react";

function Example() {
  return (
    <>
      {/* 使用默认格式化 */}
      <DateRender source="2025-05-06">
        {(formatted) => <div>日期: {formatted}</div>}
      </DateRender>

      {/* 使用自定义格式化 */}
      <DateRender
        source={new Date()}
        format={(date) => date.toLocaleDateString("zh-CN")}
      >
        {(formatted) => <div>日期: {formatted}</div>}
      </DateRender>
    </>
  );
}
```

- `source`：要渲染的输入日期（Date 对象、ISO 字符串或时间戳）。
- `format`：可选的格式化日期的函数，默认使用 `toLocaleString()`。
- `children`：渲染格式化后日期的函数，接收格式化后的日期作为参数。

#### `<SizeBox>`

创建固定尺寸的容器，用于布局调整和间距控制。

> v1.1.8: Fixed SizeBox not working in 'flex' layouts, add classname props

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

#### `<ClassName>` (v1.2.5+)

用于将 CSS 类名分类编写的组件，内置类似`clsx`的功能，并且可以去除重复的 className。支持基础类、悬停态、激活态等多种状态的类名管理。

```tsx
import { ClassName } from "@wwog/react";

function Example() {
  return (
    <ClassName
      className={{
        base: "p-2 bg-white",
        hover: "hover:bg-gray-100",
        active: "active:bg-gray-200",
        focus: "focus:ring-2",
      }}
    >
      <button>点击我</button>
    </ClassName>
  );
}
```

还可以使用容器包装元素：

```tsx
<ClassName
  className={{
    base: ["p-2", { "bg-red-500": isError }],
    hover: { "hover:bg-blue-500": true },
  }}
  asWrapper="span"
>
  内容
</ClassName>
```

- `className`：分类的类名对象，支持各种状态的类名（base, hover, active, focus, disabled 等）
- `asWrapper`：是否生成包含所有 className 的 wrapper，默认 false，传递标签名如'div'或'span'
- `children`：子元素，通常是一个 React 元素

### hooks

- 一些常用的 hooks 的封装

#### useControlled (v1.2.0+)

- 受控组件和非受控组件的切换,方便组件开发

### utils

- 用于部分组件的内部函数,如需要也可使用

#### `formatDate`

比较标准的格式化时间函数

#### `childrenLoop`

可以中断的子节点遍历，让一些分支流程拥有极致性能

#### `Counter`

计数器

#### `cn` (v1.2.5+)

一个高效的 CSS 类名合并工具函数，类似于`clsx`或`classnames`，但能自动去除重复的类名。

```tsx
import { cn } from "@wwog/react";

function Example({ isActive, isDisabled }) {
  return (
    <div
      className={cn("base-class", ["array-class-1", "array-class-2"], {
        "active-class": isActive,
        "disabled-class": isDisabled,
      })}
    >
      内容
    </div>
  );
}
```

支持多种参数类型：

- 字符串: `"class1 class2"`
- 字符串数组: `["class1", "class2"]`
- 对象: `{ "class1": true, "class2": false }`
- 以上类型的任意组合

## License

MIT
