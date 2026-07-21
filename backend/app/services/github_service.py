import requests


GITHUB_TOKEN = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"

HEADERS = {"User-Agent": "Mock-Interview-App"}
if GITHUB_TOKEN and GITHUB_TOKEN != "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN":
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"


async def get_github_stats(username: str):
    url = f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated"

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)

        if response.status_code == 404:
            return {"error": "GitHub user not found"}
        if response.status_code != 200:
            return {"error": f"Error fetching data from GitHub (Status: {response.status_code})"}

        repos = response.json()
        repo_list = []
        languages = set()

        for repo in repos:
            if not repo.get("fork", False):
                repo_list.append(
                    {
                        "id": repo.get("id"),
                        "name": repo.get("name"),
                        "url": repo.get("html_url"),
                        "description": repo.get("description") or "No description provided.",
                        "language": repo.get("language") or "Mixed Tech",
                        "stars": repo.get("stargazers_count", 0),
                    }
                )
                if repo.get("language"):
                    languages.add(repo["language"])

        sorted_repos = sorted(repo_list, key=lambda x: x["stars"], reverse=True)

        return {
            "username": username,
            "total_repos": len(repo_list),
            "languages": list(languages),
            "repositories": sorted_repos,
            "top_projects": sorted_repos[:5],
        }

    except requests.exceptions.RequestException as e:
        return {"error": f"Network error: {str(e)}"}
