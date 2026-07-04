from sqlalchemy import String, Enum, DateTime, ForeignKey, func, Integer, Boolean, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum
import uuid

class PlanType(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_id: Mapped[int | None] = mapped_column(unique=True, nullable=True)
    plan: Mapped[PlanType] = mapped_column(
        Enum(PlanType), default=PlanType.free
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relations
    watchlist: Mapped[list["Watchlist"]] = relationship(back_populates="user")
    org_memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user")
    own_repos: Mapped[list["UserRepo"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserRepo(Base):
    """Kullanıcının kendi GitHub repoları — login'de otomatik çekilir."""
    __tablename__ = "user_repos"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    github_repo_id: Mapped[int] = mapped_column(Integer, index=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="own_repos")


class OrgRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    plan: Mapped[PlanType] = mapped_column(Enum(PlanType), default=PlanType.free)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="org")
    invites: Mapped[list["OrgInvite"]] = relationship(back_populates="org")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    role: Mapped[OrgRole] = mapped_column(Enum(OrgRole), default=OrgRole.member)
    joined_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    org: Mapped["Organization"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="org_memberships")


class OrgInvite(Base):
    __tablename__ = "org_invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    org: Mapped["Organization"] = relationship(back_populates="invites")
    inviter: Mapped["User"] = relationship(foreign_keys=[invited_by])


class BillingOwnerType(str, enum.Enum):
    user = "user"
    organization = "organization"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    incomplete = "incomplete"


class Subscription(Base):
    """Bir kullanıcının veya organizasyonun Stripe aboneliği — owner_type'a göre
    user_id veya org_id'den yalnızca biri dolu olur. `plan` alanı (User/Organization
    üzerinde) webhook tarafından bu kayıtla senkron tutulan hızlı-okuma cache'idir."""
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_type: Mapped[BillingOwnerType] = mapped_column(Enum(BillingOwnerType))
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True, index=True)
    org_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    stripe_subscription_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    stripe_price_id: Mapped[str] = mapped_column(String(255))
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus))
    current_period_end: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()
    org: Mapped["Organization"] = relationship()