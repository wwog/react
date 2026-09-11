import {useEffect, useState, type FC} from "react";
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

const Shell: FC = () => {
  const {t} = useI18n();
  const routeId = useHashRoute();
  const active = findRoute(routeId);
  const Active = active.component;

  // 首次进入且 URL 没有 hash 时补上默认路由，刷新后仍停在同一页
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#/${defaultRouteId}`);
    }
  }, []);

  const groupNames = Array.from(new Set(routes.map((route) => t(route.group))));

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
      <aside
        style={{
          width: 244,
          flexShrink: 0,
          borderRight: `1px solid ${colors.border}`,
          background: "#fff",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
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
                  const isActive = route.id === active.id;
                  return (
                    <a
                      key={route.id}
                      href={`#/${route.id}`}
                      style={{
                        display: "block",
                        padding: "8px 10px",
                        borderRadius: 8,
                        marginBottom: 2,
                        textDecoration: "none",
                        fontSize: 13.5,
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
            gap: 16,
            padding: "12px 28px",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
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
          <LangToggle />
        </header>

        <div style={{padding: "26px 28px 80px", maxWidth: 940}}>
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
