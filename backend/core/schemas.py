from pydantic import BaseModel, Field # type: ignore
from typing import Optional, List, Dict, Any, Union, Literal
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

class TextBlock(BaseModel):
    block_type: Literal["text"] = Field("text", description="Markdown text block best for general information.")
    text: str = Field(..., description="The markdown text content.")

class ReactBlock(BaseModel):
    block_type: Literal["react"] = Field("react", description="React component block for custom rendering and complex visualizations.")
    description: Optional[str] = Field(None, description="One-liner description of the React component shows.")
    code: str = Field(..., description="Raw React component code without import statement (JSX) that can be rendered in React.")

class LLMOutputBlock(BaseModel):
    blocks: List[Union[TextBlock, ReactBlock]] = Field(..., description="List of content blocks in the LLM output.")

    query: str = Field(..., description="The user's query.")
    chat_id: Optional[str] = Field(None, description="Unique ID for the chat session. A new chat is started if not provided.")

class ChatResponse(BaseModel):
    response: str = Field(..., description="The response from the AI.")
    chat_id: str = Field(..., description="The ID of the chat session.")
    tool_used: Optional[str] = Field(None, description="The tool used to generate the response, if any.")

class ToolCall(BaseModel):
    name: str
    input: Dict[str, Any]
    output: Optional[str] = None

class ChatMessageResponse(BaseModel):
    """Pydantic model for a single chat message in a response."""
    id: int
    role: str
    content: Dict[str, Any]
    tool_calls: Optional[List[ToolCall]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SessionCreate(BaseModel):
    """Pydantic model for initiating a new chat session with a user and an initial message."""
    initial_message: str = Field(..., description="The first message from the user.")

class MessageRequest(BaseModel):
    """Pydantic model for sending a new message to an existing chat session."""
    session_id: str = Field(..., description="The ID of the session to which the message is being sent.")
    content: str = Field(..., description="The content of the message.")

class ChatSessionResponse(BaseModel):
    """Pydantic model for a chat session response."""
    id: str
    user_id: int
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[ChatMessageResponse] = Field(..., description="List of messages in the session.")

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    """Pydantic model for the response after sending a message."""
    session_id: str
    user_message: ChatMessageResponse
    ai_response: ChatMessageResponse
    tool_names_used: List[str] = Field(default=[], description="List of tools utilized by the agent.")
    tool_calls: List[ToolCall] = Field(default=[], description="Detailed list of tool calls.")

class SessionListResponse(BaseModel):
    """Pydantic model for listing multiple chat sessions."""
    sessions: List[ChatSessionResponse]
