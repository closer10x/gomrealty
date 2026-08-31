"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, SITE } from "@/lib/content";

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile sheet on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="header">
      <Link href="/" className="brand" aria-label={`${SITE.name} home`}>
        <img className="brand-mark" src="/brand/mark.svg" alt="" width={38} height={38} />
        <span className="brand-text">
          <span className="brand-name">GO-M REALTY</span>
          <span className="brand-sub">{SITE.region}</span>
        </span>
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden />
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <nav id="site-nav" className={open ? "nav open" : "nav"}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <a href={SITE.phoneHref} className="nav-call">
          {SITE.phone}
        </a>
      </nav>
    </header>
  );
}
