"use client";

import { usePathname, useRouter } from "@/lib/i18n";
import { languageTag } from "@/paraglide/runtime";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLang = languageTag();
  const targetLang = currentLang === "en" ? "ar" : "en";
  const label = currentLang === "en" ? "العربية" : "English";

  const handleSwitch = () => {
    router.push(pathname, { locale: targetLang });
    router.refresh();
  };

  return (
    <button
      onClick={handleSwitch}
      className="text-sm font-extrabold text-gray-700 transition-colors hover:text-emerald-700"
    >
      {label}
    </button>
  );
}
