/**
 * @en Sending work to a Worker: run heavy pure computation off the main
 * thread.
 *
 * A worker runs JavaScript on a separate thread, fully separated from the main
 * one. Hand heavy computation to a worker — parsing a large payload, image
 * processing (seam carving: hundreds of millions of pixel operations), complex
 * simulation — and the main thread can concentrate solely on keeping the UI
 * responsive. Run on the main thread, the same computation freezes the whole
 * page for its entire duration, with no task boundaries for paint to slip
 * into (you couldn't show intermediate steps even if you wanted to). In a
 * worker, the screen stays responsive and progress can stream in.
 *
 * It isn't free, though. Workers cannot touch the DOM, and the two threads
 * communicate only through postMessage, which COPIES (serializes) the data.
 * For large data the copy cost is considerable — pass Transferable objects
 * (ArrayBuffer and friends) to move them by reference instead: the sender
 * loses access, and the cost drops to near zero regardless of size
 * (see {@link postTransferable}). The same is true of what comes BACK: a job
 * that returns a multi-megabyte pixel buffer copies it home unless you name it
 * in `resultTransfer`.
 *
 * So workers aren't a cure-all: they shine when the computation is heavy
 * enough to outweigh the communication cost and has nothing to do with the
 * DOM. Every time, ask whether this work really needs to run on the main
 * thread.
 *
 * @zh 把工作送进 Worker：将重的纯计算移出主线程。
 *
 * Worker 在独立线程上运行 JavaScript，与主线程完全隔离。把重计算交给 worker——
 * 解析大 payload、图像处理（seam carving：数亿次像素操作）、复杂仿真——主线程就能
 * 专注于保持 UI 响应。同样的计算放在主线程上跑，整个过程整页冻结，任务之间没有
 * 让绘制插入的边界（想显示中间步骤都做不到）；放在 worker 里，屏幕保持响应，
 * 中间进度还能实时流回。
 *
 * 但它不是免费的。Worker 无法访问 DOM，两个线程只能通过 postMessage 通信，而
 * postMessage 会“拷贝”（序列化）数据。数据一大，通信成本就不可忽视——改传
 * Transferable 对象（ArrayBuffer 等）即可按引用转移：发送方失去使用权，成本与
 * 体积无关、接近零（见 {@link postTransferable}）。回程同理：任务若返回数兆字节的
 * 像素缓冲，除非在 `resultTransfer` 里点名，否则仍要整份拷回来。
 *
 * 所以 worker 不是万能药：计算足够重、能压过通信成本、且与 DOM 无关时才划算。
 * 每次都先问：这份工作真的需要在主线程上跑吗？
 */

/**
 * @en A function that runs inside a worker. It must be self-contained (no
 * closures over outer variables — the source is serialized), and may only use
 * APIs available in worker scope (no DOM).
 * @zh 在 worker 内部执行的函数。必须自包含（源码会被序列化，不能捕获外部变量），
 * 且只能用 worker 作用域可用的 API（无 DOM）。
 */
export type WorkerFn<Arg, Result> = (arg: Arg) => Result | Promise<Result>

/**
 * @en Error thrown when the worker itself fails to start or the script errors
 * out, carrying the raw ErrorEvent message. A function that merely throws
 * inside the worker is reported through this too, so callers only ever handle
 * one error type.
 * @zh worker 启动失败或脚本内部报错时抛出，携带原始 ErrorEvent 消息。函数在 worker
 * 内抛错同样以它上报，调用方只需处理一种错误类型。
 */
export class WorkerError extends Error {
  /**
   * @en The raw error message from the worker's ErrorEvent.
   * @zh 来自 worker ErrorEvent 的原始错误消息。
   */
  readonly raw: string

  constructor(message: string, raw?: string) {
    super(message)
    this.name = 'WorkerError'
    this.raw = raw ?? message
  }
}

/**
 * @en Options shared by {@link runInWorker} and the pooled variants.
 * @zh {@link runInWorker} 与池化变体共用的选项。
 */
export interface WorkerRunOptions {
  /**
   * @en Buffers to move (zero-copy) into the worker. The main thread loses
   * access to them as soon as the job is sent.
   * @zh 按零拷贝移入 worker 的缓冲区。任务一发出，主线程即失去使用权。
   */
  transfer?: Transferable[]
  /**
   * @en Paths inside the RESULT whose values should be moved (zero-copy) back
   * out of the worker. A path is a dot-separated property chain — `'buf'` for
   * `result.buf`, `'meta.bytes'` for a nested field, `'.'` for the result
   * itself. ArrayBuffer views (TypedArray, DataView) are transferred as their
   * underlying `.buffer`.
   *
   * Solves the return leg of a pixel pipeline: without this, a job returning a
   * 10MB buffer copies it back on the main thread inside the message handler —
   * a synchronous stall proportional to the size. With it, the buffer moves and
   * the byte cost disappears.
   *
   * A path that does not resolve to something transferable is skipped, so a
   * slightly wrong path degrades to a copy instead of failing the job. The
   * worker's job then loses access to whatever it handed over.
   *
   * @zh 结果中需要按零拷贝移出 worker 的值的路径。路径是点分隔的属性链——
   * `'buf'` 对应 `result.buf`，`'meta.bytes'` 对应嵌套字段，`'.'` 表示结果本身。
   * ArrayBuffer 视图（TypedArray、DataView）按其底层 `.buffer` 转移。
   *
   * 它解决像素流水线的回程问题：没有它，任务返回 10MB 缓冲时会在主线程的消息处理
   * 里同步拷贝回来，停顿与体积成正比；有了它，缓冲按引用转移，字节成本消失。
   *
   * 解析不到可转移值的路径会被跳过，因此路径写错只是退化为拷贝，不会让任务失败。
   * 交出缓冲后，worker 内的任务即失去对该缓冲的使用权。
   */
  resultTransfer?: string[]
}

/**
 * @en The two message keys that keep a successful reply apart from an error
 * reply. Generating them per pool keeps a reply from colliding with a job's own
 * result object, which may legitimately carry similar-looking keys.
 * @zh 用于区分成功回包与错误回包的两个消息键。按池生成可避免回包与任务自身的
 * 结果对象冲突——结果对象完全可能带有形似的键。
 */
export interface WorkerReplyChannel {
  /**
   * @en Key under which a successful result arrives.
   * @zh 成功结果所在的键。
   */
  readonly okKey: string
  /**
   * @en Key under which a thrown error message arrives.
   * @zh 抛出的错误消息所在的键。
   */
  readonly errKey: string
}

/**
 * @en A decoded worker reply: either the job's value, or the message of the
 * error it threw.
 * @zh 解码后的 worker 回包：任务结果，或任务所抛错误的消息。
 */
export type WorkerReply = {ok: true; value: unknown} | {ok: false; error: string}

/**
 * @en Build the bootstrap script a worker runs. Shared by {@link runInWorker}
 * and {@link WorkerPool} so both ends of the wire protocol — including result
 * transfer and the per-worker compile cache — live in one place.
 *
 * The script expects each message to be `{source, arg, paths}`: the job
 * function's source text, its argument, and the result-transfer paths. It
 * compiles `source` once per worker (a small bounded cache, so a batch of jobs
 * sharing one function does not recompile it every time), runs it, and replies
 * in a tagged envelope.
 *
 * This is the low-level plumbing; usually you want {@link runInWorker} or
 * {@link WorkerPool}.
 *
 * @param channel The keys replies are tagged with. See {@link WorkerReplyChannel}.
 * @returns Script source, ready for `new Worker(URL.createObjectURL(...))`.
 *
 * @zh 生成 worker 运行的引导脚本。由 {@link runInWorker} 与 {@link WorkerPool} 共用，
 * 使这条通信协议的两端——包括结果转移与 worker 内的编译缓存——只存在一处。
 *
 * 脚本期望每条消息形如 `{source, arg, paths}`：任务函数源码、参数、结果转移路径。
 * 它在每个 worker 内把 `source` 编译一次（一个很小的有界缓存，避免一批任务重复编译
 * 同一个函数），执行后以带标记的信封回包。
 *
 * 这属于底层管线；一般直接用 {@link runInWorker} 或 {@link WorkerPool}。
 */
export function createWorkerScript(channel: WorkerReplyChannel): string {
  return `const OK_KEY = ${JSON.stringify(channel.okKey)}
const ERR_KEY = ${JSON.stringify(channel.errKey)}
const COMPILE_CACHE_LIMIT = 32
const compiled = new Map()

const resolvePath = (value, path) => {
  if (path === '.') return value
  let node = value
  for (const step of path.split('.')) {
    if (node === null || node === undefined) return undefined
    node = node[step]
  }
  return node
}

const collectTransfers = (value, paths) => {
  const targets = []
  for (const path of paths) {
    let item = resolvePath(value, path)
    if (ArrayBuffer.isView(item)) item = item.buffer
    const transferable =
      item instanceof ArrayBuffer ||
      (typeof item === 'object' &&
        item !== null &&
        (typeof item.byteLength === 'number' ||
          typeof item.postMessage === 'function' ||
          typeof item.close === 'function'))
    if (transferable && !targets.includes(item)) targets.push(item)
  }
  return targets
}

self.onmessage = async (event) => {
  const request = event.data
  try {
    let fn = compiled.get(request.source)
    if (!fn) {
      // Bounded, so a pool that sees many different functions cannot grow this
      // without limit; clearing only costs a recompile.
      if (compiled.size >= COMPILE_CACHE_LIMIT) compiled.clear()
      fn = new Function('return (' + request.source + ')')()
      compiled.set(request.source, fn)
    }
    const value = await fn(request.arg)
    const paths = request.paths
    const targets = paths && paths.length > 0 ? collectTransfers(value, paths) : []
    if (targets.length > 0) {
      try {
        self.postMessage({[OK_KEY]: value}, targets)
        return
      } catch {
        // A path named something that cannot actually be transferred. Copying
        // is slower but correct, so the job still succeeds.
      }
    }
    self.postMessage({[OK_KEY]: value})
  } catch (error) {
    self.postMessage({[ERR_KEY]: String(error?.message ?? error)})
  }
}`
}

/**
 * @en Decode a reply posted by the script from {@link createWorkerScript}.
 * @zh 解码由 {@link createWorkerScript} 生成的脚本所回传的消息。
 * @param reply The raw `MessageEvent.data`.
 * @param channel The same channel the script was built with.
 * @returns The job's value, or the message of the error it threw.
 */
export function readWorkerReply(reply: unknown, channel: WorkerReplyChannel): WorkerReply {
  if (typeof reply === 'object' && reply !== null) {
    const record = reply as Record<string, unknown>
    if (channel.errKey in record) {
      return {ok: false, error: String(record[channel.errKey])}
    }
    if (channel.okKey in record) {
      return {ok: true, value: record[channel.okKey]}
    }
  }
  return {ok: false, error: `malformed reply from worker: ${String(reply)}`}
}

/**
 * @en Run a self-contained function in a Web Worker and get its result as a
 * Promise. A fresh worker is created from a Blob URL per call and terminated
 * afterwards.
 *
 * Solves: atomic heavy computation (a multi-megabyte JSON.parse, per-pixel
 * image filtering) that CANNOT be split — no yield point exists inside it, so
 * the main thread is simply stuck until it finishes. Moving it to a worker
 * is the only way to keep the page responsive while it runs.
 *
 * Limitations: `fn` is serialized with `toString()`, so it must not capture
 * outer variables; it receives and returns structured-cloneable data (or a
 * Promise of such). If `arg` contains ArrayBuffers you want to transfer
 * instead of copy, use `transfer`; if the RESULT contains them, name their
 * paths in `resultTransfer`. Because a worker is started per call, repeated
 * calls should use {@link WorkerPool} instead.
 *
 * @param fn The function to execute in the worker.
 * @param arg The argument passed to `fn` (structured-cloned into the worker).
 * @param options See {@link WorkerRunOptions}.
 * @returns A promise resolving with `fn`'s result, or rejecting with
 *   `WorkerError` if the worker script fails.
 *
 * @example
 * ```ts
 * // Multi-megabyte payload parsing — atomic and unsplittable, so off-thread
 * const data = await runInWorker(
 *   (raw: string) => JSON.parse(raw) as Record<string, unknown>[],
 *   hugeRawText,
 * )
 *
 * // Pixel processing: the buffer moves in AND back out, both zero-copy
 * const result = await runInWorker(
 *   (img: {buf: ArrayBuffer, width: number, height: number}) => {
 *     // ... per-pixel filtering on img.buf ...
 *     return {buf: img.buf, width: img.width, height: img.height}
 *   },
 *   {buf: pixels.buffer, width, height},
 *   {transfer: [pixels.buffer], resultTransfer: ['buf']},
 * )
 * ```
 */
export async function runInWorker<Arg, Result>(
  fn: WorkerFn<Arg, Result>,
  arg: Arg,
  options: WorkerRunOptions = {},
): Promise<Result> {
  const channel: WorkerReplyChannel = {okKey: '__workerOk__', errKey: '__workerErr__'}
  const url = URL.createObjectURL(
    new Blob([createWorkerScript(channel)], {type: 'text/javascript'}),
  )
  const worker = new Worker(url, {type: 'module'})
  URL.revokeObjectURL(url)

  try {
    const raw = await postTransferable(
      worker,
      {source: fn.toString(), arg, paths: options.resultTransfer ?? []},
      options.transfer,
    )
    const reply = readWorkerReply(raw, channel)
    if (!reply.ok) throw new WorkerError(`Worker function threw: ${reply.error}`)
    return reply.value as Result
  } finally {
    worker.terminate()
  }
}

/**
 * @en Send a message to a worker, transferring ownership of the listed
 * buffers instead of copying them, and get the worker's reply as a Promise.
 *
 * Solves: postMessage copies (serializes) its data, so a multi-megabyte pixel
 * buffer sent per intermediate frame would make the copy cost add up to more
 * than the computation itself. Transferable objects like ArrayBuffer move by
 * reference only — the cost is close to zero regardless of size. The side
 * that hands the buffer over can no longer use it; in exchange, the copy
 * cost disappears.
 *
 * @param worker The worker to talk to.
 * @param data The message to send (structured-cloneable, or containing the
 *   buffers to transfer).
 * @param transfer Objects whose ownership moves to the worker. After the
 *   transfer, this side can no longer use them.
 * @returns A promise resolving with the worker's next reply. Reuses a
 *   one-message-per-call protocol: each call attaches a fresh listener and
 *   removes it once the reply arrives.
 *
 * @example
 * ```ts
 * // Hand the pixel buffer to the worker without copying it
 * const worker = new Worker('imageProcessor.js')
 * const result = await postTransferable(
 *   worker,
 *   {buf: pixels.buffer, width, height}, // the message
 *   [pixels.buffer], // ...and the ownership transfer
 * )
 * // After the transfer, `pixels` on this side is detached (zero-length)
 * ```
 */
export function postTransferable<Arg = unknown, Result = unknown>(
  worker: Worker,
  data: Arg,
  transfer?: Transferable[],
): Promise<Result> {
  return new Promise<Result>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      cleanup()
      resolve(e.data as Result)
    }
    const onError = (e: ErrorEvent) => {
      cleanup()
      reject(new WorkerError(`Worker error: ${e.message}`, e.message))
    }
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    if (transfer?.length) {
      worker.postMessage(data, transfer)
    } else {
      worker.postMessage(data)
    }
  })
}
