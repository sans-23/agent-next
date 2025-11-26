from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db_session
from services.auth import get_current_user
from services.agent_manager import AgentManager
from langchain_openai import ChatOpenAI
from models.user import User
from typing import Annotated

async def get_db() -> AsyncSession:
    async for session in get_db_session():
        yield session

def get_agent_manager(request: Request) -> AgentManager:
    manager = request.app.state.agent_manager
    if manager is None:
        raise HTTPException(status_code=503, detail="AgentManager is not initialized.")
    return manager

def get_llm_instance(request: Request) -> ChatOpenAI:
    llm_instance = request.app.state.llm_instance
    if llm_instance is None:
        raise HTTPException(status_code=503, detail="LLM is not initialized.")
    return llm_instance

# Annotated Dependencies
SessionDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]
AgentManagerDep = Annotated[AgentManager, Depends(get_agent_manager)]
LLMDep = Annotated[ChatOpenAI, Depends(get_llm_instance)]

