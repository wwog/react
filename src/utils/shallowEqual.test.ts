import {describe, expect, it} from 'vitest'
import {shallowEqual} from './shallowEqual'

describe('shallowEqual', () => {
  it('应该对相同引用返回 true', () => {
    const obj = {a: 1}
    const arr = [1, 2]
    const fn = () => undefined
    expect(shallowEqual(obj, obj)).toBe(true)
    expect(shallowEqual(arr, arr)).toBe(true)
    expect(shallowEqual(fn, fn)).toBe(true)
  })

  it('应该按 Object.is 比较原始值', () => {
    expect(shallowEqual(1, 1)).toBe(true)
    expect(shallowEqual(1, 2)).toBe(false)
    expect(shallowEqual('a', 'a')).toBe(true)
    expect(shallowEqual(Number.NaN, Number.NaN)).toBe(true)
    // Object.is 语义：-0 与 0 不相等，与 useSyncExternalStore 的判定保持一致
    expect(shallowEqual(-0, 0)).toBe(false)
    expect(shallowEqual(null, undefined)).toBe(false)
    expect(shallowEqual(null, null)).toBe(true)
  })

  it('应该逐项比较数组', () => {
    expect(shallowEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(shallowEqual([1, 2, 3], [1, 2])).toBe(false)
    expect(shallowEqual([1, 2], [2, 1])).toBe(false)
    expect(shallowEqual([], [])).toBe(true)
  })

  it('嵌套值只比较一层引用', () => {
    const nested = {x: 1}
    expect(shallowEqual({a: nested}, {a: nested})).toBe(true)
    expect(shallowEqual({a: {x: 1}}, {a: {x: 1}})).toBe(false)
    expect(shallowEqual([[1]], [[1]])).toBe(false)
  })

  it('应该逐键比较普通对象', () => {
    expect(shallowEqual({a: 1, b: 2}, {a: 1, b: 2})).toBe(true)
    expect(shallowEqual({a: 1, b: 2}, {a: 1, b: 3})).toBe(false)
    expect(shallowEqual({a: 1}, {a: 1, b: 2})).toBe(false)
    expect(shallowEqual({a: 1, b: 2}, {a: 1, c: 2})).toBe(false)
    expect(shallowEqual({}, {})).toBe(true)
    // 键顺序不影响结果
    expect(shallowEqual({a: 1, b: 2}, {b: 2, a: 1})).toBe(true)
  })

  it('原型不同的对象不参与逐键比较', () => {
    // null 原型按普通对象处理（自有可枚举键为空，与 {} 相等）
    expect(shallowEqual(Object.create(null), {})).toBe(true)
    expect(shallowEqual(Object.create({a: 1}), Object.create({a: 1}))).toBe(false)
  })

  it('Date 与 Map 等非普通对象退化为引用比较', () => {
    // 这些类型的自有可枚举键都是空的，逐键比较会把内容不同的两个对象误判为相等
    expect(shallowEqual(new Date(0), new Date(1))).toBe(false)
    expect(shallowEqual(new Map([['a', 1]]), new Map([['b', 2]]))).toBe(false)
    expect(shallowEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(shallowEqual(/a/, /b/)).toBe(false)
    const sameDate = new Date(0)
    expect(shallowEqual(sameDate, sameDate)).toBe(true)
  })

  it('类实例只在引用相同时相等', () => {
    class Point {
      constructor(public x: number) {}
    }
    const point = new Point(1)
    expect(shallowEqual(point, point)).toBe(true)
    expect(shallowEqual(new Point(1), new Point(1))).toBe(false)
  })

  it('数组与对象交叉比较返回 false', () => {
    expect(shallowEqual([1], {0: 1})).toBe(false)
    expect(shallowEqual({length: 1}, [1])).toBe(false)
  })

  it('类型不同时返回 false', () => {
    expect(shallowEqual(1, {a: 1})).toBe(false)
    expect(shallowEqual({a: 1}, 'a')).toBe(false)
    expect(shallowEqual(undefined, {})).toBe(false)
  })

  it('作为 useSelector 的相等函数时能识别内容相同的合成对象', () => {
    const pickHead = (state: {name: string; age: number; theme: string}) => ({
      name: state.name,
      age: state.age,
    })
    const prevState = {name: 'a', age: 1, theme: 'light'}
    const nextState = {name: 'a', age: 1, theme: 'dark'}
    // 无关字段变化：selector 产出的是新对象，但内容相同
    expect(pickHead(prevState)).not.toBe(pickHead(nextState))
    expect(shallowEqual(pickHead(prevState), pickHead(nextState))).toBe(true)
    // 相关字段变化：内容不同
    expect(shallowEqual(pickHead(prevState), pickHead({...prevState, age: 2}))).toBe(false)
  })
})
