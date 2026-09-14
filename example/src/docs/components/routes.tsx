import {groups, type DocRoute} from "../types";
import {FrameRenderDoc} from "./FrameRenderDoc";
import {NavigationDoc} from "./NavigationDoc";
import {ProcessControlDoc} from "./ProcessControlDoc";
import {StructDoc} from "./StructDoc";
import {SundryDoc} from "./SundryDoc";
import {SundryRuntimeDoc} from "./SundryRuntimeDoc";

/**
 * components 分组的全部路由（对应 `src/components/`）。
 * 按子目录分页：ProcessControl、Struct、Sundry（较大，拆成基础与交互两页）、Navigation、Performance。
 */
export const componentsRoutes: DocRoute[] = [
  {
    id: "process-control",
    group: groups.components,
    title: {zh: "流程控制", en: "Process control"},
    blurb: {
      zh: "If / Switch / When / Pipe · 声明式分支与数据管道 · displayName 字符串匹配",
      en: "If / Switch / When / Pipe · declarative branching and data pipelines · displayName string matching",
    },
    component: ProcessControlDoc,
  },
  {
    id: "struct",
    group: groups.components,
    title: {zh: "结构渲染", en: "Structural rendering"},
    blurb: {
      zh: "ArrayRender / DateRender · 列表过滤排序空态 · 日期格式化",
      en: "ArrayRender / DateRender · list filter, sort and empty state · date formatting",
    },
    component: StructDoc,
  },
  {
    id: "sundry",
    group: groups.components,
    title: {zh: "杂项:结构", en: "Sundry: structure"},
    blurb: {
      zh: "Repeat / Scope / Toggle / SizeBox / Styles · 重复渲染、局部作用域与类名组合",
      en: "Repeat / Scope / Toggle / SizeBox / Styles · repeat, local scope and class composition",
    },
    component: SundryDoc,
  },
  {
    id: "sundry-runtime",
    group: groups.components,
    title: {zh: "杂项:交互", en: "Sundry: interaction"},
    blurb: {
      zh: "Observer / Portal / Boundary / FocusTrap · 交叉观察、传送门、错误边界与焦点陷阱",
      en: "Observer / Portal / Boundary / FocusTrap · intersection, portal, error boundary and focus trap",
    },
    component: SundryRuntimeDoc,
  },
  {
    id: "navigation",
    group: groups.components,
    title: {zh: "堆栈导航", en: "Stack navigation"},
    blurb: {
      zh: "AppStackRouter · useAppStack / useStackSize / useCanPop · 压栈、出栈、左滑返回",
      en: "AppStackRouter · useAppStack / useStackSize / useCanPop · push, pop and swipe-back",
    },
    component: NavigationDoc,
  },
  {
    id: "frame-render",
    group: groups.components,
    title: {zh: "性能:帧渲染", en: "Performance: frame render"},
    blurb: {
      zh: "FrameRender · 合帧投递、最新值胜出 · fps / leading / trailing · select / compare / shouldCommit",
      en: "FrameRender · framed delivery, latest wins · fps / leading / trailing · select / compare / shouldCommit",
    },
    component: FrameRenderDoc,
  },
];
