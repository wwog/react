import {useEffect, useState, type CSSProperties, type FC} from "react";
import {breakpoints, type BreakpointName, useScreen} from "../../src";
import {LocaleProvider, useI18n} from "./i18n";
import {defaultRouteId, findRoute, routes} from "./docs/registry";
import {colors} from "./docs/ui";

/** 路由就是 URL hash，例如 #/worker-pool —— 不需要路由库，刷新与前进后退都可用。 */
const readHash = (): string => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return id || defaultRouteId;
};

const useHashRoute = (): string => {
  const [routeId, setRouteId] = useState<string>(readHash);

  useEffect(() => {
    const onHashChange = () => setRouteId(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return routeId;
};

/** md 以下（base / xs / sm）视为移动端：面板默认收起，入口收进标题栏的按钮里。 */
const isCompactBreakpoint = (breakpoint: BreakpointName): boolean =>
  breakpoints.indexOf(breakpoint) < breakpoints.indexOf("md");

const SIDEBAR_WIDTH = 244;
const DRAWER_DURATION = 260;
const COLUMN_DURATION = 240;
const EASE_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const DRAWER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** 移动端抽屉：靠 transform 滑入滑出，关闭时延后隐藏避免过渡被截断。 */
const drawerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  bottom: 0,
  zIndex: 30,
  width: "min(80vw, 300px)",
  background: "#fff",
  borderRight: `1px solid ${colors.border}`,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.22)",
  overflowY: "auto",
  willChange: "transform",
};

/** 桌面端侧栏：靠 width 收放，内层固定宽度让内容在过渡中不被挤压。 */
const desktopAsideStyle: CSSProperties = {
  flexShrink: 0,
  background: "#fff",
  position: "sticky",
  top: 0,
  height: "100vh",
  overflowX: "hidden",
  overflowY: "auto",
  borderRightStyle: "solid",
  borderRightColor: colors.border,
  // 桌面端不做位移，但显式声明 transform 并纳入过渡，跨断点切换时才能从抽屉的
  // translateX(-100%) 平滑滑入，而不是瞬间跳变。
  transform: "translateX(0)",
  transition: `width ${COLUMN_DURATION}ms ${EASE_OUT}, border-right-width ${COLUMN_DURATION}ms ${EASE_OUT}, transform ${COLUMN_DURATION}ms ${EASE_OUT}`,
};

const hideDelay = (duration: number, visible: boolean) =>
  `visibility 0s linear ${visible ? 0 : duration}ms`;

/** 右上角的语言切换。 */
const LangToggle: FC = () => {
  const {lang, setLang} = useI18n();

  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {(["zh", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={code === lang}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontFamily: "inherit",
            border: "none",
            cursor: "pointer",
            transition: "background 160ms ease, color 160ms ease",
            background: code === lang ? colors.accent : "transparent",
            color: code === lang ? "#fff" : colors.body,
          }}
        >
          {code === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
};

/** 标题栏里的面板开关，汉堡与关闭图标交叉淡入淡出。 */
const MenuButton: FC<{open: boolean; onClick: () => void}> = ({open, onClick}) => {
  const {t} = useI18n();
  const label = open
    ? t({zh: "收起左侧面板", en: "Collapse sidebar"})
    : t({zh: "展开左侧面板", en: "Expand sidebar"});

  const iconStyle = (active: boolean): CSSProperties => ({
    position: "absolute",
    inset: 0,
    opacity: active ? 1 : 0,
    transform: active ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.6)",
    transition: "opacity 180ms ease, transform 180ms ease",
  });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="docs-sidebar"
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        flexShrink: 0,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: "#fff",
        color: colors.text,
        cursor: "pointer",
        transition: "background 160ms ease, border-color 160ms ease",
      }}
    >
      <span style={{position: "relative", width: 16, height: 16}}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={iconStyle(!open)}
        >
          <path
            d="M2 4h12M2 8h12M2 12h12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={iconStyle(open)}
        >
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
};

/** 面板内容：桌面端是常驻侧栏，移动端是抽屉，两者共用同一份结构。 */
const SidebarBody: FC<{activeId: string; onNavigate?: () => void}> = ({activeId, onNavigate}) => {
  const {t} = useI18n();
  const groupNames = Array.from(new Set(routes.map((route) => t(route.group))));

  return (
    <>
      <div style={{padding: "18px 16px 10px"}}>
        <div style={{fontSize: 15, fontWeight: 700}}>@wwog/react</div>
        <div style={{fontSize: 12, color: colors.muted, marginTop: 3}}>
          {t({zh: "交互式文档", en: "Interactive docs"})}
        </div>
      </div>
      <nav style={{padding: "4px 8px 24px"}}>
        {groupNames.map((groupName) => (
          <div key={groupName} style={{marginBottom: 14}}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.muted,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                padding: "6px 8px",
              }}
            >
              {groupName}
            </div>
            {routes
              .filter((route) => t(route.group) === groupName)
              .map((route) => {
                const isActive = route.id === activeId;
                return (
                  <a
                    key={route.id}
                    href={`#/${route.id}`}
                    onClick={onNavigate}
                    style={{
                      display: "block",
                      padding: "8px 10px",
                      borderRadius: 8,
                      marginBottom: 2,
                      textDecoration: "none",
                      fontSize: 13.5,
                      transition: "background 160ms ease, color 160ms ease",
                      color: isActive ? colors.accent : colors.body,
                      background: isActive ? colors.accentSoft : "transparent",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {t(route.title)}
                  </a>
                );
              })}
          </div>
        ))}
      </nav>
    </>
  );
};

const Shell: FC = () => {
  const {t} = useI18n();
  const routeId = useHashRoute();
  const active = findRoute(routeId);
  const Active = active.component;

  const isCompact = isCompactBreakpoint(useScreen());
  // 贴边时收起、宽屏时展开；用户手动切换的状态会保留到下一次跨断点
  const [navOpen, setNavOpen] = useState(() => !isCompact);

  useEffect(() => {
    setNavOpen(!isCompact);
  }, [isCompact]);

  // 移动端选中条目（或前进后退）后收起抽屉，避免遮住正文
  useEffect(() => {
    if (isCompact) setNavOpen(false);
  }, [routeId, isCompact]);

  // 移动端抽屉打开时支持 Esc 关闭
  useEffect(() => {
    if (!isCompact || !navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCompact, navOpen]);

  // 首次进入且 URL 没有 hash 时补上默认路由，刷新后仍停在同一页
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#/${defaultRouteId}`);
    }
  }, []);

  const closeDrawer = () => setNavOpen(false);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {isCompact ? (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(15, 23, 42, 0.45)",
            opacity: navOpen ? 1 : 0,
            visibility: navOpen ? "visible" : "hidden",
            pointerEvents: navOpen ? "auto" : "none",
            transition: `opacity ${DRAWER_DURATION}ms ease, ${hideDelay(DRAWER_DURATION, navOpen)}`,
          }}
        />
      ) : null}

      <aside
        id="docs-sidebar"
        aria-hidden={!navOpen}
        inert={!navOpen}
        style={
          isCompact
            ? {
                ...drawerStyle,
                transform: navOpen ? "translateX(0)" : "translateX(-100%)",
                visibility: navOpen ? "visible" : "hidden",
                pointerEvents: navOpen ? "auto" : "none",
                transition: `transform ${DRAWER_DURATION}ms ${DRAWER_EASE}, ${hideDelay(
                  DRAWER_DURATION,
                  navOpen,
                )}`,
              }
            : {
                ...desktopAsideStyle,
                width: navOpen ? SIDEBAR_WIDTH : 0,
                borderRightWidth: navOpen ? 1 : 0,
              }
        }
      >
        <div style={isCompact ? {width: "100%"} : {width: SIDEBAR_WIDTH}}>
          <SidebarBody activeId={active.id} onNavigate={isCompact ? closeDrawer : undefined} />
        </div>
      </aside>

      <main style={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column"}}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isCompact ? 10 : 16,
            padding: isCompact ? "10px 14px" : "12px 28px",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            borderBottom: `1px solid ${colors.border}`,
            transition: "padding 200ms ease, gap 200ms ease",
          }}
        >
          <div style={{display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1}}>
            <MenuButton open={navOpen} onClick={() => setNavOpen((value) => !value)} />
            <div style={{minWidth: 0}}>
              <div style={{fontSize: 14.5, fontWeight: 600}}>{t(active.title)}</div>
              <div
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t(active.blurb)}
              </div>
            </div>
          </div>
          <LangToggle />
        </header>

        <div
          style={{
            padding: isCompact ? "18px 16px 64px" : "26px 28px 80px",
            width: "100%",
            maxWidth: 940,
            // 内容在右侧主区域内居中：没有 auto 边距时，作为 flex 子项会贴左。
            margin: "0 auto",
            boxSizing: "border-box",
            transition: "padding 200ms ease",
          }}
        >
          <Active />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

export default App;
