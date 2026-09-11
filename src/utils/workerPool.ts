/**
 * @en Pooling: a small, fixed set of workers shared by every job — worker
 * startup is paid once instead of once per call, and an idle worker steals
 * work that has been assigned but has not started yet.
 *
 * The pool holds at most `maxWorkers` workers (default 2) and never grows past
 * that. Workers are created on demand as jobs arrive, up to the cap, and are
 * never terminated while the pool lives. Unlike {@link runInWorker}, which
 * starts and stops a worker per call, a worker here is reused for the next job.
 *
 * The workers are generic: a job carries its function's source and rebuilds it
 * inside the worker, so any job can run on any worker — which is what makes
 * stealing possible at all. Workers cannot see each other's queues, so the main
 * thread runs the whole show:
 *
 * 1. Assign — a submitted job goes to the least-loaded worker (fewest jobs in
 *    flight plus queued). An idle worker starts it immediately; otherwise the
 *    job waits in that worker's own queue.
 * 2. Steal — when a worker falls idle it drains its own queue first; if that is
 *    empty, it looks for the busiest still-busy worker and takes the job that
 *    has waited longest. A job that has not started carries no side effects, so
 *    moving it is free. A job already running cannot be stolen.
 *
 * That is a work-stealing scheduler minus the threads: the queues are plain
 * arrays on the main thread, and the workers are the only real parallelism. It
 * pays off when many jobs of uneven duration are submitted at once — the worker
 * that finishes early takes over the backlog of the one still grinding, instead
 * of sitting idle. The queues themselves pop in O(1) (see {@link Queue}), so a
 * deep backlog costs no more per job than a shallow one.
 *
 * Two things follow from a shared, generic pool. Jobs are no longer serialized
 * per function: two calls can run in parallel on different workers, so `await`
 * when order matters. And the function source is rebuilt inside the worker with
 * `new Function`, so the worker script needs a CSP that allows `unsafe-eval` —
 * stricter than {@link runInWorker}'s `worker-src blob:`.
 *
 * @zh 池化（Pooling）：一小组固定的 worker 被所有任务共享——启动成本只付一次而非
 * 每次调用一次，空闲的 worker 还会窃取“已分配但尚未开始”的任务。
 *
 * 池内最多 `maxWorkers` 个 worker（默认 2），永不越界。worker 随任务到达按需创建
 * （不超过上限），池存活期间不会被回收。与每次调用都新建/销毁 worker 的
 * {@link runInWorker} 不同，这里的 worker 会被下一个任务复用。
 *
 * worker 是通用的：任务自带函数源码，在 worker 内重建——因此任何任务都能跑在任何
 * worker 上，这正是窃取得以成立的前提。worker 之间看不到彼此的队列，所以一切都由
 * 主线程调度：
 *
 * 1. 分配——提交的任务交给“负载最轻”的 worker（在途 + 排队最少）。空闲 worker
 *    立即开跑；否则任务在该 worker 的本地队列里等待。
 * 2. 窃取——worker 空闲时先清自己的队列；若已空，就找“尚未开始任务”堆积最多的
 *    忙碌 worker，取走其中等待最久的一个。尚未开始的任务没有副作用，搬走是免费的；
 *    已在执行的任务不可被窃取。
 *
 * 这就是去掉线程的工作窃取调度器：队列是主线程上的普通数组，worker 是唯一的真实并行。
 * 任务多、耗时不均时收益最明显——先做完的 worker 会接管还在苦干的 worker 的积压，
 * 而不是闲着。队列取出是 O(1)（见 {@link Queue}），因此积压很深时每个任务的成本也与
 * 积压很浅时相同。
 *
 * 共享的通用池带来两个后果。任务不再按函数串行：两个调用可能在不同 worker 上并行，
 * 需要顺序时请 `await`。并且函数源码在 worker 内由 `new Function` 重建，因此 worker
 * 脚本需要允许 `unsafe-eval` 的 CSP（比 {@link runInWorker} 的 `worker-src blob:`
 * 更严格）。
 */

import {Queue} from './queue'
import {
  WorkerError,
  type WorkerFn,
  type WorkerReplyChannel,
  type WorkerRunOptions,
  createWorkerScript,
  readWorkerReply,
} from './worker'

/**
 * @en Options for {@link WorkerPool}.
 * @zh {@link WorkerPool} 的选项。
 */
export interface WorkerPoolOptions {
  /**
   * @en Hard upper bound on live workers. The pool starts workers on demand,
   * up to this many, and never grows past it; idle workers are kept rather than
   * recycled. Default `2`.
   * @zh 存活 worker 的硬上限。池按需启动 worker，最多到此数量，绝不越界；空闲
   * worker 会被保留而非回收。默认 `2`。
   */
  maxWorkers?: number
}

/**
 * @en A submitted job: the work, the paths to move out of its result, and the
 * promise it will settle.
 * @zh 一个已提交的任务：工作内容、结果中要按零拷贝移出的路径，以及将要结算的 Promise。
 */
interface PoolJob {
  /** Function source, resolved on the main thread. */
  readonly source: string
  readonly arg: unknown
  readonly transfer: Transferable[] | undefined
  readonly paths: string[]
  readonly resolve: (value: unknown) => void
  readonly reject: (error: unknown) => void
}

/**
 * @en Serialized function sources, keyed by the function object.
 *
 * Solves two per-job costs. `fn.toString()` would otherwise run on every
 * submission (cheap, but pointless when the same function is submitted
 * thousands of times), and each job would hold its OWN copy of the source
 * string — thousands of pending jobs, thousands of duplicate strings. Sharing
 * one instance per function keeps the string alive only as long as the function
 * itself.
 *
 * The source still travels to the worker on every job, deliberately: a job can
 * be stolen by a different worker, or the original worker can die and be
 * replaced, and either way the job must arrive self-sufficient. Paying a
 * ~100ns string copy per job is what makes those two cases correct without a
 * registration handshake.
 *
 * @zh 按函数对象缓存的序列化源码。
 *
 * 它消除两项逐任务开销。否则每次提交都要跑一遍 `fn.toString()`（本身很便宜，但同一
 * 个函数被提交上千次时毫无意义），而且每个任务各自持有一份源码字符串——成千上万个
 * 待执行任务就是成千上万份重复字符串。按函数共享一份实例，字符串的生命周期只跟随
 * 函数本身。
 *
 * 源码仍会在每个任务中传往 worker，这是刻意的：任务可能被别的 worker 窃取，或者
 * 原 worker 崩溃后被替换，无论哪种情况，任务都必须自给自足地到达。代价是每任务约
 * 100ns 的字符串拷贝，换来这两个场景无需任何注册握手即成立。
 */
const sourceCache = new WeakMap<object, string>()

const workerSource = <Arg, Result>(fn: WorkerFn<Arg, Result>): string => {
  let source = sourceCache.get(fn)
  if (source === undefined) {
    source = fn.toString()
    sourceCache.set(fn, source)
  }
  return source
}

/**
 * @en One live worker of the pool. Holds its own local queue of assigned jobs
 * and runs at most one at a time, so replies are matched positionally.
 * @zh 池中的一个存活 worker。持有自己的本地已分配任务队列，同时最多执行一个，
 * 因此回包按位置匹配。
 */
class PoolWorker {
  #worker: Worker
  #queue = new Queue<PoolJob>()
  #current: PoolJob | undefined
  #dead = false
  readonly #channel: WorkerReplyChannel
  readonly #onIdle: () => void
  readonly #onFail: (worker: PoolWorker, queued: PoolJob[], error: unknown) => void

  constructor(
    scriptUrl: string,
    channel: WorkerReplyChannel,
    onIdle: () => void,
    onFail: (worker: PoolWorker, queued: PoolJob[], error: unknown) => void,
  ) {
    this.#channel = channel
    this.#onIdle = onIdle
    this.#onFail = onFail
    this.#worker = new Worker(scriptUrl, {type: 'module'})
    this.#worker.addEventListener('message', (event: MessageEvent) => {
      this.#settle(event.data)
    })
    this.#worker.addEventListener('error', (event: ErrorEvent) => {
      this.#fail(new WorkerError(`Worker error: ${event.message}`, event.message))
    })
  }

  /**
   * @en Whether this worker is gone and must not be used again.
   * @zh 该 worker 是否已失效、不可再用。
   */
  get dead(): boolean {
    return this.#dead
  }

  /**
   * @en Whether a job is currently executing.
   * @zh 当前是否有任务在执行。
   */
  get busy(): boolean {
    return this.#current !== undefined
  }

  /**
   * @en Number of assigned jobs waiting behind the running one.
   * @zh 排在执行中任务之后、已分配但尚未开始的任务数。
   */
  get queued(): number {
    return this.#queue.length
  }

  /**
   * @en Total outstanding jobs (running + queued) — the load used to balance.
   * @zh 未完成的任务总数（在执行 + 已排队）——用于负载均衡。
   */
  get load(): number {
    return this.#queue.length + (this.#current ? 1 : 0)
  }

  /**
   * @en Put a job in the local queue without starting it. The pool decides when
   * it runs — and another idle worker may steal it first.
   * @zh 把任务放进本地队列但不启动。何时执行由池决定——也可能先被其他空闲 worker
   * 窃取。
   */
  enqueue(job: PoolJob): void {
    this.#queue.push(job)
  }

  /**
   * @en Take the longest-waiting queued job (for dispatch or for a thief).
   * @zh 取出等待最久的一个排队任务（用于派发或被窃取）。
   */
  take(): PoolJob | undefined {
    return this.#queue.pop()
  }

  /**
   * @en Start `job` now. The caller must know this worker is idle.
   * @returns `false` when the job could not even be sent (for example its data
   *   is not cloneable); the job is rejected and the worker stays idle.
   * @zh 立即启动 `job`。调用方需确保该 worker 空闲。返回 `false` 表示任务根本没能
   * 发出（例如数据不可克隆）；此时任务被 reject，worker 保持空闲。
   */
  dispatch(job: PoolJob): boolean {
    this.#current = job
    const message = {source: job.source, arg: job.arg, paths: job.paths}
    try {
      if (job.transfer?.length) {
        this.#worker.postMessage(message, job.transfer)
      } else {
        this.#worker.postMessage(message)
      }
      return true
    } catch (error) {
      this.#current = undefined
      job.reject(error instanceof Error ? new WorkerError(`WorkerPool: ${error.message}`) : error)
      return false
    }
  }

  /**
   * @en Terminate the worker and hand back every job that has not finished,
   * running one included — its reply will never arrive now.
   * @zh 终止 worker 并交回所有未完成的任务（含正在执行的那个——其回包不会再到达）。
   */
  terminate(): PoolJob[] {
    if (this.#dead) return []
    this.#dead = true
    this.#worker.terminate()
    const pending = this.#queue.toArray()
    this.#queue.clear()
    if (this.#current) pending.unshift(this.#current)
    this.#current = undefined
    return pending
  }

  #settle(reply: unknown): void {
    if (this.#dead) return
    const job = this.#current
    this.#current = undefined
    if (job) {
      const decoded = readWorkerReply(reply, this.#channel)
      if (decoded.ok) {
        job.resolve(decoded.value)
      } else {
        job.reject(new WorkerError(`Worker function threw: ${decoded.error}`))
      }
    }
    this.#onIdle()
  }

  #fail(error: unknown): void {
    if (this.#dead) return
    // The job that was running dies with the worker; the ones behind it never
    // started, so they are handed back to be re-homed on a healthy worker.
    const inFlight = this.#current
    this.#current = undefined
    this.#dead = true
    this.#worker.terminate()
    const queued = this.#queue.toArray()
    this.#queue.clear()
    if (inFlight) inFlight.reject(error)
    this.#onFail(this, queued, error)
  }
}

/**
 * @en A fixed-size pool of generic workers with least-loaded assignment and
 * work stealing. See the module header for the full picture.
 *
 * @example
 * ```ts
 * const pool = new WorkerPool({maxWorkers: 2})
 * // Any function can run on any worker; the pool keeps two of them busy.
 * const totals = await Promise.all(chunks.map((c) => pool.run(sum, c)))
 * pool.dispose()
 * ```
 *
 * @zh 固定大小的通用 worker 池，按最轻负载分配并支持工作窃取。完整说明见模块头。
 */
export class WorkerPool {
  #workers: PoolWorker[] = []
  #backlog = new Queue<PoolJob>()
  readonly #maxWorkers: number
  readonly #channel: WorkerReplyChannel
  #scriptUrl: string
  #cursor = 0
  #stolen = 0
  #scheduling = false
  #disposed = false

  constructor(options: WorkerPoolOptions = {}) {
    const maxWorkers = options.maxWorkers ?? 2
    if (!Number.isInteger(maxWorkers) || maxWorkers < 1) {
      throw new RangeError(
        `WorkerPool: maxWorkers must be a positive integer, received ${maxWorkers}`,
      )
    }
    this.#maxWorkers = maxWorkers

    // A per-pool tag keeps the reply envelope from colliding with a job's own
    // result, so a result object that happens to carry a similar key is safe.
    const tag = Math.random().toString(36).slice(2, 10)
    this.#channel = {
      okKey: `__wwogPoolOk_${tag}__`,
      errKey: `__wwogPoolErr_${tag}__`,
    }
    this.#scriptUrl = URL.createObjectURL(
      new Blob([createWorkerScript(this.#channel)], {type: 'text/javascript'}),
    )
  }

  /**
   * @en Number of live workers currently held.
   * @zh 当前持有的存活 worker 数量。
   */
  get size(): number {
    return this.#workers.length
  }

  /**
   * @en The configured upper bound on workers.
   * @zh 配置的 worker 上限。
   */
  get maxWorkers(): number {
    return this.#maxWorkers
  }

  /**
   * @en Jobs assigned but not yet started, across every worker.
   * @zh 已分配但尚未开始的任务总数（跨所有 worker）。
   */
  get pending(): number {
    let total = this.#backlog.length
    for (const worker of this.#workers) total += worker.queued
    return total
  }

  /**
   * @en Number of workers currently executing a job.
   * @zh 当前正在执行任务的 worker 数量。
   */
  get busy(): number {
    let total = 0
    for (const worker of this.#workers) if (worker.busy) total++
    return total
  }

  /**
   * @en How many jobs have been taken from another worker's queue so far —
   * the count of steals, useful for seeing whether the balance is working.
   * @zh 至今从其他 worker 队列中窃取的任务数——窃取次数，可用于观察负载是否均衡。
   */
  get stolen(): number {
    return this.#stolen
  }

  /**
   * @en Whether the pool has been disposed.
   * @zh 池是否已销毁。
   */
  get disposed(): boolean {
    return this.#disposed
  }

  /**
   * @en Submit `fn` to run on the pool. The job goes to the least-loaded worker
   * and starts there, or waits in that worker's queue to be stolen by whoever
   * frees up next.
   *
   * Same rules as {@link runInWorker}: `fn` is serialized with `toString()`, so
   * it must not capture outer variables, and it receives and returns
   * structured-cloneable data.
   *
   * @param fn Self-contained function to run in a worker.
   * @param arg Argument passed to `fn`.
   * @param options See {@link WorkerRunOptions} — `transfer` for buffers going
   *   in, `resultTransfer` for buffers coming back.
   * @returns Promise resolving with `fn`'s result.
   * @zh 把 `fn` 提交到池上执行。任务交给负载最轻的 worker 并就地启动，或在该 worker
   * 的队列中等待被下一个空闲者窃取。
   *
   * 规则同 {@link runInWorker}：`fn` 用 `toString()` 序列化，不能捕获外部变量，
   * 收发数据需可结构化克隆。
   */
  run<Arg, Result>(
    fn: WorkerFn<Arg, Result>,
    arg: Arg,
    options: WorkerRunOptions = {},
  ): Promise<Result> {
    if (this.#disposed) {
      return Promise.reject(new WorkerError('WorkerPool has been disposed'))
    }
    return new Promise<Result>((resolve, reject) => {
      const job: PoolJob = {
        source: workerSource(fn),
        arg,
        transfer: options.transfer,
        paths: options.resultTransfer ?? [],
        resolve: resolve as (value: unknown) => void,
        reject,
      }
      // A job is assigned before it runs: pick a worker, then let the scheduler
      // start it — or leave it queued where an idle worker can steal it.
      this.#ensureCapacity()
      this.#assign(job)
      this.#schedule()
    })
  }

  /**
   * @en Terminate every worker, release the script URL and reject all in-flight
   * and queued jobs.
   * @zh 终止所有 worker、释放脚本 URL，并 reject 全部在途与排队任务。
   */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    const pending = this.#backlog.toArray()
    this.#backlog.clear()
    for (const worker of this.#workers) pending.push(...worker.terminate())
    this.#workers = []
    URL.revokeObjectURL(this.#scriptUrl)
    for (const job of pending) job.reject(new WorkerError('WorkerPool has been disposed'))
  }

  /**
   * @en Spawn a worker when a job needs one and every existing worker is busy,
   * but never past `maxWorkers`. Keeping a free worker around (instead of
   * growing for a sequential workload) is why the pool is not "dynamic": it
   * expands to the cap and stops there.
   * @zh 当有任务需要、而现有 worker 全忙时启动一个，但不超过 `maxWorkers`。
   * 已有空闲 worker 就不再扩张——所以顺序任务只会用到一个 worker。这也是池“不动态
   * 扩张”的含义：最多扩到上限即止。
   */
  #ensureCapacity(): void {
    if (this.#workers.length >= this.#maxWorkers) return
    for (const worker of this.#workers) {
      if (!worker.busy && !worker.dead) return
    }
    this.#createWorker()
  }

  #createWorker(): void {
    const worker = new PoolWorker(
      this.#scriptUrl,
      this.#channel,
      () => this.#schedule(),
      (failed, queued, error) => this.#handleFailure(failed, queued, error),
    )
    this.#workers.push(worker)
  }

  /**
   * @en Pick the least-loaded worker (fewest outstanding jobs) and put the job
   * in its queue. Ties rotate, so equal workers take turns. With no live worker
   * the job waits in the backlog until one exists.
   * @zh 选择负载最轻的 worker（未完成任务最少）并把任务放进其队列。平局时轮转，
   * 让同样轻的 worker 轮流接活。没有存活 worker 时任务留在 backlog 等待。
   */
  #assign(job: PoolJob): void {
    const count = this.#workers.length
    let target = -1
    let least = Number.POSITIVE_INFINITY
    for (let i = 0; i < count; i++) {
      const index = (this.#cursor + i) % count
      const worker = this.#workers[index]!
      if (worker.dead) continue
      if (worker.load < least) {
        least = worker.load
        target = index
      }
    }
    if (target === -1) {
      this.#backlog.push(job)
      return
    }
    this.#cursor = (target + 1) % count
    this.#workers[target]!.enqueue(job)
  }

  /**
   * @en Hand work to every idle worker: a backlog job first, then its own
   * queue, then — nothing left of its own — a steal from the busiest worker.
   * @zh 给每个空闲 worker 派活：先取 backlog，再取自己的队列，自己没活了就去最忙的
   * worker 那里窃取。
   */
  #schedule(): void {
    if (this.#disposed || this.#scheduling) return
    this.#scheduling = true
    try {
      for (const worker of this.#workers) {
        if (worker.busy || worker.dead) continue
        while (!worker.busy && !worker.dead) {
          const job = this.#backlog.pop() ?? worker.take() ?? this.#stealFor(worker)
          if (!job) break
          // A job that fails to send is rejected and the worker stays idle, so
          // the loop simply offers it the next one.
          worker.dispatch(job)
        }
      }
    } finally {
      this.#scheduling = false
    }
  }

  /**
   * @en Take a not-yet-started job from the busy worker holding the longest
   * queue. Only busy workers are considered: an idle worker's queue drains on
   * its own, and an in-flight job cannot be moved.
   * @zh 从“尚未开始任务”堆积最多的忙碌 worker 那里取走一个。只考虑忙碌 worker：
   * 空闲 worker 的队列会自行排干，而在执行中的任务无法搬移。
   */
  #stealFor(thief: PoolWorker): PoolJob | undefined {
    let donor: PoolWorker | undefined
    let mostQueued = 0
    for (const worker of this.#workers) {
      if (worker === thief || worker.dead || !worker.busy) continue
      if (worker.queued > mostQueued) {
        mostQueued = worker.queued
        donor = worker
      }
    }
    const job = donor?.take()
    if (job) this.#stolen++
    return job
  }

  #handleFailure(worker: PoolWorker, queued: PoolJob[], error: unknown): void {
    const index = this.#workers.indexOf(worker)
    if (index !== -1) this.#workers.splice(index, 1)

    // Re-home jobs that never started rather than losing them.
    for (const job of queued) this.#backlog.push(job)
    this.#schedule()

    // With no worker left there is nothing to run them on, and a replacement
    // would fail the same way (e.g. CSP forbids the worker script). Surface the
    // failure instead of letting the promises hang forever.
    if (this.#workers.length === 0 && this.#backlog.length > 0) {
      const stranded = this.#backlog.toArray()
      this.#backlog.clear()
      for (const job of stranded) job.reject(error)
    }
  }
}

/**
 * @en Global registry key for the library-wide {@link WorkerPool} singleton.
 * `Symbol.for` keeps the key stable across duplicate copies of this library, so
 * any module — or any other bundle — resolves the same pool.
 * @zh 全局共享的 {@link WorkerPool} 单例注册键。使用 `Symbol.for` 让该键在库的多份
 * 副本间保持稳定，任何模块乃至其他 bundle 都能解析到同一个池。
 */
export const workerPoolSymbol: symbol = Symbol.for('@wwog/react/workerPool')

/**
 * @en Get the shared {@link WorkerPool}, creating it on first access — the Rust
 * `LazyCell`/`OnceCell` pattern. No instance exists before the first call, and
 * no worker is spawned until the first job, so merely importing this library
 * never starts one.
 * @zh 获取共享的 {@link WorkerPool}，首次访问时创建——对应 Rust 的
 * `LazyCell`/`OnceCell` 模式。首次调用前不存在实例，首个任务前不会创建 worker，
 * 因此仅导入本库不会启动任何 worker。
 * @returns The process-wide pool instance.
 */
export function getWorkerPool(): WorkerPool {
  const scope = globalThis as unknown as Record<symbol, WorkerPool | undefined>
  let pool = scope[workerPoolSymbol]
  if (!pool) {
    pool = new WorkerPool()
    scope[workerPoolSymbol] = pool
  }
  return pool
}

/**
 * @en Tear down the shared pool: terminate its workers, release the script URL
 * and drop the global instance so the next {@link getWorkerPool} creates a
 * fresh one. Useful in tests and on app teardown.
 * @zh 销毁共享池：终止其 worker、释放脚本 URL，并移除全局实例，使下次
 * {@link getWorkerPool} 创建全新实例。适用于测试与应用卸载。
 */
export function disposeWorkerPool(): void {
  const scope = globalThis as unknown as Record<symbol, WorkerPool | undefined>
  const pool = scope[workerPoolSymbol]
  if (!pool) return
  pool.dispose()
  delete scope[workerPoolSymbol]
}

/**
 * @en Pooled variant of {@link runInWorker}: runs `fn` through the shared
 * {@link WorkerPool}, so repeated calls reuse workers instead of paying startup
 * (~1.5ms) every time — and a batch of uneven jobs is spread across the pool by
 * least-loaded assignment and stealing.
 *
 * Solves: a batch of independent jobs — generating 60 thumbnails, parsing 30
 * chunks — where `runInWorker`'s per-call worker creation would add up to ~90ms
 * of pure setup. Same self-containment and structured-clone rules apply.
 *
 * @param fn Self-contained function (same rules as {@link runInWorker}).
 * @param arg Argument passed to `fn`.
 * @param options See {@link WorkerRunOptions}.
 * @returns Promise resolving with `fn`'s result.
 *
 * @example
 * ```ts
 * // 60 thumbnails: two workers share the batch, and the faster one steals
 * // from the other's queue instead of idling.
 * const thumbs = await Promise.all(
 *   images.map((img) => runInWorkerWithPool(makeThumbnail, img, {transfer: [img.buffer]})),
 * )
 * ```
 *
 * @zh {@link runInWorker} 的池化版本：通过共享的 {@link WorkerPool} 运行 `fn`，
 * 重复调用复用 worker，无需每次支付约 1.5ms 的启动成本；一批耗时不均的任务会借
 * “最轻负载分配 + 窃取”铺满整个池。
 */
export function runInWorkerWithPool<Arg, Result>(
  fn: WorkerFn<Arg, Result>,
  arg: Arg,
  options: WorkerRunOptions = {},
): Promise<Result> {
  return getWorkerPool().run(fn, arg, options)
}
