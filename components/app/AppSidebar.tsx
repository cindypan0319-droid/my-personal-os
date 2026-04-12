"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    label: "Work",
    items: [
      { href: "/tasks", label: "Tasks" },
      { href: "/projects", label: "Projects" },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/calendar", label: "Calendar" },
      { href: "/timeline", label: "Timeline" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="app-sidebar desktop-only">
      <div className="app-brand">
        <div className="app-brand-kicker">My Personal OS</div>
        <div className="app-brand-title">Task Planner</div>
      </div>

      <nav className="app-nav">
        {navGroups.map((group) => (
          <div key={group.label} className="app-nav-group">
            <div className="app-nav-group-label">{group.label}</div>
            <div className="app-nav-items">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`app-nav-item ${active ? "app-nav-item-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="app-sidebar-bottom tight-grid">
        <Link
          href="/tasks"
          className="primary-btn"
          style={{ display: "block", textAlign: "center" }}
        >
          Open Tasks
        </Link>

        <Link
          href="/projects"
          className="secondary-btn"
          style={{ display: "block", textAlign: "center" }}
        >
          Open Projects
        </Link>
      </div>
    </aside>
  );
}