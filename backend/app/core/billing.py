"""AI kullanım kotası çözümleme ve uygulama.

Kural: kullanıcı Pro planlı bir organizasyonun üyesiyse, kullanımı o
organizasyonun paylaşılan havuzundan düşer (org_slug ile açıkça belirtilebilir,
belirtilmezse en son katılınan Pro org varsayılan olur). Değilse kişisel
plan/kota kullanılır.
"""
from datetime import datetime, timezone

from fastapi import Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.quota_limits import get_limit
from app.core.redis_client import get_redis
from app.models.user import Organization, OrganizationMember, PlanType, User

QUOTA_TTL_SECONDS = 60 * 60 * 24 * 35  # ~35 gün, ayın en uzun haline göre güvenli marj


class QuotaExceededError(Exception):
    def __init__(self, feature_kind: str, limit: int, owner_type: str):
        self.feature_kind = feature_kind
        self.limit = limit
        self.owner_type = owner_type
        super().__init__(f"{owner_type} için {feature_kind} kotası doldu (limit={limit})")


class BillingContext:
    def __init__(self, owner_type: str, owner_id: str, plan: PlanType, org: Organization | None = None):
        self.owner_type = owner_type  # "user" | "org"
        self.owner_id = owner_id
        self.plan = plan
        self.org = org


async def resolve_billing_context(
    user: User, db: AsyncSession, org_slug: str | None = None
) -> BillingContext:
    if org_slug:
        result = await db.execute(
            select(Organization)
            .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
            .where(Organization.slug == org_slug, OrganizationMember.user_id == user.id)
        )
        org = result.scalar_one_or_none()
        if org:
            return BillingContext("org", str(org.id), org.plan, org)
        # org_slug verilmiş ama kullanıcı o org'un üyesi değil — kişisel plana düş

    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == user.id, Organization.plan == PlanType.pro)
        .order_by(OrganizationMember.joined_at.desc())
        .limit(1)
    )
    org = result.scalar_one_or_none()
    if org:
        return BillingContext("org", str(org.id), org.plan, org)

    return BillingContext("user", str(user.id), user.plan, None)


def require_ai_quota(feature_kind: str):
    """`feature_kind`: "generation" (project-analysis/feature-gap/project-doc,
    ortak havuz) veya "chat_message" (advisor-chat, mesaj başına sayılır)."""

    async def _dep(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        org_slug: str | None = Query(None),
    ) -> BillingContext:
        ctx = await resolve_billing_context(current_user, db, org_slug)
        limit = get_limit(feature_kind, ctx.plan, is_org=(ctx.owner_type == "org"))
        if limit is not None:
            redis_client = get_redis()
            month_key = datetime.now(timezone.utc).strftime("%Y-%m")
            key = f"quota:{ctx.owner_type}:{ctx.owner_id}:{feature_kind}:{month_key}"
            count = await redis_client.incr(key)
            if count == 1:
                await redis_client.expire(key, QUOTA_TTL_SECONDS)
            if count > limit:
                raise QuotaExceededError(feature_kind, limit, ctx.owner_type)
        return ctx

    return _dep


require_generation_quota = require_ai_quota("generation")
require_chat_quota = require_ai_quota("chat_message")
