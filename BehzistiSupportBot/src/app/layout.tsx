import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه هوشمند پاسخگویی و پشتیبانی سازمانی | سازمان بهزیستی کشور",
  description:
    "سامانه هوشمند پاسخگویی و پشتیبانی سازمانی بر اساس دانش سازمانی، بخشنامه‌ها، قوانین و پاسخ‌های گذشته با ارجاع به کارشناس زنده",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <div className="app-shell">
          <AppHeader />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
