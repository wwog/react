/**
 * 一个极小的 TypeScript/JavaScript 着色器：为文档里的代码块提供语法高亮，
 * 不引入任何第三方依赖。
 *
 * 做法是用一条带命名分组的主正则从左到右扫一遍源码，命中的片段按分组归类，
 * 未命中的间隙原样保留。因为正则一次性扫描、各分支互不重叠，字符串与注释里的
 * 关键字不会被二次着色，也就不会出现嵌套着色错乱。
 */

/** 着色类别：与 tokenize 返回的 kind 一一对应。 */
export type TokenKind =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "property"
  | "punct";

export interface Token {
  /** null 表示普通文本（空白、普通标识符等），按基础色渲染。 */
  kind: TokenKind | null;
  value: string;
}

const KEYWORDS = [
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "keyof",
  "let",
  "namespace",
  "new",
  "null",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
].join("|");

/** 小写的原始类型单独成组，着色与类型一致而不是关键字。 */
const PRIMITIVES = [
  "any",
  "bigint",
  "boolean",
  "never",
  "number",
  "object",
  "string",
  "symbol",
  "unknown",
].join("|");

/**
 * 主正则。分支顺序即优先级：
 * 注释与字符串最先（避免其中的关键字被识别），随后是数字、关键字、原始类型、
 * 大写开头的类型/类、后跟 `(` 的函数名、`.属性`，最后是标点。
 */
const TOKEN_RE = new RegExp(
  [
    "(?<comment>\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)",
    "(?<template>`(?:\\\\.|[^`\\\\])*`)",
    "(?<string>\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')",
    "(?<number>\\b0[xX][0-9a-fA-F_]+n?\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?n?\\b)",
    `(?<keyword>\\b(?:${KEYWORDS})\\b)`,
    `(?<primitive>\\b(?:${PRIMITIVES})\\b)`,
    "(?<type>\\b[A-Z][A-Za-z0-9_]*\\b)",
    "(?<fn>\\b[a-zA-Z_$][\\w$]*(?=\\s*\\())",
    "(?<prop>\\.[a-zA-Z_$][\\w$]*)",
    "(?<punct>[{}()\\[\\];,.<>=+\\-*/%!&|?~^:])",
  ].join("|"),
  "g",
);

/** 分组名 → 对外着色类别；template 与 string 同色，primitive 与 type 同色。 */
const GROUP_TO_KIND: Record<string, TokenKind> = {
  comment: "comment",
  template: "string",
  string: "string",
  number: "number",
  keyword: "keyword",
  primitive: "type",
  type: "type",
  fn: "function",
  prop: "property",
  punct: "punct",
};

const GROUP_NAMES = Object.keys(GROUP_TO_KIND);

/** 把一段代码切成 token 序列，供 React 逐段渲染。 */
export const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(code)) !== null) {
    if (match.index > cursor) {
      tokens.push({kind: null, value: code.slice(cursor, match.index)});
    }
    const groups: Record<string, string | undefined> = match.groups ?? {};
    const name = GROUP_NAMES.find((key) => groups[key] !== undefined);
    tokens.push({kind: name ? (GROUP_TO_KIND[name] ?? null) : null, value: match[0]});
    cursor = match.index + match[0].length;
  }

  if (cursor < code.length) {
    tokens.push({kind: null, value: code.slice(cursor)});
  }
  return tokens;
};
