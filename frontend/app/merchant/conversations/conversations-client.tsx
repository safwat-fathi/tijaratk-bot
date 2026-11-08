"use client";

import { useState } from "react";
import { MessageComposer } from "@/components/merchant/message-composer";
import { returnToAiAction, takeoverConversationAction, type ConversationRecord } from "@/app/merchant/actions";

export function ConversationsClient({ 
  merchantId, 
  conversations 
}: { 
  merchantId: string;
  conversations: ConversationRecord[];
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  );

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const [isTakeover, setIsTakeover] = useState(selectedConversation?.is_human_takeover ?? false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);

  // When selected conversation changes, update the takeover state
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setIsTakeover(conv.is_human_takeover);
    }
  };

  const handleToggleTakeover = async () => {
    if (!selectedConversationId) return;
    setTakeoverLoading(true);
    try {
      if (isTakeover) {
        await returnToAiAction(selectedConversationId, "Returned to AI by merchant in UI", merchantId);
        setIsTakeover(false);
      } else {
        await takeoverConversationAction(selectedConversationId, "MERCHANT_TAKEOVER", "Takeover via Merchant UI", merchantId);
        setIsTakeover(true);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت عملية نقل المحادثة");
    } finally {
      setTakeoverLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString('ar-EG');
  };

  return (
    <div className="font-sans h-[calc(100vh-8rem)] flex gap-6">
      {/* Sidebar: Conversation List */}
      <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-slate-200 shrink-0 bg-slate-50 sticky top-0">
          <h2 className="font-bold text-slate-800">المحادثات ({conversations.length})</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm text-center">لا توجد محادثات.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-start p-4 hover:bg-slate-50 transition-colors ${
                      selectedConversationId === conv.id ? "bg-blue-50 hover:bg-blue-50 border-r-4 border-blue-500 pr-3" : "pr-4"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800 text-sm">{conv.customer_ref}</span>
                      <span className="text-xs text-slate-400">
                        {formatDate(conv.updated_at || conv.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {conv.channel}
                      </span>
                      {conv.is_human_takeover && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          تدخل بشري
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Area: Chat Window */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">المحادثات</h1>
            <p className="text-slate-500 mt-1">إدارة المحادثات وتدخل الذكاء الاصطناعي.</p>
          </div>
          <button
            onClick={handleToggleTakeover}
            disabled={takeoverLoading || !selectedConversationId}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 ${
              isTakeover
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-white"
            }`}
          >
            {takeoverLoading ? (
              "جاري التحديث..."
            ) : isTakeover ? (
              <>
                <span>🤖</span> العودة للذكاء الاصطناعي
              </>
            ) : (
              <>
                <span>👤</span> تولي المحادثة
              </>
            )}
          </button>
        </div>
        
        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {selectedConversationId ? (
            <MessageComposer
              conversationId={selectedConversationId}
              isTakeover={isTakeover}
              onStateChange={() => {}}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              اختر محادثة لعرض الرسائل.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
