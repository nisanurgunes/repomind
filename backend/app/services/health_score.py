from datetime import datetime, timezone

class HealthScoreEngine:

    def calculate(
        self,
        repo: dict,
        commits: list,
        issues: list,
        pull_requests: list,
        contributors: list,
        community_files: dict | None = None,
    ) -> dict:
        commit_score = self._commit_score(commits)
        issue_score = self._issue_score(issues)
        pr_score = self._pr_score(pull_requests)
        contributor_score = self._contributor_score(contributors)
        docs_score = self._docs_score(community_files or {})

        total = (
            commit_score * 0.25 +
            issue_score * 0.20 +
            pr_score * 0.20 +
            contributor_score * 0.20 +
            docs_score * 0.15
        )

        avg_issue_hours = self._avg_issue_hours(issues)
        avg_pr_hours = self._avg_pr_merge_hours(pull_requests)

        recommendations = self._recommendations(
            commit_score=commit_score,
            issue_score=issue_score,
            pr_score=pr_score,
            contributor_score=contributor_score,
            docs_score=docs_score,
            community_files=community_files or {},
            commits=commits,
            contributors=contributors,
        )

        return {
            "health_score": round(total, 1),
            "breakdown": {
                "commit_score": round(commit_score, 1),
                "issue_score": round(issue_score, 1),
                "pr_score": round(pr_score, 1),
                "contributor_score": round(contributor_score, 1),
                "docs_score": round(docs_score, 1),
            },
            "metrics": {
                "commit_count_90d": len(commits),
                "open_issues": repo.get("open_issues_count", 0),
                "contributor_count": len(contributors),
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "avg_issue_response_hours": round(avg_issue_hours, 1),
                "avg_pr_merge_hours": round(avg_pr_hours, 1),
                "has_readme": community_files.get("readme", False) if community_files else False,
                "has_contributing": community_files.get("contributing", False) if community_files else False,
                "has_license": community_files.get("license", False) if community_files else False,
                "has_issue_template": community_files.get("issue_template", False) if community_files else False,
            },
            "recommendations": recommendations,
        }

    def _commit_score(self, commits: list) -> float:
        count = len(commits)
        if count >= 100: return 100
        if count >= 50:  return 80
        if count >= 20:  return 60
        if count >= 10:  return 40
        if count >= 1:   return 20
        return 0

    def _avg_issue_hours(self, issues: list) -> float:
        total_hours = 0
        closed_count = 0
        for issue in issues:
            if "pull_request" in issue:
                continue
            if issue.get("state") == "closed" and issue.get("closed_at"):
                created = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
                closed = datetime.fromisoformat(issue["closed_at"].replace("Z", "+00:00"))
                total_hours += (closed - created).total_seconds() / 3600
                closed_count += 1
        return total_hours / closed_count if closed_count else 0

    def _issue_score(self, issues: list) -> float:
        if not issues:
            return 50

        avg_hours = self._avg_issue_hours(issues)
        closed_count = sum(
            1 for i in issues
            if "pull_request" not in i and i.get("state") == "closed"
        )

        if closed_count == 0:
            return 30

        if avg_hours <= 24:   return 100
        if avg_hours <= 72:   return 80
        if avg_hours <= 168:  return 60
        if avg_hours <= 720:  return 40
        return 20

    def _avg_pr_merge_hours(self, pull_requests: list) -> float:
        total_hours = 0
        merged_count = 0
        for pr in pull_requests:
            if pr.get("merged_at"):
                created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
                merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                total_hours += (merged - created).total_seconds() / 3600
                merged_count += 1
        return total_hours / merged_count if merged_count else 0

    def _pr_score(self, pull_requests: list) -> float:
        if not pull_requests:
            return 50

        avg_hours = self._avg_pr_merge_hours(pull_requests)
        merged_count = sum(1 for pr in pull_requests if pr.get("merged_at"))

        if merged_count == 0:
            return 30

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

    def _docs_score(self, community_files: dict) -> float:
        """README, CONTRIBUTING, LICENSE, ISSUE_TEMPLATE varlığına göre skor."""
        score = 0
        if community_files.get("readme"):        score += 40
        if community_files.get("license"):       score += 25
        if community_files.get("contributing"):  score += 20
        if community_files.get("issue_template"): score += 15
        return float(score)

    def _recommendations(
        self,
        commit_score: float,
        issue_score: float,
        pr_score: float,
        contributor_score: float,
        docs_score: float,
        community_files: dict,
        commits: list,
        contributors: list,
    ) -> list[dict]:
        recs = []

        if commit_score < 60:
            recs.append({
                "area": "Commit Aktivitesi",
                "severity": "high" if commit_score < 40 else "medium",
                "message": f"Son 90 günde yalnızca {len(commits)} commit var. Projeyi aktif tutmak için düzenli commit atmaya çalış.",
            })

        if issue_score < 60:
            recs.append({
                "area": "Issue Yanıt Süresi",
                "severity": "high" if issue_score < 40 else "medium",
                "message": "Issue'lara yanıt süresi yüksek. Issue'ları daha hızlı triaj etmek veya 'good first issue' etiketleyerek community'den yardım almak skoru artırır.",
            })

        if pr_score < 60:
            recs.append({
                "area": "PR Merge Hızı",
                "severity": "high" if pr_score < 40 else "medium",
                "message": "Pull request'ler uzun süre bekliyor. Code review sürecini hızlandırmak veya CODEOWNERS dosyası eklemek yardımcı olabilir.",
            })

        if contributor_score < 60:
            recs.append({
                "area": "Contributor Sayısı",
                "severity": "medium",
                "message": f"Yalnızca {len(contributors)} contributor var. 'good first issue' ve 'help wanted' etiketleri ekleyerek katkıyı teşvik et.",
            })

        if not community_files.get("readme"):
            recs.append({
                "area": "Dokümantasyon",
                "severity": "high",
                "message": "README.md eksik. Projenin ne yaptığını, nasıl kurulacağını ve nasıl kullanılacağını açıklayan bir README ekle.",
            })

        if not community_files.get("contributing"):
            recs.append({
                "area": "Dokümantasyon",
                "severity": "medium",
                "message": "CONTRIBUTING.md eksik. Katkı kurallarını açıklayan bu dosya yeni contributor'ları çekmeye yardımcı olur.",
            })

        if not community_files.get("license"):
            recs.append({
                "area": "Lisans",
                "severity": "high",
                "message": "LICENSE dosyası eksik. Lisanssız projeler hukuki belirsizlik yaratır ve contributor sayısını azaltabilir.",
            })

        if not community_files.get("issue_template"):
            recs.append({
                "area": "Issue Kalitesi",
                "severity": "low",
                "message": ".github/ISSUE_TEMPLATE eklemek, kullanıcıların daha kaliteli bug report ve feature request açmasını sağlar.",
            })

        # Skora göre sırala: high > medium > low
        severity_order = {"high": 0, "medium": 1, "low": 2}
        recs.sort(key=lambda r: severity_order.get(r["severity"], 3))

        return recs
