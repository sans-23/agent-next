from sqlalchemy import Column, Integer, String, DateTime, JSON
from core.database import Base
from sqlalchemy.sql import func # type: ignore
from core.config import DEFAULT_MCP_CONFIG

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    mcp_config = Column(JSON, default=DEFAULT_MCP_CONFIG)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
