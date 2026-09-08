import asyncio

from sqlalchemy import delete

from app.core.database import async_session_maker
from app.models import StoreKnowledge
from app.models._ids import new_id

TARGET_MERCHANT_ID = "af66a415-9846-4aab-95d0-d4213e73f7aa"

STORE_KNOWLEDGE = [
    {
        "knowledge_type": "shipping",
        "title": "مناطق ورسوم التوصيل",
        "content": (
            "نقوم بالتوصيل لجميع محافظات جمهورية مصر العربية. تختلف رسوم الشحن بناءً على المحافظة "
            "وسيتم إبلاغك بها عند تأكيد الطلب. شحن مجاني للطلبات الأكثر من 2000 جنيه."
        ),
        "keywords": ["شحن", "توصيل", "مناطق", "رسوم", "مصاريف", "محافظات", "shipping", "delivery"],
    },
    {
        "knowledge_type": "shipping",
        "title": "سياسات ومواعيد الشحن",
        "content": (
            "يتم شحن الطلبات خلال 24 ساعة من تأكيد الطلب. يستغرق التوصيل من 2 إلى 4 أيام عمل حسب المحافظة وشركة الشحن."
        ),
        "keywords": ["وقت التوصيل", "متى يوصل", "أيام", "مدة الشحن"],
    },
    {
        "knowledge_type": "returns",
        "title": "سياسة الإرجاع",
        "content": (
            "يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن تكون في حالتها الأصلية "
            "وبدون أي استخدام مع وجود التيكيت والغلاف الأصلي. يتم خصم رسوم الشحن من المبلغ المسترد."
        ),
        "keywords": ["إرجاع", "استرجاع", "رجع", "ترجيع", "return"],
    },
    {
        "knowledge_type": "returns",
        "title": "شروط الاسترداد",
        "content": (
            "يتم استرداد المبلغ بنفس طريقة الدفع التي تم استخدامها، أو من خلال تحويل بنكي / محفظة إلكترونية "
            "خلال 5 إلى 7 أيام عمل بعد استلامنا للمرتجع وفحصه."
        ),
        "keywords": ["استرداد", "فلوسي", "المبلغ", "رد", "refund"],
    },
    {
        "knowledge_type": "payment",
        "title": "طرق الدفع المقبولة",
        "content": (
            "نقبل الدفع نقداً عند الاستلام، والتحويل البنكي، والبطاقات الائتمانية عبر الموقع، "
            "والمحافظ الإلكترونية مثل إنستاباي وفودافون كاش."
        ),
        "keywords": ["دفع", "كاش", "فيزا", "انستاباي", "فودافون", "طرق الدفع", "payment"],
    },
    {
        "knowledge_type": "general",
        "title": "ساعات العمل وتوافر الدعم",
        "content": (
            "فريق خدمة العملاء متاح للرد على استفساراتكم من السبت إلى الخميس، من الساعة 10 صباحاً "
            "وحتى 10 مساءً. متجرنا الإلكتروني متاح للطلبات على مدار 24 ساعة."
        ),
        "keywords": ["مواعيد العمل", "دعم", "خدمة العملاء", "متى تفتحون", "أوقات"],
    },
    {
        "knowledge_type": "faq",
        "title": "الأسئلة الشائعة (FAQ)",
        "content": (
            "هل يتوفر لديكم تغليف هدايا؟ نعم، يتوفر تغليف الهدايا برسوم إضافية بسيطة.\n"
            "هل المنتجات أصلية؟ نعم، جميع منتجاتنا أصلية 100% ومضمونة.\n"
            "هل يمكنني تعديل الطلب بعد تأكيده؟ نعم، يمكنك التعديل قبل شحن الطلب بالتواصل مع خدمة العملاء."
        ),
        "keywords": ["سؤال", "استفسار", "هدايا", "أصلية", "تعديل الطلب", "faq"],
    },
]


async def seed_knowledge():
    async with async_session_maker() as session:
        # We will not delete the merchant itself, just replacing the knowledge
        # Delete existing knowledge for this merchant to avoid duplicates
        await session.execute(delete(StoreKnowledge).where(StoreKnowledge.merchant_id == TARGET_MERCHANT_ID))

        for spec in STORE_KNOWLEDGE:
            session.add(
                StoreKnowledge(
                    id=new_id(),
                    merchant_id=TARGET_MERCHANT_ID,
                    knowledge_type=spec["knowledge_type"],
                    title=spec["title"],
                    content=spec["content"],
                    keywords=spec["keywords"],
                )
            )

        await session.commit()

        print("\n" + "=" * 50)
        print("✅ Store Knowledge Added Successfully!")
        print("=" * 50)
        print(f"Merchant ID : {TARGET_MERCHANT_ID}")
        print(f"Added {len(STORE_KNOWLEDGE)} store knowledge entries.")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    asyncio.run(seed_knowledge())
