import type {FC} from "react";
import type {Localized} from "../i18n";

/**
 * 一条文档路由。左侧列表按 group 分组，右侧渲染 component。
 * 标题与简介都是双语的。
 */
export interface DocRoute {
  id: string;
  group: Localized;
  title: Localized;
  blurb: Localized;
  component: FC;
}

/**
 * 分组与 `src/` 的顶层目录一一对应。各分组的 routes 文件引用这里的常量，
 * 保证同一分组在四种语言下始终合并到同一个侧栏小节。
 */
export const groups = {
  utils: {zh: "工具", en: "Utils"},
  hooks: {zh: "钩子", en: "Hooks"},
  components: {zh: "组件", en: "Components"},
  algorithm: {zh: "算法", en: "Algorithm"},
} satisfies Record<string, Localized>;
