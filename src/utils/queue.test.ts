import {describe, expect, it} from 'vitest'
import {Queue} from './queue'

describe('Queue', () => {
  it('应该按 FIFO 顺序 pop', () => {
    const queue = new Queue<number>()
    queue.push(1)
    queue.push(2)
    queue.push(3)

    expect(queue.length).toBe(3)
    expect(queue.pop()).toBe(1)
    expect(queue.pop()).toBe(2)
    expect(queue.pop()).toBe(3)
    expect(queue.pop()).toBeUndefined()
    expect(queue.length).toBe(0)
  })

  it('pushFront 应插到最前，且后进的更靠前（队首是 LIFO）', () => {
    const queue = new Queue<string>()
    queue.push('a')
    queue.push('b')
    queue.pushFront('urgent-1')
    queue.pushFront('urgent-2')

    // 队首区是栈：最后 pushFront 的最先出
    expect(queue.toArray()).toEqual(['urgent-2', 'urgent-1', 'a', 'b'])
    expect([queue.pop(), queue.pop(), queue.pop(), queue.pop()]).toEqual([
      'urgent-2',
      'urgent-1',
      'a',
      'b',
    ])
  })

  it('队首区耗尽后应转回队尾区', () => {
    const queue = new Queue<number>()
    queue.push(1)
    queue.push(2)
    queue.pushFront(0)
    expect(queue.pop()).toBe(0)
    expect(queue.pop()).toBe(1)
    queue.pushFront(-1)
    expect(queue.pop()).toBe(-1)
    expect(queue.pop()).toBe(2)
    expect(queue.pop()).toBeUndefined()
  })

  it('remove 应移除最前面的匹配项', () => {
    const queue = new Queue<{tag: string}>()
    queue.push({tag: 'a'})
    queue.push({tag: 'b'})
    queue.push({tag: 'a'})
    queue.pushFront({tag: 'a'})

    // 队首区的那一项在最前，应被优先移除
    expect(queue.remove((item) => item.tag === 'a')).toEqual({tag: 'a'})
    expect(queue.toArray()).toEqual([{tag: 'a'}, {tag: 'b'}, {tag: 'a'}])

    expect(queue.remove((item) => item.tag === 'b')).toEqual({tag: 'b'})
    expect(queue.toArray()).toEqual([{tag: 'a'}, {tag: 'a'}])

    expect(queue.remove((item) => item.tag === 'missing')).toBeUndefined()
  })

  it('clear 应清空并让 pop 返回 undefined', () => {
    const queue = new Queue<number>()
    for (let i = 0; i < 100; i++) queue.push(i)
    queue.pushFront(-1)

    queue.clear()

    expect(queue.length).toBe(0)
    expect(queue.toArray()).toEqual([])
    expect(queue.pop()).toBeUndefined()
  })

  it('push/pop 交错多轮后仍保持顺序与长度（压缩不改变语义）', () => {
    const queue = new Queue<number>()
    const expected: number[] = []
    let next = 0

    // 反复制造死前缀，逼出 #compact
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 500; i++) {
        queue.push(next)
        expected.push(next)
        next++
      }
      for (let i = 0; i < 480; i++) {
        expect(queue.pop()).toBe(expected.shift())
      }
      expect(queue.length).toBe(expected.length)
    }

    const drained: number[] = []
    let item = queue.pop()
    while (item !== undefined) {
      drained.push(item)
      item = queue.pop()
    }
    expect(drained).toEqual(expected)
  })

  it.each([1000, 200000])('排干 %i 个元素应保持 O(1) 摊还（回归护栏）', (n) => {
    const queue = new Queue<number>()
    for (let i = 0; i < n; i++) queue.push(i)

    // 计时区间内只做纯队列操作：断言不进循环，否则测的是 expect 的开销。
    const started = performance.now()
    let count = 0
    let ordered = true
    let item = queue.pop()
    while (item !== undefined) {
      if (item !== count) ordered = false
      count++
      item = queue.pop()
    }
    const elapsed = performance.now() - started

    expect(count).toBe(n)
    expect(ordered).toBe(true)
    // Array.shift 排空 200k 实测约 2.3s；此处只应几毫秒。上限放宽到 800ms，
    // 既能容忍慢 CI，又能在退回 O(n²) 时明确失败。
    expect(elapsed).toBeLessThan(800)
  })
})
