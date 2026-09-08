from fastapi import APIRouter

from app.domains.auth.router import router as auth_router
from app.domains.channels.router import router as channels_router
from app.domains.checkout.router import router as checkout_router
from app.domains.conversations.router import router as conversations_router
from app.domains.delivery.router import router as delivery_router
from app.domains.demo.router import router as demo_router
from app.domains.handoff.router import router as handoff_router
from app.domains.health.router import router as health_router
from app.domains.labeled_examples.router import router as labeled_examples_router
from app.domains.merchants.router import router as merchants_router
from app.domains.messages.router import router as messages_router
from app.domains.products.router import router as products_router
from app.domains.store_knowledge.router import router as store_knowledge_router

api_router = APIRouter()

api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(demo_router, prefix="/demo", tags=["demo"])
api_router.include_router(messages_router, prefix="/messages", tags=["messages"])
api_router.include_router(products_router, prefix="/products", tags=["products"])
api_router.include_router(conversations_router, prefix="/conversations", tags=["conversations"])
api_router.include_router(store_knowledge_router, prefix="/store-knowledge", tags=["store-knowledge"])
api_router.include_router(channels_router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(delivery_router, prefix="/delivery-areas", tags=["delivery"])
api_router.include_router(handoff_router, prefix="/conversations", tags=["handoff"])
api_router.include_router(labeled_examples_router, prefix="/labeled-examples", tags=["labeled-examples"])
api_router.include_router(merchants_router, prefix="/merchants", tags=["merchants"])
api_router.include_router(checkout_router, prefix="/orders", tags=["orders"])
