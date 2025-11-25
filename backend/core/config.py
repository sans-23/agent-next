import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM Configuration ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL")
LLM_MODEL_NAME = "x-ai/grok-4.1-fast:free"

# --- MCP Server Configuration ---
MCP_SERVERS = {
    "github": {
        "transport": "streamable_http",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
            "Authorization": os.getenv("GITHUB_COPILOT_TOKEN")
        }
    }
}

# --- Database Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

# --- ChromaDB Configuration ---
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8001")

# --- Security/Authentication --- 
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_secret_key_that_should_be_changed")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000

# --- Environment/Logging ---
ENV = os.getenv("ENV", "development")
SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true"

# --- Agent Configuration ---
AGENT_CACHE_SIZE = int(os.getenv("AGENT_CACHE_SIZE", "100")) # Default to 100 users

# --- Default User MCP Config ---
DEFAULT_MCP_CONFIG = {
    "github": {
        "transport": "streamable_http",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
            "Authorization": "Bearer <YOUR_GITHUB_TOKEN_HERE>"
        }
    }
}
