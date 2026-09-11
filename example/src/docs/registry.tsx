import {algorithmRoutes} from "./algorithm/routes";
import {componentsRoutes} from "./components/routes";
import {hooksRoutes} from "./hooks/routes";
import type {DocRoute} from "./types";
import {utilsRoutes} from "./utils/routes";

export type {DocRoute} from "./types";

/**
 * 侧栏按 group 分组，分组与 `src/` 的顶层目录一一对应。
 * 每个分组各自维护一份 routes 文件（`docs/<group>/routes.tsx`），
 * 这里只负责汇总与排序——新增分组时在此处加一行展开即可。
 */
export const routes: DocRoute[] = [
  ...componentsRoutes,
  ...hooksRoutes,
  ...utilsRoutes,
  ...algorithmRoutes,
];

export const defaultRouteId = routes[0].id;

export const findRoute = (id: string): DocRoute =>
  routes.find((route) => route.id === id) ?? routes[0];
