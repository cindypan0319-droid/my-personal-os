import "./globals.css";
import { AppSidebar } from "../components/app/AppSidebar";
import { MobileTabBar } from "../components/app/MobileTabBar";

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
    <html lang="en">
      <body className="app-shell-bg">
        <div className="app-shell">
          <AppSidebar />

          <div className="app-main-shell">
            <main className="app-main-content">{children}</main>
            <MobileTabBar />
          </div>
        </div>
      </body>
    </html>
  );
}