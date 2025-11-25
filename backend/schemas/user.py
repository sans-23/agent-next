from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class UserCreate(BaseModel):
    """Pydantic model for creating a new user."""
    username: str = Field(..., description="The username for the new user.")
    password: str = Field(..., description="The password for the new user.")
    mcp_config: Optional[Dict[str, Any]] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional['UserSchema'] = None

class TokenData(BaseModel):
    username: Optional[str] = None

class UserSchema(BaseModel):
    """Pydantic model for a user record."""
    id: int
    username: str
    mcp_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
