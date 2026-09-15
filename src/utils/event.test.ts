import {afterEach, describe, expect, it, vi} from 'vitest'
import {type CompatDisposable, DisposableMap, DisposableStore, toDisposable} from './disposable'
import {
  AsyncEmitter,
  type CancellationToken,
  DebounceEmitter,
  DynamicListEventMultiplexer,
  Emitter,
  Event,
  EventBufferer,
  EventMultiplexer,
  EventProfiling,
  type IObservable,
  type IObserver,
  type IWaitUntil,
  ListenerLeakError,
  ListenerRefusalError,
  MicrotaskDelay,
  MicrotaskEmitter,
  PauseableEmitter,
  Relay,
  ValueWithChangeEvent,
  createEventDeliveryQueue,
  setGlobalLeakWarningThreshold,
  trackSetChanges,
} from './event'

/** 冲干净当前的微任务队列（含微任务里再排的微任务）。 */
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Emitter 基础', () => {
  it('fire 应投递给监听器，并支持 thisArgs', () => {
    const emitter = new Emitter<number>()
    const context = {
      total: 0,
      add(this: {total: number}, value: number) {
        this.total += value
      },
    }

    emitter.event(context.add, context)
    emitter.fire(1)
    emitter.fire(2)

    expect(context.total).toBe(3)
  })

  it('多个监听器应按注册顺序收到', () => {
    const emitter = new Emitter<string>()
    const calls: string[] = []

    emitter.event((e) => calls.push(`a:${e}`))
    emitter.event((e) => calls.push(`b:${e}`))
    emitter.fire('x')

    expect(calls).toEqual(['a:x', 'b:x'])
  })

  it('退订后不再收到事件', () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    const subscription = emitter.event((e) => seen.push(e))

    emitter.fire(1)
    subscription.dispose()
    emitter.fire(2)

    expect(seen).toEqual([1])
    expect(emitter.hasListeners()).toBe(false)
  })

  it('emitter.event 引用应稳定（可安全放进依赖数组）', () => {
    const emitter = new Emitter<void>()
    expect(emitter.event).toBe(emitter.event)
  })

  it('dispose 后订阅只能拿到 noopDisposable，fire 无副作用', () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    emitter.dispose()

    const subscription = emitter.event((e) => seen.push(e))
    expect(subscription).toBeDefined()

    emitter.fire(1)
    expect(seen).toEqual([])
    expect(emitter.hasListeners()).toBe(false)

    expect(() => emitter.dispose()).not.toThrow()
  })

  it('一个监听器抛错不应影响其余监听器', () => {
    const errors: unknown[] = []
    const emitter = new Emitter<number>({onListenerError: (e) => errors.push(e)})
    const seen: number[] = []

    emitter.event(() => {
      throw new Error('boom')
    })
    emitter.event((e) => seen.push(e))
    emitter.fire(1)

    expect(seen).toEqual([1])
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('boom')
  })

  it('未提供 onListenerError 时应走 console.error，且不吞掉其余监听器', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const emitter = new Emitter<number>()
    const seen: number[] = []

    emitter.event(() => {
      throw new Error('boom')
    })
    emitter.event((e) => seen.push(e))
    emitter.fire(1)

    expect(seen).toEqual([1])
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('监听器内部再次 fire 时，嵌套投递应先完成（投递队列语义）', () => {
    const emitter = new Emitter<number>()
    const calls: string[] = []

    emitter.event((e) => {
      calls.push(`a${e}`)
      if (e === 1) {
        emitter.fire(2)
      }
    })
    emitter.event((e) => calls.push(`b${e}`))

    emitter.fire(1)

    // 没有投递队列时 b1 会排到 a2 之后
    expect(calls).toEqual(['a1', 'b1', 'a2', 'b2'])
  })

  it('投递过程中退订「排在自己后面」的监听器，不应让后面的监听器被整体跳过', () => {
    const emitter = new Emitter<number>()
    const calls: string[] = []
    const subscriptions: CompatDisposable[] = []

    subscriptions.push(
      emitter.event(() => {
        calls.push('first')
        // 退掉后面的两个（模拟 React 卸载时的清理）
        subscriptions[1].dispose()
        subscriptions[2].dispose()
      }),
    )
    subscriptions.push(emitter.event(() => calls.push('second')))
    subscriptions.push(emitter.event(() => calls.push('third')))
    emitter.event(() => calls.push('fourth'))

    emitter.fire(1)

    // 退订立刻生效（本轮就收不到），但排在它们后面的第四个不能被跳掉——这正是投递队列
    // 会随压缩一起调整 end/i 的原因。
    expect(calls).toEqual(['first', 'fourth'])

    calls.length = 0
    emitter.fire(2)
    expect(calls).toEqual(['first', 'fourth'])
  })

  it('大量增删后（稀疏数组压缩）仍按注册顺序投递给存活监听器', () => {
    const emitter = new Emitter<number>()
    const calls: string[] = []
    const subscriptions: CompatDisposable[] = []

    for (let i = 0; i < 10; i++) {
      const index = i
      subscriptions.push(emitter.event(() => calls.push(`l${index}`)))
    }
    // 退掉大部分，制造空洞并触发压缩
    subscriptions[0].dispose()
    subscriptions[2].dispose()
    subscriptions[3].dispose()
    subscriptions[5].dispose()
    subscriptions[8].dispose()

    calls.length = 0
    emitter.fire(1)

    expect(calls).toEqual(['l1', 'l4', 'l6', 'l7', 'l9'])

    calls.length = 0
    subscriptions.forEach((s) => s.dispose())
    expect(emitter.hasListeners()).toBe(false)
    emitter.fire(2)
    expect(calls).toEqual([])
  })

  it('生命周期回调应只在各自对应的转变时触发', () => {
    const calls: string[] = []
    const emitter = new Emitter<number>({
      onWillAddFirstListener: () => calls.push('willAddFirst'),
      onDidAddFirstListener: () => calls.push('didAddFirst'),
      onDidAddListener: () => calls.push('didAdd'),
      onWillRemoveListener: () => calls.push('willRemove'),
      onDidRemoveLastListener: () => calls.push('didRemoveLast'),
    })

    const first = emitter.event(() => {})
    const second = emitter.event(() => {})
    first.dispose()
    second.dispose()

    expect(calls).toEqual([
      'willAddFirst',
      'didAddFirst',
      'didAdd',
      'didAdd',
      'willRemove',
      'willRemove',
      'didRemoveLast',
    ])
  })

  it('共享投递队列时，跨 emitter 的嵌套触发应保持顺序', () => {
    // 每个 emitter 用一个独立队列时，嵌套触发会交错；共享队列则先把当前 emitter 投递完。
    const run = (shared: boolean) => {
      const queue = createEventDeliveryQueue()
      const calls: string[] = []
      const a = new Emitter<number>(shared ? {deliveryQueue: queue} : undefined)
      const b = new Emitter<number>(shared ? {deliveryQueue: queue} : undefined)

      b.event((e) => calls.push(`b1:${e}`))
      b.event((e) => calls.push(`b2:${e}`))
      a.event((e) => {
        calls.push(`a1:${e}`)
        b.fire(e)
      })
      a.event((e) => calls.push(`a2:${e}`))

      a.fire(9)
      return calls
    }

    expect(run(false)).toEqual(['a1:9', 'b1:9', 'b2:9', 'a2:9'])
    expect(run(true)).toEqual(['a1:9', 'a2:9', 'b1:9', 'b2:9'])
  })
})

describe('Emitter 泄漏检测', () => {
  it('超过阈值应上报 ListenerLeakError', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errors: Error[] = []
    const emitter = new Emitter<void>({
      leakWarningThreshold: 5,
      leakWarningName: 'myEmitter',
      onListenerError: (e) => errors.push(e as Error),
    })

    const subscriptions = Array.from({length: 5}, () => emitter.event(() => {}))

    expect(errors.some((e) => ListenerLeakError.is(e))).toBe(true)
    expect(errors[0].name).toBe('ListenerLeakError')
    expect((errors[0] as ListenerLeakError).listenerCount).toBe(5)
    expect(errors[0].message).toContain('myEmitter')
    expect(warn).toHaveBeenCalled()

    subscriptions.forEach((s) => s.dispose())
  })

  it('远超阈值后应拒绝新监听器并上报 ListenerRefusalError', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errors: Error[] = []
    const emitter = new Emitter<void>({
      leakWarningThreshold: 5,
      onListenerError: (e) => errors.push(e as Error),
    })

    // 阈值 5 → 超过 25 个监听器后开始拒绝
    const subscriptions = Array.from({length: 26}, () => emitter.event(() => {}))

    const refused = emitter.event(() => {})
    expect(emitter.hasListeners()).toBe(true)
    expect(errors.some((e) => e.name === 'ListenerRefusalError')).toBe(true)
    expect(refused).toBeDefined()

    subscriptions.forEach((s) => s.dispose())
    refused.dispose()
  })

  it('setGlobalLeakWarningThreshold 应生效并可由返回的 disposable 还原', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errors: Error[] = []
    const restore = setGlobalLeakWarningThreshold(3)

    const emitter = new Emitter<void>({onListenerError: (e) => errors.push(e as Error)})
    const subscriptions = Array.from({length: 3}, () => emitter.event(() => {}))
    expect(errors.some((e) => ListenerLeakError.is(e))).toBe(true)

    subscriptions.forEach((s) => s.dispose())
    restore.dispose()

    const quiet = new Emitter<void>({onListenerError: (e) => errors.push(e as Error)})
    const quietSubscriptions = Array.from({length: 3}, () => quiet.event(() => {}))
    expect(errors).toHaveLength(1)

    quietSubscriptions.forEach((s) => s.dispose())
  })
})

describe('EventProfiling', () => {
  it('_profName 应登记到 EventProfiling.all 并统计触发次数', () => {
    const emitter = new Emitter<number>({_profName: 'profiled'})
    const subscription = emitter.event(() => {})
    emitter.fire(1)
    emitter.fire(2)

    const profile = [...EventProfiling.all].find((p) => p.name.startsWith('profiled'))
    expect(profile).toBeDefined()
    expect(profile!.invocationCount).toBe(2)
    expect(profile!.listenerCount).toBe(1)
    expect(profile!.durations).toHaveLength(2)

    subscription.dispose()
    EventProfiling.all.delete(profile!)
  })
})

describe('Event 组合子', () => {
  it('Event.None 永不触发', () => {
    const listener = vi.fn()
    const subscription = Event.None(listener)
    expect(listener).not.toHaveBeenCalled()
    subscription.dispose()
  })

  it('once 只透出第一次', () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.once(emitter.event)((e) => seen.push(e))

    emitter.fire(1)
    emitter.fire(2)

    expect(seen).toEqual([1])
    expect(emitter.hasListeners()).toBe(false)
  })

  it('onceIf 直到条件成立才消费掉那一次', () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.onceIf(emitter.event, (e) => e > 1)((e) => seen.push(e))

    emitter.fire(1)
    expect(seen).toEqual([])
    emitter.fire(2)
    emitter.fire(3)

    expect(seen).toEqual([2])
  })

  it('map 应逐次映射，forEach 应先跑副作用再交给监听器', () => {
    const emitter = new Emitter<number>()
    const mapped: string[] = []
    const effects: number[] = []
    const seen: number[] = []

    Event.map(emitter.event, (n) => `#${n}`)((v) => mapped.push(v))
    Event.forEach(emitter.event, (n) => effects.push(n))((v) => seen.push(v))

    emitter.fire(7)

    expect(mapped).toEqual(['#7'])
    expect(effects).toEqual([7])
    expect(seen).toEqual([7])
  })

  it('filter 应只透出满足条件的事件（含类型守卫重载）', () => {
    const emitter = new Emitter<number | string>()
    const numbers: number[] = []
    const strings: string[] = []

    // 联合类型事件要写显式类型参数，否则类型守卫重载推断不出 T（与原版一致的限制）
    Event.filter<number, string>(
      emitter.event,
      (e): e is number => typeof e === 'number',
    )((e) => numbers.push(e))
    Event.filter<number, string>(
      emitter.event,
      (e): e is string => typeof e === 'string',
    )((e) => strings.push(e))

    emitter.fire(1)
    emitter.fire('a')

    expect(numbers).toEqual([1])
    expect(strings).toEqual(['a'])
  })

  it('signal 应丢弃载荷，any 应汇总多个事件', () => {
    const a = new Emitter<number>()
    const b = new Emitter<number>()
    const signals: void[] = []
    const values: number[] = []

    Event.signal(Event.any(a.event, b.event))(() => signals.push(undefined))
    Event.any(a.event, b.event)((e) => values.push(e))

    a.fire(1)
    b.fire(2)

    expect(signals).toHaveLength(2)
    expect(values).toEqual([1, 2])
  })

  it('reduce 应折叠事件，给了 initial 时首次即参与折叠', () => {
    const emitter = new Emitter<number>()
    const withInitial: number[] = []
    const withoutInitial: number[] = []

    Event.reduce(emitter.event, (last, e) => (last ?? 0) + e, 0)((v) => withInitial.push(v))
    // 不给 initial 时 O 无法从回调推断，同样需要显式类型参数
    Event.reduce<number, number>(
      emitter.event,
      (last, e) => (last ?? 0) + e,
    )((v) => withoutInitial.push(v))

    emitter.fire(1)
    emitter.fire(2)

    expect(withInitial).toEqual([1, 3])
    expect(withoutInitial).toEqual([1, 3])
  })

  it('latch 应压掉连续重复值', () => {
    const emitter = new Emitter<string>()
    const seen: string[] = []
    Event.latch(emitter.event)((e) => seen.push(e))

    emitter.fire('a')
    emitter.fire('a')
    emitter.fire('b')
    emitter.fire('b')
    emitter.fire('a')

    expect(seen).toEqual(['a', 'b', 'a'])
  })

  it('split 应把联合类型事件拆成两个', () => {
    const emitter = new Emitter<number | undefined>()
    const [numbers, undefineds] = Event.split<number, undefined>(
      emitter.event,
      (e): e is number => e !== undefined,
    )
    const seenNumbers: number[] = []
    const seenUndefined: undefined[] = []

    numbers((e) => seenNumbers.push(e))
    undefineds((e) => seenUndefined.push(e))

    emitter.fire(1)
    emitter.fire(undefined)

    expect(seenNumbers).toEqual([1])
    expect(seenUndefined).toEqual([undefined])
  })

  it('chain 应支持 map / filter / reduce / latch / forEach 连写', () => {
    const emitter = new Emitter<number>()
    const seen: string[] = []
    const effects: number[] = []

    Event.chain(emitter.event, ($) =>
      $.filter((n) => n > 0)
        .forEach((n) => effects.push(n))
        .map((n) => n * 2)
        .latch(),
    )((v) => seen.push(`v${v}`))

    emitter.fire(-1)
    emitter.fire(1)
    emitter.fire(2)
    emitter.fire(2)

    // forEach 排在 latch 之前，因此重复的 2 也会被它看到一次；latch 压掉的是之后的值
    expect(effects).toEqual([1, 2, 2])
    expect(seen).toEqual(['v2', 'v4'])
  })

  it('forward 应把事件转给另一个 emitter', () => {
    const source = new Emitter<number>()
    const target = new Emitter<number>()
    const seen: number[] = []

    Event.forward(source.event, target)
    target.event((e) => seen.push(e))
    source.fire(5)

    expect(seen).toEqual([5])
  })

  it('runAndSubscribe 应立即用 initial 调一次', () => {
    const emitter = new Emitter<string>()
    const withInitial: string[] = []
    const withoutInitial: (string | undefined)[] = []

    Event.runAndSubscribe(emitter.event, (e) => withInitial.push(e), 'init')
    Event.runAndSubscribe(emitter.event, (e) => withoutInitial.push(e))
    emitter.fire('next')

    expect(withInitial).toEqual(['init', 'next'])
    expect(withoutInitial).toEqual([undefined, 'next'])
  })

  it('toPromise 应在首次事件时兑现，cancel 应摘掉监听器', async () => {
    const emitter = new Emitter<number>()
    const promise = Event.toPromise(emitter.event)
    emitter.fire(42)
    await expect(promise).resolves.toBe(42)

    const other = new Emitter<number>()
    const cancelled = Event.toPromise(other.event)
    expect(other.hasListeners()).toBe(true)
    cancelled.cancel()
    expect(other.hasListeners()).toBe(false)
  })

  it('toPromise 的 disposables 数组应在结算后清空', async () => {
    const emitter = new Emitter<number>()
    const disposables: CompatDisposable[] = []
    const promise = Event.toPromise(emitter.event, disposables)

    expect(disposables).toHaveLength(1)
    emitter.fire(1)
    await expect(promise).resolves.toBe(1)
    await flushMicrotasks()

    expect(disposables).toHaveLength(0)
  })

  it('fromDOMEventEmitter 应转发 DOM 事件', () => {
    const target = new EventTarget()
    const seen: string[] = []
    const subscription = Event.fromDOMEventEmitter<string>(
      target,
      'ping',
      (e: unknown) => (e as CustomEvent<string>).detail,
    )((v) => seen.push(v))

    target.dispatchEvent(new CustomEvent('ping', {detail: 'hello'}))
    target.dispatchEvent(new CustomEvent('ping', {detail: 'world'}))
    subscription.dispose()
    target.dispatchEvent(new CustomEvent('ping', {detail: 'gone'}))

    expect(seen).toEqual(['hello', 'world'])
  })

  it('fromNodeEventEmitter 应转发 node 风格事件，且只在有人监听时挂钩', () => {
    const handlers = new Set<(value: number) => void>()
    let subscriptions = 0
    const nodeEmitter = {
      on(_event: string | symbol, listener: Function) {
        subscriptions++
        handlers.add(listener as (value: number) => void)
      },
      removeListener(_event: string | symbol, listener: Function) {
        subscriptions--
        handlers.delete(listener as (value: number) => void)
      },
    }

    const event = Event.fromNodeEventEmitter<number>(nodeEmitter, 'data')
    expect(subscriptions).toBe(0)

    const seen: number[] = []
    const subscription = event((v) => seen.push(v))
    expect(subscriptions).toBe(1)

    handlers.forEach((handler) => handler(1))
    subscription.dispose()
    expect(subscriptions).toBe(0)
    expect(seen).toEqual([1])
  })

  it('buffer 应在第一个监听器到来时回放缓冲的内容', () => {
    const emitter = new Emitter<number>()
    const event = Event.buffer(emitter.event, 'test')

    emitter.fire(1)
    emitter.fire(2)

    const seen: number[] = []
    event((e) => seen.push(e))

    expect(seen).toEqual([1, 2])
  })

  it('buffer(..., flushAfterTimeout) 应异步回放，让同轮挂上的多个监听器都收到', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const event = Event.buffer(emitter.event, 'test', true)

    emitter.fire(1)
    const first: number[] = []
    const second: number[] = []
    event((e) => first.push(e))
    event((e) => second.push(e))

    expect(first).toEqual([])
    await vi.advanceTimersByTimeAsync(1)

    expect(first).toEqual([1])
    expect(second).toEqual([1])
  })

  it('buffer 的后续事件应直接透出，不再缓冲', () => {
    const emitter = new Emitter<number>()
    const event = Event.buffer(emitter.event, 'test')
    const seen: number[] = []

    event((e) => seen.push(e))
    emitter.fire(1)

    expect(seen).toEqual([1])
  })

  it('Event.buffer 的开发期泄漏检测应在长时间未消费时告警', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const emitter = new Emitter<number>()
    Event.buffer(emitter.event, 'leaky')

    emitter.fire(1)
    await vi.advanceTimersByTimeAsync(60_001)

    expect(
      warn.mock.calls.some((call) => String(call[0]).includes('potential LEAK detected')),
    ).toBe(true)
  })

  it('派生事件应惰性挂在源上，最后一个订阅者离开后摘下', () => {
    let hooked = 0
    const source = new Emitter<number>({
      onWillAddFirstListener: () => hooked++,
      onDidRemoveLastListener: () => hooked--,
    })

    const mapped = Event.map(source.event, (n) => n * 2)
    expect(hooked).toBe(0)

    const first = mapped(() => {})
    const second = mapped(() => {})
    expect(hooked).toBe(1)

    first.dispose()
    expect(hooked).toBe(1)
    second.dispose()
    expect(hooked).toBe(0)
  })
})

describe('Event 时间相关组合子', () => {
  it('defer 应把事件推迟到后续任务', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const seen: void[] = []
    Event.defer(emitter.event)(() => seen.push(undefined))

    emitter.fire(1)
    emitter.fire(2)
    expect(seen).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(seen).toHaveLength(1)
  })

  it('debounce 应合并窗口期内的事件', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.debounce(emitter.event, (last, e) => (last ?? 0) + e, 10)((v) => seen.push(v))

    emitter.fire(1)
    emitter.fire(2)
    expect(seen).toEqual([])

    await vi.advanceTimersByTimeAsync(10)
    expect(seen).toEqual([3])
  })

  it('debounce 的 leading 应立即透出首次，且最终只多一次尾部触发', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.debounce(emitter.event, (last, e) => (last ?? 0) + e, 10, true)((v) => seen.push(v))

    emitter.fire(1)
    expect(seen).toEqual([1])

    emitter.fire(2)
    await vi.advanceTimersByTimeAsync(10)
    expect(seen).toEqual([1, 2])
  })

  it('debounce 的 flushOnListenerRemove 应在最后一个监听器离开时冲刷', () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const seen: number[] = []
    const subscription = Event.debounce(
      emitter.event,
      (last, e) => (last ?? 0) + e,
      10,
      false,
      true,
    )((v) => seen.push(v))

    emitter.fire(1)
    expect(seen).toEqual([])
    subscription.dispose()

    expect(seen).toEqual([1])
  })

  it('debounce 支持 MicrotaskDelay：在下一个微任务冲刷', async () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.debounce(emitter.event, (last, e) => (last ?? 0) + e, MicrotaskDelay)((v) => seen.push(v))

    emitter.fire(1)
    emitter.fire(2)
    expect(seen).toEqual([])

    await flushMicrotasks()
    expect(seen).toEqual([3])
  })

  it('accumulate 应收集窗口期内的全部事件', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const batches: number[][] = []
    Event.accumulate(emitter.event, 10)((batch) => batches.push(batch))

    emitter.fire(1)
    emitter.fire(2)
    await vi.advanceTimersByTimeAsync(10)

    expect(batches).toEqual([[1, 2]])
  })

  it('throttle 应在 leading 与 trailing 两端触发', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.throttle(emitter.event, (last, e) => (last ?? 0) + e, 10)((v) => seen.push(v))

    emitter.fire(1)
    expect(seen).toEqual([1])

    emitter.fire(2)
    emitter.fire(3)
    await vi.advanceTimersByTimeAsync(10)
    expect(seen).toEqual([1, 5])
  })

  it('throttle 支持 MicrotaskDelay', async () => {
    const emitter = new Emitter<number>()
    const seen: number[] = []
    Event.throttle(emitter.event, (last, e) => (last ?? 0) + e, MicrotaskDelay)((v) => seen.push(v))

    emitter.fire(1)
    expect(seen).toEqual([1])

    emitter.fire(2)
    await flushMicrotasks()
    expect(seen).toEqual([1, 2])
  })

  it('throttle 的 leading/trailing 可分别关闭', async () => {
    vi.useFakeTimers()
    const emitter = new Emitter<number>()
    const leadingOff: number[] = []
    const trailingOff: number[] = []
    Event.throttle(emitter.event, (last, e) => e, 10, false, true)((v) => leadingOff.push(v))
    Event.throttle(emitter.event, (last, e) => e, 10, true, false)((v) => trailingOff.push(v))

    emitter.fire(1)
    emitter.fire(2)
    await vi.advanceTimersByTimeAsync(10)

    expect(leadingOff).toEqual([2])
    expect(trailingOff).toEqual([1])
  })
})

describe('PauseableEmitter / DebounceEmitter / MicrotaskEmitter', () => {
  it('PauseableEmitter 应按计数暂停与恢复', () => {
    const emitter = new PauseableEmitter<number>()
    const seen: number[] = []
    emitter.event((e) => seen.push(e))

    emitter.pause()
    emitter.pause()
    emitter.fire(1)
    emitter.resume()
    expect(seen).toEqual([])

    emitter.resume()
    expect(seen).toEqual([1])
    expect(emitter.isPaused).toBe(false)
  })

  it('PauseableEmitter 的 merge 应把积压事件合成一个', () => {
    const emitter = new PauseableEmitter<number>({
      merge: (events) => events.reduce((a, b) => a + b, 0),
    })
    const seen: number[] = []
    emitter.event((e) => seen.push(e))

    emitter.pause()
    emitter.fire(1)
    emitter.fire(2)
    emitter.resume()

    expect(seen).toEqual([3])
  })

  it('PauseableEmitter 无监听器时 fire 不进队列', () => {
    const emitter = new PauseableEmitter<number>()
    emitter.pause()
    emitter.fire(1)
    emitter.resume()

    const seen: number[] = []
    emitter.event((e) => seen.push(e))
    expect(seen).toEqual([])
  })

  it('DebounceEmitter 应在延迟后合并透出', async () => {
    vi.useFakeTimers()
    const emitter = new DebounceEmitter<number>({
      merge: (events) => events.reduce((a, b) => a + b, 0),
      delay: 10,
    })
    const seen: number[] = []
    emitter.event((e) => seen.push(e))

    emitter.fire(1)
    emitter.fire(2)
    expect(seen).toEqual([])

    await vi.advanceTimersByTimeAsync(10)
    expect(seen).toEqual([3])
  })

  it('MicrotaskEmitter 应在本轮任务末尾投递，并在无监听器时丢弃', async () => {
    const emitter = new MicrotaskEmitter<number>()
    const seen: number[] = []

    emitter.fire(0) // 还没有监听器，直接丢弃
    emitter.event((e) => seen.push(e))
    emitter.fire(1)
    emitter.fire(2)
    expect(seen).toEqual([])

    await flushMicrotasks()
    expect(seen).toEqual([1, 2])
  })

  it('MicrotaskEmitter 的 merge 应只投递一次', async () => {
    const emitter = new MicrotaskEmitter<number>({
      merge: (events) => events.reduce((a, b) => a + b, 0),
    })
    const seen: number[] = []
    emitter.event((e) => seen.push(e))

    emitter.fire(1)
    emitter.fire(2)
    await flushMicrotasks()

    expect(seen).toEqual([3])
  })
})

describe('AsyncEmitter', () => {
  const createToken = () => {
    let cancelled = false
    const listeners = new Set<() => void>()
    const token: CancellationToken = {
      get isCancellationRequested() {
        return cancelled
      },
      onCancellationRequested: ((listener: () => void) => {
        listeners.add(listener)
        return toDisposable(() => listeners.delete(listener))
      }) as CancellationToken['onCancellationRequested'],
    }
    return {
      token,
      cancel() {
        cancelled = true
        listeners.forEach((listener) => listener())
      },
    }
  }

  interface Payload {
    token: CancellationToken
    waitUntil(thenable: Promise<unknown>): void
    value: number
  }

  it('应按注册顺序逐个等待监听器', async () => {
    const emitter = new AsyncEmitter<Payload>()
    const calls: string[] = []

    emitter.event(async (e) => {
      calls.push('a:start')
      e.waitUntil(
        new Promise<void>((resolve) =>
          setTimeout(() => {
            calls.push('a:done')
            resolve()
          }, 5),
        ),
      )
      calls.push('a:end')
    })
    emitter.event(async () => {
      calls.push('b')
    })

    const {token} = createToken()
    await emitter.fireAsync({value: 1}, token)

    expect(calls).toEqual(['a:start', 'a:end', 'a:done', 'b'])
  })

  it('token 取消后应停止后续投递', async () => {
    const emitter = new AsyncEmitter<Payload>()
    const calls: string[] = []
    const {token, cancel} = createToken()

    emitter.event(async (e) => {
      calls.push('first')
      e.waitUntil(
        new Promise<void>((resolve) =>
          setTimeout(() => {
            cancel()
            resolve()
          }, 1),
        ),
      )
    })
    emitter.event(async () => {
      calls.push('second')
    })

    await emitter.fireAsync({value: 1}, token)

    expect(calls).toEqual(['first'])
  })

  it('已取消的 token 不应投递任何东西', async () => {
    const emitter = new AsyncEmitter<Payload>()
    const listener = vi.fn()
    emitter.event(listener)

    const {token, cancel} = createToken()
    cancel()
    await emitter.fireAsync({value: 1}, token)

    expect(listener).not.toHaveBeenCalled()
  })

  it('监听器抛错不应中断其余监听器（报错走默认的 console.error）', async () => {
    // 与 vscode 一致：fireAsync 直接调用监听器，异常交给全局错误处理，不经过
    // EmitterOptions.onListenerError，也不终止其余监听器的投递。
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const emitter = new AsyncEmitter<Payload>()
    const seen: string[] = []

    emitter.event(() => {
      throw new Error('boom')
    })
    emitter.event(async () => {
      seen.push('second')
    })

    const {token} = createToken()
    await emitter.fireAsync({value: 1}, token)

    expect(seen).toEqual(['second'])
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('waitUntil 里 reject 的 promise 应被上报但不中断投递', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const emitter = new AsyncEmitter<Payload>()
    const seen: string[] = []

    emitter.event((e) => {
      e.waitUntil(Promise.reject(new Error('async boom')))
    })
    emitter.event(async () => {
      seen.push('second')
    })

    const {token} = createToken()
    await emitter.fireAsync({value: 1}, token)

    expect(seen).toEqual(['second'])
    expect(error).toHaveBeenCalled()
  })

  it('waitUntil 在监听器返回后是冻结的', async () => {
    const errors: unknown[] = []
    const emitter = new AsyncEmitter<Payload>({onListenerError: (e) => errors.push(e)})

    emitter.event((e) => {
      // 监听器同步返回，之后再把 waitUntil 存起来稍后调用 → 冻结
      setTimeout(() => {
        try {
          e.waitUntil(Promise.resolve())
        } catch (error) {
          errors.push(error)
        }
      }, 0)
    })

    const {token} = createToken()
    await emitter.fireAsync({value: 1}, token)
    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('waitUntil can NOT be called asynchronous')
  })

  it('没有监听器时应直接返回', async () => {
    const emitter = new AsyncEmitter<Payload>()
    const {token} = createToken()
    await expect(emitter.fireAsync({value: 1}, token)).resolves.toBeUndefined()
  })

  it('AsyncEmitter 应继承 Emitter 的释放语义', () => {
    const emitter = new AsyncEmitter<Payload>()
    const seen: number[] = []
    emitter.event((e) => seen.push(e.value))
    emitter.fire({value: 1, token: {} as CancellationToken, waitUntil: () => {}})
    emitter.dispose()
    emitter.fire({value: 2, token: {} as CancellationToken, waitUntil: () => {}})

    expect(seen).toEqual([1])
  })
})

describe('EventMultiplexer / DynamicListEventMultiplexer', () => {
  it('EventMultiplexer 应在有人订阅后才挂钩源，最后一人离开后摘下', () => {
    const a = new Emitter<number>()
    const b = new Emitter<number>()
    const multiplexer = new EventMultiplexer<number>()
    multiplexer.add(a.event)

    expect(a.hasListeners()).toBe(false)

    const seen: number[] = []
    const subscription = multiplexer.event((e) => seen.push(e))
    expect(a.hasListeners()).toBe(true)

    const handleB = multiplexer.add(b.event)
    expect(b.hasListeners()).toBe(true)

    a.fire(1)
    b.fire(2)
    handleB.dispose()
    b.fire(3)
    a.fire(4)

    expect(seen).toEqual([1, 2, 4])

    subscription.dispose()
    expect(a.hasListeners()).toBe(false)

    multiplexer.dispose()
  })

  it('EventMultiplexer 的句柄重复释放应是安全的（单次调用包装）', () => {
    const a = new Emitter<number>()
    const multiplexer = new EventMultiplexer<number>()
    const handle = multiplexer.add(a.event)

    handle.dispose()
    handle.dispose()

    const seen: number[] = []
    multiplexer.event((e) => seen.push(e))
    a.fire(1)
    expect(seen).toEqual([])

    multiplexer.dispose()
  })

  it('DynamicListEventMultiplexer 应跟随列表增删', () => {
    const added = new Emitter<string>()
    const removed = new Emitter<string>()
    const sources = new Map<string, Emitter<number>>()
    const sourceOf = (item: string) => {
      let source = sources.get(item)
      if (!source) {
        source = new Emitter<number>()
        sources.set(item, source)
      }
      return source
    }

    const multiplexer = new DynamicListEventMultiplexer<string, number>(
      ['a', 'b'],
      added.event,
      removed.event,
      (item) => sourceOf(item).event,
    )

    const seen: number[] = []
    const subscription = multiplexer.event((e) => seen.push(e))

    expect(sources.size).toBe(2)
    sources.get('a')!.fire(1)

    added.fire('c')
    sources.get('c')!.fire(3)

    removed.fire('a')
    sources.get('a')!.fire(9)

    expect(seen).toEqual([1, 3])

    subscription.dispose()
    multiplexer.dispose()
  })
})

describe('EventBufferer', () => {
  it('bufferEvents 期间的事件应在结束后统一投递', () => {
    const emitter = new Emitter<number>()
    const bufferer = new EventBufferer()
    const wrapped = bufferer.wrapEvent(emitter.event)
    const seen: number[] = []

    wrapped((e) => seen.push(e))
    bufferer.bufferEvents(() => {
      emitter.fire(1)
      emitter.fire(2)
      expect(seen).toEqual([])
    })

    expect(seen).toEqual([1, 2])
  })

  it('bufferEvents 之外的触发应直接透出', () => {
    const emitter = new Emitter<number>()
    const bufferer = new EventBufferer()
    const seen: number[] = []
    bufferer.wrapEvent(emitter.event)((e) => seen.push(e))

    emitter.fire(1)
    expect(seen).toEqual([1])
  })

  it('reduce 形式应把 bufferEvents 期间的事件合并成一次投递', () => {
    const emitter = new Emitter<number>()
    const bufferer = new EventBufferer()
    const seen: number[] = []
    const wrapped = bufferer.wrapEvent(emitter.event, (last, e) => (last ?? 0) + e, 0)

    wrapped((v) => seen.push(v))
    bufferer.bufferEvents(() => {
      emitter.fire(1)
      emitter.fire(2)
    })

    expect(seen).toEqual([3])
  })

  it('reduce 形式在多监听器下会重复累加且只有第一个订阅者收到（上游行为，见 JSDoc 说明）', () => {
    const emitter = new Emitter<number>()
    const bufferer = new EventBufferer()
    const merge = (last: number | undefined, e: number) => (last ?? 0) + e

    const wrapped = bufferer.wrapEvent(emitter.event, merge, 0)
    const first: number[] = []
    const second: number[] = []
    wrapped((v) => first.push(v))
    wrapped((v) => second.push(v))

    bufferer.bufferEvents(() => {
      emitter.fire(1)
      emitter.fire(2)
    })

    // 每个监听器各自把同一个事件推进共享的 items，所以是 1+1+2+2；而冲刷函数只登记了第一个
    expect(first).toEqual([6])
    expect(second).toEqual([])
  })

  it('嵌套 bufferEvents 时各自冲刷自己那一层，fn 抛错后仍冲刷已缓冲内容', () => {
    const emitter = new Emitter<number>()
    const bufferer = new EventBufferer()
    const seen: number[] = []
    bufferer.wrapEvent(emitter.event)((e) => seen.push(e))

    bufferer.bufferEvents(() => {
      emitter.fire(1)
      bufferer.bufferEvents(() => {
        emitter.fire(2)
      })
      // 内层结束即冲刷内层缓冲的事件，所以顺序变成「后来者先到」
      expect(seen).toEqual([2])
    })
    expect(seen).toEqual([2, 1])

    expect(() =>
      bufferer.bufferEvents(() => {
        emitter.fire(3)
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(seen).toEqual([2, 1, 3])
  })
})

describe('Relay', () => {
  it('应转发输入事件，并支持热换源', () => {
    const a = new Emitter<number>()
    const b = new Emitter<number>()
    const relay = new Relay<number>()
    const seen: number[] = []

    relay.input = a.event
    relay.event((e) => seen.push(e))

    a.fire(1)
    relay.input = b.event
    a.fire(2)
    b.fire(3)

    expect(seen).toEqual([1, 3])

    relay.dispose()
    b.fire(4)
    expect(seen).toEqual([1, 3])
  })

  it('无人订阅时换源不应立刻挂钩，等订阅到来才挂', () => {
    const a = new Emitter<number>()
    const relay = new Relay<number>()
    relay.input = a.event
    expect(a.hasListeners()).toBe(false)

    const seen: number[] = []
    const subscription = relay.event((e) => seen.push(e))
    a.fire(1)
    expect(seen).toEqual([1])

    subscription.dispose()
    expect(a.hasListeners()).toBe(false)
    relay.dispose()
  })
})

describe('ValueWithChangeEvent', () => {
  it('写入不同的值应触发，写入相同的值不触发', () => {
    const value = new ValueWithChangeEvent<number>(1)
    let changes = 0
    value.onDidChange(() => changes++)

    value.value = 2
    value.value = 2
    value.value = 3

    expect(changes).toBe(2)
    expect(value.value).toBe(3)
  })

  it('const 形式的事件是 Event.None', () => {
    const constant = ValueWithChangeEvent.const('x')
    expect(constant.value).toBe('x')
    expect(constant.onDidChange).toBe(Event.None)
  })
})

describe('trackSetChanges', () => {
  it('应对集合的增删做出响应：新增项调 handleItem，移除项释放句柄', () => {
    let data = new Set<string>(['a'])
    const changed = new Emitter<void>()
    const handled: string[] = []
    const disposed: string[] = []

    const tracking = trackSetChanges(
      () => data,
      changed.event,
      (item) => {
        handled.push(item)
        return toDisposable(() => disposed.push(item))
      },
    )

    expect(handled).toEqual(['a'])

    data = new Set(['a', 'b'])
    changed.fire(undefined)
    expect(handled).toEqual(['a', 'b'])

    data = new Set(['b'])
    changed.fire(undefined)
    expect(disposed).toEqual(['a'])

    tracking.dispose()
    expect(disposed).toEqual(['a', 'b'])
  })
})

describe('fromObservable / fromObservableLight', () => {
  class TestObservable implements IObservable<number> {
    #value = 0
    #observers = new Set<IObserver>()

    get(): number {
      return this.#value
    }

    reportChanges(): void {
      // 只上报「变了」；begin/endUpdate 由事务发起方（set）驱动，否则和观察者的
      // endUpdate 互相调用会栈溢出。
      for (const observer of [...this.#observers]) {
        observer.handleChange(this, undefined)
      }
    }

    addObserver(observer: IObserver): void {
      this.#observers.add(observer)
    }

    removeObserver(observer: IObserver): void {
      this.#observers.delete(observer)
    }

    set(value: number): void {
      this.#value = value
      const observers = [...this.#observers]
      observers.forEach((observer) => observer.beginUpdate(this))
      this.reportChanges()
      observers.forEach((observer) => observer.endUpdate(this))
    }

    get observerCount(): number {
      return this.#observers.size
    }
  }

  it('fromObservable 应在变更时透出新值，并只在有人监听时挂观察者', () => {
    const observable = new TestObservable()
    const event = Event.fromObservable(observable)
    const seen: number[] = []

    expect(observable.observerCount).toBe(0)
    const subscription = event((v) => seen.push(v))
    expect(observable.observerCount).toBe(1)

    observable.set(1)
    observable.set(2)

    expect(seen).toEqual([1, 2])

    subscription.dispose()
    expect(observable.observerCount).toBe(0)
  })

  it('fromObservableLight 只透出「变了」这个事实', () => {
    const observable = new TestObservable()
    const event = Event.fromObservableLight(observable)
    let changes = 0

    const subscription = event(() => changes++)
    observable.set(5)

    expect(changes).toBe(1)
    subscription.dispose()
    expect(observable.observerCount).toBe(0)
  })

  it('fromObservable 的 store 应接管内部 emitter 的释放', () => {
    const observable = new TestObservable()
    const store = new DisposableStore()
    const event = Event.fromObservable(observable, store)
    const subscription = event(() => {})
    expect(observable.observerCount).toBe(1)

    store.dispose()
    expect(observable.observerCount).toBe(0)
    subscription.dispose()
  })
})

describe('DisposableStore 与事件的协作', () => {
  it('store 应接管订阅，释放 store 即退订', () => {
    const emitter = new Emitter<number>()
    const store = new DisposableStore()
    const seen: number[] = []

    store.add(emitter.event((e) => seen.push(e)))
    emitter.fire(1)
    store.dispose()
    emitter.fire(2)

    expect(seen).toEqual([1])
    expect(emitter.hasListeners()).toBe(false)
  })

  it('DisposableMap 可用于「每个 key 一个订阅」的清理', () => {
    const sources = new DisposableMap<string, CompatDisposable>()
    const emitters = new Map<string, Emitter<number>>()
    const seen: string[] = []
    const sourceOf = (key: string) => {
      let emitter = emitters.get(key)
      if (!emitter) {
        emitter = new Emitter<number>()
        emitters.set(key, emitter)
      }
      return emitter
    }

    sources.set(
      'a',
      sourceOf('a').event((e) => seen.push(`a:${e}`)),
    )
    sources.set(
      'b',
      sourceOf('b').event((e) => seen.push(`b:${e}`)),
    )

    emitters.get('a')!.fire(1)
    sources.deleteAndDispose('a')
    emitters.get('a')!.fire(2)

    expect(seen).toEqual(['a:1'])

    sources.dispose()
    expect(emitters.get('b')!.hasListeners()).toBe(false)
  })
})
