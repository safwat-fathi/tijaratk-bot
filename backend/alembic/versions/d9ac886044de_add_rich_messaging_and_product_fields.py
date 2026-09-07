"""add_rich_messaging_and_product_fields

Revision ID: d9ac886044de
Revises: a1b2c3d4e5f6
Create Date: 2026-09-07 18:12:29.905397

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd9ac886044de'
down_revision: str | Sequence[str] | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Messages: rich messaging columns
    op.add_column('messages', sa.Column('message_type', sa.String(), nullable=True))
    op.add_column('messages', sa.Column('rich_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('messages', sa.Column('postback_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # Products: category, description, image_url
    op.add_column('products', sa.Column('category', sa.String(), nullable=True))
    op.add_column('products', sa.Column('description', sa.String(), nullable=True))
    op.add_column('products', sa.Column('image_url', sa.String(), nullable=True))
    op.create_index(op.f('ix_products_category'), 'products', ['category'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_products_category'), table_name='products')
    op.drop_column('products', 'image_url')
    op.drop_column('products', 'description')
    op.drop_column('products', 'category')
    op.drop_column('messages', 'postback_payload')
    op.drop_column('messages', 'rich_payload')
    op.drop_column('messages', 'message_type')

