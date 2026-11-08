import type { PageAiState, StatsRange } from "@/lib/pages";

export function formatCairoTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    timeZone: "Africa/Cairo",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatCairoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDayLabel(dayStr: string): string {
  const d = new Date(`${dayStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dayStr;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    timeZone: "Africa/Cairo",
    weekday: "short",
  }).format(d);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export const pagesCopy = {
  title: "صفحاتي",
  addPage: "+ أضف صفحة",
  viewCards: "بطاقات",
  viewCompare: "مقارنة",
  ranges: {
    today: "اليوم",
    "7d": "7 أيام",
    "30d": "30 يوم",
  } satisfies Record<StatsRange, string>,
  masterOffBanner: "الذكاء الاصطناعي متوقف على كل الصفحات من الإعدادات.",
  masterOffTurnOn: "تشغيل الآن",
  emptyState: "اربط أول صفحة عشان الذكاء الاصطناعي يبدأ يرد على عملائك.",
  connectFacebook: "ربط فيسبوك",
  connectInstagram: "ربط إنستجرام",
  capMessage: "تقدر تربط لحد 10 صفحات.",
  openPage: "فتح الصفحة",
  pauseButton: "إيقاف مؤقت",
  disconnectedTitle: (count: number) => `صفحات مفصولة (${count})`,
  reconnect: "إعادة ربط",
  stateLabel(state: PageAiState, pausedUntil: string | null): string {
    switch (state) {
      case "on":
        return "الذكاء الاصطناعي بيرد دلوقتي";
      case "paused": {
        const t = formatCairoTime(pausedUntil);
        return t ? `واقف مؤقتًا لحد ${t}` : "واقف مؤقتًا";
      }
      case "off":
        return "متوقف — إنت اللي بترد";
      case "master_off":
        return "متوقف على كل الصفحات";
      case "over_quota":
        return "خلّصت ردود الشهر";
    }
  },
  pauseMenu: {
    oneHour: "إيقاف 1 ساعة",
    eightHours: "إيقاف 8 ساعات",
    twentyFourHours: "إيقاف 24 ساعة",
    turnOff: "إيقاف الرد الآلي",
    resumeNow: "تشغيل الآن",
  },
  toastTurnOff: (page: string) => `وقفنا الرد على «${page}»`,
  toastUndo: "تراجع",
  toastTurnOn: (page: string) => `الرد شغّال على «${page}»`,
  toastConnected: (page: string) => `تم ربط «${page}». الذكاء الاصطناعي شغّال.`,
  toggleError: (page: string) =>
    `معرفناش نغيّر حالة الرد على «${page}». اتأكد من النت وجرّب تاني.`,
  disconnectModalBody: (page: string) =>
    `الذكاء الاصطناعي هيبطّل يرد على «${page}». محادثاتك وأرقامك هتفضل موجودة وتقدر تربطها تاني في أي وقت.`,
  disconnectButton: (page: string) => `فصل «${page}»`,
  disconnectToast: (page: string) => `اتفصلت «${page}»`,
  sharedCatalogNote: "المنتجات والسياسات مشتركة بين كل صفحاتك.",
  pageNotesLabel: "ملاحظات لهذه الصفحة",
  pageNotesHelper:
    "قول للذكاء الاصطناعي الصفحة دي لإيه وأسلوبها إيه. مش بيغيّر الأسعار ولا السياسات.",
  saveNotes: "حفظ الملاحظات",
  savedNotes: "تم الحفظ",
  connectErrors: {
    account_in_use: "هذه الصفحة مرتبطة بحساب تاجر آخر.",
    account_not_found: "لم نعثر على الصفحة، حاول مرة أخرى.",
    unsupported_platform: "هذا النوع من الحسابات غير مدعوم.",
    billing_required: "ربط الصفحات غير متاح مؤقتاً، تواصل مع الدعم.",
    zernio_unavailable: "الخدمة غير متاحة حالياً، حاول بعد قليل.",
    page_limit_reached: "تقدر تربط لحد 10 صفحات.",
    connect_failed: "تعذر ربط الصفحة، حاول مرة أخرى.",
  } as Record<string, string>,
};

