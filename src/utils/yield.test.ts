import {describe, expect, it, vi} from 'vitest'
import {forEachChunked, forEachInFrames, yieldToMain} from './yield'

describe('yieldToMain', () => {
  it('应该在宏任务边界恢复执行（当前任务结束后）', async () => {
    const order: string[] = []
    const p = yieldToMain().then(() => {
      order.push('after-yield')
    })
    order.push('before-yield')
    await p
    // yield 之前同步代码已执行完，且 after-yield 在微任务链之后运行
    expect(order).toEqual(['before-yield', 'after-yield'])
  })

  it('应该真的让出渲染机会（回归：scheduler.yield 的优先级曾饿死帧生产）', async () => {
    let frames = 0
    let counting = true
    const tick = () => {
      if (!counting) return
      frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    // 10 段 10ms 的重活，中间用 yieldToMain 分隔
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      while (performance.now() - start < 10) {
        /* 占用主线程 */
      }
      await yieldToMain()
    }

    counting = false
    // 若优先用 scheduler.yield（Chromium 实测 frames 仅 1），此断言会失败
    expect(frames).toBeGreaterThan(1)
  })

  it('应该在 abort 信号触发后 reject', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(yieldToMain(controller.signal)).rejects.toBeTruthy()
  })

  it('等待期间 abort 应立即 reject', async () => {
    const controller = new AbortController()
    const promise = yieldToMain(controller.signal)
    controller.abort()
    await expect(promise).rejects.toBeTruthy()
  })

  it('settle 后应移除 abort 监听器（避免长生命周期 signal 泄漏）', async () => {
    const controller = new AbortController()
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener')

    await yieldToMain(controller.signal)

    expect(removeSpy).toHaveBeenCalled()
    removeSpy.mockRestore()
  })

  it('连续多次 yield 应该按序完成', async () => {
    const order: number[] = []
    await Promise.all([
      yieldToMain().then(() => {
        order.push(1)
      }),
      yieldToMain().then(() => {
        order.push(2)
      }),
      yieldToMain().then(() => {
        order.push(3)
      }),
    ])
    expect(order).toEqual([1, 2, 3])
  })

  it('大量并发 yield 都应按 FIFO 顺序 resolve（共享通道不丢唤醒）', async () => {
    const N = 200
    const order: number[] = []

    await Promise.all(
      Array.from({length: N}, (_, i) =>
        yieldToMain().then(() => {
          order.push(i)
        }),
      ),
    )

    expect(order).toEqual(Array.from({length: N}, (_, i) => i))
  })

  it('共享通道：多次 yield 最多只创建一个 MessageChannel', async () => {
    const ctorSpy = vi.spyOn(globalThis, 'MessageChannel')
    try {
      await Promise.all(Array.from({length: 50}, () => yieldToMain()))
      // 懒初始化最多一次；旧实现是每次 yield 新建一个（50 次 × 6.4µs）
      expect(ctorSpy.mock.calls.length).toBeLessThanOrEqual(1)
    } finally {
      ctorSpy.mockRestore()
    }
  })

  it('每个并发 yield 应独占一个任务边界（共享通道不合并任务）', async () => {
    // 任务打点器：自身通过 MessageChannel 不断排队，用来观测“中间有多少个任务”
    const channel = new MessageChannel()
    let ticks = 0
    let running = true
    const tick = () => {
      if (!running) return
      ticks++
      channel.port2.postMessage(null)
    }
    channel.port1.onmessage = tick
    channel.port2.postMessage(null)

    await Promise.all(Array.from({length: 20}, () => yieldToMain()))

    running = false
    channel.port1.close()
    channel.port2.close()

    // 若 20 次 yield 被合并进同一个任务，打点器不会有插进来的机会
    expect(ticks).toBeGreaterThan(1)
  })
})

describe('forEachChunked', () => {
  it('应该处理所有条目并保持顺序', async () => {
    const seen: number[] = []
    await forEachChunked([1, 2, 3, 4, 5], (item) => {
      seen.push(item)
    })
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })

  it('应该把索引传给回调', async () => {
    const indices: number[] = []
    await forEachChunked(['a', 'b', 'c'], (_item, i) => {
      indices.push(i)
    })
    expect(indices).toEqual([0, 1, 2])
  })

  it('应该在每个 chunk 之后让出主线程（真的产生帧机会）', async () => {
    const items = Array.from({length: 20}, (_, i) => i)
    let frames = 0
    let counting = true
    const tick = () => {
      if (!counting) return
      frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    await forEachChunked(
      items,
      () => {
        // 每条占用约 5ms，chunkSize 2 → 总时长足够跨多帧
        const start = performance.now()
        while (performance.now() - start < 5) {
          /* 模拟绘制开销 */
        }
      },
      {chunkSize: 2},
    )

    counting = false
    // 关键断言：让出真的换来了渲染机会，而不只是“跑完了一个长任务”
    expect(frames).toBeGreaterThan(1)
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'chunkSize 为 %s 时应立即 reject RangeError，而不是静默取消让出',
    async (chunkSize) => {
      await expect(forEachChunked([1, 2, 3, 4, 5], () => {}, {chunkSize})).rejects.toBeInstanceOf(
        RangeError,
      )
    },
  )

  it('支持异步回调', async () => {
    const seen: number[] = []
    await forEachChunked(
      [1, 2, 3],
      async (item) => {
        await Promise.resolve()
        seen.push(item)
      },
      {chunkSize: 1},
    )
    expect(seen).toEqual([1, 2, 3])
  })

  it('abort 后应停止处理并 reject', async () => {
    const controller = new AbortController()
    const seen: number[] = []
    const promise = forEachChunked(
      [1, 2, 3, 4, 5],
      (item) => {
        seen.push(item)
        if (item === 2) controller.abort()
      },
      {chunkSize: 1, signal: controller.signal},
    )
    await expect(promise).rejects.toBeTruthy()
    // 中止后不应继续处理后续条目
    expect(seen).toEqual([1, 2])
  })

  it('回调抛错时应向上传播', async () => {
    await expect(
      forEachChunked([1, 2, 3], () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
})

describe('forEachInFrames', () => {
  // 帧计数器：统计测试期间真实经过了多少帧，用于验证“确实让出了渲染机会”
  const startFrameCounter = () => {
    let frames = 0
    let counting = true
    const tick = () => {
      if (!counting) return
      frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => {
      counting = false
      return frames
    }
  }

  it('应该处理所有条目', async () => {
    const seen: number[] = []
    await forEachInFrames(
      [1, 2, 3, 4, 5],
      (item) => {
        seen.push(item)
      },
      {budgetMs: 50},
    ) // 宽松预算，单帧内完成
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })

  it('预算耗尽时应跨帧继续，并真的产生多帧', async () => {
    const seen: number[] = []
    const items = Array.from({length: 20}, (_, i) => i)
    const stopFrames = startFrameCounter()

    // 每项都慢于预算（busy-wait 超过 budgetMs），保证需要多帧
    await forEachInFrames(
      items,
      (item) => {
        seen.push(item)
        const start = performance.now()
        while (performance.now() - start < 5) {
          /* 模拟重计算 */
        }
      },
      {budgetMs: 1},
    )

    const frames = stopFrames()
    expect(seen).toEqual(items)
    // 关键断言：跨帧执行期间渲染机会真实存在（否则只是“跑完了一个长任务”）
    expect(frames).toBeGreaterThan(1)
  })

  it('立即 resolve 的异步回调也必须跨帧（回归：曾在一个任务内跑完，饿死渲染）', async () => {
    const stopFrames = startFrameCounter()

    await forEachInFrames(
      [1, 2, 3, 4, 5],
      async () => {
        await Promise.resolve() // 立即 resolve，不产生任何真实宏任务边界
      },
      {budgetMs: 5},
    )

    const frames = stopFrames()
    // 修复前：整轮在微任务链中完成，frames 只有 1
    expect(frames).toBeGreaterThan(1)
  })

  it('支持异步回调并跨帧完成', async () => {
    const seen: number[] = []
    await forEachInFrames(
      [1, 2, 3],
      async (item) => {
        await new Promise((r) => setTimeout(r, 1))
        seen.push(item)
      },
      {budgetMs: 1},
    )
    expect(seen).toEqual([1, 2, 3])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'budgetMs 为 %s 时应立即 reject RangeError，而不是空转挂死',
    async (budgetMs) => {
      await expect(forEachInFrames([1, 2, 3], () => {}, {budgetMs})).rejects.toBeInstanceOf(
        RangeError,
      )
    },
  )

  it.each([1, 4, 16])('clockSampleEvery=%s 时应处理所有条目', async (clockSampleEvery) => {
    const seen: number[] = []
    await forEachInFrames(
      [1, 2, 3, 4, 5, 6, 7],
      (item) => {
        seen.push(item)
      },
      {budgetMs: 50, clockSampleEvery},
    )
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('clockSampleEvery 应真的减少 performance.now() 调用次数', async () => {
    const items = Array.from({length: 50}, (_, i) => i)

    const nowSpy = vi.spyOn(performance, 'now')
    await forEachInFrames(items, () => {}, {budgetMs: 1000, clockSampleEvery: 16})
    const sampled = nowSpy.mock.calls.length

    nowSpy.mockClear()
    await forEachInFrames(items, () => {}, {budgetMs: 1000, clockSampleEvery: 1})
    const perItem = nowSpy.mock.calls.length
    nowSpy.mockRestore()

    // 每 16 条采样一次：约 4 次读取 vs 约 50 次，差距很大
    expect(sampled).toBeLessThan(perItem / 2)
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'clockSampleEvery 为 %s 时应 reject RangeError',
    async (clockSampleEvery) => {
      await expect(forEachInFrames([1, 2], () => {}, {clockSampleEvery})).rejects.toBeInstanceOf(
        RangeError,
      )
    },
  )

  it('abort 后应 reject', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      forEachInFrames([1, 2, 3], () => {}, {signal: controller.signal}),
    ).rejects.toBeTruthy()
  })

  it('回调抛错时应向上传播', async () => {
    await expect(
      forEachInFrames([1], () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
})
