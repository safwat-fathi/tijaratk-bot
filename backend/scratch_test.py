import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.engine.product_matching import (
    VariantCandidate,
    match_line_items_to_products,
    match_variant_hint,
)
from app.engine.schemas import ExtractedLineItem
from app.models import Product, ProductVariant


async def main():
    engine = create_async_engine(settings.sqlalchemy_database_uri)
    async with AsyncSession(engine) as session:
        merchant_id = 'af66a415-9846-4aab-95d0-d4213e73f7aa'

        items1 = [ExtractedLineItem(product_name="جاكيت أزرق", quantity=2, variant_hint="مقاس L", price=None)]
        matched1 = await match_line_items_to_products(session, merchant_id, items1)
        print("Product matched for 'جاكيت أزرق':", matched1[0].product_id)
        if matched1[0].product_id:
            variants = (await session.execute(
                select(ProductVariant)
                .where(ProductVariant.product_id == matched1[0].product_id)
            )).scalars().all()
            candidates = [VariantCandidate(id=v.id, label=v.label, attributes=v.attributes) for v in variants]
            print("  Variant match for 'مقاس L':", match_variant_hint("مقاس L", candidates))

        items2 = [ExtractedLineItem(product_name="جاكيت ازرق", quantity=2, variant_hint="مقاس L", price=None)]
        matched2 = await match_line_items_to_products(session, merchant_id, items2)
        print("Product matched for 'جاكيت ازرق':", matched2[0].product_id)
        if matched2[0].product_id:
            variants = (await session.execute(
                select(ProductVariant)
                .where(ProductVariant.product_id == matched2[0].product_id)
            )).scalars().all()
            candidates = [VariantCandidate(id=v.id, label=v.label, attributes=v.attributes) for v in variants]
            print("  Variant match for 'مقاس L':", match_variant_hint("مقاس L", candidates))

        items3 = [ExtractedLineItem(product_name="جاكت", quantity=2, variant_hint="أزرق مقاس L", price=None)]
        matched3 = await match_line_items_to_products(session, merchant_id, items3)
        print("Product matched for 'جاكت':", matched3[0].product_id)
        if matched3[0].product_id:
            variants = (await session.execute(
                select(ProductVariant)
                .where(ProductVariant.product_id == matched3[0].product_id)
            )).scalars().all()
            candidates = [VariantCandidate(id=v.id, label=v.label, attributes=v.attributes) for v in variants]
            print("  Variant match for 'أزرق مقاس L':", match_variant_hint("أزرق مقاس L", candidates))
            print("  Candidates were:")
            for c in candidates:
                print(f"    {c.label}: {c.attributes}")

        # Also let's check distances
        from app.engine.embeddings import embed_text
        for s in ["جاكيت أزرق", "جاكيت ازرق", "جاكت", "جاكيت جينز"]:
            print(f"\n--- Distance for '{s}' ---")
            emb = await embed_text(s)
            distance_col = Product.embedding.cosine_distance(emb)
            result = await session.execute(
                select(Product.name, distance_col)
                .where(Product.merchant_id == merchant_id, Product.embedding.is_not(None))
                .order_by(distance_col)
            )
            for row in result.all():
                print(f"  {row.name}: distance = {row[1]:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
