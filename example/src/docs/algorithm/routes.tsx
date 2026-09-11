import {groups, type DocRoute} from "../types";
import {ZellersDoc} from "./ZellersDoc";

/** algorithm 分组的全部路由（对应 `src/algorithm/`）。 */
export const algorithmRoutes: DocRoute[] = [
  {
    id: "zellers-congruence",
    group: groups.algorithm,
    title: {zh: "蔡勒公式", en: "Zeller's congruence"},
    blurb: {
      zh: "weekday · weekdayJulian · 负余数修正 · 公历与儒略历对照",
      en: "weekday · weekdayJulian · negative-remainder fix · Gregorian vs Julian",
    },
    component: ZellersDoc,
  },
];
