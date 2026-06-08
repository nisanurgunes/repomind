from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, Enum, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum

class SeverityType(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"

class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(unique=True, index=True)
    owner: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str] = mapped_column(String(511), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    last_analyzed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relations
    snapshots: Mapped[list["RepoSnapshot"]] = relationship(back_populates="repo")
    watchlist: Mapped[list["Watchlist"]] = relationship(back_populates="repo")
    dependencies: Mapped[list["Dependency"]] = relationship(back_populates="repo")
    jobs: Mapped[list["AnalysisJob"]] = relationship(back_populates="repo")


class RepoSnapshot(Base):
    __tablename__ = "repo_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repos.id"), index=True)
    date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    commit_count_30d: Mapped[int] = mapped_column(Integer, default=0)
    commit_count_90d: Mapped[int] = mapped_column(Integer, default=0)
    open_issues: Mapped[int] = mapped_column(Integer, default=0)
    closed_issues: Mapped[int] = mapped_column(Integer, default=0)
    avg_issue_response_hours: Mapped[float] = mapped_column(Float, default=0.0)
    avg_pr_merge_hours: Mapped[float] = mapped_column(Float, default=0.0)
    contributor_count: Mapped[int] = mapped_column(Integer, default=0)
    health_score: Mapped[float] = mapped_column(Float, default=0.0)

    repo: Mapped["Repo"] = relationship(back_populates="snapshots")


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repos.id"), index=True)
    notify_on_score_drop: Mapped[bool] = mapped_column(Boolean, default=True)
    added_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="watchlist")
    repo: Mapped["Repo"] = relationship(back_populates="watchlist")


class Dependency(Base):
    __tablename__ = "dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repos.id"), index=True)
    package_name: Mapped[str] = mapped_column(String(255))
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    has_vulnerability: Mapped[bool] = mapped_column(Boolean, default=False)
    severity: Mapped[SeverityType | None] = mapped_column(
        Enum(SeverityType), nullable=True
    )
    cve_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    repo: Mapped["Repo"] = relationship(back_populates="dependencies")


class NotificationType(str, enum.Enum):
    new_commit = "new_commit"
    score_drop = "score_drop"
    new_pr = "new_pr"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repos.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()
    repo: Mapped["Repo"] = relationship()


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repos.id"), index=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.pending
    )
    triggered_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    repo: Mapped["Repo"] = relationship(back_populates="jobs")