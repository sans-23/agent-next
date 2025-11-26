from fastapi import APIRouter, HTTPException, Depends, Request # type: ignore # Import Request
from sqlalchemy.ext.asyncio import AsyncSession # type: ignore
from schemas.chat import SessionCreate, ChatSessionResponse, MessageRequest, MessageResponse, SessionListResponse, ChatMessageResponse
from services.auth import get_current_user
from models.user import User
from crud import chat as chat_crud
from crud import user as user_crud
from core.database import get_db_session
from services.agent import get_agent_response # Removed _agent_executor import
from langchain.agents import AgentExecutor # type: ignore
from services.message_converter import db_messages_to_lc_messages
from langchain_openai import ChatOpenAI

router = APIRouter()

from services.agent_manager import AgentManager

def get_agent_manager_dependency(request: Request) -> AgentManager:
    manager = request.app.state.agent_manager
    if manager is None:
        raise HTTPException(status_code=503, detail="AgentManager is not initialized.")
    return manager

def get_llm_instance_dependency(request: Request) -> ChatOpenAI:
    llm_instance = request.app.state.llm_instance
    if llm_instance is None:
        raise HTTPException(status_code=503, detail="LLM is not initialized.")
    return llm_instance

@router.post("/", response_model=ChatSessionResponse, status_code=201)
async def create_session(
    session_data: SessionCreate, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager_dependency),
    llm_instance: ChatOpenAI = Depends(get_llm_instance_dependency)
):
    """Starts a new chat session for a user."""
        
    user = await user_crud.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_session, _ = await chat_crud.create_chat_session(
        db, current_user.id, session_data.initial_message
    )
    
    # Get user-specific agent
    agent_executor = await agent_manager.get_agent(user)
    if not agent_executor:
         raise HTTPException(status_code=500, detail="Failed to initialize AI agent.")

    ai_response_content, tool_names_used, tool_calls = await get_agent_response(
        agent_executor, session_data.initial_message, [], llm_instance
    )
    
    await chat_crud.add_ai_message_to_session(
        db, new_session.id, ai_response_content, tool_names_used, tool_calls
    )
    
    messages = await chat_crud.get_chat_messages(db, new_session.id)
    
    return ChatSessionResponse(
        id=new_session.id,
        user_id=new_session.user_id,
        title=new_session.title,
        created_at=new_session.created_at,
        updated_at=new_session.updated_at,
        messages=[ChatMessageResponse.from_orm(m) for m in messages]
    )

@router.post("/chat", response_model=MessageResponse)
async def send_message(
    message_data: MessageRequest, 
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    agent_manager: AgentManager = Depends(get_agent_manager_dependency),
    llm_instance: ChatOpenAI = Depends(get_llm_instance_dependency)
):
    """Sends a new message to an existing chat session."""
        
    session = await chat_crud.get_chat_session(db, message_data.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: User ID does not match session owner.")
        
    history_records = await chat_crud.get_chat_messages(db, message_data.session_id)
    lc_history = db_messages_to_lc_messages(history_records)
    
    user_message = await chat_crud.add_user_message_to_session(
        db, message_data.session_id, message_data.content
    )
    
    # Get user-specific agent
    agent_executor = await agent_manager.get_agent(current_user)
    if not agent_executor:
         raise HTTPException(status_code=500, detail="Failed to initialize AI agent.")
    
    ai_response_content, tool_names_used, tool_calls = await get_agent_response(
        agent_executor, message_data.content, lc_history, llm_instance 
    )
    
    ai_message = await chat_crud.add_ai_message_to_session(
        db, message_data.session_id, ai_response_content, tool_names_used, tool_calls
    )
    
    return MessageResponse(
        session_id=message_data.session_id,
        user_message=ChatMessageResponse.from_orm(user_message),
        ai_response=ChatMessageResponse.from_orm(ai_message),
        tool_names_used=tool_names_used,
        tool_calls=tool_calls
    )

@router.get("/{session_id}", response_model=ChatSessionResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db_session), current_user: User = Depends(get_current_user)):
    """Retrieves a specific chat session and all its messages."""
    session = await chat_crud.get_chat_session(db, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat session not found.")
        
    messages = await chat_crud.get_chat_messages(db, session_id)
    
    return ChatSessionResponse(
        id=session.id,
        user_id=session.user_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[ChatMessageResponse.from_orm(m) for m in messages]
    )

@router.get("/user/", response_model=SessionListResponse)
async def list_user_sessions(db: AsyncSession = Depends(get_db_session), current_user: User = Depends(get_current_user)):
    """Lists all chat sessions for a specific user."""
    sessions = await chat_crud.get_user_sessions(db, current_user.id)
    return SessionListResponse(
        sessions=[
            ChatSessionResponse(
                id=s.id,
                user_id=s.user_id,
                title=s.title,
                created_at=s.created_at,
                updated_at=s.updated_at,
                messages=[]
            ) for s in sessions
        ]
    )

@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db_session), current_user: User = Depends(get_current_user)):
    """Deletes a specific chat session and all its messages."""
    session = await chat_crud.get_chat_session(db, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat session not found.")
        
    deleted = await chat_crud.delete_chat_session(db, session_id)
    if not deleted:
        # This case might occur if the session was deleted by another process
        # between the check and the delete operation.
        raise HTTPException(status_code=404, detail="Chat session could not be deleted.")
    
    return
