"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ShoppingCart,
  MessageSquare,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const navigation = [
  { name: "نظرة عامة", href: "/merchant", icon: LayoutDashboard },
  { name: "المنتجات", href: "/merchant/products", icon: Package },
  { name: "السياسات", href: "/merchant/policies", icon: BookOpen },
  { name: "الطلبات", href: "/merchant/orders", icon: ShoppingCart },
  { name: "المحادثات", href: "/merchant/conversations", icon: MessageSquare },
  { name: "تدريب الـ AI", href: "/merchant/training", icon: GraduationCap },
  { name: "الإعدادات", href: "/merchant/settings", icon: Settings },
];

export function SidebarClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logoutAction();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l border-slate-200">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-800">Tijaratk</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-400"}`} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-200">
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
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative flex w-64 flex-col bg-white border-l border-slate-200">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <span className="text-xl font-bold text-slate-800">Tijaratk</span>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-3">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <item.icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-400"}`} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="p-4 border-t border-slate-200">
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 md:hidden">
          <span className="text-lg font-bold text-slate-800">Tijaratk</span>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
