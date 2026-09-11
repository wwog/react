import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";

/**
 * 一段同时提供中英文的文案。内容与外壳共用这一种表达，因此翻译和内容写在
 * 一起，不需要维护一张扁平的 key 表。T 可以是 string，也可以是 ReactNode。
 */
export interface Localized<T = string> {
  zh: T;
  en: T;
}

export type Lang = "zh" | "en";

export const langs: readonly Lang[] = ["zh", "en"];

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** 按当前语言取出文案：t({ zh: "中文", en: "English" })。 */
  t: <T>(value: Localized<T>) => T;
}

const STORAGE_KEY = "wwog-example-lang";

const I18nContext = createContext<I18nValue | null>(null);

const readInitialLang = (): Lang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // 隐私模式下 localStorage 可能抛错：忽略，退回浏览器语言
  }
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "zh";
};

/**
 * 提供当前语言与取词函数。语言选择会写入 localStorage，刷新后保持。
 */
export const LocaleProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存不住也不影响本次会话
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = <T,>(pair: Localized<T>): T => pair[lang];
    return { lang, setLang, t };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/** 读取当前语言与取词函数；必须在 <LocaleProvider> 内使用。 */
export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within <LocaleProvider>");
  return value;
};
