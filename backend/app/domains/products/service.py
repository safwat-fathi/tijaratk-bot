from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.products.schemas import (
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductVariantRead,
)
from app.engine.embeddings import embed_text
from app.models import Product
from app.models.product_variant import ProductVariant


def _to_product_read(p: Product) -> ProductRead:
    return ProductRead(
        id=p.id,
        merchant_id=p.merchant_id,
        name=p.name,
        aliases=p.aliases,
        variants=[
            ProductVariantRead(
                id=v.id,
                product_id=v.product_id,
                label=v.label,
                sku=v.sku,
                price=float(v.price) if v.price is not None else None,
                stock=v.stock,
                status=v.status.value,
                attributes=v.attributes,
            )
            for v in p.variants
        ],
        price=float(p.price) if p.price is not None else None,
        category=p.category,
        description=p.description,
        image_url=p.image_url,
    )


async def list_products(db: AsyncSession, merchant_id: str) -> list[ProductRead]:
    stmt = (
        select(Product)
        .where(Product.merchant_id == merchant_id)
        .options(selectinload(Product.variants))
        .order_by(Product.name)
    )
    result = await db.execute(stmt)
    return [_to_product_read(p) for p in result.scalars().all()]


async def search_products(db: AsyncSession, merchant_id: str, query: str, filters: dict) -> list[ProductRead]:
    stmt = (
        select(Product)
        .where(
            Product.merchant_id == merchant_id,
            or_(Product.name.ilike(f"%{query}%"), Product.aliases.any(query)),
        )
        .options(selectinload(Product.variants))
    )
    result = await db.execute(stmt)
    return [_to_product_read(p) for p in result.scalars().all()]


async def get_product(db: AsyncSession, merchant_id: str, product_id: str) -> ProductRead | None:
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)], populate_existing=True)
    if product is None or product.merchant_id != merchant_id:
        return None
    return _to_product_read(product)


async def create_product(db: AsyncSession, merchant_id: str, payload: ProductCreate) -> ProductRead:
    product = Product(
        merchant_id=merchant_id,
        name=payload.name,
        aliases=payload.aliases,
        price=Decimal(str(payload.price)) if payload.price is not None else None,
        category=payload.category,
        description=payload.description,
        image_url=payload.image_url,
    )
    product.embedding = await embed_text(f"{product.name} " + " ".join(product.aliases))
    db.add(product)
    await db.flush()
    for v in payload.variants:
        db.add(
            ProductVariant(
                product_id=product.id, label=v.label, sku=v.sku, price=v.price, stock=v.stock, attributes=v.attributes
            )
        )
    await db.flush()
    # Reload with variants
    await db.refresh(product, ["variants"])
    return _to_product_read(product)


async def update_product(
    db: AsyncSession, merchant_id: str, product_id: str, payload: ProductUpdate
) -> ProductRead | None:
    product = await db.get(Product, product_id, options=[selectinload(Product.variants)])
    if product is None or product.merchant_id != merchant_id:
        return None
    if payload.name is not None:
        product.name = payload.name
    if payload.aliases is not None:
        product.aliases = payload.aliases
    if payload.price is not None:
        product.price = Decimal(str(payload.price))
    if payload.category is not None:
        product.category = payload.category
    if payload.description is not None:
        product.description = payload.description
    if payload.image_url is not None:
        product.image_url = payload.image_url
    # Re-embed if name or aliases changed
    if payload.name is not None or payload.aliases is not None:
        product.embedding = await embed_text(f"{product.name} " + " ".join(product.aliases))
    await db.flush()
    return _to_product_read(product)


async def delete_product(db: AsyncSession, merchant_id: str, product_id: str) -> bool:
    product = await db.get(Product, product_id)
    if product is None or product.merchant_id != merchant_id:
        return False
    await db.delete(product)
    await db.flush()
    return True
