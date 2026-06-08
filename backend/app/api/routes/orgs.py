from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User, Organization, OrganizationMember, OrgInvite, OrgRole
from pydantic import BaseModel
import secrets
import re

router = APIRouter()


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:50]


# ── Schemas ──────────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str
    description: str | None = None

class InviteCreate(BaseModel):
    email: str

class RoleUpdate(BaseModel):
    role: OrgRole


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_org_or_404(slug: str, db: AsyncSession) -> Organization:
    result = await db.execute(select(Organization).where(Organization.slug == slug))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organizasyon bulunamadı")
    return org


async def get_membership(org_id: int, user_id: int, db: AsyncSession) -> OrganizationMember | None:
    result = await db.execute(
        select(OrganizationMember).where(
            and_(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def require_admin(org: Organization, user: User, db: AsyncSession):
    if org.owner_id == user.id:
        return
    membership = await get_membership(org.id, user.id, db)
    if not membership or membership.role not in (OrgRole.owner, OrgRole.admin):
        raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/")
async def create_org(
    body: OrgCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slug = slugify(body.name)
    # slug unique kontrolü
    base_slug = slug
    i = 1
    while True:
        existing = await db.execute(select(Organization).where(Organization.slug == slug))
        if not existing.scalar_one_or_none():
            break
        slug = f"{base_slug}-{i}"
        i += 1

    org = Organization(
        name=body.name,
        slug=slug,
        description=body.description,
        owner_id=current_user.id,
    )
    db.add(org)
    await db.flush()

    # Owner'ı member olarak da ekle
    member = OrganizationMember(org_id=org.id, user_id=current_user.id, role=OrgRole.owner)
    db.add(member)
    await db.commit()
    await db.refresh(org)

    return {"id": org.id, "name": org.name, "slug": org.slug, "description": org.description}


@router.get("/")
async def list_my_orgs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == current_user.id)
    )
    orgs = result.scalars().all()
    return [{"id": o.id, "name": o.name, "slug": o.slug, "description": o.description} for o in orgs]


@router.get("/{slug}")
async def get_org(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await get_org_or_404(slug, db)
    membership = await get_membership(org.id, current_user.id, db)
    if not membership:
        raise HTTPException(status_code=403, detail="Bu organizasyona erişim yetkiniz yok")

    # Üyeleri getir
    members_result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.org_id == org.id)
    )
    members = [
        {
            "user_id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "role": m.role,
            "joined_at": m.joined_at.isoformat(),
        }
        for m, u in members_result.all()
    ]

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "owner_id": org.owner_id,
        "my_role": membership.role,
        "members": members,
    }


@router.post("/{slug}/invite")
async def invite_member(
    slug: str,
    body: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await get_org_or_404(slug, db)
    await require_admin(org, current_user, db)

    # Zaten üye mi?
    user_result = await db.execute(select(User).where(User.email == body.email))
    existing_user = user_result.scalar_one_or_none()
    if existing_user:
        existing_member = await get_membership(org.id, existing_user.id, db)
        if existing_member:
            raise HTTPException(status_code=400, detail="Bu kullanıcı zaten üye")

    # Bekleyen davet var mı?
    existing_invite = await db.execute(
        select(OrgInvite).where(
            and_(OrgInvite.org_id == org.id, OrgInvite.email == body.email, OrgInvite.is_accepted == False)
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu e-postaya zaten davet gönderildi")

    token = secrets.token_urlsafe(32)
    invite = OrgInvite(
        org_id=org.id,
        invited_by=current_user.id,
        email=body.email,
        token=token,
    )
    db.add(invite)
    await db.commit()

    # TODO: gerçek e-posta gönder
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    invite_link = f"{frontend_url}/org/join?token={token}"

    return {"message": "Davet gönderildi", "invite_link": invite_link, "token": token}


@router.get("/join/{token}")
async def join_org(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgInvite).where(and_(OrgInvite.token == token, OrgInvite.is_accepted == False))
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Geçersiz veya kullanılmış davet linki")

    # Zaten üye mi?
    existing = await get_membership(invite.org_id, current_user.id, db)
    if existing:
        raise HTTPException(status_code=400, detail="Zaten bu organizasyonun üyesisiniz")

    member = OrganizationMember(org_id=invite.org_id, user_id=current_user.id, role=OrgRole.member)
    db.add(member)
    invite.is_accepted = True
    await db.commit()

    org_result = await db.execute(select(Organization).where(Organization.id == invite.org_id))
    org = org_result.scalar_one()
    return {"message": "Organizasyona katıldınız", "org_slug": org.slug, "org_name": org.name}


@router.delete("/{slug}/members/{user_id}")
async def remove_member(
    slug: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await get_org_or_404(slug, db)
    await require_admin(org, current_user, db)

    if user_id == org.owner_id:
        raise HTTPException(status_code=400, detail="Owner çıkarılamaz")

    membership = await get_membership(org.id, user_id, db)
    if not membership:
        raise HTTPException(status_code=404, detail="Üye bulunamadı")

    await db.delete(membership)
    await db.commit()
    return {"message": "Üye çıkarıldı"}


@router.patch("/{slug}/members/{user_id}/role")
async def update_member_role(
    slug: str,
    user_id: int,
    body: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = await get_org_or_404(slug, db)
    if org.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sadece owner rol değiştirebilir")

    membership = await get_membership(org.id, user_id, db)
    if not membership:
        raise HTTPException(status_code=404, detail="Üye bulunamadı")

    membership.role = body.role
    await db.commit()
    return {"message": "Rol güncellendi"}
