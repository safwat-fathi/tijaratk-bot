"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Store,
  Package,
  BookOpen,
  ShoppingCart,
  MessageSquare,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import type { PageAiState, PageChannel } from "@/lib/pages";

export interface SidebarPageItem {
  id: string;
  name: string;
  channel: PageChannel;
  ai_state: PageAiState;
}

const navigationAfterPages = [
  { name: "المنتجات", href: "/merchant/products", icon: Package },
  { name: "السياسات", href: "/merchant/policies", icon: BookOpen },
  { name: "الطلبات", href: "/merchant/orders", icon: ShoppingCart },
  { name: "المحادثات", href: "/merchant/conversations", icon: MessageSquare },
  { name: "تدريب الـ AI", href: "/merchant/training", icon: GraduationCap },
  { name: "الإعدادات", href: "/merchant/settings", icon: Settings },
];

function stateDotClass(state: PageAiState): string {
  if (state === "on") return "bg-nile";
  if (state === "paused") return "bg-saffron";
  return "bg-stone";
}

function stateDotLabel(state: PageAiState): string {
  if (state === "on") return "يرد الآن";
  if (state === "paused") return "واقف مؤقتًا";
  return "متوقف";
}

export function SidebarClient({
  pages = [],
  children,
}: {
  pages?: SidebarPageItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isPagesSection = pathname.startsWith("/merchant/pages");
  const [pagesExpanded, setPagesExpanded] = useState(true);

  const handleLogout = async () => {
    await logoutAction();
  };

  const renderNavItems = (onNavigate?: () => void) => (
    <ul className="space-y-1 px-3">
      {/* Overview */}
      <li>
        <Link
          href="/merchant"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/merchant"
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <LayoutDashboard
            className={`w-5 h-5 ${
              pathname === "/merchant" ? "text-blue-700" : "text-slate-400"
            }`}
          />
          نظرة عامة
        </Link>
      </li>

      {/* My pages expandable group */}
      <li>
        <div
          className={`flex items-center justify-between rounded-lg text-sm font-medium transition-colors ${
            isPagesSection
              ? "bg-nile-wash text-ink"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Link
            href="/merchant/pages"
            onClick={onNavigate}
            className="flex flex-1 items-center gap-3 px-3 py-2"
          >
            <Store
              className={`w-5 h-5 ${
                isPagesSection ? "text-nile" : "text-slate-400"
              }`}
            />
            <span>صفحاتي</span>
          </Link>
          {pages.length > 0 && (
            <button
              type="button"
              aria-label={pagesExpanded ? "طي قائمة الصفحات" : "عرض قائمة الصفحات"}
              aria-expanded={pagesExpanded}
              onClick={() => setPagesExpanded((v) => !v)}
              className="p-2 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nile rounded-md"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  pagesExpanded ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {pages.length > 0 && pagesExpanded && (
          <ul className="mt-1 mr-6 space-y-0.5 border-r border-line pr-2">
            {pages.map((page) => {
              const pageHref = `/merchant/pages/${page.id}`;
              const isPageActive = pathname === pageHref;
              const platformShort = page.channel === "INSTAGRAM" ? "IG" : "FB";
              return (
                <li key={page.id}>
                  <Link
                    href={pageHref}
                    onClick={onNavigate}
                    className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      isPageActive
                        ? "bg-nile-wash font-semibold text-ink"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="truncate font-display">
                      {page.name}{" "}
                      <span className="text-[10px] text-ink-soft">
                        ({platformShort})
                      </span>
                    </span>
                    <span
                      title={stateDotLabel(page.ai_state)}
                      aria-label={stateDotLabel(page.ai_state)}
                      className={`h-2 w-2 shrink-0 rounded-full ${stateDotClass(
                        page.ai_state,
                      )}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>

      {/* Rest of navigation */}
      {navigationAfterPages.map((item) => {
        const isActive = pathname === item.href;
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${
                  isActive ? "text-blue-700" : "text-slate-400"
                }`}
              />
              {item.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="h-screen h-dvh bg-slate-50 flex overflow-hidden" dir="rtl">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l border-slate-200 shrink-0 h-full">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 shrink-0">
          <span className="text-xl font-bold text-slate-800">Tijaratk</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">{renderNavItems()}</nav>
        <div className="p-4 border-t border-slate-200 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-right rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="relative flex w-64 flex-col bg-white border-l border-slate-200 h-full z-10">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
              <span className="text-xl font-bold text-slate-800">Tijaratk</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              {renderNavItems(() => setIsSidebarOpen(false))}
            </nav>
            <div className="p-4 border-t border-slate-200 shrink-0">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 w-full text-right rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
                تسجيل الخروج
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 md:hidden shrink-0">
          <span className="text-lg font-bold text-slate-800">Tijaratk</span>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
