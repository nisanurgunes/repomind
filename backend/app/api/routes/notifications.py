from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.repo import Notification, Watchlist, Repo, RepoSnapshot, NotificationType
from app.services.github import GithubService
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification, Repo.full_name)
        .join(Repo, Notification.repo_id == Repo.id)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(30)
    )
    rows = result.all()
    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "message": n.message,
                "is_read": n.is_read,
                "repo": full_name,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n, full_name in rows
        ],
        "unread_count": sum(1 for n, _ in rows if not n.is_read),
    }


@router.post("/mark-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.post("/check")
async def check_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Watchlist'teki repo'ları kontrol et, yeni bildirim oluştur."""
    github = GithubService()

    watchlist_result = await db.execute(
        select(Watchlist, Repo)
        .join(Repo, Watchlist.repo_id == Repo.id)
        .where(Watchlist.user_id == current_user.id)
    )
    items = watchlist_result.all()

    new_count = 0
    for wl, repo in items:
        try:
            # Son snapshot'ı al
            snap_result = await db.execute(
                select(RepoSnapshot)
                .where(RepoSnapshot.repo_id == repo.id)
                .order_by(desc(RepoSnapshot.date))
                .limit(1)
            )
            last_snap = snap_result.scalar_one_or_none()

            # Son 24 saatteki commitleri çek
            commits = await github.get_commits(repo.owner, repo.name, days=1)
            if commits:
                # Bu commit için daha önce bildirim gönderilmiş mi?
                latest_sha = commits[0].get("sha", "")[:7]
                existing = await db.execute(
                    select(Notification).where(
                        Notification.user_id == current_user.id,
                        Notification.repo_id == repo.id,
                        Notification.type == NotificationType.new_commit,
                        Notification.message.contains(latest_sha),
                    )
                )
                if not existing.scalar_one_or_none():
                    author = commits[0].get("commit", {}).get("author", {}).get("name", "Bilinmeyen")
                    msg = commits[0].get("commit", {}).get("message", "").split("\n")[0][:60]
                    notif = Notification(
                        user_id=current_user.id,
                        repo_id=repo.id,
                        type=NotificationType.new_commit,
                        message=f"{repo.full_name}: {author} — \"{msg}\" [{latest_sha}]",
                    )
                    db.add(notif)
                    new_count += 1

            # Son 24 saatteki PR'ları çek
            prs = await github.get_pull_requests(repo.owner, repo.name)
            recent_prs = [
                pr for pr in prs
                if pr.get("created_at") and
                datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00")) >
                datetime.now(timezone.utc) - timedelta(days=1)
            ]
            for pr in recent_prs[:2]:
                pr_num = pr.get("number")
                existing = await db.execute(
                    select(Notification).where(
                        Notification.user_id == current_user.id,
                        Notification.repo_id == repo.id,
                        Notification.type == NotificationType.new_pr,
                        Notification.message.contains(f"#{pr_num}"),
                    )
                )
                if not existing.scalar_one_or_none():
                    title = pr.get("title", "")[:60]
                    notif = Notification(
                        user_id=current_user.id,
                        repo_id=repo.id,
                        type=NotificationType.new_pr,
                        message=f"{repo.full_name}: Yeni PR #{pr_num} — \"{title}\"",
                    )
                    db.add(notif)
                    new_count += 1

        except Exception:
            continue

    await db.commit()
    return {"checked": len(items), "new_notifications": new_count}
