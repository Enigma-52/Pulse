import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, Bell, Bug, Database, GitBranch, Globe, Home, LogOut, ScrollText, Settings, Server, Terminal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import GlobalSearch from "@/components/GlobalSearch";
import TimeRangeSelector, { TIME_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import { useEnvironment } from "@/lib/environment";

const nav = [
  { to: "/app", label: "Overview", icon: Home, end: true },
  { to: "/app/services", label: "Services", icon: Server },
  { to: "/app/traces", label: "Traces", icon: GitBranch },
  { to: "/app/logs", label: "Logs", icon: ScrollText },
  { to: "/app/exceptions", label: "Exceptions", icon: Bug },
  { to: "/app/databases", label: "Databases", icon: Database },
  { to: "/app/external", label: "External", icon: Globe },
  { to: "/app/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/explore", label: "Explore", icon: Terminal },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { range, setRange } = useGlobalTimeRange();
  const { environment, environments, setEnvironment } = useEnvironment();
  // Truncate long path segments (trace ids, exception fingerprints) so the
  // breadcrumb never shows 40-char hex strings.
  const crumb = location.pathname
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map((c) => (c.length > 14 ? `${c.slice(0, 12)}…` : c));
  const [ready, setReady] = useState<boolean | null>(null);

  // Poll backend readiness so the sidebar status dot reflects reality.
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/readyz")
        .then((res) => !cancelled && setReady(res.ok))
        .catch(() => !cancelled && setReady(false));
    check();
    const t = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const email = localStorage.getItem("pulse_email") || "";
  const initials = email
    ? email.split("@")[0].split(/[._-]/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "•";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-sidebar-border gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">Pulse</span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">v0.1</span>
        </div>

        <nav className="px-3 mt-2 space-y-0.5 flex-1">
          <div className="data-label px-2 mb-2 mt-2">Telemetry</div>
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2 py-1.5 text-sm rounded transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm rounded text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign out
          </button>
          <div className="mt-3 flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${ready === false ? "bg-status-error" : "bg-status-ok animate-pulse-dot"}`} />
            {ready === false ? "Backend unreachable" : "All systems nominal"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur flex items-center gap-4 px-6 sticky top-0 z-10">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Pulse</span>
            {crumb.length === 0 && <><span>/</span><span className="text-foreground">overview</span></>}
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span>/</span>
                <span className={i === crumb.length - 1 ? "text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <GlobalSearch />
            {environments.length > 0 && (
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="h-8 px-2 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring text-foreground"
              >
                <option value="">all envs</option>
                {environments.map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            )}
            <TimeRangeSelector value={range} onChange={setRange} ranges={TIME_RANGES} />
            <div title={email} className="w-7 h-7 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
