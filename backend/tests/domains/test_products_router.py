from decimal import Decimal

from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.main import app
from app.models import Merchant, Product, ProductVariant


async def test_list_products_returns_only_merchant_scoped_products(db_session, merchant):
    other_merchant = Merchant(name="Other Merchant")
    db_session.add(other_merchant)
    await db_session.flush()

    other = Product(merchant_id=other_merchant.id, name="Other Merchant Product")
    mine = Product(
        merchant_id=merchant.id,
        name="My Product",
        aliases=["alias1"],
        price=Decimal("249.00"),
    )
    db_session.add_all([other, mine])
    await db_session.flush()
    db_session.add(ProductVariant(product_id=mine.id, label="M", sku="MY-M", stock=5, attributes={"size": "M"}))
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/products/")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["name"] == "My Product"
    assert body[0]["aliases"] == ["alias1"]
    assert len(body[0]["variants"]) == 1
    assert body[0]["variants"][0]["label"] == "M"
    assert body[0]["variants"][0]["attributes"] == {"size": "M"}
    assert body[0]["price"] == 249.0


async def test_get_products_requires_authentication(db_session, merchant, monkeypatch):
    # Explicitly disable the dev bypass so this test isn't accidentally
    # green because of a locally-configured DEMO_API_KEY.
    monkeypatch.setattr(settings, "DEMO_API_KEY", "")

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/products/")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
