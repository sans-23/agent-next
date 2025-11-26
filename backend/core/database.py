import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from core.config import DATABASE_URL, SQLALCHEMY_ECHO

# --- Base Model ---
Base = declarative_base()

# --- Database Engine ---
# Create the asynchronous engine
engine = create_async_engine(DATABASE_URL, echo=SQLALCHEMY_ECHO)

# --- Session Maker ---
# Create a session maker to manage sessions
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# --- Dependency ---
# Dependency function to get an async database session
async def get_db_session():
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()
