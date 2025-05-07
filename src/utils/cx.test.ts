import {describe, expect, it} from 'vitest'
import {cx} from './cx'

describe('cx', () => {
  it('应该正确合并字符串类名', () => {
    expect(cx('foo', 'bar')).toBe('foo bar')
    expect(cx('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  it('应该过滤掉 falsy 值', () => {
    expect(cx('foo', null, 'bar', undefined, false)).toBe('foo bar')
  })

  it('应该正确处理数组', () => {
    expect(cx(['foo', 'bar'])).toBe('foo bar')
    expect(cx('baz', ['foo', 'bar'])).toBe('baz foo bar')
  })

  it('应该正确处理对象', () => {
    expect(cx({foo: true, bar: false})).toBe('foo')
    expect(cx({foo: true, bar: true})).toBe('foo bar')
  })

  it('应该正确处理混合输入', () => {
    expect(cx('foo', ['bar', 'baz'], {qux: true, quux: false})).toBe('foo bar baz qux')
  })

  it('应该去除重复的类名', () => {
    expect(cx('foo', 'foo', 'bar')).toBe('foo bar')
    expect(cx('foo', ['foo', 'bar'])).toBe('foo bar')
    expect(cx('foo', {foo: true})).toBe('foo')
  })
})
