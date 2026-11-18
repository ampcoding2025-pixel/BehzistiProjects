import { AppShell } from "@/components/AppShell";
import { catalogGroups } from "@/lib/catalog";

export default function CatalogPage() {
  const groups = catalogGroups();
  return (
    <AppShell
      crumbs={[
        { label: "پنل", href: "/" },
        { label: "کاتالوگ انواع دیسکت" },
      ]}
    >
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.group}>
            <h2 className="font-[family-name:var(--font-display)] text-xl mb-3">{g.group}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {g.items.map((d) => (
                <article key={d.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-base leading-7">{d.titleFa}</h3>
                    <span
                      className="text-xs rounded-full px-2 py-1 shrink-0"
                      style={{
                        background: d.family === "mostamari" ? "#e1f4ea" : "#e8eef3",
                        color: d.family === "mostamari" ? "#1f7a4d" : "#3d5166",
                      }}
                    >
                      {d.family === "mostamari" ? "مستمری" : "یارانه"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{d.description}</p>
                  <ol className="mt-3 text-xs text-[var(--ink-soft)] list-decimal list-inside space-y-1 leading-6">
                    {d.scriptSteps.map((s) => (
                      <li key={s}>
                        <code className="break-all">{s}</code>
                      </li>
                    ))}
                  </ol>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-[var(--line)] pt-2">
                    <div>
                      <dt className="text-[var(--ink-soft)]">خروجی</dt>
                      <dd className="font-semibold mt-0.5">
                        {d.output === "excel_download" && "اکسل پنل"}
                        {d.output === "finance_handoff" && "تحویل مالی"}
                        {d.output === "person_list_csv" && "CSV افراد"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ink-soft)]">شناسه</dt>
                      <dd className="font-mono mt-0.5 break-all">{d.id}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
