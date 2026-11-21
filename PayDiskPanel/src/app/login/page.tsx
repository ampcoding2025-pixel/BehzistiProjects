"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "ورود ناموفق");
        return;
      }
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("خطای شبکه");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md panel p-6">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/behzisti-logo.png"
            alt="سازمان بهزیستی کشور"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold">پنل دیسکت پرداخت</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">نام کاربری</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-xl bg-[#fde6e9] text-[var(--bad)] text-sm px-3 py-2">
              {error}
            </div>
          ) : null}
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy ? <LoadingSpinner label="ورود…" size="sm" inline /> : "ورود"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">…</div>}>
      <LoginForm />
    </Suspense>
  );
}
