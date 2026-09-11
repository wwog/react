import {describe, expect, it, vi} from 'vitest'
import {memoize} from './memoize'

describe('memoize', () => {
  it('相同输入只应计算一次', () => {
    const fn = vi.fn((x: number) => x * 2)
    const memoized = memoize(fn)

    expect(memoized(2)).toBe(4)
    expect(memoized(2)).toBe(4)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('不同输入应分别计算', () => {
    const fn = vi.fn((x: number) => x * 2)
    const memoized = memoize(fn)

    memoized(1)
    memoized(2)
    memoized(1)

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('默认以第一个参数为键（SameValueZero 语义）', () => {
    const fn = vi.fn((_x: {id: string}) => 'result')
    const memoized = memoize(fn)

    // 引用相同 → 命中缓存
    const shared = {id: 'a'}
    memoized(shared)
    memoized(shared)
    expect(fn).toHaveBeenCalledTimes(1)

    // 引用不同 → 不命中（即使内容相等）
    memoized({id: 'a'})
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('keyFn 应支持多参数缓存键', () => {
    const fn = vi.fn((userId: string, scope: string) => `${userId}:${scope}`)
    const memoized = memoize(fn, (userId, scope) => `${userId}:${scope}`)

    memoized('u1', 's1')
    memoized('u1', 's1') // 命中
    memoized('u1', 's2') // 不同键
    memoized('u2', 's1') // 不同键

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('多参数默认键应包含所有参数（回归：曾只看第一个参数导致静默错值）', () => {
    const fn = vi.fn((a: number, b: number) => a + b)
    const memoized = memoize(fn)

    expect(memoized(1, 2)).toBe(3)
    expect(memoized(1, 3)).toBe(4) // 曾错误命中 (1, 2) 的缓存 → 返回 3
    expect(memoized(1, 2)).toBe(3) // 命中
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('多参数默认键应区分参数顺序', () => {
    const fn = vi.fn((a: string, b: string) => `${a}|${b}`)
    const memoized = memoize(fn)

    memoized('x', 'y')
    memoized('y', 'x')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('stats 应统计命中与未命中', () => {
    const memoized = memoize((x: number) => x)

    memoized(1) // miss
    memoized(1) // hit
    memoized(2) // miss

    expect(memoized.stats.hits).toBe(1)
    expect(memoized.stats.misses).toBe(2)
  })

  it('clear 后应重新计算', () => {
    const fn = vi.fn((x: number) => x)
    const memoized = memoize(fn)

    memoized(1)
    memoized(1)
    expect(fn).toHaveBeenCalledTimes(1)

    memoized.clear()
    memoized(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('缓存返回值应该是同一个引用（对象结果）', () => {
    const memoized = memoize((_key: string) => ({deep: {value: 1}}))

    const a = memoized('k')
    const b = memoized('k')
    expect(a).toBe(b)
  })

  it('应缓存 undefined 结果（单次查找哨兵逻辑回归）', () => {
    const fn = vi.fn((_x: number) => undefined as number | undefined)
    const memoized = memoize(fn)

    expect(memoized(1)).toBeUndefined()
    expect(memoized(1)).toBeUndefined()

    // 关键：第二次必须命中缓存，而不是把 undefined 当成未命中重算
    expect(fn).toHaveBeenCalledTimes(1)
    expect(memoized.stats.hits).toBe(1)
    expect(memoized.stats.misses).toBe(1)
  })
})
