from datetime import datetime, timezone
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.orgs import get_org_or_404, require_admin
from app.core.auth import get_current_user
from app.core.billing import resolve_billing_context
from app.core.config import settings
from app.core.database import get_db
from app.core.quota_limits import get_limit
from app.core.redis_client import get_redis
from app.models.user import (
    BillingOwnerType,
    Organization,
    PlanType,
    Subscription,
    SubscriptionStatus,
    User,
)

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


# ── Schemas ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: Literal["personal_pro", "org_pro"]
    org_slug: str | None = None


class PortalRequest(BaseModel):
    org_slug: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _price_id_for(plan: Literal["personal_pro", "org_pro"]) -> str:
    price_id = (
        settings.STRIPE_PRICE_ID_PERSONAL_PRO
        if plan == "personal_pro"
        else settings.STRIPE_PRICE_ID_ORG_PRO
    )
    if not price_id:
        raise HTTPException(status_code=500, detail="Stripe fiyat ID'si yapılandırılmamış.")
    return price_id


async def _get_or_create_customer(
    *, email: str, name: str, existing_customer_id: str | None
) -> str:
    if existing_customer_id:
        return existing_customer_id
    customer = stripe.Customer.create(email=email, name=name)
    return customer.id


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    price_id = _price_id_for(body.plan)

    if body.plan == "org_pro":
        if not body.org_slug:
            raise HTTPException(status_code=400, detail="org_slug gerekli.")
        org = await get_org_or_404(body.org_slug, db)
        await require_admin(org, current_user, db)

        customer_id = await _get_or_create_customer(
            email=current_user.email, name=org.name, existing_customer_id=org.stripe_customer_id
        )
        if not org.stripe_customer_id:
            org.stripe_customer_id = customer_id
            await db.commit()

        metadata = {"owner_type": "organization", "owner_id": str(org.id)}
    else:
        customer_id = await _get_or_create_customer(
            email=current_user.email, name=current_user.name, existing_customer_id=current_user.stripe_customer_id
        )
        if not current_user.stripe_customer_id:
            current_user.stripe_customer_id = customer_id
            await db.commit()

        metadata = {"owner_type": "user", "owner_id": str(current_user.id)}

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/settings?checkout=success",
        cancel_url=f"{settings.FRONTEND_URL}/pricing?checkout=canceled",
        metadata=metadata,
        subscription_data={"metadata": metadata},
    )
    return {"checkout_url": session.url}


@router.post("/portal")
async def create_portal_session(
    body: PortalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.org_slug:
        org = await get_org_or_404(body.org_slug, db)
        await require_admin(org, current_user, db)
        if not org.stripe_customer_id:
            raise HTTPException(status_code=400, detail="Bu organizasyonun aktif bir aboneliği yok.")
        customer_id = org.stripe_customer_id
    else:
        if not current_user.stripe_customer_id:
            raise HTTPException(status_code=400, detail="Aktif bir aboneliğiniz yok.")
        customer_id = current_user.stripe_customer_id

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/settings",
    )
    return {"portal_url": session.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Geçersiz webhook imzası.")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, db)

    return {"received": True}


async def _apply_plan(owner_type: str, owner_id: str, plan: PlanType, db: AsyncSession):
    if owner_type == "user":
        result = await db.execute(select(User).where(User.id == owner_id))
        owner = result.scalar_one_or_none()
    else:
        result = await db.execute(select(Organization).where(Organization.id == int(owner_id)))
        owner = result.scalar_one_or_none()
    if owner:
        owner.plan = plan


async def _handle_checkout_completed(session: dict, db: AsyncSession):
    metadata = session.get("metadata") or {}
    owner_type = metadata.get("owner_type")
    owner_id = metadata.get("owner_id")
    stripe_subscription_id = session.get("subscription")
    if not (owner_type and owner_id and stripe_subscription_id):
        return

    sub = stripe.Subscription.retrieve(stripe_subscription_id)
    price_id = sub["items"]["data"][0]["price"]["id"]

    existing = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    )
    row = existing.scalar_one_or_none()
    if not row:
        row = Subscription(
            owner_type=BillingOwnerType.user if owner_type == "user" else BillingOwnerType.organization,
            user_id=owner_id if owner_type == "user" else None,
            org_id=int(owner_id) if owner_type == "organization" else None,
            stripe_subscription_id=stripe_subscription_id,
            stripe_price_id=price_id,
            status=SubscriptionStatus.active,
            current_period_end=datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc),
        )
        db.add(row)
    else:
        row.status = SubscriptionStatus.active
        row.stripe_price_id = price_id
        row.current_period_end = datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc)

    await _apply_plan(owner_type, owner_id, PlanType.pro, db)
    await db.commit()


async def _handle_subscription_updated(sub: dict, db: AsyncSession):
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub["id"])
    )
    row = result.scalar_one_or_none()
    if not row:
        return

    status_map = {
        "active": SubscriptionStatus.active,
        "past_due": SubscriptionStatus.past_due,
        "canceled": SubscriptionStatus.canceled,
        "incomplete": SubscriptionStatus.incomplete,
        "incomplete_expired": SubscriptionStatus.canceled,
        "unpaid": SubscriptionStatus.past_due,
    }
    row.status = status_map.get(sub["status"], SubscriptionStatus.past_due)
    row.current_period_end = datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc)
    row.cancel_at_period_end = bool(sub.get("cancel_at_period_end"))

    owner_type = "user" if row.owner_type == BillingOwnerType.user else "organization"
    owner_id = str(row.user_id) if row.owner_type == BillingOwnerType.user else str(row.org_id)
    new_plan = PlanType.pro if row.status == SubscriptionStatus.active else PlanType.free
    await _apply_plan(owner_type, owner_id, new_plan, db)
    await db.commit()


async def _handle_subscription_deleted(sub: dict, db: AsyncSession):
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub["id"])
    )
    row = result.scalar_one_or_none()
    if not row:
        return

    row.status = SubscriptionStatus.canceled
    owner_type = "user" if row.owner_type == BillingOwnerType.user else "organization"
    owner_id = str(row.user_id) if row.owner_type == BillingOwnerType.user else str(row.org_id)
    await _apply_plan(owner_type, owner_id, PlanType.free, db)
    await db.commit()


@router.get("/status")
async def get_billing_status(
    org_slug: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await resolve_billing_context(current_user, db, org_slug)
    is_org = ctx.owner_type == "org"

    redis_client = get_redis()
    month_key = datetime.now(timezone.utc).strftime("%Y-%m")
    gen_key = f"quota:{ctx.owner_type}:{ctx.owner_id}:generation:{month_key}"
    chat_key = f"quota:{ctx.owner_type}:{ctx.owner_id}:chat_message:{month_key}"
    generations_used = int(await redis_client.get(gen_key) or 0)
    chat_used = int(await redis_client.get(chat_key) or 0)

    subscription = None
    if is_org and ctx.org:
        result = await db.execute(
            select(Subscription).where(Subscription.org_id == ctx.org.id).order_by(Subscription.id.desc())
        )
    else:
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id).order_by(Subscription.id.desc())
        )
    sub_row = result.scalars().first()
    if sub_row:
        subscription = {
            "status": sub_row.status,
            "current_period_end": sub_row.current_period_end.isoformat(),
            "cancel_at_period_end": sub_row.cancel_at_period_end,
        }

    return {
        "owner_type": ctx.owner_type,
        "org_name": ctx.org.name if ctx.org else None,
        "org_slug": ctx.org.slug if ctx.org else None,
        "plan": ctx.plan,
        "generations_used": generations_used,
        "generations_limit": get_limit("generation", ctx.plan, is_org=is_org),
        "chat_messages_used": chat_used,
        "chat_messages_limit": get_limit("chat_message", ctx.plan, is_org=is_org),
        "subscription": subscription,
    }
