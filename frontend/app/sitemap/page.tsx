import Link from "next/link";
import { Nav } from "@/components/landing/nav";
import { FinalCTA } from "@/components/landing/final-cta";
import { BLOG_POSTS } from "@/lib/content/blog-content";

export const metadata = {
  title: "خريطة الموقع (Sitemap) | تِجارتك بوت",
  description:
    "دليل وخريطة كاملة لكافة صفحات وأقسام منصة تِجارتك بوت، والأسعار، والمميزات، والمقالات المتاحة على الموقع.",
  alternates: {
    canonical: "https://tijaratk.com/sitemap",
  },
};

export default function HtmlSitemapPage() {
  const sections = [
    {
      title: "الصفحات الرئيسية والتعريفية",
      links: [
        { href: "/", label: "الصفحة الرئيسية (Home)", desc: "عرض مختصر لمنصة التجارة الذكية" },
        { href: "/how-it-works", label: "كيف يعمل النظام؟ (How it works)", desc: "الرحلة التشغيلية في 5 خطوات ذكية" },
        { href: "/features", label: "المميزات والإمكانيات (Features)", desc: "محرك العامية، السلة التفاعلية، وتفريغ العناوين" },
        { href: "/pricing", label: "الباقات والأسعار (Pricing)", desc: "خطط الاشتراك وشروط الاستخدام العادل للذكاء الاصطناعي" },
        { href: "/faq", label: "الأسئلة الشائعة (FAQ)", desc: "إجابات مفصلة لكافة استفسارات التجار والشحن والدفع" },
      ],
    },
    {
      title: "المدونة والمقالات التحليلية",
      links: [
        { href: "/blog", label: "فهرس المدونة (Blog Hub)", desc: "أحدث المقالات والاستراتيجيات للتجارة عبر الشات" },
        ...BLOG_POSTS.map((post) => ({
          href: `/blog/${post.slug}`,
          label: post.title.ar,
          desc: `${post.category.ar} • ${post.readTime.ar}`,
        })),
      ],
    },
    {
      title: "وكلاء الذكاء الاصطناعي وروابط الماركداون (AI Crawler Endpoints)",
      links: [
        { href: "/llms.txt", label: "ملف التوجيه الذكي (llms.txt)", desc: "دليل الوكلاء ونماذج الذكاء الاصطناعي" },
        { href: "/llms-full.txt", label: "المستند التوثيقي الكامل (llms-full.txt)", desc: "المرجع النصي الموحد لجميع صفحات الموقع" },
        { href: "/pricing.md", label: "ماركداون الأسعار (/pricing.md)", desc: "نسخة خالية من التنسيق للباقات وشروط الاستخدام" },
        { href: "/faq.md", label: "ماركداون الأسئلة الشائعة (/faq.md)", desc: "إجابات منظمة ومبوبة للمحركات" },
        { href: "/how-it-works.md", label: "ماركداون كيف يعمل (/how-it-works.md)", desc: "خطوات تشغيل المنصة في صيغة Markdown" },
        { href: "/features.md", label: "ماركداون المميزات (/features.md)", desc: "قائمة الإمكانيات الكاملة للوكلاء" },
        { href: "/blog.md", label: "ماركداون المدونة (/blog.md)", desc: "فهرس المقالات بصيغة Markdown" },
      ],
    },
    {
      title: "التجربة ولوحة التحكم",
      links: [
        { href: "/demo", label: "العرض التوضيحي (Interactive Demo)", desc: "محاكاة محادثة عميل حقيقية مع محرك الذكاء الاصطناعي" },
        { href: "/merchant", label: "لوحة التحكم (Merchant Dashboard)", desc: "إدارة المنتجات والطلبات والمحادثات" },
      ],
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "الرئيسية",
          item: "https://tijaratk.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "خريطة الموقع",
          item: "https://tijaratk.com/sitemap",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#fafbfc] text-gray-900 selection:bg-emerald-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />

      <section className="relative overflow-hidden border-b border-gray-200 bg-white px-5 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            خريطة الموقع الشاملة
          </span>
          <h1 className="font-display mt-3 text-3xl sm:text-5xl font-black text-gray-950">
            فهرس جميع صفحات تِجارتك بوت
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-600">
            تصفح سريع لكافة الروابط، والمقالات، ومصادر الذكاء الاصطناعي في مكان واحد.
          </p>
          <div className="mt-4 text-xs text-gray-400">
            ملف XML الخاص بمحركات البحث متاح على:{" "}
            <a href="/sitemap.xml" className="text-emerald-700 underline font-mono">
              /sitemap.xml
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl flex flex-col gap-10">
          {sections.map((sec, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm"
            >
              <h2 className="font-display text-xl font-black text-gray-950 mb-5 border-b border-gray-100 pb-3">
                {sec.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {sec.links.map((link, lIdx) => (
                  <Link
                    key={lIdx}
                    href={link.href}
                    className="group flex flex-col rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50/30"
                  >
                    <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                      {link.label}
                    </span>
                    <span className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {link.desc}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <FinalCTA />
    </main>
  );
}
