/**
 * @en Disposal primitives for the library's push-based APIs ({@link Emitter}, {@link Event},
 * {@link DisposableStore}).
 *
 * The protocol is a plain `dispose()` method — the shape VS Code, RxJS and monaco use — and every
 * object built here *also* answers the real `Symbol.dispose` at runtime when the environment has it
 * (Chrome 125+, Safari 18.4+, Firefox 134+, Node 20+), so `using` declarations and
 * `Symbol.dispose` interop work without extra ceremony.
 *
 * The symbol is attached at runtime but deliberately kept out of the public *type*: this package
 * ships `src/` and its `.d.ts`, and naming the global `Disposable` / `Symbol.dispose` in a
 * signature makes `tsc` fail for consumers whose `lib` stops before `esnext.disposable`. It is the
 * same reason {@link safePromiseTry} reaches for `Promise.try` through a cast instead of calling
 * it: the library must not require a specific `lib` from everyone who imports it. Consumers who
 * do have the newer lib can write `using sub = event(handler)` and get the cleanup for free.
 *
 * **No module-level side effects.** The symbol is installed from each *constructor*
 * (`withDisposeSymbol(X.prototype)` is idempotent, so the first instance pays for it and the rest
 * just hit the `in` check), never from a top-level statement. A top-level call makes the whole
 * module undroppable for bundlers — a consumer importing `cx` would still ship the event system —
 * and it is also what makes `"sideEffects": false` in `package.json` truthful. See the build
 * section of AGENTS.md before moving one of these calls back out.
 *
 * @zh 推送式 API（{@link Emitter}、{@link Event}、{@link DisposableStore}）所需的可释放对象
 * 基础设施。
 *
 * 协议就是一个普通的 `dispose()` 方法——与 VS Code、RxJS、monaco 同形——同时本模块产出的每个
 * 对象在运行时支持的情况下还会响应真正的 `Symbol.dispose`（Chrome 125+、Safari 18.4+、
 * Firefox 134+、Node 20+ 具备），因此 `using` 声明与 `Symbol.dispose` 互操作无需额外处理。
 *
 * 符号只在运行时挂上，刻意不写进公开*类型*：本库会发布 `src/` 与 `.d.ts`，在签名里引用全局
 * `Disposable` / `Symbol.dispose` 会让 `lib` 停在 `esnext.disposable` 之前的使用者工程直接
 * 编译报错——{@link safePromiseTry} 用类型断言而不是直接调用来取 `Promise.try`，是同一个理由。
 * 而 lib 较新的使用者可以直接写 `using sub = event(handler)`，清理照常生效。
 *
 * **模块顶层不做任何调用。** 符号安装放在各自*构造函数*里（`withDisposeSymbol(X.prototype)`
 * 是幂等的，第一个实例付这次开销，之后只走 `in` 判断），绝不写成顶层语句：顶层调用会让整个模块
 * 无法被 bundler 丢弃——只 import `cx` 的使用者也会把事件系统打进产物——同时它也是
 * `package.json` 里 `"sideEffects": false` 能成立的前提。要把这类调用挪回顶层之前，请先读
 * AGENTS.md 的构建一节。
 */

/**
 * @en A resource that is released by calling `dispose()`. Structurally compatible with TypeScript's
 * built-in `Disposable` at runtime (see the module header).
 * @zh 通过调用 `dispose()` 释放的资源。运行时与 TypeScript 内置的 `Disposable` 结构兼容
 * （见模块头说明）。
 */
export interface CompatDisposable {
  dispose(): void
}

/**
 * @en The well-known symbol, read defensively so the module loads on runtimes that predate it.
 * @zh 该 well-known symbol，防御性地读取，使模块在更早的运行时上也能加载。
 */
const disposeSymbol: symbol | undefined = (Symbol as {dispose?: symbol}).dispose

/**
 * @en Teach an object — or a class prototype — to answer `Symbol.dispose` by calling its own
 * `dispose()`. No-op where the symbol does not exist. Returns the target so it can wrap a literal.
 * @zh 让一个对象（或类原型）以自身的 `dispose()` 响应 `Symbol.dispose`。环境没有该符号时什么也
 * 不做。返回传入对象，方便直接包住一个字面量。
 */
export const withDisposeSymbol = <T extends object>(target: T): T => {
  if (disposeSymbol && !(disposeSymbol in target)) {
    Object.defineProperty(target, disposeSymbol, {
      value(this: CompatDisposable) {
        this.dispose()
      },
      writable: true,
      configurable: true,
    })
  }
  return target
}

/**
 * @en The shared "nothing to release" singleton, the equivalent of VS Code's `Disposable.None`.
 * Returned wherever a subscription could not be registered (disposed emitter, refusal) and accepted
 * as a no-op by every store.
 * @zh 共享的「无需释放」单例，等价于 VS Code 的 `Disposable.None`。凡是订阅没能注册成功的地方
 * （emitter 已释放、拒绝新监听器等）都返回它，各 store 收到它也什么都不做。
 */
class NoopDisposable implements CompatDisposable {
  constructor() {
    withDisposeSymbol(NoopDisposable.prototype)
    // 冻结的是实例：共享单例不该被谁悄悄改掉（原先在模块顶层 Object.freeze，见文件头说明）
    Object.freeze(this)
  }

  dispose(): void {
    /* noop */
  }
}

export const noopDisposable: CompatDisposable = new NoopDisposable()

/**
 * @en Whether this is a development build, used to keep the "already disposed" warnings out of
 * production consoles (a teardown race is not worth logging in a shipped app). Bare identifier on
 * purpose: bundlers replace `process.env.NODE_ENV` with a literal, which is what lets the whole
 * warning be eliminated from a production build.
 * @zh 是否为开发构建，用来把「已经释放过了」的告警挡在生产控制台之外（拆卸期的竞态不值得在线上
 * 应用里刷日志）。刻意用裸标识符：打包器会把 `process.env.NODE_ENV` 替换成字面量，整段告警因此
 * 能从生产构建里被消除。
 */
declare const process: {env: Record<string, string | undefined>}

const isDevelopment = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return true
  }
}

/**
 * @en Check whether `thing` is {@link CompatDisposable}. The arity check mirrors VS Code: an object
 * with an unrelated `dispose(arg)` method should not be mistaken for a resource.
 * @zh 判断 `thing` 是否为 {@link CompatDisposable}。形参个数检查来自 VS Code：名字叫 `dispose`
 * 但带参数的无关方法不应该被当成可释放资源。
 */
export function isDisposable<E>(thing: E): thing is E & CompatDisposable {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof (thing as unknown as CompatDisposable).dispose === 'function' &&
    (thing as unknown as CompatDisposable).dispose.length === 0
  )
}

/**
 * @en `AggregateError` read through a cast: it is ES2021, and a consumer's `lib` may stop before
 * that (the repo's own example app does), which would make this shipped source fail to compile. The
 * type is declared locally and the value looked up on `globalThis` so no lib is required.
 * @zh 通过断言读取 `AggregateError`：它是 ES2021 的，使用者的 `lib` 可能更早（本仓库自带的
 * example 应用就是），直接引用会让发布的源码编译不过。类型在本地声明、值从 `globalThis` 取，
 * 因此不依赖任何 lib。
 */
const AggregateErrorCtor: (new (errors: unknown[], message: string) => Error) | undefined = (
  globalThis as {AggregateError?: new (errors: unknown[], message: string) => Error}
).AggregateError

/**
 * @en Dispose every item of an iterable, collecting failures instead of stopping at the first one:
 * one broken resource must not leave the rest un-released.
 *
 * A single failure is rethrown as-is; several are thrown as an `AggregateError` where the platform
 * has it, and as the first failure elsewhere (the rest are still reported through `console.error`,
 * so nothing is silently swallowed).
 *
 * @zh 释放一个可迭代对象里的每一项，并收集失败而不是在第一个错误处停下：一个坏掉的资源不该
 * 让其余资源都留在那里。
 *
 * 只有一个失败时原样抛出；多个失败在平台支持时抛 `AggregateError`，否则抛第一个失败（其余仍会
 * 通过 `console.error` 报出来，不会静默吞掉）。
 */
export function disposeAll<T extends CompatDisposable>(disposables: Iterable<T>): void {
  const errors: unknown[] = []

  for (const d of disposables) {
    if (d) {
      try {
        d.dispose()
      } catch (e) {
        errors.push(e)
      }
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    if (AggregateErrorCtor) {
      throw new AggregateErrorCtor(errors, 'Encountered errors while disposing of store')
    }
    errors.slice(1).forEach((error) => console.error(error))
    throw errors[0]
  }
}

class FunctionDisposable implements CompatDisposable {
  #isDisposed = false
  readonly #fn: () => void

  constructor(fn: () => void) {
    withDisposeSymbol(FunctionDisposable.prototype)
    this.#fn = fn
  }

  dispose(): void {
    if (this.#isDisposed) {
      return
    }
    if (!this.#fn) {
      throw new Error(
        'Unbound disposable context: Need to use an arrow function to preserve the value of this',
      )
    }
    this.#isDisposed = true
    this.#fn()
  }
}

/**
 * @en Turn a cleanup function into a {@link CompatDisposable}. `fn` is guaranteed to run **once**
 * (pass an arrow function if it needs `this`).
 * @zh 把一个清理函数变成 {@link CompatDisposable}。`fn` 保证只执行**一次**（需要 `this` 时请传
 * 箭头函数）。
 */
export function toDisposable(fn: () => void): CompatDisposable {
  return new FunctionDisposable(fn)
}

/**
 * @en Combine several disposables into one that releases all of them.
 * @zh 把多个可释放对象合成一个，释放它即释放全部。
 */
export function combinedDisposable(...disposables: CompatDisposable[]): CompatDisposable {
  return toDisposable(() => disposeAll(disposables))
}

/**
 * @en Manages a collection of disposables.
 *
 * Preferred over a bare `CompatDisposable[]` because it handles the edge cases: the same value can
 * be added twice (the `Set` keeps one entry), and adding to an already-disposed store **warns and
 * drops** the newcomer instead of registering it. Note the newcomer is *not* disposed for you (VS
 * Code behaves the same way): the store cannot know whether the caller still holds it, so the choice
 * stays with the caller — see `DisposableStore.DISABLE_DISPOSED_WARNING` to silence the warning.
 *
 * @example
 * ```ts
 * const store = new DisposableStore()
 * store.add(emitter.event(handler))
 * store.add(() => {}) // no — a function is not a disposable; wrap it in toDisposable()
 * store.dispose()     // everything above is released
 * ```
 *
 * @zh 管理一组可释放对象。
 *
 * 比裸的 `CompatDisposable[]` 可靠，因为它处理了边界情况：同一个值可以重复添加（`Set` 只留一份），
 * 往已释放的 store 里添加会**告警并丢弃**新来的对象，而不是登记它。注意它**不会**替你释放新来的
 * 对象（VS Code 也是如此）：store 无法判断调用方是否还持有它，这个选择留给调用方——要静默这条告警
 * 见 `DisposableStore.DISABLE_DISPOSED_WARNING`。
 */
export class DisposableStore implements CompatDisposable {
  /**
   * @en Set to `true` to silence the warning for adding to an already-disposed store (useful in
   * tests that assert on the disposal path itself).
   * @zh 置为 `true` 可关闭「向已释放的 store 添加对象」的告警（在断言释放路径本身的测试里有
   * 用）。
   */
  static DISABLE_DISPOSED_WARNING = false

  readonly #toDispose = new Set<CompatDisposable>()
  #isDisposed = false

  constructor() {
    withDisposeSymbol(DisposableStore.prototype)
  }

  /**
   * @en Dispose of every registered disposable and mark this store as disposed. Later additions are
   * dropped with a warning (they are *not* disposed of — see the class docs).
   * @zh 释放所有已登记的对象并把本 store 标记为已释放。之后添加进来的对象会被告警丢弃（**不会**
   * 被释放，见类文档）。
   */
  dispose(): void {
    if (this.#isDisposed) {
      return
    }

    this.#isDisposed = true
    this.clear()
  }

  /**
   * @en Whether this store has been disposed of.
   * @zh 本 store 是否已被释放。
   */
  get isDisposed(): boolean {
    return this.#isDisposed
  }

  /**
   * @en Dispose of everything currently registered, but keep the store usable.
   * @zh 释放当前登记的全部对象，但 store 本身仍可继续使用。
   */
  clear(): void {
    if (this.#toDispose.size === 0) {
      return
    }

    try {
      disposeAll(this.#toDispose)
    } finally {
      this.#toDispose.clear()
    }
  }

  /**
   * @en Register a disposable, returning it for chaining.
   * @zh 登记一个可释放对象，并把它返回出来以便链式书写。
   */
  add<T extends CompatDisposable>(o: T): T {
    if (!o || o === noopDisposable) {
      return o
    }
    if ((o as unknown as DisposableStore) === this) {
      throw new Error('Cannot register a disposable on itself!')
    }

    if (this.#isDisposed) {
      if (!DisposableStore.DISABLE_DISPOSED_WARNING && isDevelopment()) {
        console.warn(
          new Error(
            'Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!',
          ).stack,
        )
      }
      // 与 vscode 一致：这里只告警，不代为释放。立刻 dispose 会悄悄改变已经建立的订阅语义
      // （使用者看到的是「订阅了却收不到事件」），把选择权留给调用方更安全。
    } else {
      this.#toDispose.add(o)
    }

    return o
  }

  /**
   * @en Remove a disposable from the store **and** dispose of it. Never throws when it was not part
   * of the store.
   * @zh 从 store 中移除一个对象**并**释放它。对象本就不在 store 里时也不抛错。
   */
  delete<T extends CompatDisposable>(o: T): void {
    if (!o) {
      return
    }
    if ((o as unknown as DisposableStore) === this) {
      throw new Error('Cannot dispose a disposable on itself!')
    }
    this.#toDispose.delete(o)
    o.dispose()
  }

  /**
   * @en Remove a disposable from the store **without** disposing of it, handing ownership back to
   * the caller.
   * @zh 把对象从 store 中移除但**不**释放，所有权交还给调用方。
   */
  deleteAndLeak<T extends CompatDisposable>(o: T): void {
    this.#toDispose.delete(o)
  }

  /**
   * @en Report through the console when this store has already been disposed of, meant for
   * assertions in code that must not run after teardown.
   * @zh 本 store 已被释放时在控制台报告，用于「释放后不该再执行」的断言。
   */
  assertNotDisposed(): void {
    if (this.#isDisposed) {
      console.error(new Error('Object disposed'))
    }
  }
}

/**
 * @en A map that owns the disposables it stores: overwriting or deleting a key releases the value
 * that was there.
 *
 * @example
 * ```ts
 * const listeners = new DisposableMap<Thing, CompatDisposable>()
 * things.forEach(thing => listeners.set(thing, thing.onData(handle)))
 * listeners.deleteAndDispose(goneThing) // that one subscription only
 * ```
 *
 * @zh 一个「拥有」其值的 Map：覆盖或删除某个 key 会释放原来挂在那里的对象。
 */
export class DisposableMap<K, V extends CompatDisposable = CompatDisposable>
  implements CompatDisposable
{
  readonly #store: Map<K, V>
  #isDisposed = false

  constructor(store: Map<K, V> = new Map<K, V>()) {
    withDisposeSymbol(DisposableMap.prototype)
    this.#store = store
  }

  /**
   * @en Dispose every stored value and mark the map as disposed.
   * @zh 释放所有值并把本 map 标记为已释放。
   */
  dispose(): void {
    this.#isDisposed = true
    this.clearAndDisposeAll()
  }

  /**
   * @en Dispose every stored value and empty the map, but keep the map usable.
   * @zh 释放所有值并清空 map，但 map 本身仍可继续使用。
   */
  clearAndDisposeAll(): void {
    if (!this.#store.size) {
      return
    }

    try {
      disposeAll(this.#store.values())
    } finally {
      this.#store.clear()
    }
  }

  /**
   * @en Whether a value is stored under `key`.
   * @zh `key` 下是否存有值。
   */
  has(key: K): boolean {
    return this.#store.has(key)
  }

  /**
   * @en Number of stored values.
   * @zh 已存值的个数。
   */
  get size(): number {
    return this.#store.size
  }

  /**
   * @en The value stored under `key`, if any.
   * @zh `key` 下存的值（如果有）。
   */
  get(key: K): V | undefined {
    return this.#store.get(key)
  }

  /**
   * @en Store `value` under `key`, disposing of whatever was there before. Pass
   * `skipDisposeOnOverwrite` when the previous value is still referenced elsewhere.
   * @zh 把 `value` 存到 `key` 下，并释放原先挂在那里的值。原来的值还被别处引用时，传
   * `skipDisposeOnOverwrite`。
   */
  set(key: K, value: V, skipDisposeOnOverwrite = false): void {
    if (this.#isDisposed && isDevelopment()) {
      console.warn(
        new Error(
          'Trying to add a disposable to a DisposableMap that has already been disposed of. The added object will be leaked!',
        ).stack,
      )
    }

    if (!skipDisposeOnOverwrite) {
      this.#store.get(key)?.dispose()
    }

    this.#store.set(key, value)
  }

  /**
   * @en Remove the value stored under `key` from this map and dispose of it.
   * @zh 把 `key` 下的值移出本 map 并释放。
   */
  deleteAndDispose(key: K): void {
    this.#store.get(key)?.dispose()
    this.#store.delete(key)
  }

  /**
   * @en Remove the value stored under `key` and **return** it — the caller now owns the disposal.
   * @zh 把 `key` 下的值移出并**返回**——释放责任归调用方。
   */
  deleteAndLeak(key: K): V | undefined {
    const value = this.#store.get(key)
    this.#store.delete(key)
    return value
  }

  /**
   * @en The stored keys.
   * @zh 已存的 key。
   */
  keys(): IterableIterator<K> {
    return this.#store.keys()
  }

  /**
   * @en The stored values.
   * @zh 已存的值。
   */
  values(): IterableIterator<V> {
    return this.#store.values()
  }

  /**
   * @en Iterate the `[key, value]` pairs. Iterating does not transfer ownership.
   * @zh 遍历 `[key, value]` 对。遍历不会转移所有权。
   */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.#store[Symbol.iterator]()
  }
}
