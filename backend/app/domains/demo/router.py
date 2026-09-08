from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.domains.conversations.schemas import ConversationRead
from app.domains.conversations.service import list_conversations
from app.domains.messages.schemas import MessageIngestRequest, MessageIngestResponse
from app.domains.messages.service import ConversationNotFoundError, ingest_message
from app.domains.products.schemas import ProductRead
from app.domains.products.service import list_products
from app.domains.store_knowledge.schemas import StoreKnowledgeRead
from app.domains.store_knowledge.service import list_knowledge

router = APIRouter()


def get_demo_merchant_id() -> str:
    demo_id = settings.DEMO_STOPGAP_MERCHANT_ID
    if not demo_id:
        raise HTTPException(status_code=503, detail="Demo merchant is not configured")
    return demo_id


@router.get("/conversations/", response_model=list[ConversationRead])
async def get_demo_conversations(
    db: AsyncSession = Depends(get_db),
    demo_id: str = Depends(get_demo_merchant_id),
) -> list[ConversationRead]:
    return await list_conversations(db, demo_id)


@router.get("/products/", response_model=list[ProductRead])
async def get_demo_products(
    db: AsyncSession = Depends(get_db),
    demo_id: str = Depends(get_demo_merchant_id),
) -> list[ProductRead]:
    return await list_products(db, demo_id)


@router.get("/knowledge/", response_model=list[StoreKnowledgeRead])
async def get_demo_knowledge(
    db: AsyncSession = Depends(get_db),
    demo_id: str = Depends(get_demo_merchant_id),
) -> list[StoreKnowledgeRead]:
    return await list_knowledge(db, demo_id)


@router.post("/messages/", response_model=MessageIngestResponse)
async def post_demo_message(
    payload: MessageIngestRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    demo_id: str = Depends(get_demo_merchant_id),
) -> MessageIngestResponse:
    try:
        result = await ingest_message(db, payload, demo_id)
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="conversation not found")
    await db.commit()
    if result.escalation_reason == "ai_call_failed":
        response.status_code = status.HTTP_202_ACCEPTED
    return result
