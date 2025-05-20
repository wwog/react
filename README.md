# @wwog/react

A practical React component library providing declarative flow control and common UI utility components to make your React code more concise and readable.

[![npm version](https://img.shields.io/npm/v/@wwog/react.svg)](https://www.npmjs.com/package/@wwog/react)
[![ESM](https://img.shields.io/badge/📦-ESM%20only-brightgreen.svg)](https://nodejs.org/api/esm.html)

---

[中文文档](./README_zh.md)

## Installation

```bash
# Using npm
npm install @wwog/react

# Using yarn
yarn add @wwog/react

# Using pnpm
pnpm add @wwog/react
```

## Features

- **ESModule only**: Modern module system support
- **Full TypeScript support**: Written in TypeScript with complete type definitions
- **Zero dependencies**: Only React and React DOM as peer dependencies
- **Declarative flow control**: JSX-style conditional rendering and flow control components
- **Utility components**: Simple and practical common UI utility components
- **Lightweight and efficient** Excellent performance and compact size

## Components & Usage

### Flow Control Components

#### `<If>`

A declarative conditional rendering component, similar to if-else statements but used in JSX.

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

A declarative and type-safe alternative to JavaScript's switch statement.

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

A concise conditional rendering component supporting multiple logic combinations. More succinct than <If>, suitable for simple conditions.

```jsx
import { When } from "@wwog/react";

function Example() {
  const isAdmin = useIsAdmin();
  const isLoading = useIsLoading();
  const hasErrors = useHasErrors();

  return (
    <>
      {/* Render when all conditions are true */}
      <When all={[isAdmin, !isLoading]}>
        <AdminPanel />
      </When>

      {/* Render when any condition is true */}
      <When any={[isLoading, hasErrors]} fallback={<ReadyContent />}>
        <LoadingOrErrorMessage />
      </When>

      {/* Render when all conditions are false */}
      <When none={[isAdmin, isLoading]}>
        <RegularUserContent />
      </When>
    </>
  );
}
```

#### `<True>` / `<False>` (v1.1.6+)

Helper components for simple boolean conditional rendering.

```tsx
import { True, False } from "@wwog/react";

function Example({ isActive }) {
  return (
    <>
      <True condition={isActive}>
        <p>Active</p>
      </True>
      <False condition={isActive}>
        <p>Inactive</p>
      </False>
    </>
  );
}
```

- `<True condition={...}>`: Renders children when condition is true.
- `<False condition={...}>`: Renders children when condition is false.

#### `<Toggle>`

A declarative toggle component that switches values among predefined options and passes them to child components via specified props, supporting custom toggle logic.

```tsx
import { Toggle } from "@wwog/react";

<Toggle
  options={["light", "dark"]}
  render={(value, toggle) => {
    /* xxx */
  }}
/>;
```

- `options`: Array of values to toggle between.
- `index`: Initial Options index.
- `next`: Custom toggle logic function.
- `render`: Render Function.

### Utility Components

#### `<ArrayRender>`

Efficiently render array data, supports filtering and custom rendering.

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

#### `<Clamp>` (v1.2.14+)

A component for displaying text with a fixed number of lines, ellipsis, and optional extra content. Highly compatible without using webkit-box or JavaScript tricks.

```tsx
import { Clamp } from "@wwog/react";

function Example() {
  return (
    <Clamp
      text="This is a long text that will be truncated with ellipsis..."
      maxLine={2}
      extraContent={<button>See more</button>}
    />
  );
}
```

- `text`: The text content to be displayed.
- `maxLine`: Maximum number of lines, defaults to 1.
- `extraContent`: Extra content to display at the end of the text, such as a "See more" button.
- `extraHeight`: Height of the extra content, defaults to 20.
- `wrapperStyle`: Style for the wrapper container.

#### `<Pipe>` (v1.1.7+)

A declarative data pipeline component for multi-step data transformation and chaining.

> Declarative data processing, replacing nested function calls.
> Improves code readability and logic clarity.
> Suitable for data cleaning, formatting, etc.

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

- `data`: Initial data.
- `transform`: Array of transformation functions, applied in order.
- `render`: Render the final result.
- `fallback`: Content to render if result is null/undefined.

#### `<Scope>` (v1.1.7+)

Provides a local scope for children, declaratively defines temporary variables, and simplifies complex rendering logic.

> Avoids defining temporary state or calculations outside the component.
> Declaratively defines local variables for better self-containment.
> Suitable for forms, computation-heavy rendering, etc.

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

// Function-style let is supported
<Scope
  let={(props) => ({ total: props.items.length })}
  props={{ items: [1, 2] }}
  fallback={<div>Empty</div>}
>
  {({ total }) => <div>Total: {total}</div>}
</Scope>;
```

- `let`: Object or function defining scope variables.
- `props`: Props passed to the let function.
- `children`: Render function for scope variables.
- `fallback`: Fallback content when empty.

#### `<DateRender>` (v1.2.3+)

A declarative component for formatting and rendering dates, simple to use with support for custom formatting.

```tsx
import { DateRender } from "@wwog/react";

function Example() {
  return (
    <>
      {/* Using default formatting */}
      <DateRender source="2025-05-06">
        {(formatted) => <div>Date: {formatted}</div>}
      </DateRender>

      {/* Using custom formatting */}
      <DateRender
        source={new Date()}
        format={(date) => date.toLocaleDateString("en-US")}
      >
        {(formatted) => <div>Date: {formatted}</div>}
      </DateRender>
    </>
  );
}
```

- `source`: The input date to render (Date object, ISO string, or timestamp).
- `format`: Optional function to format the date, defaults to `toLocaleString()`.
- `children`: Function to render the formatted date, receives the formatted date as an argument.

#### `<SizeBox>`

Create a fixed-size container for layout adjustment and spacing control.

> v1.1.8: Fixed SizeBox not working in 'flex' layouts, add classname props

```tsx
import { SizeBox } from "@wwog/react";

function Layout() {
  return (
    <div>
      <Header />
      {/* Vertical spacing */}
      <SizeBox height={20} />
      <Content />
      {/* Fixed-size container */}
      <SizeBox width={200} height={150}>
        <SideContent />
      </SizeBox>
    </div>
  );
}
```

#### `<Styles>` (v1.2.7+)

Categorically write styles and basic string styles, with built-in functionality similar to clsx for combining type description object values, supporting duplicate class name removal and nesting.

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
        <button>Click me</button>
      </Styles>
    </Styles>
  );
}
```

You can also use a container wrapper element:

```tsx
<Styles
  className={{
    base: ["p-2"],
    hover: { "hover:bg-blue-500": true },
  }}
  asWrapper="span"
>
  Content
</Styles>
```

- `className` [string | StylesDescriptor]: Category object for class names, all values in the object will be merged
- `asWrapper` [boolean | HTMLElementType]: Whether to generate a wrapper containing all classNames, default is false, pass tag name like 'div' or 'span'
- `children` : Only works with a single child element; if there are multiple child elements, please pass asWrapper to write types and avoid ambiguity

### hooks

#### useControlled

- Applied to states that can be controlled or uncontrolled components

### utils

> Internal functions used by some components, which can also be used if needed

#### `createExternalState` (v1.2.9+, useGetter added in v1.2.13)

A lightweight external state management utility that allows you to create and manage state outside the React component tree while maintaining perfect integration with components.

```tsx
import { createExternalState } from "@wwog/react";

// Create a global theme state
const themeState = createExternalState("light", (newTheme, oldTheme) => {
  console.log(`Theme changed from ${oldTheme} to ${newTheme}`);
});

// Get or modify state from anywhere
console.log(themeState.get()); // 'light'
themeState.set("dark");

// Use the state in components
function ThemeConsumer() {
  const [theme, setTheme] = themeState.use();

  return (
    <div className={theme}>
      Current theme: {theme}
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        Toggle theme
      </button>
    </div>
  );
}

// For read-only access (v1.2.13+)
function ReadOnlyThemeConsumer() {
  const theme = themeState.useGetter();

  return <div>Current theme is: {theme}</div>;
}
```

- `createExternalState<T>(initialState, sideEffect?)`: Creates a state accessible outside components
  - `initialState`: Initial state value
  - `sideEffect`: Optional side effect function, called on state updates
  - Returns an object with methods:
    - `get()`: Get the current state value
    - `set(newState)`: Update the state value
    - `use()`: React Hook, returns `[state, setState]` for using this state in components
    - `useGetter()`: React Hook that only returns the state value, useful when you only need to read the state

Use cases:

- Global state management (themes, user settings, etc.)
- Cross-component communication
- Reactive state in services or utility classes
- Sharing state with non-React code

#### `formatDate`

A relatively standard date formatting function

#### `childrenLoop`

Interruptible child node traversal, enabling some branch processes to have ultimate performance

#### `Counter`

Incrementally class

#### `safePromiseTry` (v1.2.10+)

Support `Promise.try` Use `Promise.try`, otherwise use internal implementation

#### `cx` (v1.2.5+)

An efficient CSS class name merging utility function, similar to `clsx` or `classnames`, but automatically removes duplicate class names.

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
      Content
    </div>
  );
}
```

Supports various parameter types:

- String: `"class1 class2"`
- String array: `["class1", "class2"]`
- Object: `{ "class1": true, "class2": false }`
- Any combination of the above types

## License
