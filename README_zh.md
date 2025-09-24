# @wwog/react

一个实用的 React 组件库，提供声明式流程控制组件和常用 UI 工具组件，使您的 React 代码更加简洁和可读。

[![npm version](https://img.shields.io/npm/v/@wwog/react.svg)](https://www.npmjs.com/package/@wwog/react)
[![ESM](https://img.shields.io/badge/📦-ESM%20only-brightgreen.svg)](https://nodejs.org/api/esm.html)

>

---

[English Documentation](./README.md)

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
- **轻量高效** 性能优越，体积小巧

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

高效渲染数组数据的工具组件，支持过滤、排序和自定义渲染。性能优化，尽可能减少循环次数。

```tsx
import { ArrayRender } from "@wwog/react";

function UserList({ users }) {
  return (
    <ArrayRender
      items={users}
      filter={(user) => user.active}
      sort={(a, b) => a.name.localeCompare(b.name)}
      renderItem={(user, index) => (
        <div key={user.id}>
          {index + 1}. {user.name}
        </div>
      )}
      renderEmpty={() => <div>没有找到用户</div>}
    />
  );
}
```

- `items`: 要渲染的数组数据
- `renderItem`: 渲染每个项目的函数，接收 (item, index) 作为参数
- `filter`: 可选的过滤函数，用于过滤数组项
- `sort`: 可选的排序函数，用于数组排序，使用标准比较函数 (a, b) => number
- `renderEmpty`: 可选的函数，用于在数组为空时渲染内容

**性能说明**: 当不需要排序时，过滤在 map 循环中进行以获得最佳性能。当提供排序时，先执行过滤再排序，以减少操作次数。
```

#### `<Clamp>` (v1.2.14+)

> v1.3.0 移除。兼容性问题太大，桌面网页效果很好，h5 有问题。

用于固定行数，显示省略号且显示额外内容的组件。

```tsx
import { Clamp } from "@wwog/react";

function Example() {
  return (
    <Clamp
      text="这是一段很长的文本，会被截断并显示省略号..."
      maxLine={2}
      lineHeight={20}
      ellipsis={true}
      extraContent={<button>查看更多</button>}
      bgColor="#fff"
    />
  );
}
```

- `text`: 要显示的文本内容。
- `maxLine`: 最大行数，默认为 1。
- `extraContent`: 在文本末尾显示的额外内容，如"查看更多"按钮。
- `extraHeight`: 额外内容的高度，默认为 20。
- `wrapperStyle`: 包装器的样式。

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

#### `<Observer>` (v1.3.1+)

声明式的 Intersection Observer 组件，用于懒加载、无限滚动和基于视口的交互。

```tsx
import { Observer } from "@wwog/react";

function LazyImage({ src, alt }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Observer
      onIntersect={(entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      }}
      threshold={0.1}
      triggerOnce
    >
      <div className="image-container">
        {isVisible ? (
          <img src={src} alt={alt} />
        ) : (
          <div className="placeholder">加载中...</div>
        )}
      </div>
    </Observer>
  );
}

// 无限滚动示例
function InfiniteList({ items, onLoadMore }) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.content}</div>
      ))}
      <Observer
        onIntersect={(entry) => {
          if (entry.isIntersecting) {
            onLoadMore();
          }
        }}
        rootMargin="100px"
      >
        <div>加载更多...</div>
      </Observer>
    </div>
  );
}
```

- `onIntersect`：交集变化时触发的回调函数，接收 IntersectionObserverEntry 作为参数。
- `threshold`：交集阈值，可以是数字（0-1）或数字数组，默认为 0。
- `root`：用于交集观察的根元素，默认为视口。
- `rootMargin`：用于扩展/收缩根边界框的根边距，默认为 "0px"。
- `triggerOnce`：是否只触发一次，默认为 false。
- `disabled`：是否禁用观察，默认为 false。
- `children`：要观察的子元素。
- `className`：包装元素的 CSS 类名。
- `style`：包装元素的内联样式。

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

#### `<Styles>` (v1.2.7+)

分类编写样式和基本的 string 样式，内置类似 `clsx` 对类型描述对象的值进行组合，支持去除重复类名,支持嵌套。

```tsx
import { Styles } from "@wwog/react";
import clazz from "./index.module.css";

function Example() {
  return (
    <Styles
      className={{
        base: "p-2 bg-white",
        hover: "hover:bg-gray-100",
        active: "active:bg-gray-200",
        focus: "focus:ring-2",
        other: "button",
      }}
    >
      <Styles className={clazz.button}>
        <button>点击我</button>
      </Styles>
    </Styles>
  );
}
```

还可以使用容器包装元素：

```tsx
<Styles
  className={{
    base: ["p-2"],
    hover: { "hover:bg-blue-500": true },
  }}
  asWrapper="span"
>
  内容
</Styles>
```

- `className` [string | StylesDescriptor]：类名的分类对象,对象所有的值会被合并
- `asWrapper` [boolean | HTMLElementType]：是否生成包含所有 className 的 wrapper，默认 false，传递标签名如'div'或'span'
- `children`：只在单一子元素生效，如果多子元素请传递 asWrapper 进行类型编写，避免歧义

### hooks

- 一些常用的 hooks 的封装

#### useControlled (v1.2.0+)

- 受控组件和非受控组件的切换,方便组件开发

#### useScreen (v1.3.5+)

> 返回当前断点名称
- 支持传入自定义断点，默认采用tailwindcss的相同值断点定义

此hook基于监听实现，如果需要多次使用useScreen但不会变化传参，建议封装Context

开发记录： 内部通过mediaQuery实现，不会监听某个断点而是优化至监听当前断点的前和后两个断点以优化性能

### utils

- 用于部分组件的内部函数,如需要也可使用

#### `ruleChecker` (v1.3.9+)

一个类型安全的数据验证工具，为不同数据类型提供全面的验证规则，并具有完整的 TypeScript 支持。

```tsx
import { ruleChecker } from "@wwog/react";

// 定义数据和验证规则
const userData = {
  username: 'john',
  email: 'john@example.com',
  age: 25,
  hobbies: ['reading', 'coding']
};

const validationRules = {
  username: { required: true, min: 3, max: 20 },
  email: { required: true, email: true },
  age: { required: true, min: 18, max: 120 },
  hobbies: { min: 1, max: 5, unique: true }
};

// 验证数据
const result = ruleChecker(userData, validationRules);

if (result.valid) {
  console.log('数据有效:', result.data);
} else {
  console.log('验证错误:', result.errors);
  console.log('字段错误:', result.fieldErrors);
}
```

**功能特点:**
- **类型安全**: 完整的 TypeScript 支持，自动类型推断
- **多种数据类型**: 支持字符串、数字、布尔值和数组
- **全面的规则**: 内置长度、范围、格式、唯一性等验证
- **自定义验证器**: 支持自定义验证函数
- **依赖验证**: 基于其他字段值进行验证
- **数组元素验证**: 验证数组内的单个元素
- **多规则支持**: 为单个字段应用多个验证规则
- **详细错误报告**: 获取通用错误和字段特定错误

**可用规则:**
- **通用规则**: `required`, `message`, `validator`, `dependsOn`
- **字符串规则**: `min`, `max`, `len`, `regex`, `email`, `url`, `phone`
- **数字规则**: `min`, `max`
- **数组规则**: `min`, `max`, `len`, `unique`, `elementRule`
- **布尔值规则**: 基础验证和自定义验证器

**复杂示例:**
```tsx
const registrationData = {
  username: 'user123',
  email: 'user@example.com',
  password: 'SecurePass123',
  confirmPassword: 'SecurePass123',
  age: 25,
  tags: ['developer', 'typescript'],
  terms: true
};

const rules = {
  username: { required: true, min: 3, max: 20, regex: /^[a-zA-Z0-9_]+$/ },
  email: { required: true, email: true },
  password: [
    { required: true, min: 8 },
    { regex: /[A-Z]/, message: '密码必须包含大写字母' },
    { regex: /[0-9]/, message: '密码必须包含数字' }
  ],
  confirmPassword: {
    required: true,
    validator: (value, data) => value === data.password || '两次密码不一致'
  },
  age: { required: true, min: 18, max: 120 },
  tags: {
    min: 1,
    max: 10,
    unique: true,
    elementRule: { min: 2, max: 20 } // 每个标签必须是 2-20 个字符
  },
  terms: {
    required: true,
    validator: (value) => value === true || '您必须接受条款'
  }
};

const result = ruleChecker(registrationData, rules);
```

#### `createExternalState` (v1.2.9+)

一个轻量级的外部状态管理工具，让你可以在 React 组件树外部创建和管理状态，同时保持与组件的完美集成。

> v1.2.21: 重构 API，将 sideEffect 移至 options 对象中，增强 transform 接口支持
> v1.2.13: 新增 useGetter

```tsx
import { createExternalState } from "@wwog/react";

// 创建一个全局主题状态
const themeState = createExternalState("light", options:{
  sideEffect:(newTheme, oldTheme) => {
    console.log(`主题从 ${oldTheme} 变更为 ${newTheme}`);
  }
});

// 在任何位置获取或修改状态
console.log(themeState.get()); // 'light'
themeState.set("dark");

// 在组件中使用状态
function ThemeConsumer() {
  const [theme, setTheme] = themeState.use();

  return (
    <div className={theme}>
      当前主题: {theme}
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        切换主题
      </button>
    </div>
  );
}

// 仅读取状态 (v1.2.13+)
function ReadOnlyThemeConsumer() {
  const theme = themeState.useGetter();

  return <div>当前主题是: {theme}</div>;
}
```

- `createExternalState<T>(initialState, options?)`: 创建一个可在组件外部访问的状态
  - `initialState`: 初始状态值
  - `options.sideEffect`: 可选的副作用函数，在状态更新时调用
  - 返回包含以下方法的对象:
    - `get()`: 获取当前状态值
    - `set(newState)`: 更新状态值
    - `use()`: React Hook，返回 `[state, setState]`，用于在组件中使用此状态
    - `useGetter()`: React Hook，仅返回状态值，当你只需要读取状态时非常有用
  - `options.transform`:
    - `get`
    - `set`

适用场景:

- 全局状态管理（主题、用户设置等）
- 跨组件通信
- 服务或工具类中的响应式状态
- 与非 React 代码共享状态

#### `createStorageState` (v1.3.2+)

> 扩展自`createExternalState`，使用 storage 持久化状态,支持`localStorage`和`sessionStorage`

#### `formatDate`

比较标准的格式化时间函数

#### `childrenLoop`

可以中断的子节点遍历，让一些分支流程拥有极致性能

#### `Counter`

计数器

#### `safePromiseTry` (v1.2.10+)

支持 Promise.try 使用 Promise.try,否则使用内部实现

#### `cx` (v1.2.5+)

一个高效的 CSS 类名合并工具函数，类似于`clsx`或`classnames`，但能自动去除重复的类名。

```tsx
import { cx } from "@wwog/react";

function Example({ isActive, isDisabled }) {
  return (
    <div
      className={cx("base-class", ["array-class-1", "array-class-2"], {
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
