import {describe, expect, it} from 'vitest'
import {createPriorityQueue} from './priorityQueue'

// 等待 MessageChannel 任务排干（每次 drain 一个 job）
const flushJobs = (n = 5) => {
  return new Promise((resolve) => {
    let count = 0
    const tick = () => {
      if (++count >= n) resolve(undefined)
      else setTimeout(tick, 0)
    }
    setTimeout(tick, 0)
  })
}

describe('createPriorityQueue', () => {
  it('应该按 FIFO 顺序执行任务', async () => {
    const queue = createPriorityQueue<number>()
    const order: number[] = []

    queue.post({
      run: () => {
        order.push(1)
      },
    })
    queue.post({
      run: () => {
        order.push(2)
      },
    })
    queue.post({
      run: () => {
        order.push(3)
      },
    })

    await flushJobs()
    expect(order).toEqual([1, 2, 3])
  })

  it('紧急任务应该插队到最前面', async () => {
    const queue = createPriorityQueue<number>()
    const order: string[] = []

    queue.post({
      run: () => {
        order.push('regular-1')
      },
    })
    queue.post({
      run: () => {
        order.push('regular-2')
      },
    })
    queue.post(
      {
        run: () => {
          order.push('urgent')
        },
      },
      true,
    )

    await flushJobs()
    expect(order).toEqual(['urgent', 'regular-1', 'regular-2'])
  })

  it('promote 应把已排队的任务提到队首', async () => {
    const queue = createPriorityQueue<number>()
    const order: number[] = []

    queue.post({
      tag: 0,
      run: () => {
        order.push(0)
      },
    })
    queue.post({
      tag: 1,
      run: () => {
        order.push(1)
      },
    })
    queue.post({
      tag: 2,
      run: () => {
        order.push(2)
      },
    })

    // 照片场景：点击了还没就绪的第 2 个 → 提升它
    expect(queue.promote(2)).toBe(true)

    await flushJobs()
    expect(order).toEqual([2, 0, 1])
  })

  it('promote 已在队首的任务应返回 true 且不变序', async () => {
    const queue = createPriorityQueue<number>()
    const order: number[] = []

    queue.post({
      tag: 0,
      run: () => {
        order.push(0)
      },
    })
    queue.post({
      tag: 1,
      run: () => {
        order.push(1)
      },
    })

    expect(queue.promote(0)).toBe(true)
    await flushJobs()
    expect(order).toEqual([0, 1])
  })

  it('promote 不存在的 tag 应返回 false', () => {
    const queue = createPriorityQueue<number>()
    queue.post({tag: 0, run: () => {}})
    expect(queue.promote(99)).toBe(false)
  })

  it('支持异步任务，完成后继续排干', async () => {
    const queue = createPriorityQueue<number>()
    const order: string[] = []

    queue.post({
      run: async () => {
        await new Promise((r) => setTimeout(r, 5))
        order.push('async-job')
      },
    })
    queue.post({
      run: () => {
        order.push('after-async')
      },
    })

    await flushJobs(8)
    expect(order).toEqual(['async-job', 'after-async'])
  })

  it('异步任务失败不应阻塞后续任务，且错误应上报', async () => {
    const errors: unknown[] = []
    const queue = createPriorityQueue<number>({
      onError: (error) => {
        errors.push(error)
      },
    })
    const order: string[] = []

    queue.post({
      run: async () => {
        throw new Error('job failed')
      },
    })
    queue.post({
      run: () => {
        order.push('survivor')
      },
    })

    await flushJobs(8)
    expect(order).toEqual(['survivor'])
    expect(errors.length).toBe(1)
    expect((errors[0] as Error).message).toBe('job failed')
  })

  it('同步抛错的任务应上报且不阻塞后续任务', async () => {
    const errors: unknown[] = []
    const queue = createPriorityQueue<number>({
      onError: (error) => {
        errors.push(error)
      },
    })
    const order: string[] = []

    queue.post({
      run: () => {
        throw new Error('sync boom')
      },
    })
    queue.post({
      run: () => {
        order.push('survivor')
      },
    })

    await flushJobs(8)
    expect(order).toEqual(['survivor'])
    expect(errors.length).toBe(1)
    expect((errors[0] as Error).message).toBe('sync boom')
  })

  it('clear 应清空排队任务', async () => {
    const queue = createPriorityQueue<number>()
    const order: number[] = []

    queue.post({
      run: () => {
        order.push(1)
      },
    })
    queue.post({
      run: () => {
        order.push(2)
      },
    })
    queue.clear()
    expect(queue.size).toBe(0)

    await flushJobs()
    expect(order).toEqual([])
  })

  it('size 应反映等待中的任务数', () => {
    const queue = createPriorityQueue<number>()
    expect(queue.size).toBe(0)

    queue.post({run: () => {}})
    queue.post({run: () => {}})
    expect(queue.size).toBe(2)
  })

  it('post 后任务应异步执行，不阻塞调用方', async () => {
    const queue = createPriorityQueue<number>()
    const order: number[] = []

    queue.post({
      run: () => {
        order.push(1)
      },
    })

    // 关键断言：post 是同步返回的，任务不能在这一刻就执行完
    expect(order).toEqual([])

    await flushJobs()
    expect(order).toEqual([1])
  })

  it('每个 job 应在独立任务中执行（任务之间留出主线程空隙）', async () => {
    const queue = createPriorityQueue<number>()
    const ticks: number[] = []

    // 每个 job 里登记一次 setTimeout：若多个 job 挤在同一任务里，
    // 这些宏任务会全部排在 job 全部执行完之后
    queue.post({
      run: () => {
        ticks.push(0)
        setTimeout(() => ticks.push(1), 0)
      },
    })
    queue.post({
      run: () => {
        ticks.push(2)
        setTimeout(() => ticks.push(3), 0)
      },
    })

    await flushJobs(10)
    // 若 job 之间没有任务边界，顺序会是 0,2,1,3；有边界则是 0,1,2,3
    expect(ticks).toEqual([0, 1, 2, 3])
  })
})
