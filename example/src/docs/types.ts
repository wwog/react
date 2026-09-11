import type {FC} from "react";
import type {Localized} from "../i18n";

/**
 * 侧栏的顶层分区：首页单独成项，其余页面统一收在「文档」之下。
 * 用字符串字面量而非常量对象，方便在 route 里直接写 `section: "home"`。
 */
export type DocSection = "home" | "docs";

export const sectionLabels: Record<DocSection, Localized> = {
  home: {zh: "主页", en: "Home"},
  docs: {zh: "文档", en: "Docs"},
};

/**
 * 一条文档路由。左侧列表先按 section 分顶层区块（省略即「文档」），
 * 文档区块内再按 group 分小节，右侧渲染 component。标题与简介都是双语的。
 */
export interface DocRoute {
  id: string;
  /** 省略时归入「文档」区块。 */
  section?: DocSection;
  /** 「文档」区块内的小节；首页没有小节。 */
  group?: Localized;
  title: Localized;
  blurb: Localized;
  component: FC;
}

/**
 * 分组与 `src/` 的顶层目录一一对应。各分组的 routes 文件引用这里的常量，
 * 保证同一分组在中英两种语言下始终合并到同一个侧栏小节。
 */
export const groups = {
  utils: {zh: "工具", en: "Utils"},
  hooks: {zh: "钩子", en: "Hooks"},
  components: {zh: "组件", en: "Components"},
  algorithm: {zh: "算法", en: "Algorithm"},
} satisfies Record<string, Localized>;
