import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "../neu/Icon";
import type { IconName } from "../neu/Icon";
import { Button, IconButton } from "../neu/ui";
import { useApp } from "../../state/store";
import { useTheme } from "../../state/theme";
import { ZootMark } from "../common/ZootMark";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Roster", icon: "roster", end: true },
  { to: "/collection", label: "Collection", icon: "collection" },
  { to: "/planner", label: "Planner", icon: "planner" },
  { to: "/input", label: "Input", icon: "input" },
  { to: "/import", label: "Import", icon: "download" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <ZootMark size={24} />
      </span>
      <span className="brand__text">
        <span className="brand__name">ZOOT</span>
        <span className="brand__sub">
          Zeroth Order
          <br />
          Oil Tank
        </span>
      </span>
    </div>
  );
}

function useCounts() {
  const { state } = useApp();
  return {
    owned: Object.keys(state.roster).length,
    goals: state.goals.length,
  };
}

function Sidebar() {
  const { owned, goals } = useCounts();
  const { theme, toggle } = useTheme();

  return (
    <aside className="sidebar">
      <Brand />
      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav__item${isActive ? " is-active" : ""}`}
          >
            <span className="nav__icon">
              <Icon name={item.icon} size={19} />
            </span>
            <span>{item.label}</span>
            {item.to === "/" && owned > 0 && <span className="nav__count">{owned}</span>}
            {item.to === "/planner" && goals > 0 && <span className="nav__count">{goals}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__foot">
        <Button variant="ghost" onClick={toggle} block style={{ justifyContent: "flex-start", paddingLeft: 16, gap: 10 }}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </Button>
        <div className="sidebar__meta">
          <span>Local save</span>
          <span className="num">v1</span>
        </div>
      </div>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav__item${isActive ? " is-active" : ""}`}
        >
          <Icon name={item.icon} size={19} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  return (
    <IconButton
      className={`scroll-top${visible ? " is-visible" : ""}`}
      icon="arrowUp"
      label="Scroll to top"
      onClick={toTop}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    />
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const titles: Record<string, string> = {
      "/": "Roster",
      "/collection": "Collection",
      "/planner": "Planner",
      "/input": "Input",
      "/import": "Import",
      "/profile": "Profile",
    };
    document.title = `${titles[location.pathname] ?? "Planner"} — ZOOT`;
  }, [location.pathname]);

  return (
    <div className="shell">
      <div className="shell__nav">
        <Sidebar />
      </div>
      <div className="shell__main">
        {children}
        <BottomNav />
      </div>
      <ScrollTop />
    </div>
  );
}

interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Page({ title, subtitle, actions, children }: PageProps) {
  const { theme, toggle } = useTheme();
  return (
    <>
      <header className="topbar">
        <div className="topbar__brand">
          <Brand />
        </div>
        <div className="topbar__titles">
          <h1 className="topbar__title">{title}</h1>
          {subtitle != null && <p className="topbar__sub">{subtitle}</p>}
        </div>
        <div className="topbar__actions">
          <IconButton
            className="topbar__theme"
            icon={theme === "dark" ? "sun" : "moon"}
            label="Toggle theme"
            variant="ghost"
            size="sm"
            onClick={toggle}
          />
          {actions}
        </div>
      </header>
      <main className="content">{children}</main>
    </>
  );
}
