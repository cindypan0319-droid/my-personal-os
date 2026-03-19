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
      <body className="bg-neutral-50 text-neutral-900">
        <div className="min-h-screen md:flex">
          <aside className="w-full border-b border-neutral-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
            <div className="px-6 py-6">
              <p className="text-sm text-neutral-500">My Personal OS</p>
              <h1 className="mt-2 text-xl font-semibold">Task System</h1>
            </div>

            <nav className="px-4 pb-6">
              <div className="space-y-2">
                <Link
                  href="/"
                  className="block rounded-xl px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-100"
                >
                  Dashboard
                </Link>

                <Link
                  href="/tasks"
                  className="block rounded-xl px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-100"
                >
                  All Tasks
                </Link>

                <Link
                  href="/projects"
                  className="block rounded-xl px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-100"
                >
                  Projects
                </Link>
              </div>
            </nav>
          </aside>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}