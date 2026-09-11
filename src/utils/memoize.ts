/**
 * @en Eliminating work: memoization — skipping repeated computation.
 *
 * The best thing for performance is not doing the work in the first place.
 * Among the three ways to eliminate work (dropping, merging, skipping),
 * skipping targets repeated work rather than incoming work: if a computation
 * gives the same result for the same input, there is no reason to do it a
 * second time. Remembering results and reusing them is memoization.
 *
 * This idea hides everywhere in optimization: debounce skips executions during
 * typing, visibility-based rendering skips off-screen posts. Half of main-thread
 * optimization is really about removing work.
 *
 * @zh 消除工作：memoization —— 跳过重复计算。
 *
 * 对性能最好的事是根本不做这件事。消除工作的三种方式（丢弃、合并、跳过）里，
 * 跳过针对的是“重复工作”而非“流入工作”：同一输入必得同一结果的计算，没有理由
 * 算第二遍。记住结果并复用，即 memoization（记忆化）。
 *
 * 这个思想藏在各种优化里：debounce 跳过打字期间的执行，可见性渲染跳过屏幕外的
 * 帖子。主线程优化的一大半，本质上都是在“移除工作”。
 */

/**
 * @en Cache statistics exposed by {@link memoize}.
 * @zh {@link memoize} 暴露的缓存统计。
 */
export interface MemoizeStats {
  /**
   * @en How many calls were served from the cache.
   * @zh 有多少次调用命中了缓存。
   */
  hits: number
  /**
   * @en How many calls actually invoked the original function.
   * @zh 有多少次调用真正执行了原函数。
   */
  misses: number
}

/**
 * @en A memoized function with cache introspection and clearing.
 * @zh 记忆化后的函数，附缓存查询与清空能力。
 */
export interface MemoizedFunction<F extends (...args: any[]) => any> {
  (...args: Parameters<F>): ReturnType<F>
  /**
   * @en Drop all remembered results.
   * @zh 丢弃所有已记住的结果。
   */
  clear(): void
  /**
   * @en Read-only cache statistics.
   * @zh 只读缓存统计。
   */
  readonly stats: MemoizeStats
}

/**
 * @en Return a memoized version of `fn` that remembers the result of each
 * distinct argument key and reuses it on later calls.
 *
 * Solves: repeated computation with the same input — the third elimination
 * strategy (skipping). If a computation gives the same result for the same
 * input, there is no reason to do it a second time; memoization pins the cost
 * of a repeated computation to zero.
 *
 * Keys are derived by `keyFn` (default: the first argument, compared with
 * Map semantics — SameValueZero). For functions whose identity of interest
 * lives elsewhere (multiple args, object fields), pass a `keyFn` that
 * produces a primitive key.
 *
 * @param fn The function to memoize.
 * @param keyFn Derives the cache key from the call arguments. Defaults to
 *   using the single argument itself when the function takes 0 or 1 arguments
 *   (preserving reference identity for objects), and `JSON.stringify(args)`
 *   when it takes 2 or more — so every argument participates in the key.
 *   Pass a `keyFn` when arguments are not JSON-serializable (circular
 *   references, `Map`/`Set`, functions, ...).
 * @returns The memoized function. See {@link MemoizedFunction}.
 *
 * @example
 * ```ts
 * // Heavy parse result reused across calls with the same input
 * const parseConfig = memoize((raw: string) => expensiveParse(raw))
 * parseConfig(bigPayload) // computes
 * parseConfig(bigPayload) // cache hit — skipped
 *
 * // Multi-argument functions are keyed on ALL arguments by default
 * const add = memoize((a: number, b: number) => a + b)
 * add(1, 2) // 3 — computes
 * add(1, 3) // 4 — different key, computes (not a stale 3)
 *
 * // Custom key for objects that are not JSON-serializable
 * const query = memoize(
 *   (userId: string, scope: string) => buildQuery(userId, scope),
 *   (userId, scope) => `${userId}:${scope}`,
 * )
 * ```
 */
/**
 * @en Sentinel stored for cached `undefined` results, so a single `Map.get`
 * tells "miss" apart from "hit with an undefined value" without a second
 * `Map.has` lookup.
 * @zh 用于缓存 `undefined` 结果的哨兵值：一次 `Map.get` 即可区分“未命中”和
 * “命中但值为 undefined”，避免第二次 `Map.has` 查找。
 */
const MISSING = Symbol('memoize:missing')

export function memoize<F extends (...args: any[]) => any>(
  fn: F,
  keyFn?: (...args: Parameters<F>) => unknown,
): MemoizedFunction<F> {
  const cache = new Map<unknown, ReturnType<F> | typeof MISSING>()
  const stats: MemoizeStats = {hits: 0, misses: 0}

  const memoized = (...args: Parameters<F>): ReturnType<F> => {
    // Only the first argument would silently collide for multi-argument
    // functions (f(1, 2) and f(1, 3) would share a cache entry), so serialize
    // all arguments once there is more than one.
    const key = keyFn ? keyFn(...args) : args.length <= 1 ? args[0] : JSON.stringify(args)

    // One hash lookup on the hot path instead of `has` + `get`. A truly absent
    // key reads back as `undefined`, so `undefined` means "miss"; `MISSING`
    // marks a cached `undefined` result and is mapped back on the way out.
    const cached = cache.get(key)
    if (cached !== undefined) {
      stats.hits++
      return (cached === MISSING ? undefined : cached) as ReturnType<F>
    }

    stats.misses++
    const result = fn(...args)
    cache.set(key, result === undefined ? MISSING : result)
    return result
  }

  memoized.clear = () => {
    cache.clear()
  }

  Object.defineProperty(memoized, 'stats', {
    get: () => ({...stats}),
  })

  return memoized as MemoizedFunction<F>
}
