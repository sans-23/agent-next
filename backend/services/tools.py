from typing import List, Any
from langchain_mcp_adapters.client import MultiServerMCPClient # type: ignore
from langchain.tools import Tool # type: ignore
from core import config
from services.rag import query_vector_database
import json
import os
import aiofiles # type: ignore

async def setup_tools(llm: Any, mcp_config: dict = None) -> List[Any]:
    """Sets up and returns a list of tools, including MCP-based ones and RAG tool."""
    mcp_tools = []
    
    # Use provided config or fall back to global default (though global might be deprecated in per-user model)
    server_config = mcp_config if mcp_config else config.MCP_SERVERS

    try:
        # Check if config is valid (has headers/auth)
        # We iterate over the config to check for validity
        # Filter for valid servers
        valid_servers = {}
        for server_name, server_details in server_config.items():
             # Check if it's a known public server or has valid auth
             is_public = server_name in config.PUBLIC_MCP_SERVERS
             has_auth = server_details.get('headers') and server_details['headers'].get('Authorization') and "YOUR_GITHUB_TOKEN_HERE" not in server_details['headers']['Authorization']
             
             if is_public or has_auth:
                 valid_servers[server_name] = server_details
             else:
                 print(f"⚠️ MCP Server '{server_name}' missing valid Authorization. Skipping.")
        
        if valid_servers:
            client = MultiServerMCPClient(valid_servers)
            mcp_tools = await client.get_tools()
            print(f"✅ MCP tools fetched successfully. Found {len(mcp_tools)} tools from {list(valid_servers.keys())}.")
        else:
             print("ℹ️ No valid MCP servers configured or auth missing.")

    except Exception as e:
        print(f"❌ Error setting up MCP tools: {e}")

    # Create one RAG tool per source (namespace) so the agent can pick the right one
    sources = []
    sources_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sources.json")
    try:
        async with aiofiles.open(sources_path, "r") as f:
            data_text = await f.read()
            data = json.loads(data_text)
            if isinstance(data, list):
                sources = data
    except Exception as e:
        print(f"❌ Error reading sources.json for RAG tools: {e}")

    rag_tools: List[Any] = []
    for src in sources:
        resource_name = src.get("resource_name", "")
        description = src.get("resource_description", "")
        if not resource_name:
            continue
        tool = Tool(
            name=f"RAG_{resource_name}",
            func=lambda query, rn=resource_name: query_vector_database(query, llm, namespace=rn)[0],
            description=f"RAG over '{resource_name}'. {description}",
        )
        rag_tools.append(tool)

    return mcp_tools + rag_tools
