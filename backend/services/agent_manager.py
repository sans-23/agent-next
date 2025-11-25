from typing import Dict, Optional, Any
from collections import OrderedDict
from langchain.agents import AgentExecutor
from langchain_openai import ChatOpenAI
from services.agent import create_mcp_agent_executor
from services.tools import setup_tools
from schemas.user import UserSchema
from core import config
import logging

class AgentManager:
    def __init__(self, cache_size: int = config.AGENT_CACHE_SIZE):
        self._agent_cache: OrderedDict[int, AgentExecutor] = OrderedDict()
        self._cache_size = cache_size
        self.llm: Optional[ChatOpenAI] = None

    def set_llm(self, llm: ChatOpenAI):
        """Sets the LLM instance to be used for creating agents."""
        self.llm = llm

    async def get_agent(self, user: UserSchema) -> Optional[AgentExecutor]:
        """
        Retrieves an agent for the given user.
        If cached, returns the cached agent.
        If not, creates a new one, caches it, and returns it.
        """
        if not self.llm:
            logging.error("LLM instance not set in AgentManager.")
            return None

        user_id = user.id

        # Check cache
        if user_id in self._agent_cache:
            # Move to end to show it was recently used
            self._agent_cache.move_to_end(user_id)
            return self._agent_cache[user_id]

        # Cache miss - create new agent
        logging.info(f"Creating new agent for user {user_id}")
        
        # Use user's MCP config or default if not present
        mcp_config = user.mcp_config if user.mcp_config else config.DEFAULT_MCP_CONFIG
        
        tools = await setup_tools(self.llm, mcp_config)
        agent_executor = create_mcp_agent_executor(self.llm, tools)

        if agent_executor:
            self._agent_cache[user_id] = agent_executor
            
            # Enforce cache size
            if len(self._agent_cache) > self._cache_size:
                removed_id, _ = self._agent_cache.popitem(last=False) # Remove first (LRU)
                logging.info(f"Evicted agent for user {removed_id} from cache.")
        
        return agent_executor

    def clear_user_agent(self, user_id: int):
        """Removes a user's agent from the cache. Call this when config updates."""
        if user_id in self._agent_cache:
            del self._agent_cache[user_id]
            logging.info(f"Cleared agent cache for user {user_id}")

# Global instance
agent_manager = AgentManager()
