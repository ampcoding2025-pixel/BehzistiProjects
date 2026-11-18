import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "پنل دیسکت پرداخت | سازمان بهزیستی",
  description: "پنل داخلی تهیه دیسکت مستمری و یارانه مراکز — فقط اینترانت ستاد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className={`${vazir.className} antialiased`}>{children}</body>
    </html>
  );
}
