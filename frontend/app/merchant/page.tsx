import Link from "next/link";
import { Store, MessageSquare, Package, BookOpen } from "lucide-react";
import { getCurrentMerchant } from "@/lib/dal";
import {
  fetchProductsAction,
  fetchKnowledgeAction,
  fetchConversationsAction,
  getPages,
} from "@/app/merchant/actions";

export default async function MerchantDashboard() {
  const { merchantId, merchantName, channels } = await getCurrentMerchant();

  const [products, policies, conversations, pagesData] = await Promise.all([
    fetchProductsAction(merchantId).catch(() => []),
    fetchKnowledgeAction(merchantId).catch(() => []),
    fetchConversationsAction(merchantId).catch(() => []),
    getPages("7d").catch(() => null),
  ]);

  const totalPages = pagesData ? pagesData.pages.length : channels.length;
  const livePages = pagesData
    ? pagesData.pages.filter((p) => p.ai_state === "on").length
    : channels.length;

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          مرحباً بعودتك، {merchantName}
        </h1>
        <p className="text-slate-500 mt-1">إليك نظرة عامة على متجرك.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">المنتجات</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {products.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">السياسات</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {policies.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">المحادثات</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {conversations.length}
            </p>
          </div>
        </div>

        <Link
          href="/merchant/pages"
          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-nile transition-colors"
        >
          <div className="w-12 h-12 bg-nile-wash text-nile rounded-lg flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              الصفحات الشغّالة
            </p>
            <p className="text-2xl font-bold text-slate-900 font-display tabular-nums">
              {livePages} من {totalPages}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
