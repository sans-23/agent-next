from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from crud import user as user_crud
from core.schemas import UserSchema
from models.user import User
from core.database import get_db_session
from services.auth import get_current_user
from services.agent_manager import AgentManager

router = APIRouter()

def get_agent_manager_dependency(request: Request) -> AgentManager:
    manager = request.app.state.agent_manager
    if manager is None:
        raise HTTPException(status_code=503, detail="AgentManager is not initialized.")
    return manager

@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user.
    """
    return current_user

@router.put("/me/mcp-config", response_model=UserSchema)
async def update_mcp_config(
    mcp_config: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager_dependency)
):
    """
    Update the current user's MCP configuration.
    This will also clear the cached agent for this user, forcing a re-initialization with the new config on next use.
    """
    # Basic validation could be added here to ensure the config structure is correct
    
    updated_user = await user_crud.update_user_mcp_config(db, current_user.id, mcp_config)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Clear the agent cache for this user so the new config is picked up
    agent_manager.clear_user_agent(current_user.id)
    
    return updated_user
