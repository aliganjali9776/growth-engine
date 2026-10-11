import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { appMode } from "@/lib/server/saas-runtime";
import "@/components/saas/saas.css";

export const metadata: Metadata = {
  title: "Growth Engine | موتور رشد",
  description: "سیستم مدیریت کسب‌وکار • 1 Minute Manager",
  referrer: "no-referrer",
};
// Session-dependent pages must never be served from a shared static cache.
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" data-app-mode={appMode()}>
      <body>
        {appMode() === "local" ? <AppShell>{children}</AppShell> : children}
      </body>
    </html>
  );
}
