import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "My Personal OS",
  description: "Personal task and project system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="app-bg">
        <div className="min-h-screen md:flex">
          {/* Desktop sidebar */}
          <aside
            className="hidden md:flex md:w-64 md:flex-col"
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--panel)",
            }}
          >
            <div style={{ padding: "18px 18px 12px 18px" }}>
              <div className="page-kicker">My Personal OS</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Task System</div>
            </div>

            <nav style={{ padding: "8px 12px 16px 12px" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Link
                  href="/"
                  className="secondary-btn"
                  style={{ display: "block", textAlign: "left" }}
                >
                  Dashboard
                </Link>

                <Link
                  href="/tasks"
                  className="secondary-btn"
                  style={{ display: "block", textAlign: "left" }}
                >
                  Tasks
                </Link>

                <Link
                  href="/projects"
                  className="secondary-btn"
                  style={{ display: "block", textAlign: "left" }}
                >
                  Projects
                </Link>

                <Link
                  href="/calendar"
                  className="secondary-btn"
                  style={{ display: "block", textAlign: "left" }}
                >
                  Calendar
                </Link>

                <Link
                  href="/timeline"
                  className="secondary-btn"
                  style={{ display: "block", textAlign: "left" }}
                >
                  Timeline
                </Link>
              </div>
            </nav>
          </aside>

          <main className="flex-1 mobile-bottom-space">{children}</main>

          {/* Mobile top bar */}
          <div
            className="md:hidden"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              background: "var(--panel)",
              borderBottom: "1px solid var(--border)",
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              My Personal OS
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Task System</div>
          </div>

          {/* Mobile bottom nav */}
          <nav
            className="md:hidden"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              background: "var(--panel)",
              borderTop: "1px solid var(--border)",
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <Link
                href="/"
                className="secondary-btn"
                style={{ textAlign: "center", padding: "10px 8px" }}
              >
                Dash
              </Link>
              <Link
                href="/tasks"
                className="secondary-btn"
                style={{ textAlign: "center", padding: "10px 8px" }}
              >
                Tasks
              </Link>
              <Link
                href="/projects"
                className="secondary-btn"
                style={{ textAlign: "center", padding: "10px 8px" }}
              >
                Proj
              </Link>
              <Link
                href="/calendar"
                className="secondary-btn"
                style={{ textAlign: "center", padding: "10px 8px" }}
              >
                Cal
              </Link>
              <Link
                href="/timeline"
                className="secondary-btn"
                style={{ textAlign: "center", padding: "10px 8px" }}
              >
                Time
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}