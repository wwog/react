import type {FC} from "react";
import type {Localized} from "../i18n";
import {WorkerPoolDoc} from "./WorkerPoolDoc";

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

export const routes: DocRoute[] = [
  {
    id: "worker-pool",
    group: {zh: "工具", en: "Utils"},
    title: {zh: "WorkerPool 工作池", en: "WorkerPool"},
    blurb: {
      zh: "固定大小 worker 池 · 最轻负载分配 · 工作窃取 · 结果零拷贝",
      en: "Fixed-size worker pool · least-loaded dispatch · work stealing · zero-copy results",
    },
    component: WorkerPoolDoc,
  },
];

export const defaultRouteId = routes[0].id;

export const findRoute = (id: string): DocRoute =>
  routes.find((route) => route.id === id) ?? routes[0];
