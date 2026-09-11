/**
 * @en Eliminating work: backpressure handling — dropping and merging.
 *
 * Batch as well as you like; once the inflow exceeds the maximum throughput,
 * the backlog grows without limit (backpressure). The browser has no good way
 * to tell the server to slow down, so at some point you have to give up on
 * doing everything you are given. There are generally two ways to eliminate
 * incoming work:
 *
 * - **Dropping**: for data that just flows past — live logs, chat — once
 *   processing starts falling behind, quietly discard the oldest entries;
 *   users won't notice. Keeping up with the present matters more than showing
 *   everything.
 * - **Merging**: for data where only the latest value means anything —
 *   rankings, tickers, form drafts — merge the backlogged updates and apply
 *   only the final value. The amount of work is pinned to what the consumer
 *   can digest, no matter how fast the inflow gets.
 *
 * (The third elimination, skipping repeated computation, is memoization —
 * see `memoize.ts`.)
 *
 * @zh 消除工作：背压处理 —— 丢弃与合并。
 *
 * 批量做得再好，一旦流入速度超过最大吞吐，积压就会无限增长（背压）。浏览器没有
 * 好办法让服务端放慢，所以到了某个程度就得放弃“给多少做多少”。消除流入中的工作
 * 通常有两种方式：
 *
 * - **丢弃（drop）**：对只是流过的数据——直播日志、聊天——处理一旦落后，悄悄丢弃
 *   最旧的条目，用户不会察觉。跟上“现在”比展示“全部”更重要。
 * - **合并（merge）**：对只有最新值才有意义的数据——排行榜、行情、表单草稿——
 *   把积压的更新合并，只应用最终值。无论流入多快，工作量都钉死在消费端
 *   能消化的水平。
 *
 * （第三种消除——跳过重复计算——即 memoization，见 `memoize.ts`。）
 */

/**
 * @en A bounded queue that drops the OLDEST items when full, for flow-past
 * data where keeping up with the present matters more than completeness.
 * @zh 一个满时丢弃“最旧”条目的有界队列，适用于只是流过的数据——跟上现在比
 * 展示全部更重要。
 */
export interface DroppingQueue<T> {
  /**
   * @en Push an item. If the queue is full, the OLDEST item is silently
   * discarded to make room. Returns whether this item itself was kept.
   * @zh 推入一个条目。若队列已满，最旧的条目被静默丢弃以腾出位置。
   * 返回本次推入的条目是否被保留。
   */
  push(item: T): boolean
  /**
   * @en Take the oldest item, or `undefined` if empty.
   * @zh 取出最旧的条目；队列为空时返回 `undefined`。
   */
  shift(): T | undefined
  /**
   * @en All currently held items, oldest first. The returned array is a copy.
   * @zh 当前持有的所有条目，最旧在前。返回的是副本。
   */
  items(): T[]
  /**
   * @en Take all held items at once, oldest first, emptying the queue. The
   * returned array is handed over (not a copy), so draining costs O(1) rather
   * than an O(n) copy — mutating it does not affect the queue.
   * @zh 一次性取走所有条目，最旧在前，取后队列清空。返回的数组是直接移交
   * （非副本），因此 drain 是 O(1) 而非 O(n) 复制——修改它不会影响队列。
   */
  drainAll(): T[]
  /**
   * @en Number of held items.
   * @zh 持有的条目数。
   */
  readonly size: number
}

/**
 * @en Create a bounded FIFO queue that drops the oldest items when full —
 * the "dropping" backpressure strategy.
 *
 * Solves: a live log / streaming chat where arrivals outpace processing; the
 * backlog grows without limit and the messages reaching the screen get older
 * and older. A dropping queue caps the backlog at `capacity`: when the
 * consumer falls behind, the oldest undisplayed entries are quietly
 * discarded — keeping up with the present matters more than showing
 * everything.
 *
 * @param capacity Maximum number of items held. Default `100`.
 * @returns The queue handle. See {@link DroppingQueue}.
 *
 * @example
 * ```ts
 * // Live log tail: newest 200 lines, oldest silently dropped under pressure
 * const logs = createDroppingQueue<string>(200)
 * socket.on('log', (line) => logs.push(line))
 * setInterval(() => {
 *   for (const line of logs.drainAll()) appendLogLine(line) // never backlogs
 * }, 500)
 * ```
 */
export function createDroppingQueue<T>(capacity = 100): DroppingQueue<T> {
  let buffer: T[] = []
  return {
    push(item) {
      if (capacity <= 0) return false
      if (buffer.length >= capacity) {
        buffer.shift() // discard the oldest — keeping up matters more
      }
      buffer.push(item)
      return true
    },
    shift() {
      return buffer.shift()
    },
    items() {
      return [...buffer]
    },
    drainAll() {
      // Hand the array over and start a fresh one: O(1) instead of copying.
      const drained = buffer
      buffer = []
      return drained
    },
    get size() {
      return buffer.length
    },
  }
}

/**
 * @en A "latest value wins" cell for data where only the newest value means
 * anything — rankings, tickers, form drafts.
 * @zh 一个“最新值胜出”的格子，适用于只有最新值才有意义的数据——排行榜、行情、
 * 表单草稿。
 */
export interface LatestValue<T> {
  /**
   * @en Deposit a value. Any previously deposited value is merged away
   * (overwritten) — it will never be seen by a consumer.
   * @zh 存入一个值。之前存入的值被合并（覆盖）——消费端永远不会看到它。
   */
  set(value: T): void
  /**
   * @en Take the current latest value, if any has arrived since the last
   * take. Returns `undefined` when nothing new is waiting.
   * @zh 取走当前最新值（若有新值到达）。没有新值等待时返回 `undefined`。
   */
  take(): T | undefined
  /**
   * @en Peek at the current latest value without consuming it.
   * @zh 窥视当前最新值而不消费它。
   */
  peek(): T | undefined
  /**
   * @en Whether a new value is waiting to be taken.
   * @zh 是否有新值等待被取走。
   */
  readonly pending: boolean
}

/**
 * @en Create a single-slot cell where only the latest deposited value is ever
 * consumed — the "merging" backpressure strategy.
 *
 * Solves: data whose intermediate values are meaningless (a ranking reordered
 * 50 times a second, a ticker flashing). No matter how fast the inflow gets,
 * the amount of work is pinned to one application per consume cycle: every
 * backlogged update is merged into the final value, and nothing in between
 * is ever processed.
 *
 * @returns The cell handle. See {@link LatestValue}.
 *
 * @example
 * ```ts
 * // A leaderboard rebuilt at most once per frame, however often it changes
 * const board = createLatestValue<Ranking>()
 * socket.on('ranking', (r) => board.set(r)) // 50 updates/sec all merge
 *
 * const tick = () => {
 *   const latest = board.take()
 *   if (latest) renderBoard(latest) // one render, final value only
 *   requestAnimationFrame(tick)
 * }
 * requestAnimationFrame(tick)
 * ```
 */
export function createLatestValue<T>(): LatestValue<T> {
  let value: T | undefined
  let has = false

  return {
    set(v) {
      value = v
      has = true
    },
    take() {
      if (!has) return undefined
      has = false
      return value
    },
    peek() {
      return has ? value : undefined
    },
    get pending() {
      return has
    },
  }
}
