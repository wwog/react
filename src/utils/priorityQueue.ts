/**
 * @en Prioritizing: a cooperative task queue that controls the ORDER work runs
 * in — because on a main thread nothing can interrupt, order is the
 * responsiveness the user feels.
 *
 * The queue drains one job per task via MessageChannel (a macrotask with no
 * minimum delay — the same transport React's scheduler uses). Jobs are
 * processed FIFO, but urgent jobs cut to the front, and a job already waiting
 * in line can be promoted later — the "idle-until-urgent" pattern: get ahead
 * on work while idle, then rush the one the user actually wants.
 *
 * Classic scenario: the user attaches a few dozen photos. Previews are
 * generated unhurried, in order. But the moment the user clicks a photo that
 * isn't ready yet, that preview becomes the most urgent job there is — it
 * skips the queue and fills in right away. Total work is unchanged; only the
 * order changed, yet the experience is completely different.
 *
 * @zh 优先级（Prioritizing）：一个协作式任务队列，控制工作执行的“顺序”——
 * 在无法被中断的主线程上，顺序就是用户感受到的响应性。
 *
 * 队列通过 MessageChannel 排干（无最小延迟的宏任务——与 React scheduler 同一传输层），
 * 每个任务处理一个 job。FIFO 处理，但紧急 job 插队；已排队的 job 之后也能被提升——
 * 即“idle-until-urgent”模式：空闲时提前干活，用户要用哪个就立刻优先哪个。
 *
 * 底层是 {@link Queue}：取出队首是 O(1)，因此队列很深时"排干"本身不会变成平方开销；
 * 紧急插队同样 O(1)。只有按 tag 提升（{@link PriorityQueue.promote}）需要扫描队列。
 *
 * 典型场景：用户一次附上几十张照片，预览图本可从容按序生成；但用户点开某张
 * 还没就绪的照片时，它就成了最紧急的任务——跳过队列立刻填充。总工作量不变，
 * 只是顺序变了，体验却完全不同。
 */

import {Queue} from './queue'

/**
 * @en A tagged job for the priority queue: an arbitrary function plus metadata
 * to find it later for promotion.
 * @zh 优先级队列中的带标签任务：任意函数 + 便于之后提升的元数据。
 */
export interface PriorityJob<TTag = any> {
  /**
   * @en The work to run.
   * @zh 要执行的工作。
   */
  run: () => void | Promise<void>
  /**
   * @en Tag used by `promote` to locate this job in the queue.
   * @zh `promote` 用于在队列中定位该任务的标签。
   */
  tag?: TTag
}

/**
 * @en The priority queue handle.
 * @zh 优先级队列句柄。
 */
export interface PriorityQueue<TTag = any> {
  /**
   * @en Queue a job. Urgent jobs are placed at the front (LIFO among
   * themselves); regular jobs at the back.
   * @zh 入队一个任务。紧急任务插到队首（彼此之间后进先出）；普通任务排到队尾。
   * @param job The job to queue.
   * @param urgent Whether this job should run before queued ones. Default `false`.
   */
  post(job: PriorityJob<TTag>, urgent?: boolean): void
  /**
   * @en Move an already-queued job (matched by `tag`) to the front — a
   * priority bump. Returns whether a matching job was found and moved.
   * @zh 将已入队的任务（按 `tag` 匹配）提到队首——优先级提升。
   * 返回是否找到并移动了匹配的任务。
   * @param tag Tag previously attached via `PriorityJob.tag`.
   */
  promote(tag: TTag): boolean
  /**
   * @en Remove all queued jobs. A job currently executing is not affected.
   * @zh 移除所有排队中的任务。正在执行的任务不受影响。
   */
  clear(): void
  /**
   * @en Number of jobs currently waiting (excludes the one executing).
   * @zh 当前等待中的任务数（不含正在执行的那个）。
   */
  readonly size: number
}

/**
 * @en Options for {@link createPriorityQueue}.
 * @zh {@link createPriorityQueue} 的选项。
 */
export interface PriorityQueueOptions<TTag = any> {
  /**
   * @en Called when a job throws or rejects, so the error is surfaced instead
   * of silently swallowed. When omitted, the error is logged via
   * `console.error`. A failing job never blocks the jobs queued behind it.
   * @zh 任务抛错或 reject 时调用，用于把错误暴露出来而非静默吞掉。
   * 省略时通过 `console.error` 记录。失败的任​务不会阻塞其后的排队任务。
   */
  onError?: (error: unknown, job: PriorityJob<TTag>) => void
}

/**
 * @en Create a main-thread task queue that drains one job per task and lets
 * urgent work jump the line.
 *
 * Each message = one task: one job runs, then the next is booked only if work
 * remains — so the queue always leaves gaps for input and rendering between
 * jobs (the draining itself is splitting-friendly), while `post(job, true)`
 * and `promote(tag)` provide the priority control.
 *
 * @param options See {@link PriorityQueueOptions}.
 * @returns The queue handle. See {@link PriorityQueue}.
 *
 * @example
 * ```ts
 * const queue = createPriorityQueue()
 *
 * // Build previews for the attached photos, in order
 * files.forEach((file, i) => {
 *   queue.post({tag: i, run: () => createPreview(file, i)}) // tag it for later
 * })
 *
 * // Clicking a photo that isn't ready pulls its job to the front → priority bump
 * onClickPhoto((i) => {
 *   queue.promote(i)
 * })
 * ```
 */
export function createPriorityQueue<TTag = any>(
  options: PriorityQueueOptions<TTag> = {},
): PriorityQueue<TTag> {
  const queue = new Queue<PriorityJob<TTag>>()
  // One message = one task. Process a piece, then book the next one
  const channel = new MessageChannel()

  const reportError = (error: unknown, job: PriorityJob<TTag>) => {
    // A failed job must not break the drain loop; surface it instead
    if (options.onError) options.onError(error, job)
    else console.error('[priorityQueue] job failed', error)
  }

  const rebook = () => {
    if (queue.length > 0) channel.port2.postMessage(null)
  }

  channel.port1.onmessage = () => {
    const job = queue.pop() // take whatever is at the front right now
    if (!job) return // guard against duplicate bookings

    // Synchronous jobs allocate no promises at all. A queue can drain
    // thousands of small jobs, and a Promise.resolve().then().catch().finally()
    // chain costs ~180ns per job on top of the job itself.
    let result: void | Promise<void>
    try {
      result = job.run()
    } catch (error) {
      reportError(error, job)
      rebook()
      return
    }

    if (result instanceof Promise) {
      result.then(rebook, (error) => {
        reportError(error, job)
        rebook()
      })
      return
    }

    rebook()
  }

  return {
    post(job, urgent = false) {
      if (urgent)
        queue.pushFront(job) // urgent jobs cut to the front
      else queue.push(job)
      if (queue.length === 1) channel.port2.postMessage(null)
    },

    promote(tag) {
      const job = queue.remove((candidate) => candidate.tag === tag)
      if (!job) return false
      // Moving the frontmost match to the front is a no-op in effect; either way
      // it is next to run, which is what "already counts as promoted" means.
      queue.pushFront(job)
      return true
    },

    clear() {
      queue.clear()
    },

    get size() {
      return queue.length
    },
  }
}
