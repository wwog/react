import {describe, expect, it, vi} from 'vitest'
import {WorkerError, postTransferable, runInWorker} from './worker'

describe('runInWorker', () => {
  it('应该把纯计算送到 worker 执行并返回结果', async () => {
    const result = await runInWorker((n: number) => {
      let acc = 0
      for (let i = 1; i <= n; i++) acc += i
      return acc
    }, 100)
    expect(result).toBe(5050)
  })

  it('应该支持异步函数', async () => {
    const result = await runInWorker(
      async (xs: number[]) => {
        await Promise.resolve()
        return xs.reduce((a, b) => a + b, 0)
      },
      [1, 2, 3, 4],
    )
    expect(result).toBe(10)
  })

  it('应该结构化克隆复杂参数', async () => {
    const result = await runInWorker(
      (data: {list: string[]; map: Record<string, number>}) => {
        return {count: data.list.length, sum: data.map.a + data.map.b}
      },
      {list: ['x', 'y'], map: {a: 1, b: 2}},
    )
    expect(result).toEqual({count: 2, sum: 3})
  })

  it('worker 内抛错时应以 WorkerError reject', async () => {
    await expect(
      runInWorker(() => {
        throw new Error('inner boom')
      }, null),
    ).rejects.toBeInstanceOf(WorkerError)
  })

  it('worker 执行后应被终止（不泄漏）', async () => {
    const terminateSpy = vi.spyOn(Worker.prototype, 'terminate')

    await runInWorker((n: number) => n * 2, 21)

    // 真正观测终止行为，而不是只看返回值是否正确
    expect(terminateSpy).toHaveBeenCalledTimes(1)
    terminateSpy.mockRestore()
  })

  it('worker 内抛错后也应被终止', async () => {
    const terminateSpy = vi.spyOn(Worker.prototype, 'terminate')

    await expect(
      runInWorker(() => {
        throw new Error('boom')
      }, null),
    ).rejects.toBeInstanceOf(WorkerError)

    expect(terminateSpy).toHaveBeenCalledTimes(1)
    terminateSpy.mockRestore()
  })

  it('transfer 选项应该零拷贝转移 ArrayBuffer', async () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set([1, 2, 3, 4, 5, 6, 7, 8])

    const result = await runInWorker(
      (arr: ArrayBuffer) => {
        const view = new Uint8Array(arr)
        let sum = 0
        for (const b of view) sum += b
        return {sum, len: arr.byteLength}
      },
      buf,
      {transfer: [buf]},
    )

    expect(result).toEqual({sum: 36, len: 8})
    // 所有权已转移：主线程侧 buffer 被分离
    expect(buf.byteLength).toBe(0)
  })
  it('resultTransfer 应把结果里的 buffer 移出 worker', async () => {
    const result = await runInWorker(
      (n: number) => {
        const out = new ArrayBuffer(n)
        new Uint8Array(out).fill(3)
        return {out, size: n}
      },
      4,
      {resultTransfer: ['out']},
    )

    expect(result.size).toBe(4)
    expect(new Uint8Array(result.out)).toEqual(new Uint8Array([3, 3, 3, 3]))
  })

  it('resultTransfer 支持嵌套路径与 TypedArray（转移其底层 buffer）', async () => {
    const result = await runInWorker(
      () => {
        const view = new Uint16Array([1, 2, 3])
        return {meta: {buf: view}}
      },
      null,
      {resultTransfer: ['meta.buf']},
    )

    expect(Array.from(result.meta.buf)).toEqual([1, 2, 3])
  })

  it("resultTransfer 的 '.' 应转移结果本身", async () => {
    const out = await runInWorker((n: number) => new Uint8Array(n).fill(9).buffer, 3, {
      resultTransfer: ['.'],
    })

    expect(new Uint8Array(out)).toEqual(new Uint8Array([9, 9, 9]))
  })

  it('resultTransfer 路径写错时应退化为拷贝而不是失败', async () => {
    const result = await runInWorker(() => ({value: 1}), null, {
      resultTransfer: ['nope.missing'],
    })

    expect(result).toEqual({value: 1})
  })
})

describe('postTransferable', () => {
  it('应该把消息发给 worker 并以 Promise 取回回复', async () => {
    const worker = new Worker(
      URL.createObjectURL(
        new Blob(["self.onmessage = (e) => self.postMessage(e.data + '!')"], {
          type: 'text/javascript',
        }),
      ),
    )

    const reply = await postTransferable<string, string>(worker, 'hello')
    expect(reply).toBe('hello!')

    worker.terminate()
  })

  it('worker 报错时应该以 WorkerError reject', async () => {
    const worker = new Worker(
      URL.createObjectURL(
        new Blob(["self.onmessage = () => { throw new Error('worker boom') }"], {
          type: 'text/javascript',
        }),
      ),
    )

    // 触发 worker 脚本
    const promise = postTransferable(worker, null)
    await expect(promise).rejects.toBeInstanceOf(WorkerError)

    worker.terminate()
  })

  it('转移 ArrayBuffer 后主线程侧应被 detach', async () => {
    const worker = new Worker(
      URL.createObjectURL(
        new Blob(['self.onmessage = (e) => self.postMessage(new Uint8Array(e.data.buf).length)'], {
          type: 'text/javascript',
        }),
      ),
    )

    const buf = new ArrayBuffer(4)
    const len = await postTransferable<{buf: ArrayBuffer}, number>(worker, {buf}, [buf])

    expect(len).toBe(4)
    expect(buf.byteLength).toBe(0)

    worker.terminate()
  })
})
