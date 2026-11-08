"use client";

import { useMerchantData } from "@/lib/use-merchant-data";
import { StoreKnowledgeView } from "@/components/merchant/store-knowledge-view";
import { fetchKnowledgeAction } from "@/app/merchant/actions";
import type { StoreKnowledge } from "@/lib/knowledge";

export function PoliciesClient({
  merchantId,
  initialKnowledge,
}: {
  merchantId: string;
  initialKnowledge: StoreKnowledge[];
}) {
  const { data: knowledge, refresh } = useMerchantData<StoreKnowledge[]>(fetchKnowledgeAction, merchantId, initialKnowledge);

  return (
    <div className="font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">السياسات</h1>
        <p className="text-slate-500 mt-1">
          أضف سياسات وتعليمات المتجر (الشحن، الاسترجاع، قواعد الأسعار، أسلوب الرد). يعتمد الذكاء الاصطناعي على جميع السياسات المضافة هنا في كل رد على العملاء.
        </p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <StoreKnowledgeView
          knowledge={knowledge}
          merchantId={merchantId}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
