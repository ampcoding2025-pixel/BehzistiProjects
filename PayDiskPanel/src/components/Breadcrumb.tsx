"use client";

import Link from "next/link";

export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="مسیر صفحه" className="breadcrumb">
      <ol className="breadcrumb__list">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="breadcrumb__item">
              {i > 0 ? (
                <span className="breadcrumb__sep" aria-hidden>
                  /
                </span>
              ) : null}
              {last || !item.href ? (
                <span
                  className={`breadcrumb__current${last ? " is-current" : ""}`}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="breadcrumb__link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
