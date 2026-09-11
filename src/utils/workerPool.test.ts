import {afterEach, describe, expect, it} from 'vitest'
import {WorkerError} from './worker'
import {
  WorkerPool,
  disposeWorkerPool,
  getWorkerPool,
  runInWorkerWithPool,
  workerPoolSymbol,
} from './workerPool'

/**
 * Occupies the worker thread for `ms` so jobs submitted behind it have to queue
 * up. Self-contained, as everything handed to a worker must be.
 */
const spin = (ms: number) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* hold the thread */
  }
  return ms
}

describe('WorkerPool 固定池', () => {
  it('默认上限为 2，并发任务不会把池撑大', async () => {
    const pool = new WorkerPool()
    expect(pool.maxWorkers).toBe(2)

    const jobs = Array.from({length: 6}, () => pool.run(spin, 20))
    // Assignment happens synchronously, so the shape of the pool is visible
    // before any job finishes: two workers busy, four jobs waiting behind them.
    expect(pool.size).toBe(2)
    expect(pool.busy).toBe(2)
    expect(pool.pending).toBe(4)

    await expect(Promise.all(jobs)).resolves.toEqual([20, 20, 20, 20, 20, 20])
    pool.dispose()
  })

  it('maxWorkers 可配置为更大值', async () => {
    const pool = new WorkerPool({maxWorkers: 3})

    const jobs = Array.from({length: 6}, () => pool.run(spin, 15))
    expect(pool.size).toBe(3)
    expect(pool.busy).toBe(3)

    await Promise.all(jobs)
    pool.dispose()
  })

  it('顺序任务只懒创建一个 worker，空闲也不回收', async () => {
    const pool = new WorkerPool()

    expect(await pool.run((n: number) => n + 1, 1)).toBe(2)
    expect(await pool.run((n: number) => n + 1, 2)).toBe(3)
    expect(await pool.run((n: number) => n + 1, 3)).toBe(4)

    expect(pool.size).toBe(1)
    pool.dispose()
  })

  it('通用 worker：不同函数源码共用同一批 worker', async () => {
    const pool = new WorkerPool()

    // The source travels with the job, so a different function does NOT need a
    // different worker — this is what lets one pool serve every caller.
    expect(await pool.run((n: number) => n + 1, 1)).toBe(2)
    expect(await pool.run((s: string) => s.toUpperCase(), 'ab')).toBe('AB')
    expect(pool.size).toBe(1)

    pool.dispose()
  })

  it('并发提交时两个 worker 同时忙碌', async () => {
    const pool = new WorkerPool()

    const a = pool.run(spin, 40)
    const b = pool.run(spin, 40)
    expect(pool.size).toBe(2)
    expect(pool.busy).toBe(2)
    expect(pool.pending).toBe(0)

    await expect(Promise.all([a, b])).resolves.toEqual([40, 40])
    pool.dispose()
  })

  it('结果为空值时也能正确回传（信封按键判断）', async () => {
    const pool = new WorkerPool()

    await expect(pool.run(() => undefined, null)).resolves.toBeUndefined()
    await expect(pool.run(() => null, null)).resolves.toBeNull()
    await expect(pool.run(() => 0, null)).resolves.toBe(0)

    pool.dispose()
  })

  it('worker 内抛错应以 WorkerError reject，之后 worker 仍可用', async () => {
    const pool = new WorkerPool()

    await expect(
      pool.run(() => {
        throw new Error('pool boom')
      }, null),
    ).rejects.toBeInstanceOf(WorkerError)

    // A job-level throw is caught inside the worker; the worker itself lives on.
    expect(await pool.run((n: number) => n * 2, 21)).toBe(42)
    pool.dispose()
  })

  it('参数不可克隆时应 reject，且池仍可用', async () => {
    const pool = new WorkerPool()

    await expect(
      pool.run(
        (x: unknown) => x,
        () => {},
      ),
    ).rejects.toBeInstanceOf(WorkerError)
    expect(await pool.run((n: number) => n + 1, 41)).toBe(42)

    pool.dispose()
  })

  it('transfer 选项应零拷贝转移 ArrayBuffer', async () => {
    const pool = new WorkerPool()
    const buf = new ArrayBuffer(4)

    const size = await pool.run((b: ArrayBuffer) => new Uint8Array(b).length, buf, {
      transfer: [buf],
    })

    expect(size).toBe(4)
    expect(buf.byteLength).toBe(0)
    pool.dispose()
  })

  it('resultTransfer 应把结果里的 buffer 移出 worker', async () => {
    const pool = new WorkerPool()

    const result = await pool.run(
      (n: number) => {
        const out = new Uint8Array(n)
        out.fill(5)
        return {out, size: n}
      },
      3,
      {resultTransfer: ['out']},
    )

    expect(result.size).toBe(3)
    expect(Array.from(result.out)).toEqual([5, 5, 5])
    pool.dispose()
  })

  it('空闲 worker 会窃取忙碌 worker 尚未开始的任务', async () => {
    const pool = new WorkerPool({maxWorkers: 2})

    // The first worker finishes in ~10ms, the second holds on for ~200ms. The
    // four instant jobs queue up behind both; the worker that frees first has
    // to take over the other's backlog to stay busy.
    const results = await Promise.all([
      pool.run(spin, 10),
      pool.run(spin, 200),
      pool.run(spin, 0),
      pool.run(spin, 0),
      pool.run(spin, 0),
      pool.run(spin, 0),
    ])

    expect(results).toEqual([10, 200, 0, 0, 0, 0])
    expect(pool.stolen).toBeGreaterThan(0)
    pool.dispose()
  })

  it('单个 worker 交替执行不同函数时编译缓存不得串味', async () => {
    const pool = new WorkerPool({maxWorkers: 1})
    const double = (n: number) => n * 2
    const negate = (n: number) => -n

    // 50 个任务在同一个 worker 上交替使用两份源码：如果 worker 内的编译缓存
    // 键错位，就会拿上一次的函数去算下一次的任务。
    const results = await Promise.all(
      Array.from({length: 50}, (_, i) => (i % 2 === 0 ? pool.run(double, i) : pool.run(negate, i))),
    )

    expect(results).toEqual(Array.from({length: 50}, (_, i) => (i % 2 === 0 ? i * 2 : -i)))
    pool.dispose()
  })

  it('dispose 应终止 worker 并 reject 在途/排队任务', async () => {
    const pool = new WorkerPool({maxWorkers: 1})
    const inFlight = pool.run(spin, 50)
    const queued = pool.run(spin, 1)
    expect(pool.pending).toBe(1)

    pool.dispose()

    await expect(inFlight).rejects.toBeInstanceOf(WorkerError)
    await expect(queued).rejects.toBeInstanceOf(WorkerError)
    expect(pool.size).toBe(0)
  })

  it('dispose 后 run 应 reject', async () => {
    const pool = new WorkerPool()
    pool.dispose()

    await expect(pool.run((n: number) => n, 1)).rejects.toBeInstanceOf(WorkerError)
  })

  it('maxWorkers 非法时应抛 RangeError', () => {
    expect(() => new WorkerPool({maxWorkers: 0})).toThrow(RangeError)
    expect(() => new WorkerPool({maxWorkers: 1.5})).toThrow(RangeError)
    expect(() => new WorkerPool({maxWorkers: -1})).toThrow(RangeError)
  })
})

describe('workerPool 全局懒单例', () => {
  afterEach(() => {
    disposeWorkerPool()
  })

  it('首次访问前不存在实例，访问后返回同一实例', () => {
    disposeWorkerPool()
    const scope = globalThis as unknown as Record<symbol, unknown>
    expect(scope[workerPoolSymbol]).toBeUndefined()

    const a = getWorkerPool()
    const b = getWorkerPool()

    expect(a).toBe(b)
    expect(scope[workerPoolSymbol]).toBe(a)
  })

  it('disposeWorkerPool 后应能重建新实例', () => {
    const a = getWorkerPool()
    disposeWorkerPool()
    const b = getWorkerPool()
    expect(b).not.toBe(a)
  })

  it('runInWorkerWithPool 应走共享池并复用 worker', async () => {
    const result = await runInWorkerWithPool((n: number) => n + 41, 1)
    expect(result).toBe(42)
    expect(getWorkerPool().size).toBe(1)

    // 同一函数再调一次：不新增 worker
    await runInWorkerWithPool((n: number) => n + 41, 2)
    expect(getWorkerPool().size).toBe(1)
  })

  it('runInWorkerWithPool 应支持零拷贝 transfer', async () => {
    const buf = new ArrayBuffer(4)
    const len = await runInWorkerWithPool((b: ArrayBuffer) => new Uint8Array(b).length, buf, {
      transfer: [buf],
    })

    expect(len).toBe(4)
    expect(buf.byteLength).toBe(0)
  })

  it('runInWorkerWithPool 的错误应回传为 WorkerError', async () => {
    await expect(
      runInWorkerWithPool(() => {
        throw new Error('pooled boom')
      }, null),
    ).rejects.toBeInstanceOf(WorkerError)
  })
})
