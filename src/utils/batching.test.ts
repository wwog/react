import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {appendBatch, debounce, rafSchedule, runLayoutBatch, throttle} from './batching'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('应该延迟到安静后执行一次', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('只保留最后一次调用的参数', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    vi.advanceTimersByTime(50)
    debounced('b')
    vi.advanceTimersByTime(50)
    debounced('c')
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('等待期内再次调用应重置计时器', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(90)
    debounced() // 重置
    vi.advanceTimersByTime(90)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 应丢弃等待中的调用', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    debounced.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush 应立即执行等待中的调用', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('x')
    debounced.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('x')

    // flush 后计时器应失效，不会重复执行
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('flush 无等待调用时应为 no-op', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced.flush()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('第一次调用应立即执行（leading）', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('a')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('间隔内的后续调用应被节流', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('a')
    throttled('b')
    throttled('c')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('间隔结束后应以最新参数补一次尾调用（trailing）', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('a') // leading，立即执行
    throttled('b') // 节流，记录为尾调用
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('b')
  })

  it('持续高频调用时每个间隔最多执行一次', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    for (let i = 0; i < 10; i++) {
      throttled(i)
      vi.advanceTimersByTime(10)
    }

    // t=0 leading 执行一次（参数 0），其余调用合并；t=100 区间结束补一次尾调用（参数 9）
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 0)
    expect(fn).toHaveBeenNthCalledWith(2, 9)
  })

  it('cancel 后不再有尾调用', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('a')
    throttled('b') // 将产生尾调用
    throttled.cancel()
    vi.advanceTimersByTime(300)

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('rafSchedule', () => {
  it('一帧内多次调用应合并为一次执行', async () => {
    const fn = vi.fn()
    const scheduled = rafSchedule(fn)

    scheduled('a')
    scheduled('b')
    scheduled('c')

    // 等待 rAF 回调执行
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(fn).toHaveBeenCalledTimes(1)
    // 只保留最后一次调用的参数
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('不同帧的调用分别执行', async () => {
    const fn = vi.fn()
    const scheduled = rafSchedule(fn)

    scheduled()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    scheduled()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel 应丢弃本帧的调用', async () => {
    const fn = vi.fn()
    const scheduled = rafSchedule(fn)

    scheduled()
    scheduled.cancel()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(fn).not.toHaveBeenCalled()
  })

  it('cancel 应真正取消已预约的动画帧（而非只清空参数）', () => {
    const fn = vi.fn()
    const scheduled = rafSchedule(fn)
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')

    scheduled()
    scheduled.cancel()

    expect(cancelSpy).toHaveBeenCalledTimes(1)
    cancelSpy.mockRestore()
  })

  it('不应暴露误导性的 flush（rAF 无法同步 flush）', () => {
    const scheduled = rafSchedule(() => {})
    expect((scheduled as {flush?: unknown}).flush).toBeUndefined()
  })

  it('执行后可再次调度', async () => {
    const fn = vi.fn()
    const scheduled = rafSchedule(fn)

    scheduled(1)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    scheduled(2)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 1)
    expect(fn).toHaveBeenNthCalledWith(2, 2)
  })
})

describe('appendBatch', () => {
  it('应该一次性按顺序挂载所有子节点', () => {
    const parent = document.createElement('div')
    const a = document.createElement('span')
    const b = document.createElement('span')

    const returned = appendBatch(parent, [a, b, 'text'])

    expect(returned).toBe(parent)
    expect(parent.children.length).toBe(2)
    expect(parent.children[0]).toBe(a)
    expect(parent.children[1]).toBe(b)
    expect(parent.textContent).toBe('text')
  })

  it('应该返回 parent 支持链式调用', () => {
    const parent = document.createElement('div')
    appendBatch(parent, ['x'])
    expect(parent.textContent).toBe('x')
  })
})

describe('runLayoutBatch', () => {
  it('应该先执行 read 再执行 write，并传递测量值', () => {
    const el = document.createElement('div')
    el.style.width = '50px'
    document.body.appendChild(el)

    const write = vi.fn((width: number) => width)

    const result = runLayoutBatch(
      () => el.offsetWidth, // read
      write, // write
    )

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(50)
    expect(result).toBe(50)

    el.remove()
  })

  it('read 阶段的写入应发生在 write 阶段之前', () => {
    const order: string[] = []
    runLayoutBatch(
      () => {
        order.push('read')
        return 1
      },
      (v) => {
        order.push('write')
        return v * 2
      },
    )
    expect(order).toEqual(['read', 'write'])
  })
})
