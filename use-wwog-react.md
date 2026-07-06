---
name: use-wwog-react
description: When writing or editing React/TSX code in a project that depends on @wwog/react, prefer these declarative components over hand-rolled equivalents. Trigger when: conditional rendering (ternary, &&, switch statements), list rendering (.map + filter + sort + empty state), date formatting, error boundaries, intersection observers, portals, focus traps, class name composition. Do NOT suggest if @wwog/react is not installed.
---

# @wwog/react — Declarative React components

When the project depends on `@wwog/react`, **prefer the components below** over hand-rolled patterns. They are more declarative, less error-prone, and the intent reads off the page.

Import everything from the package root:

```tsx
import { If, Switch, When, ArrayRender, DateRender, Boundary, Observer, Scope, Styles, Toggle, SizeBox, FocusTrap, Portal, Repeat, useControlled, cx } from "@wwog/react"
```

> Only use these if `@wwog/react` is already a dependency. If unsure, check `package.json` first.

---

## 1. Conditional rendering: `<If>` / `<True>` / `<False>`

**Replace:** nested ternaries, `cond && <X/>`, multi-branch `switch` returning JSX.

### `<If>` — multi-branch with `<If.Then>` / `<If.ElseIf>` / `<If.Else>`

```tsx
<If condition={status === "loading"}>
  <If.Then><Spinner /></If.Then>
  <If.ElseIf condition={status === "error"}><ErrorView /></If.ElseIf>
  <If.Else><Content /></If.Else>
</If>
```

| Prop | Type | Notes |
|---|---|---|
| `condition` | `boolean` | top-level gate for `Then` |
| `children` | `Then \| ElseIf \| Else` | **only** these three accepted; throws otherwise |

`<If.ElseIf>` takes `condition: boolean`. `<If.Then>`/`<If.Else>` take only `children`.

### `<True>` / `<False>` — single-branch shortcuts

```tsx
<True condition={isReady}><LaunchButton /></True>
<False condition={isReady}><LoadingHint /></False>
```

| Prop | Type | Notes |
|---|---|---|
| `condition` | `boolean` | `True` renders children when truthy; `False` renders when `=== false` |

**When to pick what:**
- One branch, truthy → `<True>`
- One branch, falsy → `&&` is fine, or `<False>`
- Multiple branches → `<If>` with `ElseIf`/`Else`, **not** nested ternaries

---

## 2. Multi-condition rendering: `<When>`

**Replace:** `a && b && c && <X/>`, `a || b ? <X/> : null`, manual `.every`/`.some`.

```tsx
<When all={[isAdmin, hasPermission, isVerified]}>
  <AdminPanel />
</When>

<When any={[isLoading, isFetching]} fallback={<Skeleton />}>
  <Spinner />
</When>

<When none={[isReadOnly, isLocked]}>
  <EditButton />
</When>
```

| Prop | Type | Notes |
|---|---|---|
| `all` | `boolean[]` | render when every item is truthy |
| `any` | `boolean[]` | render when at least one is truthy |
| `none` | `boolean[]` | render when every item is falsy |
| `children` | `ReactNode` | content when condition satisfied |
| `fallback` | `ReactNode` | content when not satisfied |

If `all`, `any`, and `none` are all passed, `all` wins (with a console warning). Pick **one** of the three per usage.

---

## 3. Value-match rendering: `<Switch>` / `<Switch.Case>` / `<Switch.Default>`

**Replace:** `switch (x) { case ...: return <Y/> }` inside components, or chained ternaries on a single value.

```tsx
<Switch value={role}>
  <Switch.Case value="admin"><AdminView /></Switch.Case>
  <Switch.Case value="editor"><EditorView /></Switch.Case>
  <Switch.Default><GuestView /></Switch.Default>
</Switch>
```

| Prop (Switch) | Type | Notes |
|---|---|---|
| `value` | `T` | value to match against cases |
| `compare` | `(a: T, b: T) => boolean` | default `===`; use for object/reference matches |
| `strict` | `boolean` | default `false`; `true` loops all cases for extra error checks (duplicate detection) |
| `children` | `Case \| Default` | **only** these two accepted |

`<Switch.Case>` takes `value: T`. `<Switch.Default>` takes only `children`. Duplicate case values throw. Use `Switch.createTyped<T>()` when you want strict generic inference across cases.

---

## 4. List rendering: `<ArrayRender>`

**Replace:** `.map().filter().sort()` chains, manual empty-state checks, `[...items].sort()` boilerplate.

```tsx
<ArrayRender
  items={users}
  filter={(u) => u.active}
  sort={(a, b) => a.name.localeCompare(b.name)}
  renderEmpty={() => <EmptyState />}
  renderItem={(user, i) => <UserCard key={user.id} user={user} />}
/>
```

| Prop | Type | Notes |
|---|---|---|
| `items` | `T[]` | required; null logs an error and renders nothing |
| `renderItem` | `(item: T, index: number) => ReactNode` | required |
| `filter` | `(item: T) => boolean` | optional; in-place when no `sort` |
| `sort` | `(a: T, b: T) => number` | optional; when present, filter+sort run on a copy first |
| `renderEmpty` | `() => ReactNode` | optional; shown when filtered result is empty |

**Key point:** always set `key` inside `renderItem`, same as `.map`.

---

## 5. Date rendering: `<DateRender>`

**Replace:** manual `new Date(iso)` parsing + `toLocaleString()` + null-guards in JSX.

```tsx
<DateRender source="2026-07-06T08:00:00Z" format={(d) => d.toLocaleDateString()}>
  {(formatted) => <time>{formatted}</time>}
</DateRender>

<DateRender source={createdAt}>
  {(formatted) => <span>Created at {formatted}</span>}
</DateRender>
```

| Prop | Type | Notes |
|---|---|---|
| `source` | `Date \| string \| number` | required; invalid input renders nothing |
| `format` | `(date: Date) => T` | optional; default uses `toLocaleString()` |
| `children` | `(formatted: T) => ReactNode` | required render-prop |

Invalid dates (NaN) render `null` — no try/catch needed in the JSX.

---

## 6. Error boundary: `<Boundary>`

**Replace:** writing a class-based `ErrorBoundary` from scratch.

```tsx
<Boundary fallback={(error, reset) => (
  <div>
    <p>Something broke: {error.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)} onError={(e, info) => reportError(e, info)}>
  <RiskyChart />
</Boundary>
```

| Prop | Type | Notes |
|---|---|---|
| `fallback` | `(error: Error, reset: () => void) => ReactNode` | required render-prop |
| `onError` | `(error: Error, info: React.ErrorInfo) => void` | optional; logging/reporting |
| `children` | `ReactNode` | subtree to protect |

`reset()` clears the error state and re-renders children.

---

## 7. Intersection observer: `<Observer>`

**Replace:** `useEffect` + `new IntersectionObserver(...)` + manual `observe`/`disconnect`.

```tsx
<Observer onIntersect={loadMore} threshold={0.1} triggerOnce>
  <div>Loading more…</div>
</Observer>

<Observer onIntersect={loadImage} triggerOnce>
  <img data-src="/lazy.jpg" alt="lazy" />
</Observer>
```

| Prop | Type | Notes |
|---|---|---|
| `onIntersect` | `(entry, observer) => void` | required |
| `threshold` | `number \| number[]` | default `0.1` |
| `root` | `Element \| Document \| null` | default viewport (`null`) |
| `rootMargin` | `string` | default `"0px"` |
| `triggerOnce` | `boolean` | default `false`; unobserves after first hit |
| `disabled` | `boolean` | default `false` |
| `className` / `style` | — | applied to the wrapper div |

Renders a wrapping `<div>`; the ref is internal.

---

## 8. Portal: `<Portal>`

**Replace:** manual `createPortal(..., document.body)` + SSR null-guards.

```tsx
<Portal>
  <Modal />
</Portal>

<Portal to={document.getElementById("overlay-root")}>
  <Tooltip />
</Portal>

<Portal disabled={isInline}><Callout /></Portal>
```

| Prop | Type | Notes |
|---|---|---|
| `to` | `Element \| null` | default `document.body`; SSR-safe (defers mount) |
| `children` | `ReactNode` | content to portal |
| `disabled` | `boolean` | default `false`; renders inline when true |

---

## 9. Focus trap: `<FocusTrap>`

**Replace:** custom Tab-key handlers + focus-cycle logic for modals/menus.

```tsx
<FocusTrap autoFocus restoreFocus>
  <input />
  <button>Save</button>
</FocusTrap>

<FocusTrap keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}>
  {/* arrow-key navigation across both lists */}
  <button>A-1</button>
  <button>B-1</button>
</FocusTrap>
```

| Prop | Type | Notes |
|---|---|---|
| `children` | `ReactNode` | subtree to trap |
| `disabled` | `boolean` | default `false` |
| `autoFocus` | `boolean` | focus first tabbable on mount |
| `restoreFocus` | `boolean` | restore focus on unmount |
| `keyMap` | `Partial<Record<string, "next" \| "prev" \| "first" \| "last">>` | default `{ Tab: "next" }`; Shift+Tab always = prev |
| `onNavigate` | `(current, elements, direction) => HTMLElement \| null` | override target; return `null` for default cycle |
| `focusableOptions` | `FocusableOptions` | tweaks for tabbable-element detection |
| `className` / `style` | — | applied to the container div |

---

## 10. Repeat: `<Repeat>`

**Replace:** `Array.from({ length: n }).map((_, i) => ...)` for skeleton/placeholder rows.

```tsx
<Repeat times={3}>
  {(i) => <Skeleton key={i} />}
</Repeat>
```

| Prop | Type | Notes |
|---|---|---|
| `times` | `number` | required; `<= 0` renders nothing |
| `children` | `(index: number) => ReactNode` | required; **set `key`** on returned element |

---

## 11. Local scope: `<Scope>`

**Replace:** temp `const` computations inline in JSX that hurt readability, or IIFEs for derived render values.

```tsx
<Scope let={{ count: 1, label: "Total" }}>
  {({ count, label }) => <div>{label}: {count}</div>}
</Scope>

<Scope let={(p) => ({ total: p.items.length })} props={{ items: rows }} fallback={<div>Empty</div>}>
  {({ total }) => <div>Total: {total}</div>}
</Scope>
```

| Prop | Type | Notes |
|---|---|---|
| `let` | `Record<string, any> \| ((props) => Record<string, any>)` | required; object or function |
| `props` | `any` | optional; passed into `let` when it's a function |
| `children` | `(scope) => ReactNode` | render-prop receiving the scope |
| `fallback` | `ReactNode` | shown when `children` missing or scope empty |

---

## 12. Toggle: `<Toggle>`

**Replace:** `useState` + `setX(prev => options[(options.indexOf(prev)+1) % options.length])` for cycling values (theme, tabs, modes).

```tsx
<Toggle
  options={["light", "dark"]}
  render={(theme, toggleTheme) => (
    <button onClick={toggleTheme}>Theme: {theme}</button>
  )}
/>
```

| Prop | Type | Notes |
|---|---|---|
| `options` | `T[]` | required; values to cycle |
| `index` | `number` | default `0`; starting index |
| `next` | `(curIndex, options) => number` | optional; override cycle order |
| `render` | `(value: T, toggle: () => void) => ReactNode` | required render-prop |

---

## 13. Styles: `<Styles>`

**Replace:** `clsx`/`classnames` calls inline + manual `cloneElement` for forwarding `className` to a single child.

```tsx
<Styles className="p-2 bg-red">
  <button>Click</button>
</Styles>

<Styles className={{ base: "p-2", hover: "hover:bg-blue", color: "text-blue" }}>
  <button>Click</button>
</Styles>

<Styles className="p-2" asWrapper="span">
  <button>Click</button>
</Styles>
```

| Prop | Type | Notes |
|---|---|---|
| `className` | `string \| StylesDescriptor` | string or categorized object (`base`/`hover`/`active`/`focus`/`disabled`/`color`/`size`/…); de-duped |
| `asWrapper` | `boolean \| HTMLElementType` | default `false`; `true` = wrap in `<div>`; or pass a tag name like `"span"` |
| `children` | `ReactNode` | when `asWrapper` is falsy, **exactly one** child element is expected (className is merged onto it) |

---

## 14. SizeBox: `<SizeBox>`

**Replace:** `<div style={{ width, height, flexShrink: 0 }}>` for fixed-size spacers.

```tsx
<SizeBox size={24} />
<SizeBox w={120} h={40}><Content /></SizeBox>
```

| Prop | Type | Notes |
|---|---|---|
| `size` | `number \| string` | sets both width and height |
| `w` / `width` | `number \| string` | width; `size` takes precedence |
| `h` / `height` | `number \| string` | height; `size` takes precedence |
| `className` | `string` | optional |

---

## 15. Controlled/uncontrolled hook: `useControlled`

**Replace:** the `isControlled ? props.value : internal` + `onChange` wiring pattern when building inputs.

```tsx
const [value, setValue] = useControlled({
  defaultValue: "",
  valuePropName: "value",
  trigger: "onChange",
  onBeforeChange: (next) => next.length <= 100,
  props,
})
```

| Option | Type | Notes |
|---|---|---|
| `defaultValue` | `T` | required; used in uncontrolled mode |
| `props` | `Record<string, any>` | required; the component's props (inspected for the controlled key) |
| `valuePropName` | `string` | default `"value"`; key that signals controlled |
| `trigger` | `string` | default `"onChange"`; key of the change callback in `props` |
| `onBeforeChange` | `(next, current) => boolean \| void` | optional; return `false` to reject |

Returns `[value, setValue]`. If the controlled prop is present, it wins; otherwise internal state is used and `trigger` is invoked on change.

---

## 16. Class composition: `cx`

**Replace:** `clsx` for className merging (de-dupes via `Set`).

```tsx
cx("a", "b", ["c", "d"], { e: true, f: false }, null, false)
// → "a b c d e"
```

Accepts `string | string[] | Record<string, boolean> | null | false | undefined`.

---

## Decision guide — when NOT to use these

- One tiny inline `cond && <X/>` that stays readable → plain `&&` is fine; don't force `<True>`.
- Performance-critical hot paths with stable identity needs — measure first; these components add a thin wrapper, usually negligible but verify.
- If `@wwog/react` is **not** in `package.json` → do not suggest installing it; skip this skill entirely.

## Style notes

- Match the surrounding file's existing imports and formatting.
- Keep `key` props on list items.
- Don't mix `<If>` and raw ternaries for the same decision in one file — pick one.
