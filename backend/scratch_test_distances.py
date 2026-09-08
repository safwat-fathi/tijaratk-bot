import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.engine.embeddings import embed_text
from app.models import Merchant, Product


async def main():
    engine = create_async_engine(settings.sqlalchemy_database_uri)
    async with AsyncSession(engine) as session:
        merchants = (await session.execute(select(Merchant))).scalars().all()
        m = merchants[0]

        (await session.execute(select(Product).where(Product.merchant_id == m.id))).scalars().all()

        test_strings = ["جاكيت أزرق", "جاكيت ازرق", "جاكت", "جاكيت جينز"]
        for s in test_strings:
            print(f"\n--- Testing: '{s}' ---")
            emb = await embed_text(s)

            # test distance in db
            distance_col = Product.embedding.cosine_distance(emb)
            result = await session.execute(
                select(Product.name, distance_col)
                .where(Product.merchant_id == m.id, Product.embedding.is_not(None))
                .order_by(distance_col)
            )
            for row in result.all():
                print(f"  {row.name}: distance = {row[1]:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
