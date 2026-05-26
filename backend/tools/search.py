import json
from langchain_core.tools import tool
from backend.config import settings

@tool("web_search")
def web_search(query: str) -> str:
    """Search the web for accurate, up-to-date information on a given topic.
    Returns results as a JSON string with keys: title, url, content, score.
    """
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return json.dumps([{
            "title": "Error",
            "url": "",
            "content": "Tavily API key is missing. Please set TAVILY_API_KEY in your environment.",
            "score": 0.0
        }])
    
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        response = client.search(query=query, max_results=5)
        
        results = []
        for r in response.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
                "score": r.get("score", 0.0)
            })
        return json.dumps(results)
    except Exception as e:
        return json.dumps([{
            "title": "Error",
            "url": "",
            "content": f"Search failed with exception: {str(e)}",
            "score": 0.0
        }])
