"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { fetchMessagesAction, sendManualReplyAction } from "@/app/merchant/actions";

export function MessageComposer({
  conversationId,
  isTakeover = false,
  pageDisconnected = false,
  onStateChange,
}: {
  conversationId: string;
  isTakeover?: boolean;
  pageDisconnected?: boolean;
  onStateChange?: (state: { status: string }) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<
    { id: string; text: string; role: "user" | "ai" | "agent" }[]
  >([]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const rows = await fetchMessagesAction(conversationId);
      setMessages(
        rows.map((r) => ({
          id: r.id,
          text: r.raw_text ?? "",
          role: r.direction === "INBOUND" ? "user" : "ai",
        })),
      );
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 5000); // ponytail: polling, switch to SSE/websocket if load matters
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    onStateChange?.({ status: "idle" });
  }, [onStateChange]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pageDisconnected) return;
    const formData = new FormData(e.currentTarget);
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;

    if (formRef.current) {
      formRef.current.reset();
    }

    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `agent-${Date.now()}`, text, role: "agent" },
    ]);

    try {
      await sendManualReplyAction(conversationId, text, undefined);
      onStateChange?.({ status: "success" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل إرسال الرد");
      onStateChange?.({ status: "error" });
    } finally {
      await load(); // drop the optimistic bubble if the send failed
      setSending(false);
    }
  };

  const canReply = isTakeover && !pageDisconnected;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-[#efeae2] shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
            👤
          </div>
          <div>
            <h2 className="font-semibold">محادثة عميل</h2>
            <p className="text-xs text-white/80">المعرف: {conversationId.slice(0, 8)}</p>
          </div>
        </div>

        {/* Takeover / Disconnected Indicator */}
        {pageDisconnected ? (
          <span className="rounded-full bg-slate-400/25 border border-slate-300/40 px-2.5 py-1 text-xs font-semibold text-white flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            الصفحة مفصولة
          </span>
        ) : isTakeover ? (
          <span className="rounded-full bg-amber-400/20 border border-amber-300/40 px-2.5 py-1 text-xs font-semibold text-amber-200 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            التدخل نشط
          </span>
        ) : (
          <span className="rounded-full bg-emerald-400/20 border border-emerald-300/40 px-2.5 py-1 text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            الذكاء الاصطناعي يرد
          </span>
        )}
      </div>

      {/* Disconnected notice bar */}
      {pageDisconnected && (
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between text-xs text-slate-800">
          <span className="font-medium">
            الصفحة مفصولة — لا يمكن إرسال ردود جديدة حتى تعيد ربط الصفحة من «صفحاتي».
          </span>
        </div>
      )}

      {/* Takeover notice bar */}
      {!pageDisconnected && isTakeover && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
          <span className="font-medium">
            تم إيقاف الذكاء الاصطناعي لهذه المحادثة. يمكنك الآن إرسال ردود مباشرة للعميل.
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
        style={{ minHeight: "300px" }}
      >
        <div className="mx-auto mb-4 w-fit rounded-lg bg-[#e1f5fe] px-3 py-1 text-xs text-gray-600 shadow-sm">
          بداية المحادثة
        </div>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
              msg.role === "user"
                ? "self-end bg-[#dcf8c6] text-gray-900"
                : msg.role === "agent"
                ? "self-start bg-blue-50 border border-blue-200 text-blue-950 font-medium"
                : "self-start bg-white text-gray-900"
            }`}
          >
            {msg.role === "agent" && (
              <p className="text-[10px] text-blue-600 uppercase font-semibold mb-0.5">رد خدمة العملاء</p>
            )}
            {msg.text}
          </div>
        ))}
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 p-3 ${
          canReply ? "bg-blue-100/70 border-t border-blue-200" : "bg-[#f0f0f0]"
        }`}
      >
        <textarea
          name="text"
          required
          rows={1}
          placeholder={
            pageDisconnected
              ? "الصفحة مفصولة — أعد ربطها للرد على العميل"
              : isTakeover
                ? "اكتب ردك لإرساله للعميل..."
                : "فعّل تولي المحادثة أولاً لتتمكن من إرسال رد يدوي"
          }
          disabled={!canReply}
          className="max-h-32 min-h-12 flex-1 resize-none rounded-full border-none bg-white px-4 py-3 text-sm focus:outline-none focus:ring-0 shadow-xs disabled:bg-gray-100 disabled:text-gray-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !canReply}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          title="إرسال الرد"
        >
          {sending ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg
              className="h-5 w-5 rotate-90 rtl:-rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>
    </section>
  );
}
