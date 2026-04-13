import requests
from fastapi import FastAPI, HTTPException
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI()

# GitHub Personal Access Token එක මෙතනට දාන්න (Rate limiting මඟහරවා ගැනීමට)
GITHUB_TOKEN = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}

class RepoInfo(BaseModel):
    name: str
    url: str
    stars: int

class GitHubStats(BaseModel):
    username: str
    total_repos: int
    languages: List[str]
    top_projects: List[RepoInfo]

@app.get("/api/github/{username}", response_model=GitHubStats)
async def get_github_stats(username: str):
    # GitHub API URL එක - repos සහ profile විස්තර ලබා ගැනීමට
    url = f"https://api.github.com/users/{username}/repos?per_page=100"
    
    try:
        response = requests.get(url, headers=HEADERS)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub user not found")
        elif response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Error fetching data from GitHub")

        repos = response.json()
        repo_list = []
        languages = set()

        for repo in repos:
            # Fork කරපු ඒවා නැතුව තමන්ගේම ඒව විතරක් ගමු
            if not repo["fork"]:
                repo_list.append({
                    "name": repo["name"],
                    "url": repo["html_url"],
                    "stars": repo["stargazers_count"]
                })
                if repo["language"]:
                    languages.add(repo["language"])

        # Stars වැඩිම තියෙන projects මුලට එන විදිහට sort කරමු
        sorted_repos = sorted(repo_list, key=lambda x: x["stars"], reverse=True)

        return {
            "username": username,
            "total_repos": len(repo_list),
            "languages": list(languages),
            "top_projects": sorted_repos[:5] # හොඳම projects 5 පමණක් ලබා දීම
        }
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=str(e))

# FastAPI run කිරීමට: uvicorn main:app --reload