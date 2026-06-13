import httpx
from app.core.config import settings
from typing import Optional

GITHUB_API_BASE = "https://api.github.com"

class GithubService:
    def __init__(self, token: Optional[str] = None):
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        # Token verilmezse .env'deki GITHUB_TOKEN'ı kullan
        actual_token = token or settings.GITHUB_TOKEN
        if actual_token:
            self.headers["Authorization"] = f"Bearer {actual_token}"

    async def get_repo(self, owner: str, name: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()

    async def get_commits(self, owner: str, name: str, days: int = 90) -> list:
        from datetime import datetime, timedelta
        since = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/commits",
                headers=self.headers,
                params={"since": since, "per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_issues(self, owner: str, name: str) -> list:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/issues",
                headers=self.headers,
                params={"state": "all", "per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_pull_requests(self, owner: str, name: str) -> list:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/pulls",
                headers=self.headers,
                params={"state": "all", "per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_contributors(self, owner: str, name: str) -> list:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/contributors",
                headers=self.headers,
                params={"per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_readme_content(self, owner: str, name: str) -> str | None:
        """README'nin ham metin içeriğini döndür."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/readme",
                headers={**self.headers, "Accept": "application/vnd.github.raw+json"},
            )
            if response.status_code != 200:
                return None
            return response.text

    async def get_commits_detailed(self, owner: str, name: str, days: int = 90) -> list:
        """Yazar bilgisi ve dosya değişiklikleri dahil commit listesi."""
        from datetime import datetime, timedelta
        since = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/commits",
                headers=self.headers,
                params={"since": since, "per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_pull_requests_detailed(self, owner: str, name: str) -> list:
        """PR listesi — review ve merge süreleri için."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/pulls",
                headers=self.headers,
                params={"state": "all", "per_page": 100},
            )
            response.raise_for_status()
            return response.json()

    async def get_commit_files(self, owner: str, name: str, sha: str) -> list:
        """Tek commit'in değiştirdiği dosyalar."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/commits/{sha}",
                headers=self.headers,
            )
            if response.status_code != 200:
                return []
            data = response.json()
            return [f["filename"] for f in data.get("files", [])]

    async def search_similar_repos(self, owner: str, name: str, repo_data: dict) -> list:
        """Verilen repoya benzer repoları GitHub search API ile bul."""
        language = repo_data.get("language") or ""
        topics = repo_data.get("topics", [])
        description = repo_data.get("description") or ""

        # Arama sorgusu: topic'ler varsa onlarla, yoksa dil + description keyword'leriyle
        if topics:
            topic_query = " ".join(f"topic:{t}" for t in topics[:3])
            query = f"{topic_query} language:{language} stars:>50" if language else f"{topic_query} stars:>50"
        else:
            # Description'dan ilk 3 kelimeyi al
            keywords = " ".join(description.split()[:5]) if description else name
            query = f"{keywords} language:{language} stars:>50" if language else f"{keywords} stars:>50"

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{GITHUB_API_BASE}/search/repositories",
                headers=self.headers,
                params={"q": query, "sort": "stars", "order": "desc", "per_page": 6},
            )
            if response.status_code != 200:
                return []
            items = response.json().get("items", [])
            # Kendi reposunu çıkar
            full_name = f"{owner}/{name}".lower()
            return [r for r in items if r["full_name"].lower() != full_name][:5]

    async def get_community_files(self, owner: str, name: str) -> dict:
        """README, CONTRIBUTING, LICENSE, ISSUE_TEMPLATE varlığını kontrol et."""
        checks = {
            "readme": "README.md",
            "contributing": "CONTRIBUTING.md",
            "license": "LICENSE",
            "issue_template": ".github/ISSUE_TEMPLATE",
        }
        results = {}
        async with httpx.AsyncClient() as client:
            for key, path in checks.items():
                response = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{name}/contents/{path}",
                    headers=self.headers,
                )
                results[key] = response.status_code == 200
        return results