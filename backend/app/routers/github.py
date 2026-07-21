from fastapi import APIRouter, HTTPException

from app.services.github_service import get_github_stats


router = APIRouter()


@router.get("/api/github-sync/{username}")
@router.get("/api/github/{username}")
async def fetch_github_info(username: str):
    stats = await get_github_stats(username)

    if stats is None:
        raise HTTPException(status_code=404, detail="GitHub profile not found or API error")

    if isinstance(stats, dict) and "error" in stats:
        raise HTTPException(status_code=404, detail=stats["error"])

    repos_list = []
    if isinstance(stats, list):
        repos_list = stats
    elif isinstance(stats, dict):
        repos_list = stats.get("repositories", stats.get("top_projects", []))

    return {
        "success": True,
        "message": f"GitHub profile for {username} synced successfully!",
        "repositories": repos_list,
        "total_repos": stats.get("total_repos", len(repos_list)) if isinstance(stats, dict) else len(repos_list),
        "languages": stats.get("languages", []) if isinstance(stats, dict) else [],
    }
