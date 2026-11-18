"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function MostamariReturnsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "مستمری", href: "/?family=mostamari" },
        { label: "برگشتی‌ها" },
      ]}
    >
      <div className="space-y-4 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            برگشتی‌های مستمری
          </h1>
          <Link href="/?family=mostamari" className="btn btn-ghost">
            بازگشت به فهرست
          </Link>
        </div>

        <div className="panel p-5 space-y-4">
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            طبق سند عملیات: هر ماه پس از پرداخت، سازمان هدفمندی لیست برگشتی‌ها را می‌فرستد.
            برای اطلاع کاربران در سامانه، مبلغ مستمری همان ماه آن مددجویان را منفی می‌کنیم.
          </p>
          <ol className="text-sm leading-7 list-decimal pr-5 space-y-2 text-[var(--ink-soft)]">
            <li>دریافت فایل برگشتی از هدفمندی برای دورهٔ مربوط.</li>
            <li>شناسایی مددجویان / تراکنش همان ماه در سامانه.</li>
            <li>ثبت مبلغ منفی برای همان دوره تا در گزارش‌ها و USSD دیده شود.</li>
          </ol>
          <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-4 py-3 text-sm leading-6">
            ثبت خودکار برگشتی از فایل هنوز به این صفحه وصل نشده است. فعلاً از همین راهنما و
            فرآیند دستی/اسکریپت عملیات استفاده کنید. در نسخهٔ بعد، بارگذاری فایل و اعمال
            مبلغ منفی از اینجا انجام می‌شود.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/?family=mostamari" className="btn btn-primary">
              فهرست تراکنش‌های مستمری
            </Link>
            <Link href="/request/new?family=mostamari" className="btn btn-ghost">
              ویزارد مستمری
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
