import {useEffect, useRef, useState, type FC} from "react";
import {
  WorkerError,
  createWorkerScript,
  postTransferable,
  readWorkerReply,
  type WorkerReplyChannel,
} from "../../../../src";
import {useI18n} from "../../i18n";
import {
  ApiTable,
  Button,
  Callout,
  Code,
  Controls,
  Demo,
  InlineCode,
  Muted,
  Output,
  P,
  Section,
  colors,
} from "../ui";

const BYTES = 8 * 1024 * 1024;

/**
 * 手工搭一条最低层的 worker 通道：createWorkerScript 生成引导脚本，
 * postTransferable 负责零拷贝发送并等待回包，readWorkerReply 解码信封。
 * WorkerPool 内部走的就是这条协议。
 */
const LowLevelDemo: FC = () => {
  const {t} = useI18n();
  const workerRef = useRef<Worker | null>(null);
  const urlRef = useRef<string | null>(null);
  const channelRef = useRef<WorkerReplyChannel | null>(null);
  const [busy, setBusy] = useState(false);
  const [inResult, setInResult] = useState<{before: number; after: number; first: number} | null>(null);
  const [outResult, setOutResult] = useState<{bytes: number; first: number} | null>(null);
  const [errorResult, setErrorResult] = useState<string | null>(null);

  const ensureWorker = (): {worker: Worker; channel: WorkerReplyChannel} => {
    if (workerRef.current && channelRef.current) {
      return {worker: workerRef.current, channel: channelRef.current};
    }
    const channel: WorkerReplyChannel = {okKey: "__wwog_ok", errKey: "__wwog_err"};
    const blob = new Blob([createWorkerScript(channel)], {type: "text/javascript"});
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;
    urlRef.current = url;
    channelRef.current = channel;
    return {worker, channel};
  };

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  /** 入参零拷贝：把 buffer 的所有权移入 worker，主线程侧 byteLength 归零。 */
  const runIn = async () => {
    setBusy(true);
    setInResult(null);
    const {worker, channel} = ensureWorker();
    const buffer = new ArrayBuffer(BYTES);
    new Uint8Array(buffer)[0] = 42;
    const source = ((buf: ArrayBuffer) => {
      const view = new Uint8Array(buf);
      return {bytes: view.length, first: view[0]};
    }).toString();
    try {
      const reply = await postTransferable(
        worker,
        {source, arg: buffer, paths: [] as string[]},
        [buffer],
      );
      const decoded = readWorkerReply(reply, channel);
      if (!decoded.ok) {
        setErrorResult(decoded.error);
        return;
      }
      const value = decoded.value as {bytes: number; first: number};
      setInResult({before: BYTES, after: buffer.byteLength, first: value.first});
    } finally {
      setBusy(false);
    }
  };

  /** 回程零拷贝：结果的 data 字段按 resultTransfer 路径移回主线程。 */
  const runOut = async () => {
    setBusy(true);
    setOutResult(null);
    const {worker, channel} = ensureWorker();
    const source = ((bytes: number) => {
      const data = new Uint8Array(bytes);
      data.fill(7);
      return {data, bytes};
    }).toString();
    try {
      const reply = await postTransferable(worker, {source, arg: BYTES, paths: ["data"]});
      const decoded = readWorkerReply(reply, channel);
      if (!decoded.ok) {
        setErrorResult(decoded.error);
        return;
      }
      const value = decoded.value as {data: Uint8Array; bytes: number};
      setOutResult({bytes: value.bytes, first: value.data[0]!});
    } finally {
      setBusy(false);
    }
  };

  /** 任务抛错：worker 不崩，错误以信封形式回传。 */
  const runError = async () => {
    setBusy(true);
    setErrorResult(null);
    const {worker, channel} = ensureWorker();
    const source = (() => {
      throw new Error("boom from the worker");
    }).toString();
    try {
      const reply = await postTransferable(worker, {source, arg: null, paths: [] as string[]});
      const decoded = readWorkerReply(reply, channel);
      setErrorResult(decoded.ok ? t({zh: "没有报错？", en: "no error?"}) : decoded.error);
    } finally {
      setBusy(false);
    }
  };

  const runScriptError = async () => {
    setBusy(true);
    setErrorResult(null);
    const {worker} = ensureWorker();
    // 直接发一条违反协议的负载:worker 内部 new Function 会抛错并回传
    try {
      const reply = await postTransferable(worker, {source: "not a function", arg: null, paths: []});
      setErrorResult(String((reply as Record<string, unknown>).__wwog_err ?? reply));
    } catch (error) {
      // postTransferable 只会在 worker 自身的 error 事件上 reject，并归一为 WorkerError
      setErrorResult(error instanceof WorkerError ? `${error.name}: ${error.message}` : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Demo
      title={t({zh: "示例:最小的 worker 通信协议", en: "Demo: the minimal worker protocol"})}
      hint={t({
        zh: `同一个 worker 复用四次：传 ${BYTES / 1024 / 1024}MB 进去、把 buffer 传回来、让任务抛错、发一条非法负载。`,
        en: `One reused worker, four runs: send ${BYTES / 1024 / 1024}MB in, move a buffer back, make a job throw, and send an invalid payload.`,
      })}
    >
      <Controls>
        <Button onClick={runIn} disabled={busy}>
          {t({zh: "入参 transfer", en: "transfer argument"})}
        </Button>
        <Button onClick={runOut} disabled={busy} tone="ghost">
          {t({zh: "结果 resultTransfer", en: "resultTransfer"})}
        </Button>
        <Button onClick={runError} disabled={busy} tone="ghost">
          {t({zh: "任务抛错", en: "job throws"})}
        </Button>
        <Button onClick={runScriptError} disabled={busy} tone="ghost">
          {t({zh: "非法负载", en: "invalid payload"})}
        </Button>
      </Controls>

      {inResult ? (
        <Output>
          <div>
            {t({zh: "主线程侧 buffer.byteLength", en: "main-thread buffer.byteLength"})}:{" "}
            {inResult.before.toLocaleString()} →{" "}
            <strong style={{color: colors.success}}>{inResult.after}</strong>
          </div>
          <div>
            {t({zh: "worker 读到首字节", en: "worker read first byte"})}: {inResult.first}
          </div>
          <Muted>
            {t({
              zh: "byteLength 归零说明所有权已转移：主线程不再持有这块内存。",
              en: "byteLength 0 means ownership moved: the main thread no longer holds the memory.",
            })}
          </Muted>
        </Output>
      ) : null}

      {outResult ? (
        <Output>
          <div>
            {t({zh: "回传字节数", en: "bytes returned"})}: {outResult.bytes.toLocaleString()}
          </div>
          <div>
            {t({zh: "结果首字节", en: "result first byte"})}: {outResult.first}
          </div>
          <Muted>
            {t({
              zh: "路径命中时按引用移回；路径写错则退化为拷贝，而不是让任务失败。",
              en: "A matching path moves by reference; a wrong path degrades to a copy instead of failing the job.",
            })}
          </Muted>
        </Output>
      ) : null}

      {errorResult ? (
        <Output>
          <div>
            {t({zh: "错误", en: "error"})}: <strong style={{color: "#dc2626"}}>{errorResult}</strong>
          </div>
          <Muted>
            {t({
              zh: "抛错的是任务，不是 worker。worker 脚本仍然活着，下一次调用照常工作。",
              en: "The job threw, not the worker. The worker script is still alive and the next call works as usual.",
            })}
          </Muted>
        </Output>
      ) : null}
    </Demo>
  );
};

export const WorkerDoc: FC = () => {
  const {t} = useI18n();

  return (
    <div>
      <P>
        {t({
          zh: (
            <>
              把一个 worker 看成一条异步函数调用通道：发起方给出「函数源码 + 参数」，worker 重建函数、
              执行、把结果回传。这一页讲清这条协议的两端；需要现成的池化、负载均衡与工作窃取，请直接用{" "}
              <InlineCode>WorkerPool</InlineCode>。
            </>
          ),
          en: (
            <>
              Think of a worker as an async function-call channel: the sender provides "function source
              + argument", the worker rebuilds the function, runs it, and posts the result back. This
              page covers both ends of that protocol; for pooling, load balancing and work stealing, use{" "}
              <InlineCode>WorkerPool</InlineCode>.
            </>
          ),
        })}
      </P>

      <Callout tone="warn">
        {t({
          zh: (
            <>
              这个协议用 <InlineCode>new Function</InlineCode> 在 worker 内重建任务函数，因此页面 CSP
              必须允许 <InlineCode>unsafe-eval</InlineCode>。若不能允许，就只能自己构建固定脚本的 worker，
              用 <InlineCode>postTransferable</InlineCode> 收发消息。
            </>
          ),
          en: (
            <>
              This protocol rebuilds the job function with <InlineCode>new Function</InlineCode> inside
              the worker, so the page CSP must allow <InlineCode>unsafe-eval</InlineCode>. If it cannot,
              build a fixed-script worker yourself and use <InlineCode>postTransferable</InlineCode> to
              exchange messages.
            </>
          ),
        })}
      </Callout>

      <Section title={t({zh: "1. 两个线程之间", en: "1. Between the two threads"})}>
        <P>
          {t({
            zh: (
              <>
                主线程与 worker 只能通过 <InlineCode>postMessage</InlineCode> 通信，而它会「拷贝」（序列化）
                数据。数据一大，通信成本就不可忽视——改传 <InlineCode>Transferable</InlineCode>（
                <InlineCode>ArrayBuffer</InlineCode> 等）即可按引用转移：发送方失去使用权，成本与体积无关。
                回程同理。
              </>
            ),
            en: (
              <>
                The main thread and a worker can only talk through <InlineCode>postMessage</InlineCode>,
                which copies (serializes) its data. For large payloads that copy is significant — pass{" "}
                <InlineCode>Transferable</InlineCode> objects (<InlineCode>ArrayBuffer</InlineCode> and
                friends) to move them by reference: the sender loses access and the cost is independent
                of size. The same applies to the return leg.
              </>
            ),
          })}
        </P>
        <Code
          code={`import { createWorkerScript, postTransferable, readWorkerReply } from "@wwog/react";

// 1. 生成 worker 引导脚本,用 Blob URL 启动
const channel = { okKey: "__ok", errKey: "__err" };
const worker = new Worker(
  URL.createObjectURL(new Blob([createWorkerScript(channel)], { type: "text/javascript" })),
);

// 2. 发一条符合协议的请求,并转移 buffer 的所有权
const buffer = new ArrayBuffer(8 * 1024 * 1024);
const reply = await postTransferable(
  worker,
  { source: myFn.toString(), arg: { buf: buffer }, paths: ["buf"] },
  [buffer],
);
buffer.byteLength; // 0 —— 所有权已经不在主线程

// 3. 解码带标记的信封
const decoded = readWorkerReply(reply, channel);
if (decoded.ok) use(decoded.value);
else console.error(decoded.error);`}
          caption={t({
            zh: "paths 是结果的转移路径（点分隔），与 WorkerPool 的 resultTransfer 是同一套语义。",
            en: "paths is the result-transfer path list (dot-separated) — the same semantics as WorkerPool's resultTransfer.",
          })}
        />
        <LowLevelDemo />
      </Section>

      <Section title={t({zh: "2. 协议细节", en: "2. Protocol details"})}>
        <P>
          {t({
            zh: (
              <>
                引导脚本用两个由调用方生成的键（<InlineCode>okKey</InlineCode> /{" "}
                <InlineCode>errKey</InlineCode>）区分成功与失败回包；按池生成可避免与任务自身结果对象的
                字段冲突。脚本在每个 worker 内保留一个很小的编译缓存（上限 32），一批共用同一函数的任务
                不会重复编译。
              </>
            ),
            en: (
              <>
                The bootstrap script tags replies with two caller-generated keys (
                <InlineCode>okKey</InlineCode> / <InlineCode>errKey</InlineCode>) to separate success
                from failure; generating them per pool avoids collisions with a job's own result object.
                It keeps a small per-worker compile cache (limit 32) so a batch sharing one function does
                not recompile it every time.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[t({zh: "导出", en: "export"}), t({zh: "签名", en: "signature"}), t({zh: "说明", en: "description"})]}
          rows={[
            [
              <InlineCode>createWorkerScript</InlineCode>,
              <InlineCode>(channel) =&gt; string</InlineCode>,
              t({zh: "生成 worker 引导脚本源码。", en: "Generate the worker bootstrap script source."}),
            ],
            [
              <InlineCode>readWorkerReply</InlineCode>,
              <InlineCode>(reply, channel) =&gt; WorkerReply</InlineCode>,
              t({zh: "解码回包为 { ok, value | error }。", en: "Decode a reply into { ok, value | error }."}),
            ],
            [
              <InlineCode>postTransferable</InlineCode>,
              <InlineCode>(worker, data, transfer?) =&gt; Promise&lt;Result&gt;</InlineCode>,
              t({zh: "发送消息并等待下一条回包。", en: "Post a message and await the next reply."}),
            ],
            [
              <InlineCode>WorkerError</InlineCode>,
              <InlineCode>class extends Error</InlineCode>,
              t({zh: "worker 脚本出错时抛出；raw 保留原始消息。", en: "Thrown when the worker script errors; raw carries the original message."}),
            ],
          ]}
        />
        <P>
          <Muted>
            {t({
              zh: "postTransferable 每次调用附加一对临时 listener，收到回包后立即移除；它是一问一答的协议，不要并发复用同一个 worker 而不做多路复用。",
              en: "postTransferable attaches a fresh listener pair per call and removes it on reply; it is a request/response protocol, so do not share one worker concurrently without multiplexing.",
            })}
          </Muted>
        </P>
      </Section>

      <Section title={t({zh: "3. 什么时候值得", en: "3. When it is worth it"})}>
        <P>
          {t({
            zh: (
              <>
                worker 不是万能药：计算要足够重、能压过通信成本，且与 DOM 无关时才划算。
                通过 Blob URL 启动 worker 是最通用的方式，也可用独立脚本文件。
              </>
            ),
            en: (
              <>
                Workers are not a cure-all: they pay off when the computation is heavy enough to
                outweigh the communication cost and has nothing to do with the DOM. A Blob URL is the
                most portable way to start one; a separate script file works too.
              </>
            ),
          })}
        </P>
        <ApiTable
          head={[t({zh: "限制", en: "limit"}), t({zh: "说明", en: "why it matters"})]}
          rows={[
            [
              t({zh: "worker 内没有 DOM", en: "No DOM in a worker"}),
              t({zh: "布局、事件、window 都不可用；只有纯计算与部分 Web API。", en: "No layout, events or window — only pure computation and a subset of Web APIs."}),
            ],
            [
              t({zh: "数据必须可结构化克隆", en: "Data must be structured-cloneable"}),
              t({zh: "函数、DOM 节点不可克隆；报错会归一为 WorkerError。", en: "Functions and DOM nodes cannot be cloned; failures normalize to WorkerError."}),
            ],
            [
              t({zh: "转移是不可逆的", en: "Transfer is irreversible"}),
              t({zh: "交出 buffer 后发送方就无法再使用；要保留就传副本。", en: "Once a buffer is handed over the sender cannot use it; keep a copy if you still need it."}),
            ],
            [
              t({zh: "启动有成本", en: "Startup costs something"}),
              t({zh: "所以需要池化复用——见 WorkerPool。", en: "Which is why pooling matters — see WorkerPool."}),
            ],
          ]}
        />
      </Section>
    </div>
  );
};
