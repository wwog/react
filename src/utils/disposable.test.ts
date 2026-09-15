import {describe, expect, it, vi} from 'vitest'
import {
  type CompatDisposable,
  DisposableMap,
  DisposableStore,
  combinedDisposable,
  disposeAll,
  isDisposable,
  noopDisposable,
  toDisposable,
} from './disposable'

/** 运行时的 `Symbol.dispose`（老环境没有，用它来决定是否断言符号互操作）。 */
const disposeSymbol: symbol | undefined = (Symbol as {dispose?: symbol}).dispose

describe('toDisposable', () => {
  it('应只执行一次清理函数', () => {
    const fn = vi.fn()
    const disposable = toDisposable(fn)

    disposable.dispose()
    disposable.dispose()
    disposable.dispose()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('combinedDisposable 应释放全部子对象', () => {
    const a = vi.fn()
    const b = vi.fn()
    const combined = combinedDisposable(toDisposable(a), toDisposable(b))

    combined.dispose()

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('noopDisposable', () => {
  it('释放时什么也不做，且是冻结的单例', () => {
    expect(() => noopDisposable.dispose()).not.toThrow()
    expect(Object.isFrozen(noopDisposable)).toBe(true)
  })
})

describe('isDisposable', () => {
  it('应识别带 dispose() 的对象，并排除其它形状', () => {
    expect(isDisposable(toDisposable(() => {}))).toBe(true)
    expect(isDisposable({dispose: () => {}})).toBe(true)
    // 形参个数不为 0 的同名方法不算（与 vscode 一致）
    expect(isDisposable({dispose: (arg: unknown) => arg})).toBe(false)
    expect(isDisposable(null)).toBe(false)
    expect(isDisposable(undefined)).toBe(false)
    expect(isDisposable('dispose')).toBe(false)
    expect(isDisposable({})).toBe(false)
  })
})

describe('disposeAll', () => {
  it('应释放每一项', () => {
    const calls: number[] = []
    disposeAll([toDisposable(() => calls.push(1)), toDisposable(() => calls.push(2))])
    expect(calls).toEqual([1, 2])
  })

  it('一个对象抛错不应阻止其余对象被释放', () => {
    const calls: number[] = []
    const broken: CompatDisposable = {
      dispose() {
        throw new Error('boom')
      },
    }

    expect(() =>
      disposeAll([broken, toDisposable(() => calls.push(2)), toDisposable(() => calls.push(3))]),
    ).toThrow('boom')
    expect(calls).toEqual([2, 3])
  })

  it('多个对象抛错时应抛 AggregateError', () => {
    const broken = (message: string): CompatDisposable => ({
      dispose() {
        throw new Error(message)
      },
    })

    expect(() => disposeAll([broken('a'), broken('b')])).toThrow(AggregateError)
  })
})

describe('DisposableStore', () => {
  it('dispose 应释放全部并标记为已释放', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    store.add(toDisposable(fn))

    expect(store.isDisposed).toBe(false)
    store.dispose()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.isDisposed).toBe(true)
  })

  it('dispose 应幂等', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    store.add(toDisposable(fn))

    store.dispose()
    store.dispose()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('clear 应释放内容但保持 store 可用', () => {
    const store = new DisposableStore()
    const first = vi.fn()
    store.add(toDisposable(first))
    store.clear()

    expect(first).toHaveBeenCalledTimes(1)
    expect(store.isDisposed).toBe(false)

    const second = vi.fn()
    store.add(toDisposable(second))
    store.dispose()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('add 应返回传入对象以便链式书写', () => {
    const store = new DisposableStore()
    const disposable = toDisposable(() => {})
    expect(store.add(disposable)).toBe(disposable)
    store.dispose()
  })

  it('noopDisposable 不需要登记', () => {
    const store = new DisposableStore()
    expect(store.add(noopDisposable)).toBe(noopDisposable)
    store.dispose()
  })

  it('同一个对象重复添加只释放一次', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    const disposable = toDisposable(fn)

    store.add(disposable)
    store.add(disposable)
    store.dispose()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('不允许把自己登记到自己身上', () => {
    const store = new DisposableStore()
    expect(() => store.add(store as unknown as CompatDisposable)).toThrow(
      'Cannot register a disposable on itself!',
    )
  })

  it('已释放的 store 收到新对象时应告警（内容按 vscode 语义不代为释放）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const store = new DisposableStore()
      store.dispose()

      const fn = vi.fn()
      store.add(toDisposable(fn))

      expect(warn).toHaveBeenCalled()
      expect(fn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('DisposableStore.DISABLE_DISPOSED_WARNING 应能关掉上述告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    DisposableStore.DISABLE_DISPOSED_WARNING = true
    try {
      const store = new DisposableStore()
      store.dispose()
      store.add(toDisposable(() => {}))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      DisposableStore.DISABLE_DISPOSED_WARNING = false
      warn.mockRestore()
    }
  })

  it('delete 应移除并释放', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    const disposable = toDisposable(fn)

    store.add(disposable)
    store.delete(disposable)

    expect(fn).toHaveBeenCalledTimes(1)
    store.dispose()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('deleteAndLeak 应移除但不释放', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    const disposable = toDisposable(fn)

    store.add(disposable)
    store.deleteAndLeak(disposable)

    expect(fn).not.toHaveBeenCalled()
    store.dispose()
    expect(fn).not.toHaveBeenCalled()

    disposable.dispose()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('assertNotDisposed 应在已释放时走 console.error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const store = new DisposableStore()
      store.assertNotDisposed()
      expect(error).not.toHaveBeenCalled()

      store.dispose()
      store.assertNotDisposed()
      expect(error).toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })
})

describe('DisposableMap', () => {
  it('覆盖同一个 key 应释放旧值', () => {
    const map = new DisposableMap<string, CompatDisposable>()
    const first = vi.fn()
    const second = vi.fn()

    map.set('a', toDisposable(first))
    map.set('a', toDisposable(second))

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(map.size).toBe(1)

    map.dispose()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('skipDisposeOnOverwrite 应跳过释放', () => {
    const map = new DisposableMap<string, CompatDisposable>()
    const first = vi.fn()
    const value = toDisposable(first)

    map.set('a', value)
    map.set(
      'a',
      toDisposable(() => {}),
      true,
    )

    expect(first).not.toHaveBeenCalled()
    map.dispose()
  })

  it('deleteAndDispose / deleteAndLeak 的差异应体现在释放上', () => {
    const map = new DisposableMap<string, CompatDisposable>()
    const disposed = vi.fn()
    const leaked = vi.fn()

    map.set('disposed', toDisposable(disposed))
    map.set('leaked', toDisposable(leaked))

    map.deleteAndDispose('disposed')
    const leakedHandle = map.deleteAndLeak('leaked')

    expect(disposed).toHaveBeenCalledTimes(1)
    expect(leaked).not.toHaveBeenCalled()
    expect(map.size).toBe(0)

    leakedHandle?.dispose()
    expect(leaked).toHaveBeenCalledTimes(1)
  })

  it('clearAndDisposeAll 应清空但保持 map 可用', () => {
    const map = new DisposableMap<string, CompatDisposable>()
    const fn = vi.fn()
    map.set('a', toDisposable(fn))

    map.clearAndDisposeAll()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(map.size).toBe(0)

    const next = vi.fn()
    map.set('b', toDisposable(next))
    map.dispose()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('应支持 has / get / keys / values / 迭代', () => {
    const map = new DisposableMap<string, CompatDisposable>()
    const a = toDisposable(() => {})
    map.set('a', a)

    expect(map.has('a')).toBe(true)
    expect(map.get('a')).toBe(a)
    expect([...map.keys()]).toEqual(['a'])
    expect([...map.values()]).toEqual([a])
    expect([...map]).toEqual([['a', a]])

    map.dispose()
  })
})

describe('Symbol.dispose 互操作', () => {
  it.runIf(disposeSymbol)('DisposableStore 应响应 [Symbol.dispose]', () => {
    const store = new DisposableStore()
    const fn = vi.fn()
    store.add(toDisposable(fn))
    ;(store as unknown as Record<symbol, () => void>)[disposeSymbol!]()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.isDisposed).toBe(true)
  })

  it.runIf(disposeSymbol)('toDisposable / DisposableMap / noopDisposable 也应响应', () => {
    const fn = vi.fn()
    const disposable = toDisposable(fn)
    ;(disposable as unknown as Record<symbol, () => void>)[disposeSymbol!]()
    expect(fn).toHaveBeenCalledTimes(1)

    const mapFn = vi.fn()
    const map = new DisposableMap<string, CompatDisposable>()
    map.set('a', toDisposable(mapFn))
    ;(map as unknown as Record<symbol, () => void>)[disposeSymbol!]()
    expect(mapFn).toHaveBeenCalledTimes(1)

    expect(() =>
      (noopDisposable as unknown as Record<symbol, () => void>)[disposeSymbol!](),
    ).not.toThrow()
  })
})
