import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, BarChart3, Bell, Bug, Database, GitBranch, Home, LogOut, ScrollText, Settings, Server, Terminal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import GlobalSearch from "@/components/GlobalSearch";

const nav = [
  { to: "/app", label: "Overview", icon: Home, end: true },
  { to: "/app/services", label: "Services", icon: Server },
  { to: "/app/traces", label: "Traces", icon: GitBranch },
  { to: "/app/logs", label: "Logs", icon: ScrollText },
  { to: "/app/exceptions", label: "Exceptions", icon: Bug },
  { to: "/app/databases", label: "Databases", icon: Database },
  { to: "/app/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/explore", label: "Explore", icon: Terminal },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const crumb = location.pathname.split("/").filter(Boolean).slice(1);

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

        <div className="px-3 pt-4 pb-2">
          <div className="data-label px-2 mb-2">Workspace</div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-sidebar-accent text-sidebar-foreground">
            <div className="w-4 h-4 rounded-sm bg-accent border border-border" />
            <span className="truncate">production</span>
            <span className="ml-auto text-muted-foreground">⌘K</span>
          </button>
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
            <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse-dot" />
            All systems nominal
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
            <button className="h-8 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">
              Last 15m
            </button>
            <div className="w-7 h-7 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-medium">
              EM
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
