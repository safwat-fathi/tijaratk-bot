#!/usr/bin/env python3
"""Seed realistic Egyptian restaurant menu items and operational store knowledge.

Targets merchant: 3304832b-08e6-4499-98fa-5a219d0f1daf (or configurable via CLI).
Includes 22 items across 5 categories with hybrid variants, high-quality images,
Arabic search aliases, and vector embeddings.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any, cast

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

from app.core.database import async_session_maker
from app.engine.embeddings import embed_text
from app.models import Merchant, Product, ProductVariant, StoreKnowledge
from app.models._ids import new_id
from app.models.enums import VariantStatus

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_MERCHANT_ID = "3304832b-08e6-4499-98fa-5a219d0f1daf"

# ---------------------------------------------------------------------------
# Restaurant Menu Items Definition (22 items across 5 categories)
# ---------------------------------------------------------------------------

RESTAURANT_MENU: list[dict[str, Any]] = [
    # ---------------- Category 1: المشويات ----------------
    {
        "name": "كفتة بلدي مشوية على الفحم",
        "category": "المشويات",
        "description": "كفتة لحم بلدي طازجة متبلة بالبهارات الشرقية والبصل ومشوية على الفحم، تقدم مع بقدونس وعيش بلدي وطحينة.",
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("110.00"),  # Base starting price (1/4 kg)
        "aliases": ["كفتة", "كفته", "كفتة مشوية", "كفتة بلدي", "kofta", "مشويات", "كفته لحمة"],
        "variants": [
            {
                "label": "ربع كيلو (1/4 كجم)",
                "sku": "KFT-250G",
                "price": Decimal("110.00"),
                "stock": 50,
                "attributes": {"portion": "250g", "unit": "ربع كيلو"},
            },
            {
                "label": "نصف كيلو (1/2 كجم)",
                "sku": "KFT-500G",
                "price": Decimal("210.00"),
                "stock": 40,
                "attributes": {"portion": "500g", "unit": "نصف كيلو"},
            },
            {
                "label": "كيلو كامل (1 كجم)",
                "sku": "KFT-1000G",
                "price": Decimal("400.00"),
                "stock": 25,
                "attributes": {"portion": "1000g", "unit": "كيلو"},
            },
        ],
    },
    {
        "name": "شيش طاووق متبل مشوي",
        "category": "المشويات",
        "description": "قطع صدور دجاج متبلة بخلطة الزبادي والليمون والأعشاب، مشوية مع الفلفل الألوان والبصل على الفحم.",
        "image_url": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("95.00"),
        "aliases": ["شيش", "طاووق", "شيش طاووق", "shish tawook", "فراخ مشوية", "شيش دجاج"],
        "variants": [
            {
                "label": "ربع كيلو (1/4 كجم)",
                "sku": "TAW-250G",
                "price": Decimal("95.00"),
                "stock": 50,
                "attributes": {"portion": "250g", "unit": "ربع كيلو"},
            },
            {
                "label": "نصف كيلو (1/2 كجم)",
                "sku": "TAW-500G",
                "price": Decimal("180.00"),
                "stock": 35,
                "attributes": {"portion": "500g", "unit": "نصف كيلو"},
            },
            {
                "label": "كيلو كامل (1 كجم)",
                "sku": "TAW-1000G",
                "price": Decimal("350.00"),
                "stock": 20,
                "attributes": {"portion": "1000g", "unit": "كيلو"},
            },
        ],
    },
    {
        "name": "كباب ضاني بلدي",
        "category": "المشويات",
        "description": "قطع لحم ضاني بلدي طري متبل بماء البصل والطماطم والبهارات الخاصة ومشوي بدقة على الفحم.",
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("160.00"),
        "aliases": ["كباب", "كباب ضاني", "كباب بلدي", "لحمة مشوية", "kebab", "لحم ضاني"],
        "variants": [
            {
                "label": "ربع كيلو (1/4 كجم)",
                "sku": "KBB-250G",
                "price": Decimal("160.00"),
                "stock": 30,
                "attributes": {"portion": "250g", "unit": "ربع كيلو"},
            },
            {
                "label": "نصف كيلو (1/2 كجم)",
                "sku": "KBB-500G",
                "price": Decimal("310.00"),
                "stock": 25,
                "attributes": {"portion": "500g", "unit": "نصف كيلو"},
            },
            {
                "label": "كيلو كامل (1 كجم)",
                "sku": "KBB-1000G",
                "price": Decimal("600.00"),
                "stock": 15,
                "attributes": {"portion": "1000g", "unit": "كيلو"},
            },
        ],
    },
    {
        "name": "طرب مشوي بالخلطة",
        "category": "المشويات",
        "description": "كفتة بلدي ملفوفة بمنديل الضاني المقرمش، مشوية على الفحم وتذوب في الفم، غنية بالنكهة الشرقية الأصيلة.",
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("130.00"),
        "aliases": ["طرب", "طرب مشوي", "طرب بلدي", "tarb", "منديل ضاني"],
        "variants": [
            {
                "label": "ربع كيلو (1/4 كجم)",
                "sku": "TRB-250G",
                "price": Decimal("130.00"),
                "stock": 35,
                "attributes": {"portion": "250g", "unit": "ربع كيلو"},
            },
            {
                "label": "نصف كيلو (1/2 كجم)",
                "sku": "TRB-500G",
                "price": Decimal("250.00"),
                "stock": 25,
                "attributes": {"portion": "500g", "unit": "نصف كيلو"},
            },
            {
                "label": "كيلو كامل (1 كجم)",
                "sku": "TRB-1000G",
                "price": Decimal("480.00"),
                "stock": 15,
                "attributes": {"portion": "1000g", "unit": "كيلو"},
            },
        ],
    },
    {
        "name": "فرخة كاملة مشوية على الفحم",
        "category": "المشويات",
        "description": "دجاجة طازجة متبلة بالبهارات الحارة والليمون ومشوية على الفحم، تقدم مع سلطة خضراء وطحينة وعيش.",
        "image_url": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("130.00"),
        "aliases": ["فرخة", "فراخ", "دجاج مشوي", "نصف فرخة", "فرخة مشوية", "chicken grill"],
        "variants": [
            {
                "label": "نصف فرخة مشوية",
                "sku": "CHK-HALF",
                "price": Decimal("130.00"),
                "stock": 40,
                "attributes": {"portion": "نصف فرخة"},
            },
            {
                "label": "فرخة كاملة مشوية",
                "sku": "CHK-FULL",
                "price": Decimal("240.00"),
                "stock": 30,
                "attributes": {"portion": "فرخة كاملة"},
            },
        ],
    },

    # ---------------- Category 2: الشاورما والساندوتشات ----------------
    {
        "name": "شاورما لحمة عربي",
        "category": "الشاورما والساندوتشات",
        "description": "شرائح لحم بقري متبلة مع بصل وبقدونس وطماطم وصوص طحينة، ملفوفة بخبز الصاج السوري المقرمش.",
        "image_url": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("65.00"),
        "aliases": ["شاورما لحمة", "شاورما", "ساندوتش شاورما", "shawarma meat", "شاورما سوري"],
        "variants": [
            {
                "label": "ساندوتش عادي (صغير)",
                "sku": "SHW-MT-SML",
                "price": Decimal("65.00"),
                "stock": 60,
                "attributes": {"size": "صغير"},
            },
            {
                "label": "ساندوتش صاروخ كبير",
                "sku": "SHW-MT-LRG",
                "price": Decimal("90.00"),
                "stock": 60,
                "attributes": {"size": "كبير صاروخ"},
            },
            {
                "label": "وجبة عربي (مع بطاطس وتومية)",
                "sku": "SHW-MT-MEAL",
                "price": Decimal("130.00"),
                "stock": 45,
                "attributes": {"meal": "وجبة عربي"},
            },
        ],
    },
    {
        "name": "شاورما دجاج متبلة",
        "category": "الشاورما والساندوتشات",
        "description": "شرائح دجاج متبلة بالثوم والليمون مع خيار مخلل وصوص تومية كريمي ملفوفة في خبز الصاج.",
        "image_url": "https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("55.00"),
        "aliases": ["شاورما فراخ", "شاورما دجاج", "ساندوتش شاورما فراخ", "shawarma chicken", "شاورما"],
        "variants": [
            {
                "label": "ساندوتش عادي (صغير)",
                "sku": "SHW-CH-SML",
                "price": Decimal("55.00"),
                "stock": 60,
                "attributes": {"size": "صغير"},
            },
            {
                "label": "ساندوتش صاروخ كبير",
                "sku": "SHW-CH-LRG",
                "price": Decimal("80.00"),
                "stock": 60,
                "attributes": {"size": "كبير صاروخ"},
            },
            {
                "label": "وجبة عربي (مع بطاطس وتومية)",
                "sku": "SHW-CH-MEAL",
                "price": Decimal("115.00"),
                "stock": 45,
                "attributes": {"meal": "وجبة عربي"},
            },
        ],
    },
    {
        "name": "حواوشي بلدي مخصوص",
        "category": "الشاورما والساندوتشات",
        "description": "لحم مفروم بلدي بتتبيلة الحواوشي والخلطة السرية والفلفل الحار داخل رغيف بلدي مقرمش ومستوي على الجريل.",
        "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("50.00"),
        "aliases": ["حواوشي", "حواوشي بلدي", "حواوشي لحمة", "hawawshi", "رغيف حواوشي"],
        "variants": [
            {
                "label": "حواوشي بلدي عادي",
                "sku": "HAW-REG",
                "price": Decimal("50.00"),
                "stock": 50,
                "attributes": {"type": "سادة"},
            },
            {
                "label": "حواوشي دبل جبنة موزاريلا",
                "sku": "HAW-CHEESE",
                "price": Decimal("70.00"),
                "stock": 40,
                "attributes": {"type": "بالموزاريلا"},
            },
        ],
    },
    {
        "name": "ساندوتش كبدة إسكندراني",
        "category": "الشاورما والساندوتشات",
        "description": "كبدة بتلو طازجة مقلية بالثوم والفلفل الحار والخل والليمون في عيش فينو طازج مع طحينة.",
        "image_url": "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("40.00"),
        "aliases": ["كبدة", "كبده", "كبدة اسكندراني", "ساندوتش كبدة", "alexandrian liver"],
        "variants": [],
    },
    {
        "name": "ساندوتش سجق شرقي بدبس الرمان",
        "category": "الشاورما والساندوتشات",
        "description": "سجق بلدي متبل مع صوص الطماطم والفلفل الألوان ودبس الرمان اللذيذ في عيش فينو مقرمش.",
        "image_url": "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("45.00"),
        "aliases": ["سجق", "سجق شرقي", "سجق بلدي", "ساندوتش سجق", "sausage"],
        "variants": [],
    },

    # ---------------- Category 3: الوجبات والفتة ----------------
    {
        "name": "فتة شاورما مشكل (لحمة ودجاج)",
        "category": "الوجبات والفتة",
        "description": "أرز بسمتي أصفر مبهر يعلوه ميكس شاورما لحمة ودجاج مع خبز مقلي مقرمش وصوص التومية الخاص وصوص أحمر.",
        "image_url": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("125.00"),
        "aliases": ["فتة", "فتة شاورما", "فتة ميكس", "فته شاورما", "shawarma fatteh"],
        "variants": [],
    },
    {
        "name": "طبق ميكس جريل ملوكي",
        "category": "الوجبات والفتة",
        "description": "تشكيلة مشويات فاخرة: سيخ كفتة، سيخ كباب، سيخ شيش طاووق، وقطعة طرب مع أرز بسمتي بالزعفران وبطاطس وطحينة.",
        "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("220.00"),
        "aliases": ["ميكس جريل", "طبق مشكل", "مشويات مشكلة", "وجبة ميكس", "mix grill"],
        "variants": [],
    },
    {
        "name": "وجبة نصف فرخة مع أرز وسلطات",
        "category": "الوجبات والفتة",
        "description": "نصف دجاجة مشوية على الفحم تقدم مع طبق أرز مصري بالشعرية وبطاطس محمرة وسلطة خضراء وطحينة وعيش.",
        "image_url": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("150.00"),
        "aliases": ["وجبة فرخة", "وجبة فراخ", "وجبة نص فرخة", "نصف فرخة مع رز", "chicken meal"],
        "variants": [],
    },

    # ---------------- Category 4: المقبلات والسلطات ----------------
    {
        "name": "طحينة بلدي بالكمون والليمون",
        "category": "المقبلات والسلطات",
        "description": "طحينة بيضاء خام مجهزة بزيت الزيتون والليمون والكمون والخل على الطريقة الأصلية.",
        "image_url": "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("15.00"),
        "aliases": ["طحينة", "طحينه", "سلطة طحينة", "tahini", "طحينة بلدي"],
        "variants": [],
    },
    {
        "name": "بابا غنوج مدخن",
        "category": "المقبلات والسلطات",
        "description": "باذنجان مشوي على الفحم ومهروس مع الطحينة والثوم وزيت الزيتون والليمون.",
        "image_url": "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("20.00"),
        "aliases": ["بابا غنوج", "باذنجان", "متبل", "baba ghanoush"],
        "variants": [],
    },
    {
        "name": "بطاطس محمرة كرسبي بالبهارات",
        "category": "المقبلات والسلطات",
        "description": "أصابع بطاطس ذهبية ومقرمشة مع رشة بهارات خاصة وصوص الكاتشب والمايونيز.",
        "image_url": "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("25.00"),
        "aliases": ["بطاطس", "بطاطس محمرة", "فرنش فرايز", "fries", "بطاطس مقلية"],
        "variants": [
            {
                "label": "حجم عادي",
                "sku": "FRS-REG",
                "price": Decimal("25.00"),
                "stock": 100,
                "attributes": {"size": "عادي"},
            },
            {
                "label": "حجم لارج كبير",
                "sku": "FRS-LRG",
                "price": Decimal("40.00"),
                "stock": 80,
                "attributes": {"size": "كبير"},
            },
        ],
    },
    {
        "name": "شوربة لسان عصفور سخنة",
        "category": "المقبلات والسلطات",
        "description": "شوربة لسان عصفور بمرقة الدجاج الغنية والليمون والبقدونس الطازج، طبق دافئ ومثالي.",
        "image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("25.00"),
        "aliases": ["شوربة", "لسان عصفور", "شوربه", "soup"],
        "variants": [],
    },
    {
        "name": "سمبوسك مشكل مقرمش (6 قطع)",
        "category": "المقبلات والسلطات",
        "description": "تشكيلة من السمبوسك المقرمش: 3 قطع محشوة جبنة كيري ونعناع، و3 قطع لحمة مفرومة متبلة.",
        "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("45.00"),
        "aliases": ["سمبوسك", "سمبوسة", "سمبوسك مشكل", "sambousek"],
        "variants": [],
    },
    {
        "name": "مخلل بلدي مشكل",
        "category": "المقبلات والسلطات",
        "description": "تشكيلة مخللات بلدية مقرمشة: لفت، جزر، خيار، فلفل حار، وزيتون مع خلطة الشطة.",
        "image_url": "https://images.unsplash.com/photo-1589135233689-d56d95342a32?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("10.00"),
        "aliases": ["مخلل", "طرشي", "مخلل بلدي", "pickles"],
        "variants": [],
    },

    # ---------------- Category 5: المشروبات والحلويات ----------------
    {
        "name": "مشروبات غازية كانز (330 مل)",
        "category": "المشروبات والحلويات",
        "description": "علبة كانز مثلجة منعشة، اختر الطعم المفضل لديك.",
        "image_url": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("20.00"),
        "aliases": ["بيبسي", "كولا", "سفن", "سفن اب", "ميرندا", "حاجة ساقعة", "canz", "pepsi"],
        "variants": [
            {
                "label": "بيبسي (Pepsi)",
                "sku": "DRK-PEP",
                "price": Decimal("20.00"),
                "stock": 100,
                "attributes": {"flavor": "Pepsi"},
            },
            {
                "label": "سفن أب (7Up)",
                "sku": "DRK-7UP",
                "price": Decimal("20.00"),
                "stock": 100,
                "attributes": {"flavor": "7Up"},
            },
            {
                "label": "ميرندا برتقال (Mirinda)",
                "sku": "DRK-MIR",
                "price": Decimal("20.00"),
                "stock": 80,
                "attributes": {"flavor": "Mirinda Orange"},
            },
        ],
    },
    {
        "name": "عصير مانجو فريش طبيعي",
        "category": "المشروبات والحلويات",
        "description": "عصير مانجو طبيعي 100% غني ومركز بدون مواد حافظة يقدم مثلجاً ومنعشاً.",
        "image_url": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("35.00"),
        "aliases": ["عصير مانجو", "مانجا", "عصير مانجا", "mango juice", "عصير فريش"],
        "variants": [],
    },
    {
        "name": "عصير ليمون بالنعناع فريش",
        "category": "المشروبات والحلويات",
        "description": "عصير ليمون طازج مضروب مع أوراق النعناع الأخضر المنعش والثلج المجروش.",
        "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("30.00"),
        "aliases": ["ليمون نعناع", "عصير ليمون", "lemon mint", "ليمون بالنعناع"],
        "variants": [],
    },
    {
        "name": "طاجن أم علي بالمكسرات والقشطة",
        "category": "المشروبات والحلويات",
        "description": "رقائق الميلفيه الهشة بالحليب الساخن المكرمل والقشطة البلدي الغنية ومغطاة بالمكسرات المحمصة والزبيب.",
        "image_url": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("45.00"),
        "aliases": ["ام علي", "أم علي", "طاجن ام علي", "حلويات", "om ali"],
        "variants": [],
    },
    {
        "name": "أرز باللبن والمكسرات الفاخرة",
        "category": "المشروبات والحلويات",
        "description": "أرز باللبن كريمي بالقشطة الطبيعية مع الفستق واللوز والزبيب وعسل النحل.",
        "image_url": "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
        "price": Decimal("30.00"),
        "aliases": ["رز بلبن", "أرز باللبن", "رز باللبن", "rice pudding"],
        "variants": [],
    },
]

# ---------------------------------------------------------------------------
# Restaurant Operational Store Knowledge Entries
# ---------------------------------------------------------------------------

RESTAURANT_KNOWLEDGE = [
    {
        "knowledge_type": "operating_hours",
        "title": "مواعيد العمل وخدمة التوصيل",
        "content": (
            "المطعم مفتوح يومياً لاستقبال الطلبات والصالة من الساعة 12:00 ظهراً حتى الساعة 02:00 بعد منتصف الليل. "
            "خدمة توصيل الطلبات للمنازل (الدليفري) مستمرة يومياً حتى الساعة 03:00 فجراً طوال أيام الأسبوع بما فيها العطلات."
        ),
        "keywords": ["مواعيد", "ميعاد", "ساعات العمل", "فاتحين", "شغالين لحد امتى", "التوصيل شغال", "hours", "open"],
    },
    {
        "knowledge_type": "delivery_info",
        "title": "مناطق التوصيل والرسوم والمدة",
        "content": (
            "نوصل لجميع مناطق وضواحي القاهرة والجيزة. "
            "متوسط وقت التوصيل يتراوح بين 30 إلى 45 دقيقة من تأكيد الطلب. "
            "رسوم التوصيل: 25 جنيهاً للمناطق القريبة داخل النطاق، و35 جنيهاً للمناطق الأبعد. "
            "يصلك الأكل ساخناً ومغلفاً بأحدث وسائل التغليف الحراري للحفاظ على الجودة والنكهة."
        ),
        "keywords": ["توصيل", "دليفري", "مناطق التوصيل", "مصاريف الشحن", "سعر الدليفري", "بتوصلوا فين", "الوقت", "delivery"],
    },
    {
        "knowledge_type": "payment_methods",
        "title": "طرق الدفع المتاحة",
        "content": (
            "نوفر عدة خيارات دفع مريحة وآمنة: "
            "1. الدفع كاش نقدياً عند استلام الطلب من مندوب التوصيل. "
            "2. الدفع عبر تحويل انستاباي (InstaPay) لحظياً. "
            "3. الدفع بالبطاقات البنكية والفيزا والماستركارد عبر ماكينة POS المحمولة مع المندوب (يرجى إبلاغنا مسبقاً)."
        ),
        "keywords": ["طرق الدفع", "دفع", "كاش", "فيزا", "انستاباي", "instapay", "بطاقة", "payment"],
    },
    {
        "knowledge_type": "order_policy",
        "title": "الحد الأدنى للطلب وسياسة التعديل",
        "content": (
            "الحد الأدنى لقيمة الطلب هو 75 جنيهاً داخل نطاق التوصيل الأساسي. "
            "يمكن تعديل الطلب أو إضافة أصناف خلال أول 5 دقائق من تأكيده بالتواصل معنا مباشرة قبل بدء التجهيز في المطبخ."
        ),
        "keywords": ["حد ادنى", "اقل اوردر", "تعديل الطلب", "الاوردر", "minimum order", "policy"],
    },
    {
        "knowledge_type": "contact_info",
        "title": "خدمة العملاء وأرقام التواصل والشكاوى",
        "content": (
            "فريق خدمة العملاء جاهز لخدمتكم ومتابعة طلباتكم على مدار الساعة عبر هذه المحادثة أو الاتصال بالخط الساخن. "
            "في حال وجود أي ملاحظة على جودة الطعام أو تأخير التوصيل، نهتم بإرضائكم فوراً وتبديل الطلب إذا لزم الأمر."
        ),
        "keywords": ["خدمة العملاء", "رقم التليفون", "تواصل", "شكوى", "مساعدة", "contact", "support"],
    },
]


# ---------------------------------------------------------------------------
# Seeding Logic
# ---------------------------------------------------------------------------

async def seed_restaurant(merchant_id: str, clear_existing: bool = False) -> None:
    async with async_session_maker() as session:
        # 1. Verify merchant exists
        merchant = await session.get(Merchant, merchant_id)
        if not merchant:
            logger.error(f"Merchant with ID '{merchant_id}' not found! Aborting.")
            sys.exit(1)

        logger.info(f"Seeding restaurant menu for merchant: {merchant.name} (ID: {merchant.id})")

        # 2. Clear existing items if requested
        if clear_existing:
            logger.info("Flag --clear supplied. Cleaning existing products, variants, and store knowledge...")
            existing_products = (
                await session.execute(select(Product).where(Product.merchant_id == merchant_id))
            ).scalars().all()

            for p in existing_products:
                await session.delete(p)

            await session.execute(
                delete(StoreKnowledge).where(StoreKnowledge.merchant_id == merchant_id)
            )
            await session.flush()
            logger.info(f"Cleared {len(existing_products)} old products and store knowledge entries.")

        # 3. Seed Menu Products and Variants
        logger.info(f"Starting creation of {len(RESTAURANT_MENU)} restaurant menu items...")
        created_products = 0
        created_variants = 0

        for item_data in RESTAURANT_MENU:
            # Check if product with same name already exists
            stmt = select(Product).where(
                Product.merchant_id == merchant_id,
                Product.name == item_data["name"],
            )
            existing = (await session.execute(stmt)).scalars().first()

            if existing:
                logger.info(f"Product '{item_data['name']}' already exists. Updating...")
                product = existing
                product.category = item_data["category"]
                product.description = item_data["description"]
                product.image_url = item_data["image_url"]
                product.price = item_data["price"]
                product.aliases = cast(list[str], item_data["aliases"])
            else:
                product = Product(
                    id=new_id(),
                    merchant_id=merchant_id,
                    name=item_data["name"],
                    category=item_data["category"],
                    description=item_data["description"],
                    image_url=item_data["image_url"],
                    price=item_data["price"],
                    aliases=cast(list[str], item_data["aliases"]),
                )
                session.add(product)
                created_products += 1

            # Generate embedding
            embed_input = f"{product.name} " + " ".join(cast(list[str], product.aliases))
            try:
                logger.info(f"Generating vector embedding for '{product.name}'...")
                product.embedding = await embed_text(embed_input)
            except Exception as exc:
                logger.warning(f"Could not generate embedding for '{product.name}': {exc}. Leaving embedding None.")
                product.embedding = None

            await session.flush()

            # Process variants
            variant_specs = item_data.get("variants", [])
            if variant_specs and not existing:
                for v_spec in variant_specs:
                    variant = ProductVariant(
                        id=new_id(),
                        product_id=product.id,
                        label=v_spec["label"],
                        sku=v_spec.get("sku"),
                        price=v_spec.get("price", product.price),
                        stock=v_spec.get("stock", 50),
                        status=VariantStatus.ACTIVE,
                        attributes=v_spec.get("attributes", {}),
                    )
                    session.add(variant)
                    created_variants += 1

        await session.flush()

        # 4. Seed Store Knowledge
        logger.info(f"Seeding {len(RESTAURANT_KNOWLEDGE)} operational store knowledge entries...")
        created_knowledge = 0
        for k_data in RESTAURANT_KNOWLEDGE:
            stmt = select(StoreKnowledge).where(
                StoreKnowledge.merchant_id == merchant_id,
                StoreKnowledge.knowledge_type == k_data["knowledge_type"],
            )
            existing_k = (await session.execute(stmt)).scalars().first()

            if existing_k:
                existing_k.title = str(k_data["title"])
                existing_k.content = str(k_data["content"])
                existing_k.keywords = cast(list[str], k_data["keywords"])
            else:
                sk = StoreKnowledge(
                    id=new_id(),
                    merchant_id=merchant_id,
                    knowledge_type=str(k_data["knowledge_type"]),
                    title=str(k_data["title"]),
                    content=str(k_data["content"]),
                    keywords=cast(list[str], k_data["keywords"]),
                )
                session.add(sk)
                created_knowledge += 1

        await session.commit()
        logger.info("=" * 60)
        logger.info("Restaurant menu seeding completed successfully! 🎉")
        logger.info(f"Merchant: {merchant.name} ({merchant.id})")
        logger.info(f"Products created/updated: {len(RESTAURANT_MENU)}")
        logger.info(f"Variants created: {created_variants}")
        logger.info(f"Store Knowledge entries: {len(RESTAURANT_KNOWLEDGE)}")
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Seed realistic Egyptian restaurant menu items and store knowledge.")
    parser.add_argument(
        "--merchant-id",
        type=str,
        default=DEFAULT_MERCHANT_ID,
        help=f"Target merchant ID (default: {DEFAULT_MERCHANT_ID})",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing products and store knowledge for the merchant before seeding",
    )

    args = parser.parse_args()
    asyncio.run(seed_restaurant(merchant_id=args.merchant_id, clear_existing=args.clear))


if __name__ == "__main__":
    main()
