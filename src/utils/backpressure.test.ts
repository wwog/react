import {describe, expect, it} from 'vitest'
import {createDroppingQueue, createLatestValue} from './backpressure'

describe('createDroppingQueue', () => {
  it('应该保持 FIFO 顺序', () => {
    const q = createDroppingQueue<number>(3)
    q.push(1)
    q.push(2)
    q.push(3)

    expect(q.shift()).toBe(1)
    expect(q.shift()).toBe(2)
    expect(q.shift()).toBe(3)
    expect(q.shift()).toBeUndefined()
  })

  it('满时应丢弃最旧的条目', () => {
    const q = createDroppingQueue<number>(3)
    q.push(1)
    q.push(2)
    q.push(3)
    q.push(4) // 挤掉 1

    expect(q.size).toBe(3)
    expect(q.items()).toEqual([2, 3, 4])
  })

  it('丢弃的是未消费的最旧条目，已消费的不受影响', () => {
    const q = createDroppingQueue<number>(2)
    q.push(1)
    q.push(2)
    expect(q.shift()).toBe(1) // 1 已消费，队列剩 [2]

    q.push(3) // 未满，直接入队 → [2, 3]
    expect(q.items()).toEqual([2, 3])
    q.push(4) // 满，挤掉 2 → [3, 4]
    expect(q.items()).toEqual([3, 4])
  })

  it('push 满时返回 true（新条目被保留）', () => {
    const q = createDroppingQueue<number>(1)
    expect(q.push(1)).toBe(true)
    expect(q.push(2)).toBe(true) // 2 保留，1 被挤掉
    expect(q.shift()).toBe(2)
  })

  it('capacity 0 应总是丢弃', () => {
    const q = createDroppingQueue<number>(0)
    expect(q.push(1)).toBe(false)
    expect(q.size).toBe(0)
  })

  it('drainAll 应取走全部并清空', () => {
    const q = createDroppingQueue<number>(10)
    q.push(1)
    q.push(2)
    q.push(3)

    expect(q.drainAll()).toEqual([1, 2, 3])
    expect(q.size).toBe(0)
    expect(q.drainAll()).toEqual([])
  })

  it('drainAll 交出的数组应与队列脱钩（O(1) 移交语义）', () => {
    const q = createDroppingQueue<number>(10)
    q.push(1)
    q.push(2)

    const drained = q.drainAll()
    expect(drained).toEqual([1, 2])

    // 修改返回值不应影响队列
    drained.push(999)
    expect(q.size).toBe(0)

    q.push(3)
    expect(q.items()).toEqual([3])
    expect(drained).toEqual([1, 2, 999])
  })

  it('应该模拟直播日志的背压丢弃', () => {
    const q = createDroppingQueue<string>(3)
    // 消费端 1 条/秒，生产端 5 条/秒 → 旧日志被悄悄丢弃
    for (let i = 0; i < 10; i++) q.push(`log-${i}`)

    expect(q.items()).toEqual(['log-7', 'log-8', 'log-9'])
  })
})

describe('createLatestValue', () => {
  it('set/take 应存取最新值', () => {
    const cell = createLatestValue<number>()
    expect(cell.take()).toBeUndefined()

    cell.set(1)
    expect(cell.take()).toBe(1)
  })

  it('take 之后没有新值应返回 undefined', () => {
    const cell = createLatestValue<number>()
    cell.set(1)
    expect(cell.take()).toBe(1)
    expect(cell.take()).toBeUndefined()
  })

  it('连续 set 应合并：只保留最新值', () => {
    const cell = createLatestValue<number>()

    // 排行榜 1 秒内更新 50 次，消费端只拿到最终名次
    for (let i = 0; i < 50; i++) cell.set(i)
    expect(cell.take()).toBe(49)
    expect(cell.pending).toBe(false)
  })

  it('pending 应反映是否有新值等待', () => {
    const cell = createLatestValue<number>()
    expect(cell.pending).toBe(false)

    cell.set(1)
    expect(cell.pending).toBe(true)

    cell.take()
    expect(cell.pending).toBe(false)
  })

  it('peek 应窥视但不消费', () => {
    const cell = createLatestValue<number>()
    cell.set(42)

    expect(cell.peek()).toBe(42)
    expect(cell.pending).toBe(true) // 未消费
    expect(cell.take()).toBe(42) // 仍可取走
  })

  it('两次消费之间只应感知到最新值', () => {
    const cell = createLatestValue<number>()

    cell.set(1)
    expect(cell.take()).toBe(1) // 第一次消费

    cell.set(2)
    cell.set(3)
    cell.set(4)
    expect(cell.take()).toBe(4) // 2、3 被合并掉
    expect(cell.take()).toBeUndefined()
  })
})
