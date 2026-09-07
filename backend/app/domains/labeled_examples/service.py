import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.labeled_examples.schemas import LabeledExampleCreate, LabeledExampleRead, LabeledExampleUpdate
from app.engine.clients import AICallError
from app.engine.embeddings import embed_text
from app.models import LabeledExample

logger = logging.getLogger(__name__)


async def _embedding_for(text: str) -> list[float] | None:
    """An example without an embedding never surfaces as a few-shot example.
    Fail open (None) rather than rejecting the save — the merchant's data
    entry matters more than one embedding call."""
    try:
        return await embed_text(text)
    except AICallError as exc:
        logger.warning("labeled_example_embedding_failed error=%s", exc)
        return None


async def list_examples(db: AsyncSession, merchant_id: str) -> list[LabeledExampleRead]:
    result = await db.execute(
        select(LabeledExample).where(LabeledExample.merchant_id == merchant_id).order_by(LabeledExample.normalized_text)
    )
    return [LabeledExampleRead.model_validate(row) for row in result.scalars().all()]


async def create_example(db: AsyncSession, merchant_id: str, payload: LabeledExampleCreate) -> LabeledExampleRead:
    example = LabeledExample(
        merchant_id=merchant_id,
        normalized_text=payload.normalized_text,
        intent=payload.intent,
        extraction=payload.extraction,
        embedding=await _embedding_for(payload.normalized_text),
        source="merchant",
    )
    db.add(example)
    await db.flush()
    return LabeledExampleRead.model_validate(example)


async def update_example(
    db: AsyncSession, merchant_id: str, example_id: str, payload: LabeledExampleUpdate
) -> LabeledExampleRead | None:
    example = await db.get(LabeledExample, example_id)
    if example is None or example.merchant_id != merchant_id:
        return None
    if payload.normalized_text is not None:
        example.normalized_text = payload.normalized_text
        example.embedding = await _embedding_for(payload.normalized_text)
    if payload.intent is not None:
        example.intent = payload.intent
    if payload.extraction is not None:
        example.extraction = payload.extraction
    await db.flush()
    return LabeledExampleRead.model_validate(example)


async def delete_example(db: AsyncSession, merchant_id: str, example_id: str) -> bool:
    example = await db.get(LabeledExample, example_id)
    if example is None or example.merchant_id != merchant_id:
        return False
    await db.delete(example)
    await db.flush()
    return True
