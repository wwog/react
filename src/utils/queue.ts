/**
 * @en Draining: a FIFO queue that pops in constant time, so a long line of
 * waiting work does not turn the act of draining it into the quadratic cost.
 *
 * The obvious queue is an array with `push`/`shift`. `push` is O(1) — but
 * `Array.prototype.shift` is not: V8 moves every remaining element down one
 * slot, so draining n items costs O(n²). At 1,000 items that is too small to
 * notice (a fraction of a millisecond); at 50,000 it is ~135ms; at 200,000 it
 * is ~2.3s of pure main-thread bookkeeping. That is the shape of the bug this
 * queue exists to avoid: fine on the demo, quadratic on the real batch.
 *
 * The fix is to stop moving elements. A cursor marks where the live range
 * begins; `pop` reads at the cursor and advances it, leaving a dead prefix
 * behind. Once that prefix is worth reclaiming the live tail is copied down in
 * one step — a move that happens once per O(n) pops, so the cost amortizes to
 * O(1) per item.
 *
 * `pushFront` exists for the one legitimate reason to cut the line: a job that
 * has just become urgent. It goes into its own small stack at the front rather
 * than shifting the whole array, so it also costs O(1) — which is what makes
 * {@link createPriorityQueue}'s "urgent wins" cheap even on a long queue.
 *
 * @zh 排干（Draining）：一个 pop 为常数时间的 FIFO 队列，让"排干一条很长的队伍"这件事
 * 本身不会退化成平方级开销。
 *
 * 最直觉的队列是数组 + `push`/`shift`。`push` 是 O(1)，但 `Array.prototype.shift`
 * 不是：V8 会把剩余元素整体前移一格，于是排干 n 个元素要 O(n²)。1000 个元素时小到
 * 察觉不到（不到一毫秒），50000 个就要约 135ms，200000 个则是约 2.3 秒纯主线程搬运。
 * 这正是本队列要消除的问题形态：demo 上没事，真实批量上平方爆炸。
 *
 * 做法是不再搬元素。一个游标标记活跃区间的起点；`pop` 在游标处取值并前移，身后留下
 * 一段死前缀。等这段前缀值得回收时，一次性把活跃区尾部整体下移——每 O(n) 次 pop 才发生
 * 一次，因此摊还到每个元素是 O(1)。
 *
 * `pushFront` 只为一个正当理由存在：刚刚变紧急的任务。它进入队首自己的小栈，而不是
 * 整体平移数组，因此同样是 O(1)——这也是 {@link createPriorityQueue} 的"紧急插队"在
 * 长队列上依然便宜的原因。
 */

/**
 * @en A FIFO queue with amortized O(1) `push`, `pushFront` and `pop`.
 *
 * Semantics: `push` appends at the back, `pushFront` inserts at the front (so
 * the most recently pushed front item is popped first — a LIFO stack at the
 * front), and `pop` removes from the front, which is the back region until the
 * front region is exhausted.
 *
 * @example
 * ```ts
 * const queue = new Queue<string>()
 * queue.push('a')
 * queue.push('b')
 * queue.pushFront('urgent')
 * queue.pop() // 'urgent'
 * queue.pop() // 'a'
 * ```
 *
 * @zh 一个 `push`、`pushFront`、`pop` 均为摊还 O(1) 的 FIFO 队列。
 *
 * 语义：`push` 追加到队尾；`pushFront` 插入队首（因此最后 pushFront 的项会最先被
 * pop——队首是一个后进先出的栈）；`pop` 从队首取出，队首栈耗尽后转向队尾区。
 */
export class Queue<T> {
  /**
   * @en Front region, stored reversed: index 0 is the most recently front-pushed
   * and the last index is the frontmost item. Kept as a stack so `pushFront` and
   * popping from it are both O(1).
   * @zh 队首区，逆序存放：下标 0 是最近一次 pushFront 的，最后一个下标才是最前面的
   * 元素。作为栈使用，因此 `pushFront` 与从队首弹出都是 O(1)。
   */
  #front: T[] = []

  /**
   * @en Back region: live items are `#back[#head .. end]`.
   * @zh 队尾区：活跃元素是 `#back[#head .. end]`。
   */
  #back: T[] = []

  /**
   * @en Start of the live range in `#back`; everything before it is dead.
   * @zh `#back` 中活跃区间的起点；之前的都是死元素。
   */
  #head = 0

  /**
   * @en Number of items waiting (front region + live back region).
   * @zh 等待中的元素数（队首区 + 队尾活跃区）。
   */
  get length(): number {
    return this.#front.length + (this.#back.length - this.#head)
  }

  /**
   * @en Append `item` at the back.
   * @zh 把 `item` 追加到队尾。
   */
  push(item: T): void {
    this.#back.push(item)
  }

  /**
   * @en Insert `item` at the front, ahead of everything already queued.
   * @zh 把 `item` 插到队首，排在所有已排队元素之前。
   */
  pushFront(item: T): void {
    this.#front.push(item)
  }

  /**
   * @en Remove and return the frontmost item, or `undefined` when empty.
   * @zh 取出并返回最前面的元素；队列为空时返回 `undefined`。
   */
  pop(): T | undefined {
    const front = this.#front
    if (front.length > 0) return front.pop()

    const head = this.#head
    const back = this.#back
    if (head >= back.length) return undefined

    const item = back[head]
    // Drop the reference eagerly: on a deep queue the popped job (and whatever
    // payload it holds) would otherwise stay reachable until compaction.
    back[head] = undefined as T
    this.#head = head + 1
    this.#compact()
    return item
  }

  /**
   * @en Remove the frontmost item matching `predicate` and return it, or
   * `undefined` when nothing matches. Scanning is O(n) — it exists for
   * occasional operations like promoting a queued job by tag, not for the
   * per-item path.
   * @zh 移除并返回最前面的、满足 `predicate` 的元素；没有匹配则返回 `undefined`。
   * 扫描是 O(n)——它是为"按 tag 提升某个排队任务"这类偶发操作准备的，不在逐元素路径上。
   */
  remove(predicate: (item: T) => boolean): T | undefined {
    const front = this.#front
    // Frontmost first: the front stack's top is the queue's head.
    for (let i = front.length - 1; i >= 0; i--) {
      if (predicate(front[i]!)) return front.splice(i, 1)[0]
    }
    const back = this.#back
    for (let i = this.#head; i < back.length; i++) {
      if (predicate(back[i]!)) return back.splice(i, 1)[0]
    }
    return undefined
  }

  /**
   * @en Remove every item.
   * @zh 清空队列。
   */
  clear(): void {
    this.#front.length = 0
    this.#back.length = 0
    this.#head = 0
  }

  /**
   * @en Snapshot of the waiting items, frontmost first. O(n).
   * @zh 等待中元素的快照，最前面的在前。O(n)。
   */
  toArray(): T[] {
    const front = this.#front.slice().reverse()
    return front.concat(this.#back.slice(this.#head))
  }

  /**
   * @en Reclaim the dead prefix once it is worth the move. Triggering only when
   * the prefix is both non-trivial and at least as large as the live range keeps
   * `#back` within 2× the live size, so memory cannot creep, while the copy cost
   * amortizes to O(1) per pop.
   * @zh 当死前缀值得搬运时回收它。仅当前缀不小且不小于活跃区间时才触发，使 `#back`
   * 始终不超过活跃规模的两倍（内存不会悄悄膨胀），而拷贝成本摊还到每次 pop 为 O(1)。
   */
  #compact(): void {
    if (this.#head > 32 && this.#head * 2 >= this.#back.length) {
      this.#back = this.#back.slice(this.#head)
      this.#head = 0
    }
  }
}
