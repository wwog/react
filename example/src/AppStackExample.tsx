import { useState, type FC } from "react";
import { AppStackRouter, useAppStack } from "../../src";

// ---- 通用样式 ----

// 模拟手机外壳:居中显示一个手机尺寸的容器,内部即 AppStackRouter
const phoneFrame: React.CSSProperties = {
  position: "relative",
  width: 390,
  height: 780,
  margin: "32px auto",
  borderRadius: 40,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  overflow: "hidden",
  background: "#fff",
};

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "#fff",
};

// 顶部导航栏:左侧返回按钮(仅非根屏幕),中间标题
const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #eee",
  background: "#fff",
  minHeight: 44,
};

const titleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
};

const backBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 16,
  color: "#06f",
  cursor: "pointer",
  padding: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 16,
  WebkitOverflowScrolling: "touch",
};

const primaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 16px",
  margin: "8px 0",
  borderRadius: 10,
  border: "none",
  background: "#06f",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "#f2f2f7",
  color: "#06f",
};

// 列表项
const listItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid #f2f2f7",
  cursor: "pointer",
  background: "#fff",
};

const badge: React.CSSProperties = {
  fontSize: 12,
  color: "#fff",
  background: "#06f",
  borderRadius: 10,
  padding: "2px 8px",
};

// ---- 屏幕组件 ----

// 根屏幕:Home
const Home: FC = () => {
  const { push, canPop, size } = useAppStack();
  return (
    <div style={pageStyle}>
      <div style={barStyle}>
        <span style={backBtnStyle}>&nbsp;</span>
        <span style={titleStyle}>首页</span>
        <span style={{ fontSize: 12, color: "#999" }}>栈:{size}</span>
      </div>
      <div style={bodyStyle}>
        <h3 style={{ marginTop: 0 }}>AppStackRouter 示例</h3>
        <p style={{ color: "#666", fontSize: 14 }}>
          点击下方按钮压入新屏幕。屏幕被加入堆栈并 keep-alive(不卸载),
          可用左滑返回、浏览器返回键、或按钮出栈。
        </p>
        <button style={primaryBtn} onClick={() => push(List)}>
          进入列表 (push)
        </button>
        <button
          style={ghostBtn}
          onClick={() => push(List)}
          disabled={!canPop()}
        >
          再压一层 List
        </button>
        <div style={{ marginTop: 16, color: "#999", fontSize: 13 }}>
          提示:从屏幕左边缘(40px 内)右滑可触发返回手势。
        </div>
      </div>
    </div>
  );
};

// 列表屏幕:点击项进入详情
const List: FC = () => {
  const { push } = useAppStack();
  const items = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div style={pageStyle}>
      <div style={barStyle}>
        <BackButton />
        <span style={titleStyle}>列表</span>
        <span style={{ fontSize: 12, color: "#999" }}>12 项</span>
      </div>
      <div style={{ ...bodyStyle, padding: 0 }}>
        {items.map((i) => (
          <div
            key={i}
            style={listItem}
            onClick={() => push(Detail, { id: i })}
          >
            <span>项目 {i}</span>
            <span style={{ color: "#ccc" }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 详情屏幕:展示 id,带计数器(验证 keep-alive 状态保留),可进入子页 / replace
const Detail: FC<{ id: number }> = ({ id }) => {
  const { push, replace, reset } = useAppStack();
  const [count, setCount] = useState(0);
  return (
    <div style={pageStyle}>
      <div style={barStyle}>
        <BackButton />
        <span style={titleStyle}>详情 #{id}</span>
        <span style={badge}>{count}</span>
      </div>
      <div style={bodyStyle}>
        <h3 style={{ marginTop: 0 }}>详情页 #{id}</h3>
        <p style={{ color: "#666", fontSize: 14 }}>
          这里的计数器状态在 pop 再回来后仍然保留(keep-alive)。
        </p>
        <button style={primaryBtn} onClick={() => setCount((c) => c + 1)}>
          计数 +1(当前 {count})
        </button>
        <button style={primaryBtn} onClick={() => push(Sub, { from: id })}>
          进入子页 (push)
        </button>
        <button
          style={ghostBtn}
          onClick={() => replace(Detail, { id: id + 100 })}
        >
          replace 为 #{id + 100}
        </button>
        <button style={ghostBtn} onClick={reset}>
          reset 回首页
        </button>
      </div>
    </div>
  );
};

// 子页:最深层,演示多层堆栈
const Sub: FC<{ from: number }> = ({ from }) => {
  const { pop, size } = useAppStack();
  return (
    <div style={pageStyle}>
      <div style={barStyle}>
        <BackButton />
        <span style={titleStyle}>子页</span>
        <span style={{ fontSize: 12, color: "#999" }}>栈:{size}</span>
      </div>
      <div style={bodyStyle}>
        <h3 style={{ marginTop: 0 }}>子页面</h3>
        <p style={{ color: "#666", fontSize: 14 }}>来自详情 #{from}。</p>
        <p style={{ color: "#666", fontSize: 14 }}>
          连续按浏览器返回键会逐层出栈,直到回到首页后离开页面。
        </p>
        <button style={primaryBtn} onClick={pop}>
          返回 (pop)
        </button>
      </div>
    </div>
  );
};

// 通用返回按钮:调用程序式 pop
const BackButton: FC = () => {
  const { pop, canPop } = useAppStack();
  return (
    <button
      style={backBtnStyle}
      onClick={pop}
      disabled={!canPop()}
    >
      ‹ 返回
    </button>
  );
};

// ---- 示例入口 ----

export const AppStackExample: FC = () => {
  // 划过阈值后反向回划是否识别为"取消返回"意图(默认 true)
  const [cancelOnReverse, setCancelOnReverse] = useState(true);

  return (
    <div style={{ minHeight: "100vh", background: "#f2f2f7", padding: "16px 0" }}>
      <div style={{ textAlign: "center", color: "#666", fontSize: 13 }}>
        AppStackRouter - 移动端堆栈视图示例
      </div>
      <div style={phoneFrame}>
        {/*
          AppStackRouter:
          - root 为栈底始终渲染的根屏幕
          - safeArea 默认开启(配合 viewport-fit=cover)
          - swipeBack 默认开启:左边缘右滑返回
          - swipeBackCancelOnReverseRelease:划过阈值后反向回划松手 -> 回弹不出栈
          - fullscreen=false:嵌入到已具备高度的 phoneFrame 内
        */}
        <AppStackRouter
          root={<Home />}
          fullscreen={false}
          transitionDuration={280}
          swipeBackCancelOnReverseRelease={cancelOnReverse}
        >
          {/* 全局叠层:显示在所有屏幕之上(不受手势/过渡影响) */}
          <StackDepthIndicator />
        </AppStackRouter>
      </div>
      <div
        style={{
          textAlign: "center",
          color: "#666",
          fontSize: 12,
          maxWidth: 390,
          margin: "0 auto 8px",
        }}
      >
        <label style={{ cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={cancelOnReverse}
            onChange={(e) => setCancelOnReverse(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          划过阈值后反向回划 = 取消返回(swipeBackCancelOnReverseRelease)
        </label>
      </div>
      <div style={{ textAlign: "center", color: "#999", fontSize: 12, paddingBottom: 16 }}>
        提示:浏览器返回键 / 左滑返回 / 按钮均可出栈
      </div>
    </div>
  );
};

// 右上角浮层:实时显示栈深度
const StackDepthIndicator: FC = () => {
  const { size } = useAppStack();
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(0,0,0,0.5)",
        color: "#fff",
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 8,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      depth: {size}
    </div>
  );
};
