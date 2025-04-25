# @wwog/react

A practical React component library providing declarative flow control and common UI utility components to make your React code more concise and readable.

[![npm version](https://img.shields.io/npm/v/@wwog/react.svg)](https://www.npmjs.com/package/@wwog/react)
[![ESM](https://img.shields.io/badge/📦-ESM%20only-brightgreen.svg)](https://nodejs.org/api/esm.html)

---

[中文文档](./README.md)

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
import { When } from '@wwog/react';

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

<Toggle options={["light", "dark"]} render={(value,toggle)=>{/* xxx */}}/>

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

### hooks

#### useControlled

- Applied to states that can be controlled or uncontrolled components


### Ideas

> Not high demand, but useful components

- Loop: Flexible iteration rendering, supports arrays, objects, and ranges.
- Try: Encapsulate async logic, handle Promise states.
- Pick: Lightweight value selection rendering, similar to enum matching.
- Render: Dynamic render function, simplifies complex rendering logic.
- Once: Ensure content is rendered only once, suitable for initialization.
- Each: Enhanced list rendering, supports filtering and sorting.

## License
