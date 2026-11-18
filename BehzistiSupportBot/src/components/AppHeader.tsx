"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/behzisti-logo.svg" alt="سازمان بهزیستی کشور" />
        <div>
          <h1>سامانه هوشمند پاسخگویی و پشتیبانی سازمانی</h1>
          <p>سازمان بهزیستی کشور</p>
        </div>
      </div>
      <nav className="nav-links" aria-label="ناوبری">
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          گفتگو با کاربر
        </Link>
        <Link href="/knowledge" className={pathname === "/knowledge" ? "active" : ""}>
          Knowledge
        </Link>
        <Link href="/agent" className={pathname === "/agent" ? "active" : ""}>
          پنل کارشناس
        </Link>
      </nav>
    </header>
  );
}
