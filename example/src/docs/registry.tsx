import {algorithmRoutes} from "./algorithm/routes";
import {componentsRoutes} from "./components/routes";
import {HomeDoc} from "./home/HomeDoc";
import {hooksRoutes} from "./hooks/routes";
import type {DocRoute} from "./types";
import {utilsRoutes} from "./utils/routes";

export type {DocRoute} from "./types";

/**
 * 侧栏分两层：首页（`section: "home"`）单独成项，其余页面收在「文档」区块下，
 * 区块内再按 group 分小节，分组与 `src/` 的顶层目录一一对应。
 * 每个分组各自维护一份 routes 文件（`docs/<group>/routes.tsx`），
 * 这里只负责汇总与排序——新增分组时在此处加一行展开即可。
 */
export const routes: DocRoute[] = [
  {
    id: "home",
    section: "home",
    title: {zh: "主页", en: "Home"},
    blurb: {
      zh: "仓库概览 · 声明式组件 · 高性能工具函数",
      en: "Repository overview · declarative components · high-performance utilities",
    },
    component: HomeDoc,
  },
  ...componentsRoutes,
  ...hooksRoutes,
  ...utilsRoutes,
  ...algorithmRoutes,
];

export const defaultRouteId = routes[0].id;

export const findRoute = (id: string): DocRoute =>
  routes.find((route) => route.id === id) ?? routes[0];
