---
name: use-wwog-react
description: When writing or editing React/TSX code in a project that depends on @wwog/react, prefer these declarative components and utilities over hand-rolled equivalents. Trigger when: conditional rendering (ternary, &&, multi-branch switch), multi-condition gating, data transformation pipelines, list rendering (.map + filter + sort + empty state), date formatting, error boundaries, intersection observers, portals, focus traps, className composition, controlled/uncontrolled input wiring, responsive breakpoints, mobile stack navigation with back gestures, throttling high-frequency child renders to a frame budget, splitting long tasks and yielding to the main thread, debounce/throttle/rAF scheduling, off-main-thread work in Web Workers, worker pools, memoization, bounded queues and backpressure (drop-oldest / latest-wins), FLIP animations, focusability queries, module-level shared state and localStorage-backed state, fine-grained store subscriptions (one field changing re-rendering only the components that read it) and shallow selector equality, push-based events (emitter/fire/subscribe, debounce or throttle waterfalls, buffering, multiplexing several sources, async delivery with cancellation, subscribing to one for a React component's lifetime), callbacks that must stay referentially stable yet read the latest props, turning an event's last payload into a renderable value, resource lifetime and unsubscribe leaks (DisposableStore/DisposableMap, `using` declarations), timezone-independent weekday math. Do NOT suggest if @wwog/react is not installed.
---

# @wwog/react — declarative components & utilities

When the project depends on `@wwog/react`, **prefer the tools below** over hand-rolled patterns. They are more declarative, less error-prone, and the intent reads off the page.

> Only use these if `@wwog/react` is already a dependency. If unsure, check `package.json` first — and do not suggest installing it.

Import everything from the package root (`dist/index.js`, ESM; `src/` ships too):

```tsx
import {
  // flow control
  If, True, False, When, Switch, Pipe,
  // structural rendering
  ArrayRender, DateRender, Repeat,
  // sundry / runtime
  Boundary, Observer, Portal, FocusTrap, Scope, Styles, Toggle, SizeBox,
  // performance & navigation
  FrameRender, AppStackRouter, useAppStack, useStackSize, useCanPop,
  // hooks
  useControlled, useScreen, getCurrentBreakpoint,
  useEvent, useEventValue, useEventCallback,
  // utils
  cx, createExternalState, createStorageState, shallowEqual, formatDate, Counter,
  childrenLoop, safePromiseTry, safePromiseWithResolvers,
  getTabIndex, isFocusable, isTabbable, getFocusableElements, getTabbableElements,
  breakpoints, DefBreakpointDesc,
  yieldToMain, forEachChunked, forEachInFrames,
  debounce, throttle, rafSchedule, appendBatch, runLayoutBatch,
  Queue, createPriorityQueue,
  createDroppingQueue, createLatestValue,
  memoize, WorkerPool, getWorkerPool, runInWorkerWithPool, disposeWorkerPool, WorkerError,
  flipAnimate, weekday, weekdayJulian,
  // events & lifetime
  Emitter, Event, MicrotaskDelay, PauseableEmitter, DebounceEmitter, MicrotaskEmitter,
  AsyncEmitter, EventMultiplexer, DynamicListEventMultiplexer, EventBufferer, Relay,
  ValueWithChangeEvent, trackSetChanges, EventProfiling, setGlobalLeakWarningThreshold,
  ListenerLeakError, ListenerRefusalError, createEventDeliveryQueue,
  DisposableStore, DisposableMap, toDisposable, combinedDisposable, noopDisposable,
  isDisposable, disposeAll,
} from "@wwog/react"
```

Everything is a **named export** from the root; there are no default exports. Prop interfaces (`IfProps`, `StylesProps`, …) and option/detail types (`FrameRenderProps`, `WorkerRunOptions`, `BreakpointDesc`, `CxInput`, `Responsive<T>`, …) are exported too — import them for typing instead of redeclaring.

### Contents

Components: [1 If/True/False](#1-conditional-rendering-if--true--false) · [2 When](#2-multi-condition-gating-when) · [3 Switch](#3-value-match-rendering-switch) · [4 Pipe](#4-data-pipeline-pipe) · [5 ArrayRender](#5-list-rendering-arrayrender) · [6 Repeat](#6-repeat-repeat) · [7 DateRender](#7-date-rendering-daterender) · [8 Boundary](#8-error-boundary-boundary) · [9 Observer](#9-intersection-observer-observer) · [10 Portal](#10-portal-portal) · [11 FocusTrap](#11-focus-trap-focustrap) · [12 Scope](#12-local-scope-scope) · [13 Toggle](#13-toggle-toggle) · [14 Styles](#14-styles-styles) · [15 SizeBox](#15-sizebox-sizebox) · [16 FrameRender](#16-frame-coalescing-framerender) · [17 AppStackRouter](#17-mobile-stack-navigation-appstackrouter)

Hooks: [18 useControlled](#18-controlleduncontrolled-hook-usecontrolled) · [19 useScreen](#19-responsive-breakpoints-usescreen) · [36 events in React](#36-events-in-react-useevent--useeventvalue--useeventcallback)

Utils: [20 cx](#20-class-composition-cx) · [21 createExternalState](#21-external-state-createexternalstate--createstoragestate) · [22 formatDate/Counter](#22-date-formatting--counter-formatdate--counter) · [23 promise](#23-promise-helpers-safepromisetry--safepromisewithresolvers) · [24 childrenLoop](#24-childrenloop-childrenloop) · [25 focusable](#25-focusability-queries) · [26 breakpoints](#26-breakpoints--responsive-types) · [27 yield](#27-long-task-splitting-yieldtomain--foreachchunked--foreachinframes) · [28 scheduling](#28-debounce-throttle--raf-scheduling) · [29 queues](#29-queues-queue--createpriorityqueue) · [30 backpressure](#30-backpressure-createdroppingqueue--createlatestvalue) · [31 memoize](#31-memoization-memoize) · [32 workers](#32-off-main-thread-work-workerpool--runinworkerwithpool) · [33 FLIP](#33-flip-animation-flipanimate) · [34 weekday](#34-weekday-math-weekday--weekdayjulian) · [35 events & lifetime](#35-events-and-lifetime-emitter--event)

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
| `condition` | `boolean` | required; gate for `Then` |
| `children` | `ReactNode` | **must** be valid React elements, and only these three types |

**Throws** (at render time) when: a child is not a valid element; more than one `Then`; more than one `Else`; or a child is not `Then`/`ElseIf`/`Else`. Multiple `ElseIf` are allowed and evaluated in declaration order — the first truthy `condition` wins. If `condition` is true but no `Then` is present, it renders nothing.

`<If.ElseIf condition={...}>`, `<If.Then>`, `<If.Else>` take `children` only. Child recognition is by `displayName` string comparison (`If_Then`/`If_Else`/`If_ElseIf`), so don't rename those.

`If.createTyped()` returns `{ If, Then, ElseIf, Else }` for inference; use it when cases need a shared generic.

### `<True>` / `<False>` — single-branch shortcuts

```tsx
<True condition={isReady}><LaunchButton /></True>
<False condition={isReady}><LoadingHint /></False>
```

| Prop | Type | Notes |
|---|---|---|
| `condition` | `boolean` | `True` renders when truthy; `False` renders only when `condition === false` |

Note the asymmetry: `<False>` uses a **strict** `=== false` check, so `undefined`/`null` do *not* render its children.

**When to pick what:**
- One branch, truthy → `<True>`
- One branch, falsy → plain `&&` is fine, or `<False>` when you specifically mean `=== false`
- Multiple branches → `<If>` with `ElseIf`/`Else`, **not** nested ternaries

---

## 2. Multi-condition gating: `<When>`

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
| `all` | `boolean[]` | render when the array is non-empty and every item is truthy |
| `any` | `boolean[]` | render when non-empty and at least one item is truthy |
| `none` | `boolean[]` | render when non-empty and every item is falsy |
| `children` | `ReactNode` | content when satisfied |
| `fallback` | `ReactNode` | content when not satisfied (defaults to `null`) |

Evaluation is a fall-through chain, in this order: `all` → `any` → `none`. So passing several is not an error, but it is confusing: it only warns when `all` is combined with `any` or `none`, and despite the warning text, `all` does **not** simply win — if `all` is present but not fully true, `any` and then `none` are still evaluated. **Pass exactly one** of the three.

Empty arrays are falsy: `all={[]}` and `any={[]}` render the fallback (plain JS `[].every()` would be vacuously true).

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
| `value` | `T` | required; value to match against cases |
| `compare` | `(a: T, b: T) => boolean` | default `===`; use for object/reference matches |
| `strict` | `boolean` | default `false`; see below |
| `children` | `ReactNode` | only `Case` / `Default` elements |

`<Switch.Case value={v}>` and `<Switch.Default>` take only `children`.

**Error behavior (exact):**
- Duplicate `Case` values **throw in both modes** — the only difference is that strict appends `" (detected in strict mode)"` to the message.
- Non-strict stops iterating at the first matching `Case`, so a duplicate appearing *after* the matched case is never detected. Strict always visits every child, so duplicates anywhere are caught.
- More than one `Default` throws (`Switch can only have one Default child`).
- A non-element child, or an element that is not `Case`/`Default`, throws with its index.

Renders `matchedChildren ?? defaultChild`, so an unmatched value with no `Default` renders nothing. Set `strict` from the dev environment to get the extra checks in development. Use `Switch.createTyped<T>()` for strict generic inference across cases; it returns `{ Switch, Case, Default }`.

---

## 4. Data pipeline: `<Pipe>`

**Replace:** an IIFE or a chain of `const` locals in JSX that transforms one value through several steps before rendering.

```tsx
<Pipe
  data={users}
  transform={[
    (list) => list.filter((u) => u.active),
    (list) => list.map((u) => u.name),
  ]}
  render={(names) => <div>{names.join(", ")}</div>}
  fallback={<div>No Data</div>}
/>
```

| Prop | Type | Notes |
|---|---|---|
| `data` | `any` | required; initial value |
| `transform` | `((input: any) => any)[]` | required; reduced left-to-right over `data` |
| `render` | `(result: any) => ReactNode` | required; called when the result is not `null`/`undefined` |
| `fallback` | `ReactNode` | rendered when the final result is `null`/`undefined` (default `null`) |

Transforms are memoized on `[data, transform]`, so an **inline array literal defeats the memo** — hoist the array to module scope or wrap it in `useMemo` when the transforms are stable. `<Pipe>` shares `any`-typed inputs with `<Scope>`; for typed derived values prefer `<Scope>` or a plain local.

---

## 5. List rendering: `<ArrayRender>`

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
| `items` | `T[]` | required; a falsy value logs `ArrayRender: items is null` and renders nothing |
| `renderItem` | `(item: T, index: number) => ReactNode` | required |
| `filter` | `(item: T) => boolean` | optional |
| `sort` | `(a: T, b: T) => number` | optional; when present, filter + sort run on a copy first |
| `renderEmpty` | `() => ReactNode` | optional; rendered when the result is empty |

**Index behavior differs by path — this is the trap:**
- `items.length === 0` short-circuits to `renderEmpty()` before `filter` runs.
- **With `sort`:** `items` is copied (`[...items]`), filtered, sorted; `renderItem` gets compacted `0..n-1` indices.
- **Without `sort`:** `items` is *not* mutated, filtering happens during `map`, filtered slots become `null`, and `renderItem` receives the **original** index of each item (so index-based keys can collide with gaps). `renderEmpty` only appears when *every* item was filtered out.

`items` is never mutated. Always set `key` inside `renderItem`, as with `.map`.

---

## 6. Repeat: `<Repeat>`

**Replace:** `Array.from({ length: n }).map((_, i) => ...)` for skeleton/placeholder rows.

```tsx
<Repeat times={3}>
  {(i) => <Skeleton key={i} />}
</Repeat>
```

| Prop | Type | Notes |
|---|---|---|
| `times` | `number` | required; `<= 0` renders nothing |
| `children` | `(index: number) => ReactNode` | required; **set `key`** on the returned element |

Renders a `Fragment` — no wrapper element is added.

---

## 7. Date rendering: `<DateRender>`

**Replace:** manual `new Date(iso)` parsing + `toLocaleString()` + null-guards in JSX.

```tsx
<DateRender source="2026-07-06T08:00:00Z" format={(d) => d.toLocaleDateString()}>
  {(formatted) => <time>{formatted}</time>}
</DateRender>
```

| Prop | Type | Notes |
|---|---|---|
| `source` | `Date \| string \| number` | required |
| `format` | `(date: Date) => T` | optional; default is `date.toLocaleString()` |
| `children` | `(formatted: T) => ReactNode` | required render-prop |

Generic over the formatted type: `<DateRender<string> …>`.

**Null behavior, exactly:** renders `null` when the source is not a `Date`/`string`/`number`, when a string/number parses to `NaN`, **or when the formatted value is falsy** (`!formattedDate`). So a `format` that returns `""`, `0`, or `false` renders nothing — return a placeholder string instead. A `Date` instance is passed through without a `NaN` check, so an invalid `Date` reaches `format`/`toLocaleString`.

For token-based formatting without a `format` render prop, use `formatDate` ([§22](#22-date-formatting--counter-formatdate--counter)).

---

## 8. Error boundary: `<Boundary>`

**Replace:** writing a class-based `ErrorBoundary` from scratch.

```tsx
<Boundary
  fallback={(error, reset) => (
    <div>
      <p>Something broke: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
  onError={(e, info) => reportError(e, info)}
>
  <RiskyChart />
</Boundary>
```

| Prop | Type | Notes |
|---|---|---|
| `fallback` | `(error: Error, reset: () => void) => ReactNode` | required render-prop |
| `onError` | `(error: Error, info: React.ErrorInfo) => void` | optional; logging/reporting |
| `children` | `ReactNode` | subtree to protect |

`reset()` clears the stored error and re-renders children. Only catches render/lifecycle errors — not event handlers or async throws.

---

## 9. Intersection observer: `<Observer>`

**Replace:** `useEffect` + `new IntersectionObserver(...)` + manual `observe`/`disconnect`.

```tsx
<Observer onIntersect={loadMore} threshold={0.1} triggerOnce>
  <div>Loading more…</div>
</Observer>
```

| Prop | Type | Notes |
|---|---|---|
| `onIntersect` | `(entry: IntersectionObserverEntry, observer: IntersectionObserver) => void` | required |
| `threshold` | `number \| number[]` | default `0.1` |
| `root` | `Element \| Document \| null` | default viewport (`null`) |
| `rootMargin` | `string` | default `"0px"` |
| `triggerOnce` | `boolean` | default `false`; unobserves after the first hit |
| `disabled` | `boolean` | default `false` |
| `className` / `style` | — | applied to the wrapper `<div>` |

Renders a wrapping `<div>` (the ref is internal) and always renders it — `disabled` only means "not observed".

**Memoize `onIntersect`.** It is in the effect dependency array, so a new function identity on every render tears down and recreates the `IntersectionObserver`. Wrap it in `useCallback` or hoist it. If the browser lacks `IntersectionObserver` the component warns once and skips observing. Flipping `triggerOnce` back to `false` resets the once-flag, so it can fire again.

---

## 10. Portal: `<Portal>`

**Replace:** manual `createPortal(..., document.body)` + SSR null-guards.

```tsx
<Portal><Modal /></Portal>

<Portal to={document.getElementById("overlay-root")}><Tooltip /></Portal>

<Portal disabled={isInline}><Callout /></Portal>
```

| Prop | Type | Notes |
|---|---|---|
| `to` | `Element \| null` | default `document.body`; SSR-safe (defers mount until after the mount effect) |
| `children` | `ReactNode` | content to portal |
| `disabled` | `boolean` | default `false`; renders inline when true |

---

## 11. Focus trap: `<FocusTrap>`

**Replace:** custom Tab-key handlers + focus-cycle logic for modals/menus.

```tsx
<FocusTrap autoFocus restoreFocus>
  <input />
  <button>Save</button>
</FocusTrap>

<FocusTrap keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}>
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
| `keyMap` | `Partial<Record<string, FocusDirection>>` | default `{ Tab: "next" }`; `FocusDirection = "next" \| "prev" \| "first" \| "last"` |
| `onNavigate` | `(current: HTMLElement, elements: HTMLElement[], direction: FocusDirection) => HTMLElement \| null` | override target; return `null` for the default cycle |
| `focusableOptions` | `FocusableOptions` | passed to tabbable detection ([§25](#25-focusability-queries)) |
| `className` / `style` | — | applied to the container `<div>` |

Shift+Tab always means `prev`, even if `keyMap` remaps `Tab`. Mapped keys are handled on the container's `keydown` and call `preventDefault()` + `stopPropagation()` **before** checking for tabbables, so a mapped key is consumed even when nothing is focusable. It only works while focus is already inside the container. `autoFocus` and `restoreFocus` are no-ops when `disabled`.

---

## 12. Local scope: `<Scope>`

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
| `props` | `any` | optional; passed into `let` when it is a function |
| `children` | `(scope) => ReactNode` | render-prop receiving the scope |
| `fallback` | `ReactNode` | rendered when `children` is missing **or** the scope has no keys |

---

## 13. Toggle: `<Toggle>`

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
| `next` | `(curIndex: number, options: T[]) => number` | optional; override cycle order |
| `render` | `(value: T, toggle: () => void) => ReactNode` | required render-prop |

**Caveats:** an out-of-bounds `index` **throws** from inside an effect (not during render, so it surfaces asynchronously). With an empty `options` array `toggle` is a no-op and `render` is called with `undefined`. Generic defaults to `boolean`; `render` is called directly on every render (no wrapper element).

---

## 14. Styles: `<Styles>`

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
| `className` | `string \| StylesDescriptor` | string, or an object whose **values** are merged |
| `asWrapper` | `boolean \| HTMLElementType` | default `false`; `true` → wrap in `<div>`; or pass a tag name |
| `children` | `ReactNode` | when `asWrapper` is falsy, exactly one child element is expected |

**The descriptor keys are only labels.** The implementation is `cx(...Object.values(className))` — values are concatenated flatly, de-duped, in key order. Nothing is prefixed and no key is interpreted, so a variant must carry its own prefix (`hover: "hover:bg-blue"`, not `hover: "bg-blue"`). Keys beyond the documented ones (`base`/`hover`/`active`/`focus`/`disabled`/`color`/`size`/`layer`/`wrapper`/`dark`/`light`/`sundry`, plus any custom string key) behave identically; they are for human grouping only.

**Error/edge behavior:** falsy `children` → `null`; falsy `className` → children returned unmodified; more than one child (without `asWrapper`) → `console.error` and children rendered **without** the merged className; a non-element child → `console.error` and children returned unmerged. A nested `<Styles>` child whose `className` is a descriptor is normalized to a string before merging.

---

## 15. SizeBox: `<SizeBox>`

**Replace:** `<div style={{ width, height, flexShrink: 0 }}>` for fixed-size spacers.

```tsx
<SizeBox size={24} />
<SizeBox w={120} h={40}><Content /></SizeBox>
```

| Prop | Type | Notes |
|---|---|---|
| `size` | `number \| string` | sets both width and height |
| `w` / `width` | `number \| string` | width |
| `h` / `height` | `number \| string` | height |
| `children` | `ReactNode` | rendered inside the box |
| `className` | `string` | optional |

Resolution uses `size || w || width` and `size || h || height` — a falsy value (`0`, `""`) falls through to the next candidate, so `size={0}` is ignored. Always sets `flexShrink: 0`. With nothing supplied, no width/height style is set.

---

## 16. Frame coalescing: `<FrameRender>`

**Replace:** manual `requestAnimationFrame` throttling of a high-frequency subtree, `useDeferredValue` gymnastics, or "last value wins" ref juggling for live/streaming views.

The parent may re-render at any rate; `FrameRender` lets the expensive child commit **at most once per frame window** (`1000 / fps` ms), last value winning.

```tsx
// State lives outside (cheap, any rate); the expensive child renders at most 30×/s
function Dashboard() {
  const ticks = useHighFrequencyTicks()
  return (
    <FrameRender fps={30}>
      <LiveChart ticks={ticks} />
    </FrameRender>
  )
}

// Function form: when you need to derive from the delivered props bag
<FrameRender fps={30} props={{ data, theme }}>
  {({ data, theme }) => <Chart data={data} theme={theme} />}
</FrameRender>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactElement<P> \| ((props: P) => ReactNode)` | — | required; **single element or function only** |
| `props` | `P` | `{}` | props bag for the function form |
| `fps` | `number` | `60` | target commit rate; `<= 0` bypasses framing entirely |
| `strategy` | `"auto" \| "raf" \| "timer"` | `"auto"` | `auto` = rAF visible / timer hidden; `raf`; `timer` |
| `leading` | `boolean` | `true` | first update of a window commits on the next frame (never synchronously) |
| `trailing` | `boolean` | `true` | `false` = sampling semantics; with `leading` also false, commits become nearly impossible |
| `paused` | `boolean` | `false` | stop committing, keep the pending value; resumes with the latest |
| `disabled` | `boolean` | `false` | full pass-through, no scheduling/comparison/stats |
| `pauseWhenHidden` | `boolean` | `true` | no commits while the tab is hidden; defers side effects until visible |
| `scheduler` | `(cb: (time: number) => void) => () => void` | rAF | inject a transport; also for deterministic frame advancement in tests |
| `select` | `(props: P) => unknown` | — | narrows **comparison only** — the child still receives the full props |
| `compare` | `"shallow" \| "reference" \| "never" \| ((prev, next) => boolean)` | `"shallow"` | true = equal = skip commit |
| `shouldCommit` | `(prev, next, ctx) => boolean` | — | veto policy; `false` drops the pending value (reported as `"vetoed"`) |
| `onFrame` | `(ctx) => void` | — | every pump tick, including non-committing ones — **not** a general frame clock |
| `onCommit` | `(props: P, ctx) => void` | — | after a commit, inside an effect |
| `onDrop` | `(props: P, reason, ctx) => void` | — | only meaningful drops: `"vetoed" \| "cancelled" \| "unmounted"` |
| `warn` | `boolean` | `true` | dev-only notice toggle, read at mount |

`ctx` is a `FrameRenderContext`: `{ time, frame, commits, coalesced, fps }`.

**Imperative handle** via `ref` (`FrameRenderHandle`): `flush(): boolean` (commit pending now, bypassing the time gate), `cancel(): boolean` (drop pending + cancel the booking), `pause()`, `resume()`, `getStats(): FrameRenderStats`. Stats: `{ frames, captures, commits, skips, vetoes, coalesced, dropped, commitsPerSecond }` — `commits` is the upper bound on child renders.

**When this is safe:** children that are **stateless with respect to the coalesced data** — charts, canvases, tables, streaming ticks. In development the component warns once (unless `warn={false}` or `NODE_ENV === "production"`) because:

- Inside a window the child renders the **previous** props of the element form. Never wrap controlled inputs, validation/error messages, loading states, or anything that must react immediately — use the function form if you need unambiguous props.
- Children with their own state, context subscriptions, or high-frequency subscriptions bypass coalescing entirely.

Also note: unsupported `children` shapes (Fragment, array, string) warn once and pass through unframed; `pauseWhenHidden` means a fully covered tab with the `raf`/`auto` strategy commits nothing (use `"timer"` to keep cadence); unmount drops any pending value.

---

## 17. Mobile stack navigation: `<AppStackRouter>`

**Replace:** hand-rolled `useState`-driven screen stacks, history/back-button plumbing, and edge-swipe-back gesture code in mobile H5 SPAs.

```tsx
function Home() {
  const { push } = useAppStack()
  return <button onClick={() => push(Profile, { id: 1 })}>Open Profile</button>
}

function Profile({ id }: { id: number }) {
  const { pop, canPop } = useAppStack()
  return <button onClick={pop} disabled={!canPop()}>Back</button>
}

<AppStackRouter root={<Home />} />
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `root` | `ReactElement` | — | required; always rendered at the bottom, and where a refresh lands |
| `maxStackSize` | `number` | unlimited | exceeding it drops the bottom-most non-root screen; changing it recreates the store |
| `swipeBack` | `boolean` | `true` | enable the left-edge swipe-back gesture |
| `swipeBackEdgeWidth` | `number` | `40` | left-edge trigger width, px |
| `swipeBackCancelOnReverseRelease` | `boolean` | `true` | releasing while moving left forces snap-back even past threshold |
| `swipeBackCancelVelocity` | `number` | `0.1` | min leftward velocity (px/ms) to count as cancel intent |
| `safeArea` | `boolean` | `true` | apply `env(safe-area-inset-*)` padding |
| `transitionDuration` | `number` | `300` | enter/exit transition ms; `0` disables |
| `fullscreen` | `boolean` | `true` | `100dvh` when true, `100%` when false |
| `className` / `style` | — | — | container; `style` is spread last, so it can override the computed styles and CSS vars |
| `children` | `ReactNode` | — | global overlay above the stack (toast, etc.), unaffected by gestures/transitions |

**Navigation API** — `useAppStack(): AppStackApi`:

| Member | Signature | Notes |
|---|---|---|
| `push` | `<P>(Component: ComponentType<P>, params?: P) => void` | renders `<Component {...params} />` |
| `pop` | `() => void` | no-op on an empty stack; also calls `history.back()` to keep browser history consistent |
| `replace` | `<P>(Component: ComponentType<P>, params?: P) => void` | replaces the top without changing depth; degrades to `push` on an empty stack |
| `reset` | `() => void` | clears back to root, no transition |
| `canPop` | `() => boolean` | depth > 0 |
| `size` | `number` | depth, excluding root |

Also exported: `useStackSize(): number` and `useCanPop(): boolean`, which re-render only when the depth (or the boolean) actually changes. **All three hooks throw** when used outside an `<AppStackRouter>`.

**Behavior to know:** screens are absolutely-positioned layers kept alive (not unmounted), so route component state and scroll survive; only the top layer is interactive. It tracks container width with a `ResizeObserver` (not `window.innerWidth`) and intercepts the browser back button with a `history.pushState` sentinel — with **multiple router instances only the last one to push a sentinel** owns the back button. Remember `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` or `safeArea` does nothing. The swipe distance and velocity thresholds are fixed (80px / 0.5 px/ms); only edge width and the cancel options are configurable.

---

## 18. Controlled/uncontrolled hook: `useControlled`

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

| Option | Type | Default | Notes |
|---|---|---|---|
| `defaultValue` | `T` | — | required; used in uncontrolled mode |
| `props` | `Record<string, any>` | — | required; inspected for the controlled key |
| `valuePropName` | `string` | `"value"` | key that signals controlled |
| `trigger` | `string` | `"onChange"` | key of the change callback in `props` |
| `onBeforeChange` | `(newValue: T, currentValue: T) => boolean \| void` | — | return `false` to reject the change |

Returns `[value, setValue]` where `setValue` is a `Dispatch<SetStateAction<T>>` — it **accepts functional updaters**, resolved against the current value.

Two behaviors worth knowing: the `trigger` callback is invoked in **both** controlled and uncontrolled modes (whenever `props[trigger]` exists), and controlled detection uses `Object.prototype.hasOwnProperty`, so `value={undefined}` counts as controlled. `onBeforeChange` returning `false` aborts before both the internal update and the trigger.

---

## 19. Responsive breakpoints: `useScreen`

**Replace:** `window.matchMedia` / `resize` listeners with manual width comparisons for responsive branching in JS.

```tsx
const bp = useScreen()                          // 'base' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
const custom = useScreen({ sm: 600, md: 900, lg: 1200 })
```

`useScreen(breakpointDesc: BreakpointDesc = DefBreakpointDesc): BreakpointName` returns a **single breakpoint name string**, not an object. Default thresholds: `xs 475, sm 640, md 768, lg 1024, xl 1280, 2xl 1536, 3xl 1920`; `base` has no threshold and is the fallback.

Pure resolver also exported: `getCurrentBreakpoint(breakpointDesc, width): BreakpointName`.

Notes: it listens with `matchMedia` on the adjacent breakpoints only, and the effect dependency is `JSON.stringify(breakpointDesc)` — so an inline literal object is fine, but non-JSON values are dropped and key order matters. It is SSR-safe, though the client's initial state reads `window.innerWidth` while the server returns `'base'`, which can surface as a hydration mismatch. A `NaN` threshold for an adjacent breakpoint throws from inside the effect.

---

## 20. Class composition: `cx`

**Replace:** `clsx` for className merging (de-dupes via `Set`, preserving first-seen order).

```tsx
cx("a", "b", ["c", "d"], { e: true, f: false }, null, false)
// → "a b c d e"
```

Accepts `CxInput = string | string[] | Record<string, boolean> | undefined | null | false`. Falsy args are skipped; array entries are added verbatim; object keys are added when their value is truthy.

---

## 21. External state: `createExternalState` / `createStorageState`

**Replace:** module-level `let` + a home-grown pub/sub, or `Context` for state that should live outside the React tree (cross-component sync, values read by plain functions).

```tsx
const themeState = createExternalState("light", {
  onChange: (next, prev) => console.log(`Theme: ${prev} → ${next}`),
})

themeState.get()                       // read outside React
themeState.set((prev) => (prev === "light" ? "dark" : "light"))

function ThemeButton() {
  const [theme, setTheme] = themeState.useState()   // like useState
  return <button onClick={() => setTheme("dark")}>{theme}</button>
}

const persisted = createStorageState<string>("key", "initial")   // localStorage by default
```

### Selecting a slice: `useSelector`

For an object store, `useState()` re-renders on *any* field. `useSelector(selector, isEqual?)` subscribes to one slice and re-renders only when that slice changes:

```tsx
const appState = createExternalState({ name: "wwog", age: 1, theme: "light" })

function NameLabel() {
  // changing age / theme does NOT re-render this component
  const name = appState.useSelector((s) => s.name)
  return <span>{name}</span>
}

// a selector that composes a NEW object must be given an equality fn,
// or every unrelated write re-renders (fresh reference each call):
import { shallowEqual } from "@wwog/react"
const head = appState.useSelector((s) => ({ name: s.name, age: s.age }), shallowEqual)
```

Equality defaults to `Object.is` and is compared against the last **committed** slice, so a selector whose reference identity changes every render (an inline arrow) is safe: no extra re-render, no stale slice. `shallowEqual` compares arrays / plain objects one level deep with `Object.is` per entry; `Date` / `Map` / `Set` / class instances deliberately fall back to reference equality (their own enumerable keys are empty, so a key-wise pass would call two different values equal and a subscriber would miss the update).

Outside components: `subscribe(listener)` fires on any change; `subscribeWithSelector(selector, (nextSlice, prevSlice) => {}, { isEqual?, fireImmediately? })` fires only when the slice changes (`prevSlice` on the first change is the slice as of subscribing; `fireImmediately` calls back once at subscribe time with `nextSlice === prevSlice`). Both return an unsubscribe function.

Returned API: `get()`, `set(value | updater)`, `useState(): [T, setter]`, `useGetter(): T`, `useSelector(selector, isEqual?)`, `subscribe(listener)`, `subscribeWithSelector(selector, listener, options?)`. Options are `{ onSet?, onChange?, notify? }` — `onSet` fires on **every** `set` (even unchanged), `onChange` only when `Object.is` differs. `notify` is `"sync"` (default: subscribers are notified before `set` returns) or `"microtask"` (several `set` calls in one task notify once, from a microtask; intermediate states are skipped and `onSet` / `onChange` stay synchronous).

Caveats: each call creates an **independent** store — share the returned instance (module-level const) to sync components. A `set` still notifies every subscriber, but each one only compares its own slice, so an unrelated write costs a comparison rather than a re-render. There is no batching by default, so `N` writes in one tick notify `N` times (React then batches the resulting renders) — that walk is the thing `notify: "microtask"` removes, and it only pays off with many subscribers and frequent writes. `set` must be given a **new reference**: an updater that mutates in place and returns the same object is `Object.is`-equal to the previous value, so nothing updates. A subscriber that throws is caught, logged and skipped, and the remaining subscribers and the `onSet` / `onChange` callbacks still run. Callback errors are caught and logged (`console.error`), never propagated — a callback returning a rejected promise is caught too, a synchronous throw is logged on the spot. `useState` / `useSelector` provide a server snapshot, so SSR renders the current value but does not subscribe. In development, a `useSelector` whose selector returns a new reference with shallow-equal contents warns once per hook. The check reads the bare `process.env.NODE_ENV`, which Vite/webpack replace at build time, so the hint is dropped from production builds; where nothing replaces it and `process` is absent (native ESM, esbuild without `define`), it counts as development and the hint shows.

`createStorageState(key, initialState, options)` persists `JSON.stringify` on `set`, and reads once at creation. `storageType` is `"local" | "session"`, optional, `"local"` by default. It is client-only (guarded by `typeof window`), warns and falls back to `initialState` on a parse failure, writes via `onSet` — **skipping the write when the serialized result equals what is already stored** (setting an equal-content object is common, and re-serializing + rewriting the whole value is the expensive step; the value restored at creation counts as the baseline) — and does **not** listen for cross-tab `storage` events unless `syncAcrossTabs: true`: then another tab's write is applied through `set` (so `onSet` / `onChange` fire and `useSelector` slices update), the remote value is **not** written back, and a remote removal / `clear()` returns the state to `initialState` without resurrecting it in storage. The event does not cross tabs for `sessionStorage`, and bad remote JSON is ignored with a `console.warn`.

> `__listeners` on the returned object is a test-only internal (per `AGENTS.md`). Don't use it in application code.

---

## 22. Date formatting & counter: `formatDate` / `Counter`

**Replace:** hand-rolled `getFullYear()`/`padStart` date-token formatting.

```ts
formatDate("YYYY-MM-DD", date)               // '2023-04-15'
formatDate("YY-MM-DD hh:mm:ss A", date)      // '23-04-15 02:30:45 PM'
formatDate("dddd", date)                     // 'Saturday'
```

`formatDate(schema: string, date = new Date()): string`. Tokens: `YY` `YYYY`, `M` `MM` `MMM` `MMMM`, `D` `DD`, `d` `dd` `ddd` `dddd` (weekday name), `H` `HH` (0–23), `h` `hh`, `m` `mm`, `s` `ss`, `SSS`, `Z` `ZZ`, `A` `a`. Uses **local-time** getters; unrecognized characters pass through unchanged (there is no escaping, so a token inside literal text is still replaced).

Two gotchas: `Z`/`ZZ` are **hard-coded to `+08:00` / `+0800`** and are *not* the date's actual offset — never use them for real timezone output. And `h`/`hh` are `hour % 12`, so noon and midnight format as `0`/`00`, not `12`.

`Counter` is a tiny monotonic counter: `count` (public field, starts at 0) and `next(): number` which returns `this.count++` — i.e. it returns the value *before* incrementing.

---

## 23. Promise helpers: `safePromiseTry` / `safePromiseWithResolvers`

**Replace:** `Promise.try` / `Promise.withResolvers` with manual feature detection.

```ts
await safePromiseTry(() => JSON.parse(maybeJson))   // sync throw becomes a rejection
const { promise, resolve, reject } = safePromiseWithResolvers<number>()
```

`safePromiseTry(callbackFn, ...args)` resolves with the callback's value, converts a synchronous throw into a rejection, and mirrors a returned promise. `safePromiseWithResolvers<T>()` returns `{ promise, resolve, reject }`. Both prefer the native `Promise.try` / `Promise.withResolvers` and fall back to a local polyfill, so they are safe on older runtimes.

---

## 24. `childrenLoop`

**Replace:** `React.Children.forEach` when you need to **stop early**.

```ts
childrenLoop(children, (child, index) => {
  if (isMatch(child)) return false   // break
})
```

`childrenLoop(children: ReactNode | undefined, callback: (child, index) => boolean | void): void`. Returning `false` stops iteration. Unlike `React.Children.forEach`, `null`, booleans, strings and numbers **are** passed to the callback, and only top-level arrays are iterated (nested arrays arrive as opaque values). It is an iteration helper, not a renderer — it does not add keys or flatten.

---

## 25. Focusability queries

**Replace:** hand-written `tabindex`/visibility checks and ad-hoc tabbable-element scans (e.g. when building your own dialog or roving-tabindex list).

| Export | Signature | Notes |
|---|---|---|
| `isFocusable` | `(node: Element, options?: FocusableOptions) => boolean` | can receive programmatic focus; **includes** `tabindex="-1"` |
| `isTabbable` | `(node: Element, options?: FocusableOptions) => boolean` | reachable by Tab; excludes `tabindex < 0` and non-checked radios in a same-name group |
| `getFocusableElements` | `(container: Element, options?) => HTMLElement[]` | document order, shadow-DOM aware |
| `getTabbableElements` | `(container: Element, options?) => HTMLElement[]` | **sorted by tab order** (positive `tabindex` ascending, then `0` in document order) |
| `getTabIndex` | `(node: Element) => number` | effective value including browser defaults |

`FocusableOptions = { includeContainer?: boolean (false), getShadowRoot?: boolean | ((el) => ShadowRoot | boolean | undefined) (true), displayCheck?: "full" | "full-native" | "legacy-full" | "non-zero-area" | "none" ("full") }`.

**SSR asymmetry:** `isFocusable`/`isTabbable` return `false` when there is no DOM, but `getFocusableElements`/`getTabbableElements` throw a `ReferenceError` if called during SSR — only call the collection helpers from effects or event handlers. Closed shadow roots are not traversable.

---

## 26. Breakpoints & responsive types

```ts
breakpoints            // ['base','xs','sm','md','lg','xl','2xl','3xl'] (ascending)
DefBreakpointDesc      // { xs: 475, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536, '3xl': 1920 }
type Responsive<T> = T | Partial<Record<BreakpointName, T>>
```

**Replace:** hard-coded pixel thresholds scattered through a component. Use `Responsive<T>` for per-breakpoint value maps and `useScreen()` ([§19](#19-responsive-breakpoints-usescreen)) to pick the active key; `useScreen` does not consume `Responsive<T>` itself.

---

## 27. Long-task splitting: `yieldToMain` / `forEachChunked` / `forEachInFrames`

**Replace:** a long synchronous loop over a large array that freezes input and paint.

| Export | Signature | Notes |
|---|---|---|
| `yieldToMain` | `(signal?: AbortSignal) => Promise<void>` | resolve in a fresh macrotask (`MessageChannel`, then `scheduler.yield`, then `setTimeout`) |
| `forEachChunked` | `<T>(items: Iterable<T>, fn: (item: T, index: number) => void \| Promise<void>, options?: { chunkSize?: number; signal?: AbortSignal }) => Promise<void>` | `chunkSize` default `20`, must be a positive integer or it rejects with `RangeError` |
| `forEachInFrames` | same shape with `options?: { budgetMs?: number; clockSampleEvery?: number; signal?: AbortSignal }` | `budgetMs` default `5`; work stops at the frame budget and resumes on the next `requestAnimationFrame` |

```ts
await forEachChunked(chats, (chat) => appendChatNode(chat))            // keep input responsive
await forEachInFrames(particles, (p) => p.applyForces(), { budgetMs: 5 }) // stay in the render rhythm
```

Async `fn` is awaited (at most one async item per frame for `forEachInFrames`). Aborting rejects the returned promise; work already done is not rolled back. `forEachInFrames` requires `requestAnimationFrame` (browser-only, not SSR-safe). `yieldToMain` only returns control — it does not cancel running work.

---

## 28. Debounce, throttle & rAF scheduling

**Replace:** bespoke timer bookkeeping for high-frequency events, and manual `requestAnimationFrame` coalescing.

| Export | Signature | Notes |
|---|---|---|
| `debounce` | `<F>(fn: F, wait = 200) => DebouncedFunction<F>` | `{ cancel(), flush() }`; runs after `wait` ms of quiet |
| `throttle` | `<F>(fn: F, wait = 200) => ThrottledFunction<F>` | `{ cancel() }`; leading edge fires immediately, plus a trailing call |
| `rafSchedule` | `<F>(fn: F) => RafScheduledFunction<F>` | `{ cancel() }`; at most one call per animation frame, latest args win — **no `flush()`** (rAF cannot be forced synchronously) |
| `appendBatch` | `(parent: Element, children: (Node \| string)[]) => Element` | appends many nodes/strings in one `DocumentFragment` insert |
| `runLayoutBatch` | `<T, R>(read: () => T, write: (measured: T) => R) => R` | runs all reads, then the write, to avoid layout thrashing |

```ts
const onScroll = throttle(() => updateReadingPosition(), 100)
const renderBoard = rafSchedule(() => board.draw())
appendBatch(tbody, rows.map((row) => renderRow(row)))
runLayoutBatch(() => els.map((el) => el.offsetWidth), (widths) => els.forEach((el, i) => (el.style.width = `${widths[i]! + 10}px`)))
```

In every case the original function's return value is discarded. `debounce`/`throttle` clear both the pending timer and the stored arguments on `cancel()` (`debounce` also has `flush()`); `rafSchedule` and `appendBatch` are browser-only.

---

## 29. Queues: `Queue` / `createPriorityQueue`

**Replace:** array `shift()` on deep queues (O(n²)) and ad-hoc "urgent work first" micro-schedulers.

```ts
class Queue<T> {
  get length(): number
  push(item: T): void
  pushFront(item: T): void
  pop(): T | undefined
  remove(predicate: (item: T) => boolean): T | undefined
  clear(): void
  toArray(): T[]
}
```

Amortized O(1) `push`/`pushFront`/`pop`; `pushFront` is a stack-like line-cut (the most recently front-pushed item pops first). `remove`/`toArray` are O(n) and `remove` returns the frontmost match only.

```ts
const queue = createPriorityQueue<string>({ onError: (err, job) => report(err) })
files.forEach((file) => queue.post({ tag: file.id, run: () => createPreview(file) }))
queue.promote(clickedId)   // jump this job to the front
```

`createPriorityQueue({ onError? }): PriorityQueue` → `{ post(job, urgent?), promote(tag), clear(), size }`. Drains **one job per macrotask** (`MessageChannel`), so posting is async and returns immediately. `urgent` jobs go to the front (LIFO among urgent). `promote(tag)` is an O(n) scan meant for occasional use. Job errors are contained — reported through `onError`, or `console.error` when omitted — and never block the queue. There is no `dispose()`; `clear()` only drops queued jobs. `MessageChannel` is required, so this is browser/worker-only.

---

## 30. Backpressure: `createDroppingQueue` / `createLatestValue`

**Replace:** an unbounded buffer between a fast producer and a slow consumer, which otherwise grows without limit.

| Export | Signature | Strategy |
|---|---|---|
| `createDroppingQueue<T>(capacity = 100)` | `{ push(item): boolean, shift(), items(), drainAll(), size }` | **drop oldest** when full — for flow-past data (live logs, chat) |
| `createLatestValue<T>()` | `{ set(value), take(), peek(), pending }` | **latest wins** — intermediate values collapse; for tickers, rankings, drafts |

```ts
const logs = createDroppingQueue<string>(200)
socket.on("log", (line) => logs.push(line))
setInterval(() => { for (const line of logs.drainAll()) appendLogLine(line) }, 500)

const board = createLatestValue<Ranking>()
socket.on("ranking", (r) => board.set(r))
const next = board.take()   // undefined if nothing new
```

`push` returns whether the item was kept (only `false` when capacity ≤ 0 — capacity is not validated). `drainAll()` hands over the internal buffer in O(1) and resets the queue. `take()` clears the pending flag, `peek()` does not; a stored `undefined` is indistinguishable from "empty" except via `pending`. Neither needs disposal.

---

## 31. Memoization: `memoize`

**Replace:** a hand-rolled `Map` cache around an expensive pure function.

```ts
const parseConfig = memoize((raw: string) => expensiveParse(raw))
const query = memoize(
  (userId: string, scope: string) => buildQuery(userId, scope),
  (userId, scope) => `${userId}:${scope}`,
)
```

`memoize(fn, keyFn?)` returns a callable with `clear()` and a read-only `stats: { hits, misses }` (a fresh copy per access).

**Default key derivation matters:** with 0 or 1 argument the single argument is the key (Map `SameValueZero`, so object identity is required); with 2 or more arguments the key is `JSON.stringify(args)` — non-serializable arguments (`Map`, `Set`, functions, circular refs) collide or throw. Supply `keyFn` when only part of the arguments matter or when they are not JSON-safe. The cache is **unbounded** and holds strong references — call `clear()` to release. Errors are not cached, so a throw is retried on the next call.

---

## 32. Off-main-thread work: `WorkerPool` / `runInWorkerWithPool`

**Replace:** a hand-written `new Worker(...)` + message-id bookkeeping for CPU-heavy pure functions (parsing, image/math work) that would jank the main thread.

```ts
// One-liner: a lazily-created, process-wide pool (2 workers)
const thumbs = await Promise.all(
  images.map((img) => runInWorkerWithPool(makeThumbnail, img, { transfer: [img.buffer] })),
)

// Or own the lifetime
const pool = new WorkerPool({ maxWorkers: 2 })
const totals = await Promise.all(chunks.map((c) => pool.run(sum, c)))
pool.dispose()
```

- `new WorkerPool({ maxWorkers = 2 })` — throws `RangeError` if `maxWorkers` is not a positive integer. Getters: `size`, `maxWorkers`, `pending`, `busy`, `stolen`, `disposed`. `run(fn, arg, options)` returns a promise; `dispose()` terminates workers, revokes the script URL and rejects in-flight/queued jobs (idempotent).
- Shared pool: `getWorkerPool()`, `disposeWorkerPool()`, `runInWorkerWithPool(fn, arg, options)`. The instance lives on `globalThis` under `workerPoolSymbol` (`Symbol.for('@wwog/react/workerPool')`), so duplicate copies of the library share it. Call `disposeWorkerPool()` on teardown tests, otherwise workers stay alive.
- `WorkerRunOptions = { transfer?: Transferable[], resultTransfer?: string[] }` — `transfer` moves buffers in zero-copy (the main thread loses them); `resultTransfer` is a list of dot-separated paths in the result to move back out (`"buf"`, `"meta.bytes"`, `"."` for the whole result).
- Failures reject with `WorkerError` (`{ message, raw }`), covering both spawn/script errors and throws inside the job.

**Hard constraints — these are the reason to not use it casually:**
- `fn` is serialized with `toString()` and rebuilt with `new Function` inside the worker. It must be **self-contained** (no closures over outer variables) and may only use worker-scope APIs — no DOM.
- The argument and result must be structured-cloneable (or explicitly transferred).
- Requires CSP allowances for `worker-src blob:` and `unsafe-eval`.
- Browser/worker only. Jobs are **not** serialized per function: two calls can run in parallel on different workers, so `await` when order matters.
- Low-level plumbing (`createWorkerScript`, `readWorkerReply`, `postTransferable`) is exported for hand-written workers speaking the same protocol; `postTransferable` resolves with the worker's *next* message and has no timeout or cancellation.

---

## 33. FLIP animation: `flipAnimate`

**Replace:** animating `top`/`left` (or manually measuring rects before and after a DOM reorder) for list reordering, prepend, and remove-with-collapse.

```ts
flipAnimate(el, () => { list.prepend(el) })                 // the one and only layout change
flipAnimate(el, () => list.prepend(el), { duration: 200, easing: "linear" })
```

`flipAnimate(element: Element, layoutChange: () => void, options?: { duration?: number (300); easing?: string ('ease-in-out'); scale?: boolean (false) }): Animation` measures, runs `layoutChange()` exactly once, measures again, and plays the inverted transform back to `none`. `scale: true` also animates size changes via `transform: scale`.

Caveats: requires the Web Animations API and a live element; `layoutChange` must be **synchronous** and must be the **only** layout change (measuring elsewhere after the call can observe the inverted transform); the returned `Animation` is yours to control (`finished`, `cancel()`); `scale` divides by the final size, so a zero-size result yields a degenerate transform.

---

## 34. Weekday math: `weekday` / `weekdayJulian`

**Replace:** `new Date(y, m, d).getDay()` when you need timezone-independent, allocation-free weekday math, or dates outside the reliable `Date` range.

```ts
weekday(2023, 4, 15)        // 6 → Saturday   (Gregorian; 0 = Sunday)
weekdayJulian(1582, 10, 15) // 5 → Thursday   (Julian;    0 = Saturday)
```

Zeller's congruence (Michael Keith & Tom Craver integer form) for `(y, m, d)` with 4-digit year and 1–12 month. No validation — out-of-range inputs silently return a value mod 7.

**The two functions use different return conventions** (`weekday`: 0 = Sunday; `weekdayJulian`: 0 = Saturday) — do not mix them up. For an ordinary modern date, `new Date().getDay()` is equivalent to `weekday`; reach for these when you need timezone/locale independence, no allocation, or Julian/historical dates.

---

## 35. Events and lifetime: `Emitter` / `Event`

**Replace:** a hand-rolled `Set<callback>` notifier, `EventTarget` + `addEventListener` bookkeeping, and the `useEffect` cleanup that nobody remembers to write.

```ts
class Document {
  private readonly _onDidChange = new Emitter<string>()
  readonly onDidChange = this._onDidChange.event   // 对外只读:只有内部能 fire
  edit(text: string) { this._onDidChange.fire(text) }
}

const doc = new Document()
const sub = doc.onDidChange(render)   // 订阅 = 调用事件本身
sub.dispose()                         // 退订 = 释放返回的句柄
```

**Reach for it when something *happened* and several places may care** — a save finished, a socket message arrived, a shortcut was pressed. Do **not** use it as a store: an `Event` has no current value, so a subscriber that arrives late has missed everything before it.

| Situation | Reach for |
|---|---|
| Announce what just happened (replaying it later would be meaningless) | `Emitter` + `Event` |
| Also need the current value, readable before the first change | `ValueWithChangeEvent` (`const(v)` when it never changes) |
| Shared app state with per-field subscriptions, maybe persisted | `createExternalState` / `createStorageState` |
| High-frequency source that should be handled at some rhythm | `Event.debounce` (wait for silence) · `Event.throttle` (steady pace) · `Event.accumulate` (keep every one) |
| Several sources — or a source that gets replaced at runtime | `Event.any` · `DynamicListEventMultiplexer` · `Relay` |
| Wait for one event, or for every participant to finish before the next | `Event.toPromise` · `AsyncEmitter.fireAsync` |
| Own the lifetime of a batch of subscriptions | `DisposableStore` · `DisposableMap` |
| Only care that a value really changed (not every identical fire) | `Event.latch` |

An `Event<T>` **is a function**: `event(listener, thisArgs?, disposables?)` subscribes and returns a `CompatDisposable`. This is a full port of VS Code's `event.ts`, so the semantics are the same ones that hold up under load: a single listener is stored bare and only becomes an array at the second subscriber, removals leave holes that are compacted lazily, and `fire()` goes through a delivery queue — which is why re-entrant `fire()` delivers in order and why unsubscribing during delivery does not skip the listeners behind it.

| Piece | API |
|---|---|
| fire / subscribe | `new Emitter<T>()` → `.fire(v)`, `.event`, `.hasListeners()`, `.dispose()`; options: `onWillAddFirstListener`, `onDidAddFirstListener`, `onDidAddListener`, `onWillRemoveListener`, `onDidRemoveLastListener`, `onListenerError`, `leakWarningThreshold`, `leakWarningName`, `deliveryQueue`, `_profName` |
| derive | `Event.map` · `filter` · `forEach` · `reduce` · `latch` · `once` · `onceIf` · `any` · `split` · `chain(event, $ => $…)` · `signal` · `None` |
| timing | `Event.defer` · `debounce(event, merge, delay, leading?, flushOnListenerRemove?)` · `throttle` · `accumulate`; `delay` may be `MicrotaskDelay` to coalesce on the next microtask instead of a timer |
| bridging | `Event.toPromise` · `forward` · `runAndSubscribe` · `fromDOMEventEmitter` · `fromNodeEventEmitter` · `fromObservable` / `fromObservableLight` |
| buffering | `Event.buffer(source, debugName, flushAfterTimeout?)` — buffers until the first listener, then replays |
| emitters | `PauseableEmitter` (counted pause/resume, optional `merge`) · `DebounceEmitter` · `MicrotaskEmitter` · `AsyncEmitter.fireAsync(data, token, promiseJoin?)` with `IWaitUntil.waitUntil(p)` · `EventMultiplexer` · `DynamicListEventMultiplexer` · `EventBufferer` · `Relay` (re-pluggable `input`) |
| value + change | `ValueWithChangeEvent<T>` (write a *different* value to notify; `ValueWithChangeEvent.const(v)` is free) · `trackSetChanges(getData, onDidChangeData, handleItem)` |
| lifetime | `DisposableStore` · `DisposableMap<K, V>` · `toDisposable(fn)` · `combinedDisposable(...)` · `noopDisposable` · `isDisposable` · `disposeAll` · `withDisposeSymbol(MyClass.prototype)` (makes your own class answer `Symbol.dispose` with its `dispose()`) |

```ts
// React: build the subscription inside the effect, release it in the cleanup
useEffect(() => {
  const sub = emitter.event(handler)
  return () => sub.dispose()
}, [emitter])

// several subscriptions sharing one lifetime — create the store *inside* the effect
useEffect(() => {
  const store = new DisposableStore()
  store.add(emitter.event(onA))
  store.add(Event.any(emitter.event, other.event)(onAny))
  return () => store.dispose()
}, [emitter, other])

// per-key ownership
const perItem = new DisposableMap<string, CompatDisposable>()
perItem.set(key, source(key).event(handler))
perItem.deleteAndDispose(key)   // releases exactly that one
```

**Lifetime protocol:** disposal is a plain `dispose()` (the shape VS Code/RxJS/monaco use) and every object additionally answers the real `Symbol.dispose` where the runtime has it (Chrome 125+, Safari 18.4+, Firefox 134+, Node 20+), so `using sub = emitter.event(handler)` works. The symbol is deliberately **not** in the public type — naming the global `Disposable`/`Symbol.dispose` in a signature would break `tsc` for consumers whose `lib` stops before `esnext.disposable` (the repo's own example app runs `lib: ["ES2020", "DOM"]`).

**Cautions — these are the ones that bite:**

- **Events are hot.** A subscriber misses everything fired before it subscribed; `Event.buffer` is the one exception, and `ValueWithChangeEvent` / `createExternalState` are the answer when you need a readable current value.
- **A derived event exposed to third parties must be created with a `DisposableStore`** (`Event.map(src, fn, store)`). Otherwise a forgotten unsubscribe on the derived event leaks a listener on the source. Derivation is lazy — the source is not touched until the first listener arrives, and released when the last one leaves.
- **Union-typed events need explicit type arguments:** `Event.filter<number, string>(ev, (e): e is number => …)` and `Event.split<number, undefined>(ev, isNumber)`. Without them the type-guard overload cannot be inferred and the non-narrowing one silently wins. `Event.reduce` without `initial` likewise needs `Event.reduce<I, O>(…)`.
- **`EventBufferer.wrapEvent(ev, reduce, initial)`'s reduce form only works with one listener** — with more, the shared accumulator double-counts and only the first subscriber is notified (upstream behaviour, documented in the JSDoc). Use the non-reduce form or `Event.accumulate` when several subscribers listen.
- **`Event.toPromise(ev).cancel()` does not reject** — it detaches the listener and the promise never settles. Race it yourself when you need a timeout.
- **Leak warnings are opt-in:** pass `leakWarningThreshold` (or call `setGlobalLeakWarningThreshold(n)`, which returns a disposable that restores the previous value). Over the threshold it reports a `ListenerLeakError` per call site; far over it (`threshold²`) the emitter refuses new listeners with a `ListenerRefusalError`.
- **In React, the store must be created inside the effect.** `StrictMode` runs effects twice (mount → unmount → mount); a `DisposableStore` created in `useMemo`/`useRef` and disposed in the cleanup is already released on the second mount, so every later `store.add(subscription)` is dropped while the subscription itself stays live — the failure is silent. `new DisposableStore()` inside the effect, `return () => store.dispose()`.
- **`EmitterOptions.onListenerError` defaults to `console.error`, not to a rethrow** — a library must not turn a listener's exception into the host's global error. `AsyncEmitter.fireAsync` reports through the same default regardless of the option, matching the original.

**Deviations from the VS Code original** (everything else is ported as-is): disposal comes from this package instead of `lifecycle.ts`/`IDisposable`; `LinkedList`, `createSingleCallFunction` and `diffSets` are private implementations in the module and `StopWatch` became a `performance.now()` measurement; the default listener-error handling is `console.error`; the dev-only switches key off `process.env.NODE_ENV` instead of `env.VSCODE_DEV` (so bundlers strip them); and `fromObservable` accepts a minimal structural observable (`get`, `reportChanges`, `addObserver`, `removeObserver`) rather than the whole operator set.

---

## 36. Events in React: `useEvent` / `useEventValue` / `useEventCallback`

**Replace:** the hand-written `useEffect(() => { const s = src.on(handler); return () => s() }, [])`, the `useCallback` whose dependency list exists only to keep a reference stable, and the `useState` + subscribe pair repeated for every "last error / progress / last message" you want to render.

| You want | Use |
|---|---|
| The component follows an external event (socket, keyboard, a DOM listener, an external store) | `useEvent(event, handler)` |
| The last payload of an event, rendered (progress, last error, last message) | `useEventValue(event, initial)` |
| A callback that stays referentially stable but reads the latest props/state | `useEventCallback(fn)` |
| Shared/persisted state rather than "something happened" | `createExternalState` + `useSelector` (not these hooks) |
| Every payload buffered while nobody listened | `Event.buffer` before `useEvent` |

```tsx
import { useEvent, useEventValue, useEventCallback, Emitter } from "@wwog/react"

function Chat({ filter }: { filter: string }) {
  const [messages, setMessages] = useState<string[]>([])
  // subscribes on mount, unsubscribes on unmount, always calls the latest closure
  useEvent(socket.onMessage, (message) => {
    if (matches(message, filter)) setMessages((all) => [...all, message])
  })
  return <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
}

function Upload() {
  const percent = useEventValue(uploader.onProgress, 0)   // 0 until the first fire
  return <progress value={percent} max={100} />
}

// one reference for the whole lifetime, latest `draft` when called
const save = useEventCallback(() => persist(draft))
const saveDebounced = useMemo(() => debounce(save, 300), [save])
```

**What the hooks guarantee, and what they leave to you:**

- **No resubscription on re-render** — the listener is forwarded through a ref and the subscription depends on the event identity alone. Fires are never missed *because of a re-render*; the handler simply sees the newest props.
- **A subscription belongs to the effect**, so `StrictMode` (mount → unmount → mount) is safe. Never own the store yourself (`useMemo`/`useRef` + `dispose` in a cleanup) — the second mount gets an already-released store and the subscription silently stops working.
- **The event must be a stable reference.** `emitter.event` is cached and safe inline; `Event.map(ev, fn)` returns a new event per call, so memoize the derived event (`useMemo(() => Event.map(...), [source])`) or bind it to a `DisposableStore` — otherwise every render swaps the source and resubscribes.
- **No `useSyncExternalStore`, no returned subscription handle.** There is no shared snapshot to tear from (`useEventValue` caches the last payload per component), and a handle would be a fresh object each render. Manage subscriptions outside the render phase with a `DisposableStore` instead.
- **Conditional subscription:** `useEvent(enabled ? event : Event.None, handler)`. No extra parameter, and `Event.None` is a stable singleton.
- **`useEventValue` follows React's `Object.is` bailout** — firing twice with the same reference re-renders once. When every fire must count, count in the event (`Event.map(ev, () => n++)`); when only real changes matter, `Event.latch` it first. A function payload and a function `initial` are both handled (neither is mistaken for an updater / lazy initializer).
- **Fires between render and the effect are lost**, because events are hot. Buffer with `Event.buffer`, or reach for `ValueWithChangeEvent` / `createExternalState` when a current value must be readable at any time.
- `useEventCallback` mirrors React 19's `useEffectEvent` in intent but may be called anywhere (handlers, effects, promise callbacks) and passed down to children — it just does not have `useEffectEvent`'s "effects only" guardrail.

---

## Decision guide — when NOT to use these

- One tiny inline `cond && <X/>` that stays readable → plain `&&` is fine; don't force `<True>`.
- Performance-critical hot paths with stable identity needs — measure first; most of these components add a thin wrapper, usually negligible but worth verifying.
- **`<FrameRender>` is not a general optimization** — only wrap stateless, expensive children. Never use it around controlled inputs, validation messages, or loading states, because the element form can render stale props for up to one frame window.
- **`WorkerPool` is not for I/O or tiny jobs.** Serialization plus worker startup dwarfs the work; use it for CPU-bound, self-contained, structured-cloneable functions.
- `memoize`, `createExternalState`, and the queues are module-lifetime objects: don't create them inside a render, and clear/dispose them (unbounded caches and live workers are real leaks).
- **Reach for `useEvent` before writing `useEffect` + `on()` + cleanup**, and for `useEventCallback` before writing a `useCallback` whose only purpose is a stable identity. Do not wrap state that must be readable at any time in an event just to move it through these hooks.
- **An `Emitter` is not a store.** Don't use it to hold state that components read at render time — use `createExternalState`/`ValueWithChangeEvent` for that. Reach for events for things that *happen* (a save finished, a keystroke, a socket message), and always pair a subscription with a lifetime (`useEffect` cleanup or a `DisposableStore`).
- Don't reach for `Event.multiplexer`/`AsyncEmitter`/leak thresholds by default: plain `new Emitter()` + `Event.map/filter` covers most cases. `AsyncEmitter.fireAsync` is for "every participant must finish before the next one starts" (save-participant style) and is not a general broadcast.
- If `@wwog/react` is **not** in `package.json` → do not suggest installing it; skip this skill entirely.

## Style notes

- Match the surrounding file's existing imports and formatting.
- Import from the package root (`@wwog/react`), not from `src/...` deep paths — the internal module layout is not part of the public API.
- Keep `key` props on list items; with `<ArrayRender>` remember that indices are **not** compacted when there is no `sort`.
- Don't mix `<If>` and raw ternaries for the same decision in one file — pick one.
- Memoize any callback passed to `<Observer>` (`onIntersect`) and any inline transform array passed to `<Pipe>`.
- Prefer the render-prop forms (`<Scope>`, `<Toggle>`, `<DateRender>`, `<Repeat>`) over computing the same values in an outer `useMemo` just to feed JSX.
