import type { Metadata } from "next";
import { LocaleProvider } from "@/lib/i18n/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه هوشمند پاسخگویی و پشتیبانی سازمانی | سازمان بهزیستی کشور",
  description:
    "سامانه هوشمند پاسخگویی و پشتیبانی سازمانی بر اساس دانش سازمانی، بخشنامه‌ها، قوانین و پاسخ‌های گذشته با ارجاع به کارشناس زنده",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LocaleProvider>
          <div className="app-shell app-shell--agent">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
