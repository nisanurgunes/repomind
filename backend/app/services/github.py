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