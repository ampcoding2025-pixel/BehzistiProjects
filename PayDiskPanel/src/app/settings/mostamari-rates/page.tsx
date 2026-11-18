"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const RATES_1404 = [
  { family: "یک نفره", amount: "۱۴٬۰۰۰٬۰۰۰" },
  { family: "دو نفره", amount: "۲۰٬۰۰۰٬۰۰۰" },
  { family: "سه نفره", amount: "۲۸٬۰۰۰٬۰۰۰" },
  { family: "چهار نفره", amount: "۳۶٬۰۰۰٬۰۰۰" },
  { family: "پنج نفره و بیشتر", amount: "۴۴٬۰۰۰٬۰۰۰" },
];

export default function MostamariRatesSettingsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "تنظیمات", href: "/settings/access" },
        { label: "مبالغ مستمری" },
      ]}
    >
      <div className="space-y-4 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            مبالغ و سقف مستمری
          </h1>
          <Link href="/settings/db" className="btn btn-ghost">
            تنظیمات دیتابیس
          </Link>
        </div>

        <div className="panel p-5 space-y-4">
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            طبق سند عملیات، به‌روزرسانی سالانه مبالغ پس از اعلام بودجه انجام می‌شود. ابتدا
            دسترسی ثبت/تایید و قطع مستمری از کاربران گرفته می‌شود، سپس جداول تعریف مبلغ،
            مستمری فعال، درخواست‌های تاییدنشده و سقف استان‌ها اصلاح می‌گردد و در پایان سقف
            کلی استان‌ها به‌روز می‌شود.
          </p>

          <h2 className="font-semibold text-sm">مبالغ مرجع ۱۴۰۴ (ریال)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-2 font-semibold">بعد خانوار</th>
                  <th className="py-2 font-semibold">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {RATES_1404.map((r) => (
                  <tr key={r.family} className="border-b border-[var(--line)]">
                    <td className="py-2">{r.family}</td>
                    <td className="py-2" dir="ltr">
                      {r.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-4 py-3 text-sm leading-6">
            اجرای خودکار UPDATE روی جداول مبلغ و سقف هنوز از پنل فعال نیست (ریسک عملیاتی
            بالا). این صفحه مرجع مبالغ و یادآور مراحل سند است. اجرای واقعی روی lab و با
            هماهنگی بودجه انجام شود.
          </div>

          <ol className="text-sm leading-7 list-decimal pr-5 space-y-1 text-[var(--ink-soft)]">
            <li>قفل ثبت / تایید / قطع مستمری برای کاربران</li>
            <li>اصلاح مبالغ در تعریف مستمری</li>
            <li>اصلاح مبالغ در مستمری‌های فعال</li>
            <li>اصلاح درخواست‌های تاییدنشده</li>
            <li>اصلاح سقف محل تأمین در استان‌ها</li>
            <li>به‌روزرسانی سقف کلی استان</li>
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
