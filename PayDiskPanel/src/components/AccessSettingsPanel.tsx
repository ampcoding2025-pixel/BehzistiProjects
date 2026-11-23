"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingBlock, LoadingSpinner } from "@/components/LoadingSpinner";
import type { DiskFamily } from "@/lib/types";

type DbUserHit = {
  id: number;
  username: string;
  displayName?: string;
  role: string;
  isAdmin: boolean;
  centerId: number;
};

function userLabel(u: { username: string; displayName?: string }) {
  const name = (u.displayName || "").trim();
  if (name && name.toLowerCase() !== u.username.toLowerCase()) return name;
  return u.username;
}

type AccessTypeRef = {
  family: DiskFamily;
  typeId: string;
  label: string;
};

type AccessRow = {
  username: string;
  dbUserId?: number | null;
  displayName?: string;
  typeRefs: AccessTypeRef[];
  canCreate: boolean;
  canApprove: boolean;
};

function sameUser(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function blankRow(hit: DbUserHit): AccessRow {
  return {
    username: hit.username,
    dbUserId: hit.id || null,
    displayName: userLabel(hit),
    typeRefs: [],
    canCreate: true,
    canApprove: true,
  };
}

export function AccessSettingsPanel() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [enforced, setEnforced] = useState(false);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [preselectDone, setPreselectDone] = useState(false);

  const [userQ, setUserQ] = useState("");
  const [userHits, setUserHits] = useState<DbUserHit[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DbUserHit | null>(null);

  const [family, setFamily] = useState<DiskFamily>("yarane");
  const [typeQ, setTypeQ] = useState("");
  const [typeOptions, setTypeOptions] = useState<AccessTypeRef[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);

  const loadAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/access?family=yarane");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "بارگذاری دسترسی‌ها ناموفق");
        return;
      }
      setCanEdit(!!data.canEdit);
      setCanManageAdmins(!!data.canManageAdmins);
      setEnforced(!!data.enforced);
      setRows(
        (data.users || []).map((u: AccessRow) => ({
          ...u,
          typeRefs: Array.isArray(u.typeRefs) ? u.typeRefs : [],
          canCreate: u.canCreate !== false,
          canApprove: u.canApprove !== false,
        })),
      );
      setTypeOptions(data.typeOptions || []);
    } catch {
      setError("خطای شبکه");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = userQ.trim();
      if (q.length < 1) {
        setUserHits([]);
        return;
      }
      // Don't re-search while a user is already selected with the same query
      if (selectedUser && sameUser(selectedUser.username, q)) {
        setUserHits([]);
        return;
      }
      setUserSearching(true);
      try {
        const res = await fetch(`/api/settings/users?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok && data.ok) setUserHits(data.users || []);
        else setUserHits([]);
      } catch {
        setUserHits([]);
      } finally {
        setUserSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [userQ, selectedUser]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setTypeLoading(true);
      try {
        const params = new URLSearchParams({
          family,
          typeQ: typeQ.trim(),
        });
        const res = await fetch(`/api/settings/access?${params}`);
        const data = await res.json();
        if (res.ok && data.ok) setTypeOptions(data.typeOptions || []);
      } catch {
        /* keep previous */
      } finally {
        setTypeLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [family, typeQ]);

  const current = useMemo(() => {
    if (!selectedUser) return null;
    return (
      rows.find((r) => sameUser(r.username, selectedUser.username)) || null
    );
  }, [rows, selectedUser]);

  /** Upsert row for selected DB user in one atomic setState. */
  function upsertSelected(
    hit: DbUserHit,
    mutate: (row: AccessRow) => AccessRow,
  ) {
    setRows((prev) => {
      const i = prev.findIndex((r) => sameUser(r.username, hit.username));
      if (i < 0) {
        return [...prev, mutate(blankRow(hit))];
      }
      const next = [...prev];
      const base = {
        ...next[i]!,
        displayName: next[i]!.displayName || userLabel(hit),
      };
      next[i] = mutate(base);
      return next;
    });
  }

  function selectDbUser(hit: DbUserHit) {
    setSelectedUser(hit);
    setUserQ(hit.username);
    setUserHits([]);
    setMsg(null);
    setError(null);
    // Ensure a mutable ACL row exists (defaults: create+approve on)
    setRows((prev) => {
      const i = prev.findIndex((r) => sameUser(r.username, hit.username));
      if (i < 0) return [...prev, blankRow(hit)];
      const name = userLabel(hit);
      if (prev[i]!.displayName === name) return prev;
      const next = [...prev];
      next[i] = { ...next[i]!, displayName: name, dbUserId: hit.id || next[i]!.dbUserId };
      return next;
    });
  }

  useEffect(() => {
    if (loading || preselectDone) return;
    const u = searchParams.get("user");
    if (!u) {
      setPreselectDone(true);
      return;
    }
    const hit = rows.find((r) => sameUser(r.username, u));
    selectDbUser({
      id: Number(hit?.dbUserId || 0),
      username: hit?.username || u,
      displayName: hit?.displayName || hit?.username || u,
      role: "",
      isAdmin: false,
      centerId: 0,
    });
    setPreselectDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from URL
  }, [loading, rows, searchParams, preselectDone]);

  function setFlag(field: "canCreate" | "canApprove", value: boolean) {
    if (!selectedUser || !canEdit) return;
    upsertSelected(selectedUser, (row) => ({ ...row, [field]: value }));
  }

  async function setDbAdmin(isAdmin: boolean) {
    if (!selectedUser || !canManageAdmins) return;
    setAdminBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/users/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedUser.username, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "تغییر ادمین ناموفق");
        return;
      }
      setSelectedUser({ ...selectedUser, isAdmin, role: isAdmin ? "Admin" : "User" });
      setMsg(isAdmin ? "کاربر ادمین شد" : "دسترسی ادمین برداشته شد");
    } catch {
      setError("خطای شبکه در تغییر ادمین");
    } finally {
      setAdminBusy(false);
    }
  }

  function toggleType(ref: AccessTypeRef) {
    if (!selectedUser || !canEdit || selectedUser.isAdmin) return;
    const key = `${ref.family}:${ref.typeId}`;
    upsertSelected(selectedUser, (row) => {
      const has = row.typeRefs.some((t) => `${t.family}:${t.typeId}` === key);
      return {
        ...row,
        typeRefs: has
          ? row.typeRefs.filter((t) => `${t.family}:${t.typeId}` !== key)
          : [...row.typeRefs, ref],
      };
    });
  }

  /** Select or clear every type currently shown (full list or search filter). */
  function setVisibleTypes(select: boolean) {
    if (!selectedUser || !canEdit || selectedUser.isAdmin) return;
    if (typeOptions.length === 0) return;
    const visibleKeys = new Set(
      typeOptions.map((t) => `${t.family}:${t.typeId}`),
    );
    upsertSelected(selectedUser, (row) => {
      const kept = row.typeRefs.filter(
        (t) => !visibleKeys.has(`${t.family}:${t.typeId}`),
      );
      return {
        ...row,
        typeRefs: select ? [...kept, ...typeOptions] : kept,
      };
    });
  }

  function isGranted(ref: AccessTypeRef) {
    if (selectedUser?.isAdmin) return true;
    if (!current) return false;
    return current.typeRefs.some(
      (t) => t.family === ref.family && t.typeId === ref.typeId,
    );
  }

  const grantedForFamily = useMemo(() => {
    if (selectedUser?.isAdmin) return typeOptions;
    if (!current) return [];
    return current.typeRefs.filter((t) => t.family === family);
  }, [current, family, selectedUser?.isAdmin, typeOptions]);

  const visibleAllSelected = useMemo(() => {
    if (!typeOptions.length) return false;
    if (selectedUser?.isAdmin) return true;
    if (!current) return false;
    return typeOptions.every((t) =>
      current.typeRefs.some(
        (g) => g.family === t.family && g.typeId === t.typeId,
      ),
    );
  }, [typeOptions, current, selectedUser?.isAdmin]);

  const visibleSomeSelected = useMemo(() => {
    if (!typeOptions.length) return false;
    if (selectedUser?.isAdmin) return true;
    if (!current) return false;
    return typeOptions.some((t) =>
      current.typeRefs.some(
        (g) => g.family === t.family && g.typeId === t.typeId,
      ),
    );
  }, [typeOptions, current, selectedUser?.isAdmin]);

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enforced: true, users: rows }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "ذخیره ناموفق");
        return;
      }
      setEnforced(true);
      setMsg("دسترسی‌ها ذخیره شد");
      setRows(
        (data.users || []).map((u: AccessRow) => ({
          ...u,
          typeRefs: Array.isArray(u.typeRefs) ? u.typeRefs : [],
        })),
      );
    } catch {
      setError("خطای شبکه در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="بارگذاری دسترسی‌ها…" />;
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4 space-y-2">
        <h2 className="font-semibold text-lg">دسترسی انواع تراکنش</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-7">
          کاربر را از دیتابیس جستجو کنید، خانواده دیسکت را انتخاب کنید، سپس نوع را پیدا و تیک بزنید.
          {enforced ? " · محدودیت فعال است." : " · تا اولین ذخیره، محدودیت اعمال نمی‌شود."}
        </p>
        {!canEdit ? (
          <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-3 py-2 text-sm">
            حساب شما اجازه ویرایش ندارد. با کاربر{" "}
            <strong>setad.admin</strong> وارد شوید تا بتوانید ایجاد/تایید و انواع را تنظیم کنید.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] px-3 py-2 text-sm">{error}</div>
        ) : null}
        {msg ? <div className="text-xs text-[var(--brand)]">{msg}</div> : null}
      </div>

      <div className="panel p-4 space-y-4">
        <div className="field">
          <label htmlFor="acl-user-q">۱. جستجوی کاربر در دیتابیس</label>
          <input
            id="acl-user-q"
            value={userQ}
            onChange={(e) => {
              setUserQ(e.target.value);
              setSelectedUser(null);
            }}
            placeholder="نام یا نام کاربری…"
            autoComplete="off"
          />
          {userSearching ? (
            <div className="mt-2">
              <LoadingSpinner size="sm" inline />
            </div>
          ) : null}
          {userHits.length > 0 && !selectedUser ? (
            <ul className="mt-2 w-full max-h-56 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--paper)] divide-y divide-[var(--line)]">
              {userHits.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="w-full text-right px-3 py-2.5 text-sm hover:bg-[var(--paper-2)] transition-colors"
                    onClick={() => selectDbUser(u)}
                  >
                    <span className="font-semibold">{userLabel(u)}</span>
                    <span className="text-[11px] text-[var(--ink-soft)] ms-2">
                      {u.username}
                      {u.isAdmin ? " · ادمین" : ""}
                      {u.centerId ? ` · مرکز ${u.centerId}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedUser ? (
          <div className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                انتخاب‌شده:{" "}
                <strong>{userLabel(selectedUser)}</strong>
                <span className="text-[var(--ink-soft)] text-xs ms-2">
                  {selectedUser.username}
                  {selectedUser.id ? ` · #${selectedUser.id}` : ""}
                  {selectedUser.isAdmin ? " · ادمین" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-2" title="اجازه ساخت تراکنش جدید در ویزارد">
                  <input
                    type="checkbox"
                    checked={selectedUser.isAdmin ? true : (current?.canCreate ?? true)}
                    disabled={!canEdit || selectedUser.isAdmin}
                    onChange={(e) => setFlag("canCreate", e.target.checked)}
                  />
                  ایجاد
                </label>
                <label className="inline-flex items-center gap-2" title="اجازه تایید نهایی تراکنش در ویزارد">
                  <input
                    type="checkbox"
                    checked={selectedUser.isAdmin ? true : (current?.canApprove ?? true)}
                    disabled={!canEdit || selectedUser.isAdmin}
                    onChange={(e) => setFlag("canApprove", e.target.checked)}
                  />
                  تایید
                </label>
                {canManageAdmins ? (
                  <label className="inline-flex items-center gap-2" title="ادمین پنل — همه انواع تراکنش">
                    <input
                      type="checkbox"
                      checked={!!selectedUser.isAdmin}
                      disabled={adminBusy}
                      onChange={(e) => void setDbAdmin(e.target.checked)}
                    />
                    ادمین سیستم
                  </label>
                ) : null}
              </div>
            </div>
            {selectedUser.isAdmin ? (
              <div className="text-xs rounded-lg bg-[#e8f6f4] text-[var(--brand)] px-3 py-2 leading-6">
                این کاربر <strong>ادمین</strong> است — همه انواع تیک‌خورده نمایش داده می‌شوند و قابل تغییر نیستند.
              </div>
            ) : (
              <div className="text-[11px] text-[var(--ink-soft)] leading-6">
                <strong>ایجاد</strong> = ساخت تراکنش · <strong>تایید</strong> = تایید نهایی ·
                انواع زیر را تیک بزنید یا با «انتخاب همه نتایج» همهٔ لیست/جستجو را یکجا بدهید.
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-[var(--ink-soft)]">ابتدا یک کاربر را از نتایج انتخاب کنید.</div>
        )}

        <div className="field">
          <label>۲. خانواده دیسکت</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(
              [
                { id: "yarane" as const, label: "یارانه" },
                { id: "mostamari" as const, label: "مستمری" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn text-xs ${family === f.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => {
                  setFamily(f.id);
                  setTypeQ("");
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="acl-type-q">۳. جستجوی نوع و دادن دسترسی</label>
          <input
            id="acl-type-q"
            value={typeQ}
            onChange={(e) => setTypeQ(e.target.value)}
            placeholder={
              family === "yarane"
                ? "مثلاً CBR، شبانه، شماره محل تأمین…"
                : "مثلاً امداد، هدفمندی، Ky…"
            }
            disabled={!selectedUser}
          />
        </div>

        {selectedUser ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--ink-soft)]">
                {typeLoading ? "…" : `${typeOptions.length} نتیجه`}
                {selectedUser.isAdmin
                  ? " · همه انواع (ادمین)"
                  : grantedForFamily.length
                    ? ` · ${grantedForFamily.length} نوع ${family === "yarane" ? "یارانه" : "مستمری"} انتخاب‌شده`
                    : ""}
                {typeQ.trim() ? " · فیلتر جستجو فعال" : ""}
              </div>
              {canEdit && !selectedUser.isAdmin && typeOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost text-xs py-1 px-2"
                    disabled={visibleAllSelected}
                    onClick={() => setVisibleTypes(true)}
                    title={
                      typeQ.trim()
                        ? "تیک زدن همه نتایج همین جستجو"
                        : "تیک زدن همه انواع نمایش‌داده‌شده"
                    }
                  >
                    انتخاب همه نتایج
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs py-1 px-2"
                    disabled={!visibleSomeSelected}
                    onClick={() => setVisibleTypes(false)}
                    title={
                      typeQ.trim()
                        ? "برداشتن تیک همه نتایج همین جستجو"
                        : "برداشتن تیک همه انواع نمایش‌داده‌شده"
                    }
                  >
                    حذف همه نتایج
                  </button>
                </div>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[42vh] overflow-auto border border-[var(--line)] rounded-xl p-3">
              {typeOptions.length === 0 ? (
                <div className="text-sm text-[var(--ink-soft)] col-span-2 py-4 text-center">
                  نوعی یافت نشد
                </div>
              ) : (
                typeOptions.map((t) => {
                  const on = isGranted(t);
                  const locked = !canEdit || selectedUser.isAdmin;
                  return (
                    <button
                      key={`${t.family}:${t.typeId}`}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleType(t)}
                      className={`flex items-start gap-2 text-xs rounded-lg px-2 py-2 text-right transition-colors ${
                        on ? "bg-[#e8f6f4]" : "hover:bg-[var(--paper-2)]"
                      } ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span
                        className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded border ${
                          on
                            ? "border-[var(--brand)] bg-[var(--brand)]"
                            : "border-[var(--line)] bg-white"
                        }`}
                        aria-hidden
                      />
                      <span>{t.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={save}
              >
                {saving ? "…" : "ذخیره دسترسی‌ها"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

    </div>
  );
}
