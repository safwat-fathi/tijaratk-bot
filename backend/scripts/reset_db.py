import asyncio
import logging

from sqlalchemy import text

from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def reset_db():
    logger.info("Dropping and recreating public schema...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))

    logger.info("Database reset successfully.")
    # We must properly dispose the engine to avoid open connections
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_db())
