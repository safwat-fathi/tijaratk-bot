"use client";

import { useState } from "react";
import { Link, usePathname } from "@/lib/i18n";
import { BrandMark } from "@/app/logo";
import * as m from "@/paraglide/messages";
import { LanguageSwitcher } from "./language-switcher";

export function Nav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/how-it-works", label: m.nav_link_how() },
    { href: "/features", label: m.nav_link_features() },
    { href: "/pricing", label: m.nav_link_pricing() },
    { href: "/faq", label: m.nav_link_faq() },
    { href: "/blog", label: m.nav_link_blog() },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <div className="bg-emerald-700 text-white px-4 py-2.5 text-center text-[13.5px] font-bold">
        {m.nav_banner_text()}
        <Link href="/signup" className="underline hover:text-emerald-200 ms-1">
          {m.nav_banner_cta()}
        </Link>
      </div>

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <BrandMark />

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm transition-colors ${
                    active
                      ? "font-black text-emerald-700 border-b-2 border-emerald-600 pb-1"
                      : "font-medium text-gray-700 hover:text-emerald-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher />

            <Link
              href="/demo"
              className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-emerald-700 shadow-sm"
            >
              {m.nav_cta()}
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white px-5 py-5 md:hidden shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors ${
                      active
                        ? "bg-emerald-50 font-black text-emerald-800"
                        : "font-semibold text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <span>{link.label}</span>
                    {active && <span className="text-emerald-600 font-bold">•</span>}
                  </Link>
                );
              })}

              {/* Quick Article Links on Mobile */}
              <div className="mt-2 border-t border-gray-100 pt-3">
                <span className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  أحدث المقالات والمقارنات:
                </span>
                <Link
                  href="/blog/tijaratkbot-vs-arabybot"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-2 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50"
                >
                  مقارنة تِجارتك بوت مع عربي بوت (ArabyBot) ←
                </Link>
                <Link
                  href="/blog/why-sell-from-chat-inbox"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-2 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50"
                >
                  ليه لازم تبيع من داخل شات السوشيال ميديا؟ ←
                </Link>
                <Link
                  href="/sitemap"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-2 text-xs text-gray-500 hover:text-emerald-700 hover:bg-emerald-50/50"
                >
                  خريطة الموقع كاملة (Sitemap) ←
                </Link>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <Link
                  href="/merchant"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-800"
                >
                  لوحة التحكم
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
