"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "🏠" }],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "✅" },
      { href: "/projects", label: "Projects", icon: "📁" },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/calendar", label: "Calendar", icon: "📅" },
      { href: "/timeline", label: "Timeline", icon: "🕒" },
    ],
  },
];

const STORAGE_KEY = "task-planner-sidebar-collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    setCollapsed(saved === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className="app-sidebar desktop-only"
      style={{
        width: collapsed ? 84 : 260,
        minWidth: collapsed ? 84 : 260,
        transition: "width 180ms ease, min-width 180ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        className="app-brand"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 12,
        }}
      >
        {!collapsed ? (
          <div>
            <div className="app-brand-kicker">My Personal OS</div>
            <div className="app-brand-title">Task Planner</div>
          </div>
        ) : (
          <div style={{ fontSize: 22 }}>🧭</div>
        )}

        <button
          type="button"
          className="secondary-btn"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            padding: "6px 10px",
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav
        className="app-nav"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          flex: 1,
        }}
      >
        {navGroups.map((group) => (
          <div key={group.label} className="app-nav-group">
            {!collapsed ? (
              <div className="app-nav-group-label">{group.label}</div>
            ) : null}

            <div className="app-nav-items" style={{ display: "grid", gap: 8 }}>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`app-nav-item ${active ? "app-nav-item-active" : ""}`}
                    title={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: 10,
                      padding: collapsed ? "12px 10px" : "12px 14px",
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="app-sidebar-bottom tight-grid" style={{ gap: 8 }}>
        <Link
          href="/tasks"
          className="primary-btn"
          style={{
            display: "block",
            textAlign: "center",
            padding: collapsed ? "10px 8px" : undefined,
          }}
          title="Open Tasks"
        >
          {collapsed ? "✅" : "Open Tasks"}
        </Link>

        <Link
          href="/projects"
          className="secondary-btn"
          style={{
            display: "block",
            textAlign: "center",
            padding: collapsed ? "10px 8px" : undefined,
          }}
          title="Open Projects"
        >
          {collapsed ? "📁" : "Open Projects"}
        </Link>
      </div>
    </aside>
  );
}