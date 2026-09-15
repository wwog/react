import {groups, type DocRoute} from "../types";
import {UseControlledDoc} from "./UseControlledDoc";
import {UseEventDoc} from "./UseEventDoc";
import {UseScreenDoc} from "./UseScreenDoc";

/** hooks 分组的全部路由（对应 `src/hooks/`）。 */
export const hooksRoutes: DocRoute[] = [
  {
    id: "use-controlled",
    group: groups.hooks,
    title: {zh: "useControlled 受控状态", en: "useControlled"},
    blurb: {
      zh: "受控 / 非受控统一 · hasOwnProperty 判定 · onBeforeChange 否决 · 自定义 trigger",
      en: "Controlled / uncontrolled unification · hasOwnProperty detection · onBeforeChange veto · custom trigger",
    },
    component: UseControlledDoc,
  },
  {
    id: "use-event",
    group: groups.hooks,
    title: {zh: "useEvent 事件订阅", en: "useEvent"},
    blurb: {
      zh: "订阅跟随组件生死 · useEventValue 事件驱动值 · useEventCallback 稳定回调",
      en: "Subscriptions that follow the component · useEventValue · useEventCallback",
    },
    component: UseEventDoc,
  },
  {
    id: "use-screen",
    group: groups.hooks,
    title: {zh: "useScreen 响应式断点", en: "useScreen"},
    blurb: {
      zh: "实时当前断点 · 自定义 breakpointDesc · 纯函数 getCurrentBreakpoint",
      en: "Live current breakpoint · custom breakpointDesc · pure getCurrentBreakpoint",
    },
    component: UseScreenDoc,
  },
];
