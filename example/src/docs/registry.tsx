import type {FC} from "react";
import type {Localized} from "../i18n";
import {BackpressureDoc} from "./utils/BackpressureDoc";
import {BatchingDoc} from "./utils/BatchingDoc";
import {ExternalStateDoc} from "./utils/ExternalStateDoc";
import {FlipDoc} from "./utils/FlipDoc";
import {FocusableDoc} from "./utils/FocusableDoc";
import {FoundationsDoc} from "./utils/FoundationsDoc";
import {MemoizeDoc} from "./utils/MemoizeDoc";
import {QueueDoc} from "./utils/QueueDoc";
import {WorkerDoc} from "./utils/WorkerDoc";
import {WorkerPoolDoc} from "./utils/WorkerPoolDoc";
import {YieldDoc} from "./utils/YieldDoc";

/**
 * 一条文档路由。左侧列表按 group 分组，右侧渲染 component。
 * 新增一个功能页只需在这里加一项——标题与简介都是双语的。
 */
export interface DocRoute {
  id: string;
  group: Localized;
  title: Localized;
  blurb: Localized;
  component: FC;
}

/**
 * 分组与 `src/` 的目录一一对应。当前只完成了 utils（工具）分组；
 * hooks / components / algorithm 待补，届时复用同一个 group 常量即可。
 */
const utilsGroup: Localized = {zh: "工具", en: "Utils"};

export const routes: DocRoute[] = [
  {
    id: "worker-pool",
    group: utilsGroup,
    title: {zh: "WorkerPool 工作池", en: "WorkerPool"},
    blurb: {
      zh: "固定大小 worker 池 · 最轻负载分配 · 工作窃取 · 结果零拷贝",
      en: "Fixed-size worker pool · least-loaded dispatch · work stealing · zero-copy results",
    },
    component: WorkerPoolDoc,
  },
  {
    id: "worker",
    group: utilsGroup,
    title: {zh: "Worker 通信", en: "Worker messaging"},
    blurb: {
      zh: "引导脚本 · postTransferable · readWorkerReply · 零拷贝来与回",
      en: "Bootstrap script · postTransferable · readWorkerReply · zero-copy both ways",
    },
    component: WorkerDoc,
  },
  {
    id: "queue",
    group: utilsGroup,
    title: {zh: "Queue 与优先级队列", en: "Queue & priority queue"},
    blurb: {
      zh: "摊还 O(1) 的 FIFO 队列 · 紧急插队 · 事后 promote",
      en: "Amortized O(1) FIFO queue · urgent cut-in · later promote",
    },
    component: QueueDoc,
  },
  {
    id: "yield",
    group: utilsGroup,
    title: {zh: "拆分与让出", en: "Splitting & yielding"},
    blurb: {
      zh: "yieldToMain · forEachChunked · forEachInFrames · 长任务不冻结页面",
      en: "yieldToMain · forEachChunked · forEachInFrames · long tasks without freezing",
    },
    component: YieldDoc,
  },
  {
    id: "batching",
    group: utilsGroup,
    title: {zh: "批量与合并", en: "Batching & coalescing"},
    blurb: {
      zh: "debounce · throttle · rafSchedule · appendBatch · runLayoutBatch",
      en: "debounce · throttle · rafSchedule · appendBatch · runLayoutBatch",
    },
    component: BatchingDoc,
  },
  {
    id: "backpressure",
    group: utilsGroup,
    title: {zh: "背压:丢弃与合并", en: "Backpressure: drop & merge"},
    blurb: {
      zh: "createDroppingQueue · createLatestValue · 流入超过吞吐时的取舍",
      en: "createDroppingQueue · createLatestValue · choices when inflow beats throughput",
    },
    component: BackpressureDoc,
  },
  {
    id: "memoize",
    group: utilsGroup,
    title: {zh: "记忆化", en: "Memoization"},
    blurb: {
      zh: "memoize · 跳过重复计算 · key 推导规则 · hits / misses",
      en: "memoize · skip repeated computation · key derivation · hits / misses",
    },
    component: MemoizeDoc,
  },
  {
    id: "flip",
    group: utilsGroup,
    title: {zh: "FLIP 动画", en: "FLIP animation"},
    blurb: {
      zh: "flipAnimate · 只变一次布局,其余交给合成器",
      en: "flipAnimate · one layout change, the rest on the compositor",
    },
    component: FlipDoc,
  },
  {
    id: "focusable",
    group: utilsGroup,
    title: {zh: "可聚焦性", en: "Focusability"},
    blurb: {
      zh: "isFocusable · isTabbable · getFocusableElements · getTabbableElements",
      en: "isFocusable · isTabbable · getFocusableElements · getTabbableElements",
    },
    component: FocusableDoc,
  },
  {
    id: "external-state",
    group: utilsGroup,
    title: {zh: "外部状态", en: "External state"},
    blurb: {
      zh: "createExternalState · createStorageState · 跨组件共享与会话持久化",
      en: "createExternalState · createStorageState · cross-component state and persistence",
    },
    component: ExternalStateDoc,
  },
  {
    id: "foundations",
    group: utilsGroup,
    title: {zh: "基础工具", en: "Foundations"},
    blurb: {
      zh: "cx · formatDate · Counter · childrenLoop · Promise 兼容层 · 断点常量",
      en: "cx · formatDate · Counter · childrenLoop · Promise helpers · breakpoints",
    },
    component: FoundationsDoc,
  },
];

export const defaultRouteId = routes[0].id;

export const findRoute = (id: string): DocRoute =>
  routes.find((route) => route.id === id) ?? routes[0];
