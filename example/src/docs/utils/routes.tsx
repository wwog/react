import {groups, type DocRoute} from "../types";
import {BackpressureDoc} from "./BackpressureDoc";
import {BatchingDoc} from "./BatchingDoc";
import {EventDoc} from "./EventDoc";
import {ExternalStateDoc} from "./ExternalStateDoc";
import {FlipDoc} from "./FlipDoc";
import {FocusableDoc} from "./FocusableDoc";
import {FoundationsDoc} from "./FoundationsDoc";
import {MemoizeDoc} from "./MemoizeDoc";
import {QueueDoc} from "./QueueDoc";
import {WorkerDoc} from "./WorkerDoc";
import {WorkerPoolDoc} from "./WorkerPoolDoc";
import {YieldDoc} from "./YieldDoc";

/** utils 分组的全部路由（对应 `src/utils/`）。 */
export const utilsRoutes: DocRoute[] = [
  {
    id: "event",
    group: groups.utils,
    title: {zh: "事件与生命周期", en: "Events & lifetime"},
    blurb: {
      zh: "Emitter · Event 组合子 · 专用 emitter · 泄漏检测 · DisposableStore",
      en: "Emitter · Event combinators · specialised emitters · leak detection · DisposableStore",
    },
    component: EventDoc,
  },
  {
    id: "worker-pool",
    group: groups.utils,
    title: {zh: "WorkerPool 工作池", en: "WorkerPool"},
    blurb: {
      zh: "固定大小 worker 池 · 最轻负载分配 · 工作窃取 · 结果零拷贝",
      en: "Fixed-size worker pool · least-loaded dispatch · work stealing · zero-copy results",
    },
    component: WorkerPoolDoc,
  },
  {
    id: "worker",
    group: groups.utils,
    title: {zh: "Worker 通信", en: "Worker messaging"},
    blurb: {
      zh: "引导脚本 · postTransferable · readWorkerReply · 零拷贝来与回",
      en: "Bootstrap script · postTransferable · readWorkerReply · zero-copy both ways",
    },
    component: WorkerDoc,
  },
  {
    id: "queue",
    group: groups.utils,
    title: {zh: "Queue 与优先级队列", en: "Queue & priority queue"},
    blurb: {
      zh: "摊还 O(1) 的 FIFO 队列 · 紧急插队 · 事后 promote",
      en: "Amortized O(1) FIFO queue · urgent cut-in · later promote",
    },
    component: QueueDoc,
  },
  {
    id: "yield",
    group: groups.utils,
    title: {zh: "拆分与让出", en: "Splitting & yielding"},
    blurb: {
      zh: "yieldToMain · forEachChunked · forEachInFrames · 长任务不冻结页面",
      en: "yieldToMain · forEachChunked · forEachInFrames · long tasks without freezing",
    },
    component: YieldDoc,
  },
  {
    id: "batching",
    group: groups.utils,
    title: {zh: "批量与合并", en: "Batching & coalescing"},
    blurb: {
      zh: "debounce · throttle · rafSchedule · appendBatch · runLayoutBatch",
      en: "debounce · throttle · rafSchedule · appendBatch · runLayoutBatch",
    },
    component: BatchingDoc,
  },
  {
    id: "backpressure",
    group: groups.utils,
    title: {zh: "背压:丢弃与合并", en: "Backpressure: drop & merge"},
    blurb: {
      zh: "createDroppingQueue · createLatestValue · 流入超过吞吐时的取舍",
      en: "createDroppingQueue · createLatestValue · choices when inflow beats throughput",
    },
    component: BackpressureDoc,
  },
  {
    id: "memoize",
    group: groups.utils,
    title: {zh: "记忆化", en: "Memoization"},
    blurb: {
      zh: "memoize · 跳过重复计算 · key 推导规则 · hits / misses",
      en: "memoize · skip repeated computation · key derivation · hits / misses",
    },
    component: MemoizeDoc,
  },
  {
    id: "flip",
    group: groups.utils,
    title: {zh: "FLIP 动画", en: "FLIP animation"},
    blurb: {
      zh: "flipAnimate · 只变一次布局,其余交给合成器",
      en: "flipAnimate · one layout change, the rest on the compositor",
    },
    component: FlipDoc,
  },
  {
    id: "focusable",
    group: groups.utils,
    title: {zh: "可聚焦性", en: "Focusability"},
    blurb: {
      zh: "isFocusable · isTabbable · getFocusableElements · getTabbableElements",
      en: "isFocusable · isTabbable · getFocusableElements · getTabbableElements",
    },
    component: FocusableDoc,
  },
  {
    id: "external-state",
    group: groups.utils,
    title: {zh: "外部状态", en: "External state"},
    blurb: {
      zh: "createExternalState · createStorageState · 跨组件共享与会话持久化",
      en: "createExternalState · createStorageState · cross-component state and persistence",
    },
    component: ExternalStateDoc,
  },
  {
    id: "foundations",
    group: groups.utils,
    title: {zh: "基础工具", en: "Foundations"},
    blurb: {
      zh: "cx · formatDate · Counter · childrenLoop · Promise 兼容层 · 断点常量",
      en: "cx · formatDate · Counter · childrenLoop · Promise helpers · breakpoints",
    },
    component: FoundationsDoc,
  },
];
