import { AppShell } from "@/components/AppShell";
import { ARMAGHAN, MAKEOVER_API, UI_CALC_TYPES } from "@/lib/armaghan";
import { GAPS } from "@/lib/mock-requests";

const SEV = {
  blocker: { label: "مسدودکننده", bg: "#fde6e9", color: "#a11f2c" },
  needed: { label: "لازم", bg: "#fff1db", color: "#a15c00" },
  nice: { label: "بهتر است", bg: "#e8eef3", color: "#3d5166" },
} as const;

export default function GapsPage() {
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "چطور ارمغان کار می‌کند" },
      ]}
    >
      <section className="panel p-5 mb-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl mb-3">جریان فعلی ارمغان</h2>
        <ol className="text-sm leading-8 text-[var(--ink-soft)] list-decimal list-inside space-y-1">
          <li>
            لیست تراکنش‌ها:{" "}
            <code className="text-[var(--ink)]">{ARMAGHAN.uiBase}{ARMAGHAN.transactionsRoute}</code>
          </li>
          <li>
            API پایه: <code className="text-[var(--ink)]">{ARMAGHAN.apiBase}</code> —{" "}
            {MAKEOVER_API.listTransactions}
          </li>
          <li>جدید: RegisterTransaction(title) → رکورد MakeOverTransactions</li>
          <li>
            دکمه «...» → مودال محاسبه با Type:{" "}
            {UI_CALC_TYPES.map((t) => t.value).join(" / ")}
          </li>
          <li>Calculate → POST MakeOver/Calculate (در UI فعلاً SupplyLocationId=[-100])</li>
          <li>
            لیست افراد: Diskette/GetListMakeover → دانلود از{" "}
            <code className="text-[var(--ink)]">{ARMAGHAN.disketteBase}</code>
          </li>
          <li>دیسکت بانک: Diskette/GetMakeOver (اختیاری؛ در brief مدیر ادامه با مالی)</li>
          <li>
            مسیر موازی SQL: <code>CalculateMarakezYarane(@TransactionId, @SupplyLocationId)</code> روی{" "}
            {ARMAGHAN.sqlHost} / {ARMAGHAN.db}
          </li>
        </ol>
      </section>

      <section className="panel p-5 mb-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl mb-3">اتصال بی‌درز به پنل دیسکت پرداخت</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm leading-7">
          <div className="rounded-xl bg-[var(--paper)] p-4 border border-[var(--line)]">
            <h3 className="font-semibold mb-2">مستمری</h3>
            <p className="text-[var(--ink-soft)]">
              پنل درخواست می‌گیرد → Worker فقط SPهای سفیدلیست را اجرا می‌کند → اکسل را در پنل سرو
              می‌کند. ارمغان UI لازم نیست مگر برای تأیید Ky/Year بعداً.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--paper)] p-4 border border-[var(--line)]">
            <h3 className="font-semibold mb-2">یارانه</h3>
            <p className="text-[var(--ink-soft)]">
              پنل یا تراکنش موجود را می‌گیرد یا Register می‌زند → Calculate/لیست را از API یا SQL
              اجرا می‌کند → وضعیت «تحویل به مالی» + لینک #{`{Id}`} به ارمغان.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">کمبودها برای آماده‌سازی واقعی</h2>
        {GAPS.map((g) => {
          const s = SEV[g.severity];
          return (
            <article key={g.id} className="panel p-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-semibold rounded-full px-2 py-1"
                  style={{ background: s.bg, color: s.color }}
                >
                  {s.label}
                </span>
                <h3 className="font-semibold">{g.title}</h3>
              </div>
              <p className="text-sm text-[var(--ink-soft)] leading-7">{g.detail}</p>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
