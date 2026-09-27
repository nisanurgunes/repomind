import datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

router = APIRouter()


@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.name,
                "avatar_url": u.avatar_url,
                "plan": u.plan,
                "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.post("/impersonate/{user_id}")
async def impersonate_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Hedef kullanıcı adına gerçek bir JWT üretir — admin o kullanıcı olarak
    tam bir oturum başlatabilir. Destek/debug amaçlı; şimdilik audit log yok."""
    import uuid as _uuid

    try:
        target_uuid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz kullanıcı ID'si")

    result = await db.execute(select(User).where(User.id == target_uuid))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    payload = {
        "sub": str(target.id),
        "email": target.email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return {
        "token": token,
        "user": {
            "id": str(target.id),
            "email": target.email,
            "name": target.name,
        },
    }
