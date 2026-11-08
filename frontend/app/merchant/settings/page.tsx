import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantSettings } from "@/lib/dal";
import {
  updateAiEnabledAction,
  updateAutoLearningAction,
} from "../actions";
import { SettingToggle } from "./setting-toggle";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  if (connected || error) {
    const qs = new URLSearchParams();
    if (connected) qs.set("connected", connected);
    if (error) qs.set("error", error);
    redirect(`/merchant/pages?${qs.toString()}`);
  }

  const settings = await getMerchantSettings();

  return (
    <div className="font-sans max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">الإعدادات</h1>
        <p className="text-slate-500 mt-1">
          إدارة الذكاء الاصطناعي العام وتفضيلات متجرك.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">الذكاء الاصطناعي</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 tabular-nums">
            المحادثات هذا الشهر: {settings.conversationsUsed} /{" "}
            {settings.conversationsLimit}
            {settings.conversationsUsed >= settings.conversationsLimit &&
              " — الباقة المجانية انتهت، لن يرد الـ AI على محادثات جديدة حتى الشهر القادم."}
          </p>
          <SettingToggle
            title="إيقاف الذكاء الاصطناعي على كل الصفحات"
            description="مفتاح رئيسي لكل الصفحات — عند الإيقاف لن يرد الذكاء الاصطناعي على أي صفحة متصلة، وستظهر للعملاء قائمة الاختيارات فقط."
            initialEnabled={settings.aiEnabled}
            onChange={updateAiEnabledAction}
          />
          <div className="pt-6 border-t border-slate-100">
            <SettingToggle
              title="التعلم المستمر"
              description="يتعلم الـ AI تلقائيًا من محادثاتك السابقة ويضيف أمثلة تدريب جديدة (تظهر في صفحة تدريب الـ AI)."
              initialEnabled={settings.autoLearningEnabled}
              onChange={updateAutoLearningAction}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">صفحات فيسبوك وإنستجرام</h2>
          <Link
            href="/merchant/pages"
            className="text-sm font-medium text-nile hover:underline"
          >
            الانتقال إلى صفحاتي ←
          </Link>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600">
            يمكنك ربط صفحات جديدة، أو إيقاف الذكاء الاصطناعي مؤقتًا على صفحة معينة، أو متابعة إحصائيات كل صفحة من قسم{" "}
            <Link
              href="/merchant/pages"
              className="font-semibold text-nile underline underline-offset-2"
            >
              صفحاتي
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
