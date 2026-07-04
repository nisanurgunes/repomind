from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.auth import get_current_user
from app.core.billing import BillingContext, require_chat_quota, require_generation_quota
from app.core.database import get_db
from app.models.repo import Repo, RepoSnapshot, UsageEvent
from app.models.user import User
from app.services.github import GithubService
from app.services.health_score import HealthScoreEngine
from app.services.readme_parser import parse_readme
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/")
async def get_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo))
    repos = result.scalars().all()
    return {"repos": [{"id": r.id, "full_name": r.full_name, "stars": r.stars} for r in repos]}

@router.post("/analyze")
async def analyze_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    github = GithubService()
    engine = HealthScoreEngine()

    try:
        repo_data = await github.get_repo(owner, name)
        commits = await github.get_commits(owner, name)
        issues = await github.get_issues(owner, name)
        pull_requests = await github.get_pull_requests(owner, name)
        contributors = await github.get_contributors(owner, name)
        community_files = await github.get_community_files(owner, name)
        readme_content = await github.get_readme_content(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    repo_topics = repo_data.get("topics", [])
    readme_info = parse_readme(readme_content, repo_topics)

    score_data = engine.calculate(repo_data, commits, issues, pull_requests, contributors, community_files)

    result = await db.execute(
        select(Repo).where(Repo.github_id == repo_data["id"])
    )
    repo = result.scalar_one_or_none()

    if not repo:
        repo = Repo(
            github_id=repo_data["id"],
            owner=owner,
            name=name,
            full_name=repo_data["full_name"],
            description=repo_data.get("description"),
            stars=repo_data.get("stargazers_count", 0),
            forks=repo_data.get("forks_count", 0),
            language=repo_data.get("language"),
            is_archived=repo_data.get("archived", False),
        )
        db.add(repo)
        await db.flush()

    repo.last_analyzed_at = datetime.now(timezone.utc)

    snapshot = RepoSnapshot(
        repo_id=repo.id,
        commit_count_30d=score_data["metrics"]["commit_count_90d"],
        commit_count_90d=score_data["metrics"]["commit_count_90d"],
        open_issues=score_data["metrics"]["open_issues"],
        avg_issue_response_hours=score_data["metrics"]["avg_issue_response_hours"],
        avg_pr_merge_hours=score_data["metrics"]["avg_pr_merge_hours"],
        contributor_count=score_data["metrics"]["contributor_count"],
        health_score=score_data["health_score"],
    )
    db.add(snapshot)
    await db.commit()

    return {
        "id": repo.id,
        "repo": f"{owner}/{name}",
        "health_score": score_data["health_score"],
        "breakdown": score_data["breakdown"],
        "metrics": score_data["metrics"],
        "recommendations": score_data["recommendations"],
        "readme": readme_info,
    }

@router.get("/chart/{owner}/{name}/commits")
async def get_commit_chart(owner: str, name: str):
    github = GithubService()
    try:
        commits = await github.get_commits(owner, name, days=90)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    weeks = {}
    for commit in commits:
        date_str = commit["commit"]["author"]["date"]
        date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        week_start = date - timedelta(days=date.weekday())
        week_key = week_start.strftime("%d %b")
        weeks[week_key] = weeks.get(week_key, 0) + 1

    chart_data = [
        {"week": week, "commits": count}
        for week, count in sorted(weeks.items())
    ]
    return {"chart_data": chart_data}

@router.get("/{owner}/{name}/scorecard")
async def get_scorecard(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Public — login gerektirmez. Paylaşılabilir skor kartı verisi."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı. Önce analiz edilmeli.")

    snapshot_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(1)
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Henüz analiz edilmemiş.")

    return {
        "full_name": repo.full_name,
        "description": repo.description,
        "language": repo.language,
        "stars": repo.stars,
        "forks": repo.forks,
        "health_score": snapshot.health_score,
        "commit_count_90d": snapshot.commit_count_90d,
        "open_issues": snapshot.open_issues,
        "contributor_count": snapshot.contributor_count,
        "avg_issue_response_hours": snapshot.avg_issue_response_hours,
        "avg_pr_merge_hours": snapshot.avg_pr_merge_hours,
        "analyzed_at": snapshot.date.isoformat() if snapshot.date else None,
    }

@router.get("/{owner}/{name}/badge")
async def get_badge(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Public — README'ye eklenebilir SVG badge."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()

    score = None
    if repo:
        snapshot_result = await db.execute(
            select(RepoSnapshot)
            .where(RepoSnapshot.repo_id == repo.id)
            .order_by(desc(RepoSnapshot.date))
            .limit(1)
        )
        snap = snapshot_result.scalar_one_or_none()
        if snap:
            score = snap.health_score

    if score is None:
        score = "?"
        color = "#6b7280"
        label_color = "#374151"
    elif score >= 80:
        color = "#16a34a"
        label_color = "#15803d"
    elif score >= 60:
        color = "#ca8a04"
        label_color = "#b45309"
    else:
        color = "#dc2626"
        label_color = "#b91c1c"

    score_text = str(score)
    score_width = len(score_text) * 7 + 16
    total_width = 82 + score_width

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="DevPulse: {score_text}">
  <title>DevPulse Score: {score_text}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total_width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="82" height="20" fill="#555"/>
    <rect x="82" width="{score_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="41" y="15" fill="#010101" fill-opacity=".3">DevPulse</text>
    <text x="41" y="14">DevPulse</text>
    <text x="{82 + score_width // 2}" y="15" fill="#010101" fill-opacity=".3">{score_text}</text>
    <text x="{82 + score_width // 2}" y="14">{score_text}</text>
  </g>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "no-cache, max-age=0",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/{owner}/{name}/history")
async def get_repo_history(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Son 10 snapshot — skor geçmişi grafiği için."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")

    snapshots_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(10)
    )
    snapshots = snapshots_result.scalars().all()

    return {
        "history": [
            {
                "date": s.date.strftime("%d %b") if s.date else "",
                "health_score": s.health_score,
                "commit_count_90d": s.commit_count_90d,
                "open_issues": s.open_issues,
                "contributor_count": s.contributor_count,
            }
            for s in reversed(snapshots)
        ]
    }

@router.get("/{owner}/{name}/contributors-analysis")
async def get_contributors_analysis(owner: str, name: str):
    """Ekip analitik verisi — contributor, PR, commit zaman dağılımı, hot spot."""
    github = GithubService()
    try:
        commits = await github.get_commits_detailed(owner, name, days=90)
        contributors = await github.get_contributors(owner, name)
        pull_requests = await github.get_pull_requests_detailed(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    # --- Contributor bazlı commit sayısı ---
    contributor_commits: dict[str, int] = {}
    hourly_counts = [0] * 24
    daily_counts = [0] * 7  # 0=Mon ... 6=Sun
    file_changes: dict[str, int] = {}

    for commit in commits:
        author = (
            commit.get("author", {}) or {}
        )
        login = author.get("login") or (commit.get("commit", {}).get("author", {}).get("name") or "unknown")
        contributor_commits[login] = contributor_commits.get(login, 0) + 1

        # Commit zamanı
        date_str = commit.get("commit", {}).get("author", {}).get("date", "")
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                hourly_counts[dt.hour] += 1
                daily_counts[dt.weekday()] += 1
            except Exception:
                pass

    # Hot spot: top 20 commit için dosya listesini çek (rate limit'e takılmamak için)
    top_shas = [c["sha"] for c in commits[:20]]
    for sha in top_shas:
        files = await github.get_commit_files(owner, name, sha)
        for f in files:
            file_changes[f] = file_changes.get(f, 0) + 1

    hot_spots = sorted(file_changes.items(), key=lambda x: x[1], reverse=True)[:10]

    # --- PR metrikleri ---
    merged_prs = [pr for pr in pull_requests if pr.get("merged_at")]
    open_prs = [pr for pr in pull_requests if pr.get("state") == "open"]

    merge_hours_list = []
    for pr in merged_prs:
        try:
            created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
            merge_hours_list.append((merged - created).total_seconds() / 3600)
        except Exception:
            pass

    avg_merge_hours = round(sum(merge_hours_list) / len(merge_hours_list), 1) if merge_hours_list else None

    total_commits = len(commits)
    contributor_list = [
        {
            "login": login,
            "commits": count,
            "percent": round(count / total_commits * 100, 1) if total_commits else 0,
            "avatar_url": next(
                (c.get("avatar_url") for c in contributors if c.get("login") == login), None
            ),
        }
        for login, count in sorted(contributor_commits.items(), key=lambda x: x[1], reverse=True)
    ]

    days_labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    return {
        "contributors": contributor_list,
        "total_commits": total_commits,
        "pr_metrics": {
            "total": len(pull_requests),
            "merged": len(merged_prs),
            "open": len(open_prs),
            "avg_merge_hours": avg_merge_hours,
        },
        "commit_heatmap": {
            "hourly": [{"hour": f"{h:02d}:00", "commits": hourly_counts[h]} for h in range(24)],
            "daily": [{"day": days_labels[i], "commits": daily_counts[i]} for i in range(7)],
        },
        "hot_spots": [{"file": f, "changes": c} for f, c in hot_spots],
    }


@router.post("/{owner}/{name}/advisor-chat")
async def advisor_chat(
    owner: str,
    name: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    billing_ctx: BillingContext = Depends(require_chat_quota),
):
    """
    Repo bağlamını bilen ürün danışmanı AI ile serbest chat.
    body: { messages: [{role, content}], repo_context: {description, language, topics, readme_excerpt} }
    """
    import anthropic, os

    messages = body.get("messages", [])
    repo_context = body.get("repo_context", {})

    if not messages:
        raise HTTPException(status_code=400, detail="Mesaj gerekli.")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY eksik.")

    focus_areas = repo_context.get('focus_areas', [])
    top_suggestions = repo_context.get('top_suggestions', [])
    project_summary = repo_context.get('project_summary', '')
    project_stage = repo_context.get('project_stage', '')

    system_prompt = f"""Sen deneyimli bir ürün danışmanı ve startup mentörüsün. Kullanıcı seninle kendi GitHub projesi hakkında fikir tartışıyor.

Proje Bağlamı:
- Repo: {owner}/{name}
- Açıklama: {repo_context.get('description') or 'Belirtilmemiş'}
- Dil/Stack: {repo_context.get('language') or 'Belirtilmemiş'}
- Topics: {', '.join(repo_context.get('topics', [])) or 'Yok'}
{f'- Proje Aşaması: {project_stage}' if project_stage else ''}
{f'- Proje Özeti: {project_summary}' if project_summary else ''}
{f'- Tespit Edilen Odak Alanları: {", ".join(focus_areas)}' if focus_areas else ''}
{f'- Önerilen Geliştirmeler: {", ".join(top_suggestions)}' if top_suggestions else ''}

Görevin:
- Projeyi zaten analiz ettin — kod yapısı, commit geçmişi, issue'lar incelendi. Bu bilgilere dayanarak konuş.
- Kullanıcıya "Projen ne yapıyor?", "Hedef kitlen kim?" gibi sorular SORMA. Bu bilgileri zaten analiz ettin.
- Kullanıcı bir konu açtığında direkt görüşünü söyle, önce soru sormaya geçme.
- Analiz bulgularına dayanarak projeye özgü somut öneriler ver.
- Gerektiğinde kullanıcının fikirlerini değerlendir, riskleri ve alternatifleri belirt.
- Kısa ve aksiyon odaklı yanıtlar ver.
- Türkçe konuş."""

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        db.add(UsageEvent(
            user_id=current_user.id,
            org_id=billing_ctx.org.id if billing_ctx.org else None,
            feature="advisor_chat",
            repo_full_name=f"{owner}/{name}",
        ))
        await db.commit()
        return {"reply": response.content[0].text}
    except Exception:
        raise HTTPException(status_code=500, detail="Yanıt alınamadı. Tekrar deneyin.")


@router.get("/{owner}/{name}/project-analysis")
async def get_project_analysis(
    owner: str,
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    billing_ctx: BillingContext = Depends(require_generation_quota),
):
    """
    Kullanıcının kendi projesini derin analiz eder:
    - Kod yapısı, README, config dosyaları
    - Son commit geçmişi (ne üzerinde çalışılmış)
    - Issues (neler bekliyor)
    Karşılaştırma yapmadan, projenin kendisine özgü AI feature önerisi üretir.
    """
    import anthropic, os, json

    github = GithubService()

    try:
        repo_data = await github.get_repo(owner, name)
        readme = await github.get_readme_content(owner, name) or ""
        file_tree = await github.get_file_tree(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    # Önemli config/entry dosyalarını oku
    key_files_content = {}
    key_file_candidates = [
        f for f in file_tree
        if any(f.endswith(ext) for ext in [
            "package.json", "pyproject.toml", "requirements.txt",
            "Dockerfile", "docker-compose.yml", "Makefile",
            "go.mod", "Cargo.toml", "pom.xml", ".env.example"
        ])
    ]
    for path in key_file_candidates[:5]:
        content = await github.get_file_content(owner, name, path)
        if content:
            key_files_content[path] = content

    # Son commit'leri çek (son 30 gün)
    try:
        commits_raw = await github.get_commits(owner, name, days=30)
        recent_commits = [
            f"- {c['commit']['message'].split(chr(10))[0][:100]} ({c['commit']['author']['date'][:10]})"
            for c in commits_raw[:20]
        ]
    except Exception:
        recent_commits = []

    # Açık issue'ları çek
    try:
        issues_raw = await github.get_issues(owner, name)
        open_issues = [
            f"- {i['title'][:100]}"
            for i in issues_raw
            if i.get("state") == "open" and "pull_request" not in i
        ][:15]
    except Exception:
        open_issues = []

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY eksik.")

    client = anthropic.Anthropic(api_key=api_key)

    file_tree_str = "\n".join(file_tree[:60]) if file_tree else "Bilgi yok"
    key_files_str = "\n\n".join([f"### {p}\n{c}" for p, c in key_files_content.items()]) or "Yok"
    commits_str = "\n".join(recent_commits) if recent_commits else "Son commit bulunamadı"
    issues_str = "\n".join(open_issues) if open_issues else "Açık issue yok"

    prompt = f"""Sen deneyimli bir yazılım mühendisisin. Aşağıdaki GitHub projesini derinlemesine analiz et ve geliştirme önerileri sun.

## Proje: {owner}/{name}
Açıklama: {repo_data.get('description') or 'Yok'}
Dil: {repo_data.get('language') or 'Bilinmiyor'}
Topics: {', '.join(repo_data.get('topics', [])) or 'Yok'}
Stars: {repo_data.get('stargazers_count', 0):,}
Open Issues: {repo_data.get('open_issues_count', 0)}

## Dosya Yapısı:
{file_tree_str}

## Önemli Dosyalar:
{key_files_str}

## README:
{readme[:2500]}

## Son 30 Günlük Commit Geçmişi:
{commits_str}

## Açık Issue'lar:
{issues_str}

---

Görevin: Bu projenin mevcut durumunu, commit geçmişini ve issue'larını dikkate alarak:
1. Projenin hangi aşamada olduğunu anla (başlangıç/gelişme/olgunlaşma)
2. Kod yapısına ve commit geçmişine göre eksik veya geliştirilmesi gereken alanları tespit et
3. Pratik, öncelikli ve bu projeye özgü feature/iyileştirme önerileri sun

SADECE JSON formatında yanıt ver:
{{
  "project_stage": "early|growing|mature",
  "project_summary": "Projenin ne yaptığı ve nerede olduğu hakkında 2-3 cümle",
  "suggestions": [
    {{
      "title": "Kısa başlık (max 8 kelime)",
      "description": "Bu önerinin neden bu projeye uygun olduğunu açıkla (2-3 cümle)",
      "rationale": "Commit geçmişi veya kod yapısından neden bu öneriyi çıkardın (1 cümle)",
      "priority": "high|medium|low",
      "effort": "small|medium|large",
      "category": "feature|refactor|devops|testing|docs|security"
    }}
  ],
  "focus_areas": ["Mevcut odak alanı 1", "Mevcut odak alanı 2"]
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        # JSON bloğunu güvenli çıkar
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("JSON bulunamadı")
        result = json.loads(raw[start:end])
        db.add(UsageEvent(
            user_id=current_user.id,
            org_id=billing_ctx.org.id if billing_ctx.org else None,
            feature="project_analysis",
            repo_full_name=f"{owner}/{name}",
        ))
        await db.commit()
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Analiz tamamlanamadı. Lütfen tekrar deneyin.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.")


@router.get("/{owner}/{name}/feature-gap")
async def get_feature_gap(
    owner: str,
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    billing_ctx: BillingContext = Depends(require_generation_quota),
):
    """
    Verilen repoya benzer projeleri bul, README'lerini analiz et ve
    'onlarda var, sende yok' feature önerileri üret.
    """
    import anthropic
    import os

    github = GithubService()

    try:
        repo_data = await github.get_repo(owner, name)
        user_readme = await github.get_readme_content(owner, name) or ""
        file_tree = await github.get_file_tree(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    # Önemli config/entry dosyalarını oku (package.json, pyproject.toml, vb.)
    key_files_content = {}
    key_file_candidates = [
        f for f in file_tree
        if any(f.endswith(ext) for ext in [
            "package.json", "pyproject.toml", "requirements.txt",
            "Dockerfile", "docker-compose.yml", ".github/workflows",
            "Makefile", "go.mod", "Cargo.toml", "pom.xml"
        ])
    ]
    for path in key_file_candidates[:4]:
        content = await github.get_file_content(owner, name, path)
        if content:
            key_files_content[path] = content

    # Benzer repoları bul
    try:
        similar_repos = await github.search_similar_repos(owner, name, repo_data)
    except Exception:
        similar_repos = []

    if not similar_repos:
        raise HTTPException(status_code=404, detail="Benzer repo bulunamadı.")

    # Benzer repoların README'lerini çek
    similar_readmes = []
    for repo in similar_repos[:4]:
        try:
            r_owner, r_name = repo["full_name"].split("/")
            readme = await github.get_readme_content(r_owner, r_name)
            if readme:
                similar_readmes.append({
                    "full_name": repo["full_name"],
                    "description": repo.get("description") or "",
                    "stars": repo.get("stargazers_count", 0),
                    "readme": readme[:3000],  # token limitini aş
                })
        except Exception:
            continue

    if not similar_readmes:
        raise HTTPException(status_code=404, detail="Benzer repoların README'leri okunamadı.")

    # Claude ile gap analizi
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY eksik.")

    client = anthropic.Anthropic(api_key=api_key)

    similar_text = "\n\n".join([
        f"## {r['full_name']} ({r['stars']:,} ⭐)\n{r['description']}\n\nREADME:\n{r['readme']}"
        for r in similar_readmes
    ])

    file_tree_str = "\n".join(file_tree[:60]) if file_tree else "Bilgi yok"
    key_files_str = "\n\n".join([f"### {path}\n{content}" for path, content in key_files_content.items()]) if key_files_content else "Yok"

    prompt = f"""Sen bir yazılım geliştirici asistanısın. Kullanıcının GitHub reposunu hem kendi kodu hem de benzer projelerle karşılaştırıp eksik feature önerileri sunacaksın.

## Kullanıcının reposu: {owner}/{name}
Açıklama: {repo_data.get('description') or 'Yok'}
Dil: {repo_data.get('language') or 'Bilinmiyor'}
Topics: {', '.join(repo_data.get('topics', [])) or 'Yok'}

Dosya yapısı:
{file_tree_str}

Önemli dosyalar:
{key_files_str}

README:
{user_readme[:2000]}

---

## Benzer projeler ve README'leri:
{similar_text}

---

Görevin:
1. Benzer projelerde görülen ama kullanıcının projesinde olmayan önemli feature'ları tespit et.
2. Her öneri için somut ve uygulanabilir bir açıklama yaz.
3. Teknik jargon kullan ama anlaşılır ol.

SADECE JSON formatında yanıt ver, başka hiçbir şey yazma:
{{
  "similar_repos": [
    {{"full_name": "...", "stars": 0, "description": "..."}}
  ],
  "suggestions": [
    {{
      "title": "Kısa başlık (max 8 kelime)",
      "description": "Bu feature nedir ve neden faydalı (2-3 cümle)",
      "seen_in": ["repo/adı"],
      "priority": "high|medium|low",
      "effort": "small|medium|large"
    }}
  ],
  "summary": "Genel değerlendirme — 2-3 cümle"
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        import json
        raw = message.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("JSON bulunamadı")
        result = json.loads(raw[start:end])
        db.add(UsageEvent(
            user_id=current_user.id,
            org_id=billing_ctx.org.id if billing_ctx.org else None,
            feature="feature_gap",
            repo_full_name=f"{owner}/{name}",
        ))
        await db.commit()
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Analiz tamamlanamadı. Lütfen tekrar deneyin.")
    except Exception:
        raise HTTPException(status_code=500, detail="Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.")


@router.get("/{owner}/{name}/project-doc")
async def get_project_doc(
    owner: str,
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    billing_ctx: BillingContext = Depends(require_generation_quota),
):
    """
    Projenin mevcut (zaten var olan) özelliklerini, teknoloji yığınını ve
    varsa API endpoint'lerini tespit eder. Feature Gap / Proje Analizi'nin
    aksine eksik değil, VAR OLAN işlevleri döndürür — sunum/yatırımcı
    dokümanı üretmek için kullanılır.
    """
    import anthropic, os, json

    github = GithubService()

    try:
        repo_data = await github.get_repo(owner, name)
        readme = await github.get_readme_content(owner, name) or ""
        file_tree = await github.get_file_tree(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    key_files_content = {}
    key_file_candidates = [
        f for f in file_tree
        if any(f.endswith(ext) for ext in [
            "package.json", "pyproject.toml", "requirements.txt",
            "Dockerfile", "docker-compose.yml", "Makefile",
            "go.mod", "Cargo.toml", "pom.xml",
        ])
    ]
    for path in key_file_candidates[:5]:
        content = await github.get_file_content(owner, name, path)
        if content:
            key_files_content[path] = content

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY eksik.")

    client = anthropic.Anthropic(api_key=api_key)

    file_tree_str = "\n".join(file_tree[:80]) if file_tree else "Bilgi yok"
    key_files_str = "\n\n".join([f"### {p}\n{c}" for p, c in key_files_content.items()]) or "Yok"

    prompt = f"""Sen bir teknik yazarsın. Aşağıdaki GitHub projesini, bu projeyi hiç bilmeyen birine (ör. bir yatırımcıya veya iş ortağına) sunmak için dokümante edeceksin.

## Proje: {owner}/{name}
Açıklama: {repo_data.get('description') or 'Yok'}
Dil: {repo_data.get('language') or 'Bilinmiyor'}
Topics: {', '.join(repo_data.get('topics', [])) or 'Yok'}
Stars: {repo_data.get('stargazers_count', 0):,}

## Dosya Yapısı:
{file_tree_str}

## Önemli Dosyalar:
{key_files_str}

## README:
{readme[:4000]}

---

Görevin: SADECE bu projede HALİHAZIRDA VAR OLAN özellikleri ve teknik yapıyı çıkar. Eksik/önerilecek şeyleri değil, mevcut olanı anlat.

Kurallar:
- "features" listesi README, dosya yapısı ve kod dosyalarından net şekilde anlaşılan gerçek işlevler olmalı. Var olduğuna emin olmadığın bir şeyi uydurma.
- "endpoints" sadece README'de açıkça dokümante edilmişse veya dosya yapısından (route/controller dosya adlarından) net şekilde çıkarılabiliyorsa doldur. Emin değilsen boş liste döndür — endpoint uydurma.
- "tech_stack" key dosyalardan (package.json, requirements.txt vb.) ve dosya uzantılarından objektif olarak çıkar.

SADECE JSON formatında yanıt ver:
{{
  "tagline": "Projeyi tek cümlede özetleyen çarpıcı bir başlık (max 15 kelime)",
  "overview": "Projenin ne yaptığı, kimin için olduğu — 3-4 cümlelik yönetici özeti",
  "tech_stack": [["Katman", "Teknoloji / Detay"]],
  "features": [
    {{"title": "Kısa başlık (max 6 kelime)", "description": "Bu özellik ne yapar, kullanıcıya ne kazandırır (2-3 cümle)"}}
  ],
  "endpoints": [
    {{"method": "GET|POST|PUT|PATCH|DELETE", "path": "/...", "desc": "Kısa açıklama"}}
  ],
  "highlights": ["Öne çıkan, satış konuşmasında kullanılabilecek madde"]
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("JSON bulunamadı")
        data = json.loads(raw[start:end])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Doküman oluşturulamadı. Lütfen tekrar deneyin.")
    except Exception:
        raise HTTPException(status_code=500, detail="Doküman oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.")

    data["repo"] = {
        "full_name": repo_data.get("full_name", f"{owner}/{name}"),
        "description": repo_data.get("description"),
        "language": repo_data.get("language"),
        "stars": repo_data.get("stargazers_count", 0),
    }
    db.add(UsageEvent(
        user_id=current_user.id,
        org_id=billing_ctx.org.id if billing_ctx.org else None,
        feature="project_doc",
        repo_full_name=f"{owner}/{name}",
    ))
    await db.commit()
    return data


@router.get("/{owner}/{name}")
async def get_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")

    snapshot_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(1)
    )
    snapshot = snapshot_result.scalar_one_or_none()

    return {
        "id": repo.id,
        "full_name": repo.full_name,
        "description": repo.description,
        "stars": repo.stars,
        "forks": repo.forks,
        "language": repo.language,
        "last_analyzed_at": repo.last_analyzed_at.isoformat() if repo.last_analyzed_at else None,
        "latest_snapshot": {
            "health_score": snapshot.health_score,
            "commit_count_90d": snapshot.commit_count_90d,
            "open_issues": snapshot.open_issues,
            "contributor_count": snapshot.contributor_count,
            "avg_issue_response_hours": snapshot.avg_issue_response_hours,
            "avg_pr_merge_hours": snapshot.avg_pr_merge_hours,
            "date": snapshot.date.isoformat() if snapshot.date else None,
        } if snapshot else None,
    }
