"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Me {
  displayName: string;
  username: string;
  role: string;
}

const ROLE_FA: Record<string, string> = {
  operator: "اپراتور",
  admin: "ادمین",
  finance_viewer: "ناظر مالی",
};

export function UserBar() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dbLabel, setDbLabel] = useState<string>("");
  const [writable, setWritable] = useState(false);

  const refreshDb = useCallback(() => {
    fetch("/api/settings/db")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setDbLabel(d.activeLabel || "");
        setWritable(!!d.labWrites);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMe(d.user);
      })
      .catch(() => undefined);
    refreshDb();
  }, [refreshDb]);

  useEffect(() => {
    const onDb = () => refreshDb();
    window.addEventListener("paydisk-db-changed", onDb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "paydisk-db-target") onDb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("paydisk-db-changed", onDb);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshDb]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (!me) {
    return (
      <div className="text-xs text-[var(--ink-soft)] rounded-full border border-[var(--line)] px-3 py-1">
        …
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {dbLabel ? (
        <span
          className="text-xs rounded-full border border-[var(--line)] px-3 py-1 font-mono"
          title={writable ? "خواندن و نوشتن روی این دیتابیس" : "فقط خواندن"}
          dir="ltr"
        >
          {dbLabel}
          {writable ? " · W" : " · R"}
        </span>
      ) : null}
      <span className="text-xs rounded-full border border-[var(--line)] px-3 py-1">
        {me.displayName} · {ROLE_FA[me.role] ?? me.role}
      </span>
      <button type="button" className="btn btn-ghost text-xs" onClick={logout}>
        خروج
      </button>
    </div>
  );
}
