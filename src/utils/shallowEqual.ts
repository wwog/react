/**
 * @zh 浅比较：先比引用，再对「数组 / 普通对象」的每个自有可枚举键做一次 `Object.is`。
 *
 * 主要用于 `useSelector` 的相等性判断：当 selector 需要合成一个新对象
 * （`s => ({name: s.name, age: s.age})`）时，每次调用都会得到新引用，默认的 `Object.is`
 * 永远判定为「变了」，于是任何无关字段变化都会重渲染。传入 `shallowEqual` 才能让
 * 「内容相同」被判为相等，从而跳过重渲染。
 *
 * 注意：只有普通对象与数组参与逐键比较。`Date` / `Map` / `Set` / `RegExp` / 类实例的自有
 * 可枚举键都是空的，逐键比较会把内容不同的两个对象误判为相等（`new Date(0)` 与
 * `new Date(1)` 会「相等」），订阅者因此漏掉更新。这些类型一律退化为引用比较——宁可多渲染
 * 一次，不可少渲染一次。
 * @en Shallow equality: reference equality first, then one `Object.is` pass over the own
 * enumerable keys of arrays and plain objects.
 *
 * This exists mainly for `useSelector`: a selector that composes a new object
 * (`s => ({name: s.name, age: s.age})`) returns a fresh reference every call, so the default
 * `Object.is` always reports "changed" and every unrelated field update re-renders. Passing
 * `shallowEqual` lets equal-by-content selections count as equal and skip the re-render.
 *
 * Only arrays and plain objects are compared key-wise. `Date` / `Map` / `Set` / `RegExp` and
 * class instances have no own enumerable keys, so a key-wise pass would call two objects with
 * different contents equal (`new Date(0)` and `new Date(1)` would "match") and subscribers
 * would miss updates. Those types fall back to reference equality: an extra render is
 * recoverable, a missed one is not.
 *
 * @example
 * ```tsx
 * // 合成对象必须给相等函数，否则无关字段变化也会重渲染
 * const head = appState.useSelector((s) => ({name: s.name, age: s.age}), shallowEqual)
 * ```
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let index = 0; index < a.length; index++) {
      if (!Object.is(a[index], b[index])) return false
    }
    return true
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false

  const recordA = a as Record<string, unknown>
  const recordB = b as Record<string, unknown>
  const keysA = Object.keys(recordA)
  if (keysA.length !== Object.keys(recordB).length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(recordB, key)) return false
    if (!Object.is(recordA[key], recordB[key])) return false
  }
  return true
}

/**
 * @zh 仅接受对象字面量与 `Object.create(null)`，其它原型（Date、Map、类实例…）一律不算普通对象。
 * @en Accepts only object literals and `Object.create(null)`; any other prototype (Date, Map,
 * class instances, ...) is not a plain object.
 */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
