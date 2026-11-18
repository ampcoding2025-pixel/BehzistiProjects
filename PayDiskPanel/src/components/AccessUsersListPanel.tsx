"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDataTable } from "@/components/FaDataTable";
import { LoadingBlock } from "@/components/LoadingSpinner";

type AllowlistRow = {
  username: string;
  displayName: string;
  role: string;
  authMode: "local" | "db";
  authModeFa: string;
  dbUserId: number | null;
  dbFound: boolean;
  dbEnabled: boolean;
  dbSource: string | null;
  dbSourceFa: string | null;
  canLogin: boolean;
};

const COLUMN_TITLES: Record<string, string> = {
  displayName: "نام نمایشی",
  username: "نام کاربری",
  role: "نقش پنل",
  authModeFa: "نحوه ورود",
  dbStatus: "وضعیت در DB",
  dbUserId: "شناسه DB",
  canLoginFa: "اجازه ورود",
};

export function AccessUsersListPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteFa, setNoteFa] = useState<string | null>(null);
  const [users, setUsers] = useState<AllowlistRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/users/allowlist");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "بارگذاری ناموفق");
        return;
      }
      setNoteFa(data.noteFa || null);
      setUsers(data.users || []);
    } catch {
      setError("خطای شبکه");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(needle) ||
        (u.displayName || "").toLowerCase().includes(needle) ||
        String(u.dbUserId || "").includes(needle) ||
        u.authModeFa.includes(needle),
    );
  }, [users, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = filtered.slice((page - 1) * pageSize, page * pageSize);

  const pageRows = pageSlice.map((u) => ({
    username: u.username,
    displayName: u.displayName || u.username,
    role: u.role === "admin" ? "ادمین" : u.role,
    authModeFa: u.authModeFa,
    dbStatus:
      u.authMode === "local"
        ? "لازم نیست"
        : !u.dbFound
          ? "یافت نشد در ۱۵۵/۱۵۷"
          : !u.dbEnabled
            ? `غیرفعال (${u.dbSourceFa || "DB"})`
            : `فعال · ${u.dbSourceFa || "DB"}`,
    dbUserId: u.dbUserId != null ? u.dbUserId : "—",
    canLoginFa: u.canLogin ? "بله" : "خیر",
    _user: u,
  }));

  if (loading) {
    return <LoadingBlock label="بارگذاری کاربران مجاز…" />;
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl">
              کاربران مجاز ورود به پنل
            </h1>
            <p className="text-sm text-[var(--ink-soft)] mt-1 leading-7">
              {noteFa ||
                "فقط این فهرست می‌تواند وارد شود؛ بقیه «حق دسترسی ندارید» می‌گیرند."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => void load()}>
              بروزرسانی از DB
            </button>
            <Link href="/settings/access" className="btn btn-ghost text-xs">
              دسترسی انواع دیسکت
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="field grow min-w-[12rem]">
            <label htmlFor="users-q">جستجو</label>
            <input
              id="users-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="نام کاربری یا نام…"
            />
          </div>
          <div className="text-sm text-[var(--ink-soft)] pb-2">
            {filtered.length.toLocaleString("fa-IR")} از{" "}
            {users.length.toLocaleString("fa-IR")} کاربر
          </div>
        </div>

        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
      </div>

      <div className="panel p-4">
        <FaDataTable
          columns={[
            "displayName",
            "username",
            "role",
            "authModeFa",
            "dbStatus",
            "dbUserId",
            "canLoginFa",
          ]}
          columnTitles={COLUMN_TITLES}
          rows={pageRows}
          empty="کاربری در فهرست مجاز نیست"
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          rowKey={(row) => String(row.username)}
          renderCell={(column, row) => {
            if (column === "canLoginFa") {
              const ok = (row._user as AllowlistRow | undefined)?.canLogin;
              return (
                <span
                  className={
                    ok ? "text-[var(--brand)] font-semibold" : "text-[var(--bad)]"
                  }
                >
                  {String(row.canLoginFa)}
                </span>
              );
            }
            if (column === "dbStatus") {
              const u = row._user as AllowlistRow | undefined;
              const bad =
                u &&
                u.authMode === "db" &&
                (!u.dbFound || !u.dbEnabled);
              return (
                <span className={bad ? "text-[var(--bad)]" : undefined}>
                  {String(row.dbStatus)}
                </span>
              );
            }
            return undefined;
          }}
        />
      </div>
    </div>
  );
}
