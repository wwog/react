import { useState, type FC } from "react";
import { FocusTrap } from "../../src";

const section: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 16,
  marginBottom: 24,
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 8,
};

const col: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  border: "1px dashed #aaa",
  borderRadius: 6,
};

const badge: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 8,
};

const itemBase: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid #888",
  cursor: "pointer",
  outline: "none",
};

function Item({
  children,
  ...props
}: { children: string } & React.HTMLAttributes<HTMLButtonElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <button
      {...props}
      style={{
        ...itemBase,
        ...(focused ? { borderColor: "#06f", boxShadow: "0 0 0 2px #06f44" } : {}),
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </button>
  );
}

export const FocusTrapExample: FC = () => {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 32 }}>
      <h1>FocusTrap Examples</h1>

      {/* 1. Default Tab trap */}
      <section style={section}>
        <h2>Tab default</h2>
        <div style={badge}>Tab/Shift+Tab &#x2192; next/prev</div>
        <FocusTrap>
          <div style={row}>
            <Item>Item 1</Item>
            <Item>Item 2</Item>
            <Item>Item 3</Item>
          </div>
        </FocusTrap>
      </section>

      {/* 2. Arrow up/down */}
      <section style={section}>
        <h2>Arrow up/down</h2>
        <div style={badge}>&#x2191; / &#x2193; &#x2192; prev / next</div>
        <FocusTrap keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}>
          <div style={col}>
            <Item>Item A</Item>
            <Item>Item B</Item>
            <Item>Item C</Item>
          </div>
        </FocusTrap>
      </section>

      {/* 3. Arrow left/right */}
      <section style={section}>
        <h2>Arrow left/right</h2>
        <div style={badge}>&#x2190; / &#x2192; &#x2192; prev / next</div>
        <FocusTrap keyMap={{ ArrowRight: "next", ArrowLeft: "prev" }}>
          <div style={row}>
            <Item>Step 1</Item>
            <Item>Step 2</Item>
            <Item>Step 3</Item>
          </div>
        </FocusTrap>
      </section>

      {/* 4. Cross-list navigation */}
      <section style={section}>
        <h2>Cross-list navigation</h2>
        <div style={badge}>
          &#x2191; / &#x2193; across two lists — Item B-1 &#x2192; Item A-2
        </div>
        <FocusTrap keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={col}>
              <h4>List A</h4>
              <Item>A-1</Item>
              <Item>A-2</Item>
            </div>
            <div style={col}>
              <h4>List B</h4>
              <Item>B-1</Item>
              <Item>B-2</Item>
            </div>
          </div>
        </FocusTrap>
      </section>

      {/* 5. Reordered grid traversal with onNavigate */}
      <section style={section}>
        <h2>Grid (with onNavigate)</h2>
        <div style={badge}>
          &#x2191;/&#x2193; traverses in row-major order (A-1 &#x2192; B-1 &#x2192; A-2 &#x2192; B-2),
          even though document order is column-first
        </div>
        <FocusTrap
          keyMap={{ ArrowDown: "next", ArrowUp: "prev" }}
          onNavigate={(current, elements, direction) => {
            const cols = 2;
            const rows = Math.ceil(elements.length / cols);
            const total = elements.length;
            const i = current ? elements.indexOf(current) : 0;
            const col = Math.floor(i / rows);
            const row = i % rows;
            const vis = row * cols + col;
            const nextVis =
              direction === "next"
                ? (vis + 1) % total
                : (vis - 1 + total) % total;
            const nextRow = Math.floor(nextVis / cols);
            const nextCol = nextVis % cols;
            return elements[nextCol * rows + nextRow] ?? elements[0];
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <div style={col}>
              <Item>Cell A-1</Item>
              <Item>Cell A-2</Item>
              <Item>Cell A-3</Item>
            </div>
            <div style={col}>
              <Item>Cell B-1</Item>
              <Item>Cell B-2</Item>
              <Item>Cell B-3</Item>
            </div>
          </div>
        </FocusTrap>
      </section>
    </div>
  );
};
