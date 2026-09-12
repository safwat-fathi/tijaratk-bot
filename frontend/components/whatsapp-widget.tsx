"use client";

import * as m from "@/paraglide/messages";

export function WhatsAppWidget() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return null;

  const waUrl = `https://wa.me/${number.replace(/[^0-9]/g, "")}`;

  return (
    <div className="fixed bottom-6 end-6 z-50 flex items-center justify-center">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center justify-center p-3 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition-all duration-300"
        aria-label={m.whatsapp_widget_tooltip()}
      >
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
          <path d="M12.031 0C5.395 0 0 5.395 0 12.031c0 2.126.554 4.195 1.606 6.012L.151 23.364l5.485-1.439A11.968 11.968 0 0012.031 24c6.634 0 12.029-5.395 12.029-12.031C24.06 5.395 18.665 0 12.031 0zm0 22.012a9.92 9.92 0 01-5.076-1.39l-.364-.216-3.766.988 1.006-3.67-.236-.376A9.919 9.919 0 012.052 12.03c0-5.503 4.478-9.98 9.979-9.98 5.503 0 9.98 4.477 9.98 9.98 0 5.502-4.477 9.98-9.98 9.98zm5.474-7.464c-.301-.151-1.777-.878-2.052-.979-.275-.101-.476-.151-.676.151-.201.301-.777.979-.953 1.18-.176.201-.352.226-.653.076a8.214 8.214 0 01-2.42-1.493 9.07 9.07 0 01-1.677-2.083c-.176-.301-.019-.464.132-.614.135-.135.301-.352.451-.527.151-.176.201-.301.301-.502.101-.201.05-.376-.025-.527-.075-.151-.676-1.63-.927-2.233-.243-.586-.49-.506-.676-.515-.176-.008-.376-.008-.577-.008-.201 0-.527.075-.802.376-.275.301-1.053 1.029-1.053 2.51 0 1.481 1.078 2.912 1.228 3.113.151.201 2.124 3.242 5.143 4.545.719.31 1.279.495 1.716.634.721.23 1.378.197 1.895.12.576-.085 1.777-.728 2.028-1.432.251-.703.251-1.305.176-1.431-.075-.126-.275-.201-.576-.352z"/>
        </svg>

        <span className="absolute top-1/2 -translate-y-1/2 end-[120%] px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-md">
          {m.whatsapp_widget_tooltip()}
        </span>
      </a>
    </div>
  );
}
