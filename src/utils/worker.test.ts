import {describe, expect, it} from 'vitest'
import {WorkerError, postTransferable} from './worker'

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
