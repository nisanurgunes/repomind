from datetime import datetime, timezone

class HealthScoreEngine:

    def calculate(self, repo: dict, commits: list, issues: list, pull_requests: list, contributors: list) -> dict:
        commit_score = self._commit_score(commits)
        issue_score = self._issue_score(issues)
        pr_score = self._pr_score(pull_requests)
        contributor_score = self._contributor_score(contributors)

        total = (
            commit_score * 0.30 +
            issue_score * 0.25 +
            pr_score * 0.25 +
            contributor_score * 0.20
        )

        return {
            "health_score": round(total, 1),
            "breakdown": {
                "commit_score": round(commit_score, 1),
                "issue_score": round(issue_score, 1),
                "pr_score": round(pr_score, 1),
                "contributor_score": round(contributor_score, 1),
            },
            "metrics": {
                "commit_count_90d": len(commits),
                "open_issues": repo.get("open_issues_count", 0),
                "contributor_count": len(contributors),
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
            }
        }

    def _commit_score(self, commits: list) -> float:
        count = len(commits)
        if count >= 100: return 100
        if count >= 50:  return 80
        if count >= 20:  return 60
        if count >= 10:  return 40
        if count >= 1:   return 20
        return 0

    def _issue_score(self, issues: list) -> float:
        if not issues:
            return 50  # Issue yoksa nötr skor

        total_hours = 0
        closed_count = 0

        for issue in issues:
            # Pull request'leri filtrele — issues endpoint'i PR'ları da döner
            if "pull_request" in issue:
                continue
            if issue.get("state") == "closed" and issue.get("closed_at"):
                created = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
                closed = datetime.fromisoformat(issue["closed_at"].replace("Z", "+00:00"))
                hours = (closed - created).total_seconds() / 3600
                total_hours += hours
                closed_count += 1

        if closed_count == 0:
            return 30

        avg_hours = total_hours / closed_count

        if avg_hours <= 24:   return 100
        if avg_hours <= 72:   return 80
        if avg_hours <= 168:  return 60
        if avg_hours <= 720:  return 40
        return 20

    def _pr_score(self, pull_requests: list) -> float:
        if not pull_requests:
            return 50

        total_hours = 0
        merged_count = 0

        for pr in pull_requests:
            if pr.get("merged_at"):
                created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
                merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                hours = (merged - created).total_seconds() / 3600
                total_hours += hours
                merged_count += 1

        if merged_count == 0:
            return 30

        avg_hours = total_hours / merged_count

        if avg_hours <= 24:   return 100
        if avg_hours <= 72:   return 80
        if avg_hours <= 168:  return 60
        if avg_hours <= 720:  return 40
        return 20

    def _contributor_score(self, contributors: list) -> float:
        count = len(contributors)
        if count >= 20: return 100
        if count >= 10: return 80
        if count >= 5:  return 60
        if count >= 2:  return 40
        if count >= 1:  return 20
        return 0