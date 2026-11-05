import { loginWithKeyAction } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "المفتاح غير صحيح. تأكد من نسخه كاملاً.",
  unavailable: "الخدمة غير متاحة حالياً، حاول بعد قليل.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans" dir="rtl">
      <form
        action={loginWithKeyAction}
        className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4"
      >
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-2xl">T</div>
        <h1 className="text-2xl font-bold text-slate-900">دخول التاجر</h1>
        <p className="text-slate-500">أدخل مفتاح API الخاص بمتجرك للدخول إلى لوحة التحكم.</p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {ERRORS[error] ?? ERRORS.invalid}
          </div>
        )}

        <input
          name="api_key"
          type="password"
          required
          autoComplete="off"
          dir="ltr"
          placeholder="tk_..."
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          دخول
        </button>
      </form>
    </div>
  );
}
