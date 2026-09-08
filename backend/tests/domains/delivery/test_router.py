from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import get_db
from app.domains.auth.dependencies import get_current_merchant
from app.main import app
from app.models import Merchant


async def test_delivery_area_crud_happy_path(db_session, merchant):
    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return merchant

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/delivery-areas/", json={"area": "Nasr City", "delivery_fee": 25.0, "estimated_delivery": "same day"}
            )
            assert created.status_code == 201
            area_id = created.json()["id"]

            listed = await client.get("/delivery-areas/")
            assert any(a["id"] == area_id for a in listed.json())

            patched = await client.patch(f"/delivery-areas/{area_id}", json={"delivery_fee": 40.0})
            assert patched.status_code == 200
            assert patched.json()["delivery_fee"] == "40.00"

            deleted = await client.delete(f"/delivery-areas/{area_id}")
            assert deleted.status_code == 204
            listed_after = await client.get("/delivery-areas/")
            assert all(a["id"] != area_id for a in listed_after.json())
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)


async def test_delivery_areas_endpoints_require_auth(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/delivery-areas/")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


async def test_patch_and_delete_reject_cross_merchant_area(db_session, merchant):
    other = Merchant(name="Other")
    db_session.add(other)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    async def _override_get_current_merchant():
        return other

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_merchant] = _override_get_current_merchant
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post("/delivery-areas/", json={"area": "Maadi", "delivery_fee": 10.0})
            area_id = created.json()["id"]

            # Overriding auth as `merchant`, not `other`, so the owned lookup misses.
            app.dependency_overrides[get_current_merchant] = lambda: merchant
            patched = await client.patch(f"/delivery-areas/{area_id}", json={"delivery_fee": 99.0})
            assert patched.status_code == 404
            deleted = await client.delete(f"/delivery-areas/{area_id}")
            assert deleted.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_merchant, None)
