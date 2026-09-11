import type {CSSProperties, FC, ReactNode} from "react";

/** 示例应用的配色，集中一处便于保持一致。 */
export const colors = {
  bg: "#f6f7f9",
  panel: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  body: "#374151",
  muted: "#6b7280",
  accent: "#2563eb",
  accentSoft: "#eff6ff",
  accentBorder: "#bfdbfe",
  warn: "#b45309",
  warnSoft: "#fffbeb",
  warnBorder: "#fcd34d",
  codeBg: "#0f172a",
  codeText: "#e2e8f0",
  success: "#047857",
  successSoft: "#ecfdf5",
};

export const controlStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "#fff",
  fontSize: 13,
  color: colors.text,
  fontFamily: "inherit",
};

/** 一个带标题的内容区块。 */
export const Section: FC<{title: ReactNode; children: ReactNode}> = ({title, children}) => (
  <section style={{marginBottom: 40}}>
    <h2
      style={{
        fontSize: 19,
        margin: "0 0 12px",
        paddingBottom: 8,
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      {title}
    </h2>
    {children}
  </section>
);

export const P: FC<{children: ReactNode}> = ({children}) => (
  <p style={{margin: "0 0 12px", lineHeight: 1.8, color: colors.body, fontSize: 14}}>{children}</p>
);

export const InlineCode: FC<{children: ReactNode}> = ({children}) => (
  <code
    style={{
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      borderRadius: 5,
      padding: "0 5px",
      fontSize: "0.9em",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </code>
);

export const Code: FC<{code: string; caption?: ReactNode}> = ({code, caption}) => (
  <div style={{margin: "0 0 14px"}}>
    <pre
      style={{
        background: colors.codeBg,
        color: colors.codeText,
        padding: "12px 14px",
        borderRadius: 10,
        fontSize: 12.5,
        lineHeight: 1.65,
        overflowX: "auto",
        margin: 0,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <code>{code}</code>
    </pre>
    {caption ? (
      <div style={{fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 1.6}}>
        {caption}
      </div>
    ) : null}
  </div>
);

export const Callout: FC<{tone?: "info" | "warn"; children: ReactNode}> = ({tone = "info", children}) => {
  const warn = tone === "warn";
  return (
    <div
      style={{
        background: warn ? colors.warnSoft : colors.accentSoft,
        border: `1px solid ${warn ? colors.warnBorder : colors.accentBorder}`,
        color: warn ? colors.warn : "#1e40af",
        borderRadius: 10,
        padding: "10px 13px",
        fontSize: 13,
        lineHeight: 1.75,
        margin: "0 0 14px",
      }}
    >
      {children}
    </div>
  );
};

/** 交互实例的外框：标题 + 操作区 + 结果区。 */
export const Demo: FC<{title: ReactNode; hint?: ReactNode; children: ReactNode}> = ({
  title,
  hint,
  children,
}) => (
  <div
    style={{
      background: colors.panel,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 16,
      margin: "0 0 16px",
    }}
  >
    <div style={{fontSize: 14, fontWeight: 600, color: colors.text}}>{title}</div>
    {hint ? (
      <div style={{fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 1.7}}>{hint}</div>
    ) : null}
    <div style={{marginTop: 12}}>{children}</div>
  </div>
);

export const Button: FC<{
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "ghost";
}> = ({children, onClick, disabled, tone = "primary"}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "8px 14px",
      borderRadius: 9,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "inherit",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      border: tone === "primary" ? "1px solid transparent" : `1px solid ${colors.border}`,
      background: tone === "primary" ? colors.accent : "#fff",
      color: tone === "primary" ? "#fff" : colors.text,
    }}
  >
    {children}
  </button>
);

export const Controls: FC<{children: ReactNode}> = ({children}) => (
  <div style={{display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap"}}>{children}</div>
);

export const Label: FC<{children: ReactNode}> = ({children}) => (
  <span style={{fontSize: 13, color: colors.body}}>{children}</span>
);

export const Stats: FC<{children: ReactNode}> = ({children}) => (
  <div style={{display: "flex", gap: 24, flexWrap: "wrap", margin: "14px 0 4px"}}>{children}</div>
);

export const Stat: FC<{label: ReactNode; value: ReactNode}> = ({label, value}) => (
  <div style={{minWidth: 72}}>
    <div
      style={{
        fontSize: 11,
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 19,
        fontWeight: 600,
        color: colors.text,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
  </div>
);

/** 结果/日志区：等宽小字，滚动查看。 */
export const Output: FC<{children: ReactNode}> = ({children}) => (
  <div
    style={{
      background: "#f9fafb",
      border: `1px solid ${colors.border}`,
      borderRadius: 9,
      padding: "10px 12px",
      fontSize: 12.5,
      lineHeight: 1.8,
      color: colors.body,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      maxHeight: 260,
      overflow: "auto",
    }}
  >
    {children}
  </div>
);

export const Muted: FC<{children: ReactNode}> = ({children}) => (
  <span style={{color: colors.muted}}>{children}</span>
);

/** API 参考表。 */
export const ApiTable: FC<{head: ReactNode[]; rows: ReactNode[][]}> = ({head, rows}) => (
  <div style={{overflowX: "auto", margin: "0 0 18px"}}>
    <table style={{borderCollapse: "collapse", width: "100%", fontSize: 13}}>
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th
              key={index}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderBottom: `2px solid ${colors.border}`,
                color: colors.muted,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                style={{
                  padding: "9px 10px",
                  borderBottom: `1px solid ${colors.border}`,
                  verticalAlign: "top",
                  lineHeight: 1.7,
                  color: colors.body,
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
