"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { LoadingSpinner } from "./LoadingSpinner";
import { UserBar } from "./UserBar";

type NavChild = {
  href: string;
  label: string;
  hint: string;
  /** Special soft-reset for wizard */
  wizardReset?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  hint: string;
  children: NavChild[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "txns",
    label: "تراکنش‌ها",
    hint: "لیست و ایجاد",
    children: [
      { href: "/", label: "لیست تراکنش‌ها", hint: "تراکنش‌های تاییدشده" },
      {
        href: "/request/new",
        label: "تراکنش جدید",
        hint: "ویزارد یارانه",
        wizardReset: true,
      },
    ],
  },
  {
    id: "settings",
    label: "تنظیمات",
    hint: "دسترسی و دیتابیس",
    children: [
      { href: "/settings/access", label: "اعطای دسترسی", hint: "کاربر و نوع تراکنش" },
      { href: "/settings/users", label: "فهرست کاربران", hint: "دسترسی‌های ذخیره‌شده" },
      { href: "/settings/db", label: "تنظیمات دیتابیس", hint: "اتصال فعال" },
      {
        href: "/settings/mostamari-rates",
        label: "مبالغ مستمری",
        hint: "مبالغ سالانه و سقف استان",
      },
      {
        href: "/settings/yarane-thresholds",
        label: "مبالغ یارانه",
        hint: "سقف و کف محل تأمین (فقط مشاهده)",
      },
      {
        href: "/mostamari/returns",
        label: "برگشتی مستمری",
        hint: "ثبت مبالغ منفی پس از برگشتی",
      },
    ],
  },
];

function groupActive(group: NavGroup, pathname: string) {
  return group.children.some((c) => {
    if (c.href === "/") return pathname === "/";
    return pathname === c.href || pathname.startsWith(`${c.href}/`);
  });
}

function childActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/request/new") return pathname === "/request/new";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Chevron({ open }: { open: boolean }) {
  // Base glyph points down (▼). Collapsed = down; expanded = up.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV_OPEN_KEY = "paydisk_nav_open";

type NavAccess = { canSeeTxns: boolean; canSeeSettings: boolean };
/** Survives AppShell remounts between pages (each page wraps its own shell). */
let navAccessCache: NavAccess | null = null;

function defaultOpenIds(): Record<string, boolean> {
  return { txns: true, settings: false };
}

function readStoredOpenIds(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(NAV_OPEN_KEY);
    if (!raw) return defaultOpenIds();
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaultOpenIds(), ...parsed };
  } catch {
    return defaultOpenIds();
  }
}

function WizardChildLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (pathname === "/request/new") {
          e.preventDefault();
          if (searchParams.get("trId")) {
            router.replace("/request/new");
          } else {
            router.refresh();
            window.location.assign("/request/new");
          }
        }
      }}
    >
      {children}
    </Link>
  );
}

function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [navReady, setNavReady] = useState(() => navAccessCache !== null);
  const [canSeeTxns, setCanSeeTxns] = useState(
    () => navAccessCache?.canSeeTxns ?? false,
  );
  const [canSeeSettingsNav, setCanSeeSettingsNav] = useState(
    () => navAccessCache?.canSeeSettings ?? false,
  );
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(defaultOpenIds);
  const [openHydrated, setOpenHydrated] = useState(false);

  useEffect(() => {
    setOpenIds(readStoredOpenIds());
    setOpenHydrated(true);
  }, []);

  useEffect(() => {
    if (!openHydrated) return;
    try {
      sessionStorage.setItem(NAV_OPEN_KEY, JSON.stringify(openIds));
    } catch {
      /* ignore */
    }
  }, [openIds, openHydrated]);

  // Keep the group of the current route expanded (stops collapse/jump on navigate).
  useEffect(() => {
    setOpenIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of NAV_GROUPS) {
        if (groupActive(g, pathname) && !next[g.id]) {
          next[g.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) {
          if (!cancelled) setNavReady(true);
          return;
        }
        const next: NavAccess = {
          canSeeTxns: !!d.access?.canSeeTransactions,
          canSeeSettings: !!d.access?.canSeeSettings,
        };
        navAccessCache = next;
        setCanSeeTxns(next.canSeeTxns);
        setCanSeeSettingsNav(next.canSeeSettings);
        setNavReady(true);
      })
      .catch(() => {
        if (!cancelled) setNavReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.filter((g) => {
        if (g.id === "settings") return canSeeSettingsNav;
        if (g.id === "txns") return canSeeTxns;
        return false;
      }),
    [canSeeSettingsNav, canSeeTxns],
  );

  useEffect(() => {
    if (!navReady) return;
    const onSettings = pathname.startsWith("/settings");
    const onTxns =
      pathname === "/" ||
      pathname.startsWith("/request") ||
      pathname.startsWith("/transactions");
    if (onSettings && !canSeeSettingsNav) {
      router.replace("/");
      return;
    }
    if (onTxns && !canSeeTxns && canSeeSettingsNav) {
      router.replace("/settings/access");
    }
  }, [navReady, pathname, canSeeSettingsNav, canSeeTxns, router]);

  function toggle(id: string) {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!navReady) {
    return (
      <nav className="p-3">
        <LoadingSpinner label="بارگذاری منو…" size="sm" />
      </nav>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <nav className="p-3">
        <div className="rounded-xl bg-[#fff1db] text-[#a15c00] px-3 py-2 text-xs leading-6">
          برای این حساب منوی تراکنش یا تنظیمات فعال نیست. با ادمین برای اعطای دسترسی هماهنگ کنید.
        </div>
      </nav>
    );
  }

  return (
    <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
      {visibleGroups.map((group) => {
        const sectionOn = groupActive(group, pathname);
        // Active route's group always stays open — avoids collapse flash on click.
        const open = sectionOn || !!openIds[group.id];

        return (
          <div key={group.id} className="min-w-[10rem]">
            <button
              type="button"
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right transition-colors ${
                sectionOn ? "bg-[var(--paper-2)]" : "hover:bg-[var(--paper-2)]"
              }`}
              aria-expanded={open}
              onClick={() => toggle(group.id)}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">{group.label}</div>
                <div className="text-[11px] text-[var(--ink-soft)]">{group.hint}</div>
              </div>
              <Chevron open={open} />
            </button>

            {open ? (
              <div className="mt-0.5 mb-1 ms-2 space-y-0.5 border-r border-[var(--line)] pr-2">
                {group.children.map((child) => {
                  const active = childActive(child.href, pathname);
                  const className = `block rounded-lg px-2.5 py-1.5 transition-colors ${
                    active ? "bg-[#e8f6f4]" : "hover:bg-[var(--paper-2)]"
                  }`;
                  const body = (
                    <>
                      <div className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>
                        {child.label}
                      </div>
                      <div className="text-[10px] text-[var(--ink-soft)] leading-4">
                        {child.hint}
                      </div>
                    </>
                  );

                  if (child.wizardReset) {
                    return (
                      <Suspense
                        key={child.href}
                        fallback={
                          <Link href={child.href} className={className}>
                            {body}
                          </Link>
                        }
                      >
                        <WizardChildLink href={child.href} className={className}>
                          {body}
                        </WizardChildLink>
                      </Suspense>
                    );
                  }

                  return (
                    <Link key={child.href} href={child.href} className={className}>
                      {body}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  crumbs,
  /** @deprecated use crumbs — kept as last breadcrumb label if crumbs omitted */
  title,
}: {
  children: React.ReactNode;
  crumbs?: Crumb[];
  title?: string;
}) {
  const trail: Crumb[] =
    crumbs && crumbs.length
      ? crumbs
      : title
        ? [{ label: "پنل", href: "/" }, { label: title }]
        : [{ label: "پنل", href: "/" }];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-l border-[var(--line)] bg-white/90 backdrop-blur lg:min-h-screen sticky top-0 z-20">
        <div className="px-4 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/behzisti-logo.svg"
              alt="سازمان بهزیستی کشور"
              className="h-11 w-auto shrink-0"
            />
            <div>
              <div className="text-lg font-semibold leading-none">پنل دیسکت پرداخت</div>
              <div className="text-[11px] text-[var(--ink-soft)] mt-1">
                سازمان بهزیستی · ستاد
              </div>
            </div>
          </div>
        </div>
        <SideNav />
      </aside>

      <div className="flex-1 min-w-0">
        <header className="border-b border-[var(--line)] bg-white/70 backdrop-blur sticky top-0 z-10">
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <Breadcrumb items={trail} />
            <UserBar />
          </div>
        </header>

        <main className="px-3 sm:px-4 py-5 sm:py-6 w-full max-w-[1600px]">
          {children}
        </main>
      </div>
    </div>
  );
}
