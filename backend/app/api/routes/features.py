from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.repo import SavedFeature, FeatureStatus
from app.models.user import User
from pydantic import BaseModel
import json

router = APIRouter()


class SaveFeatureRequest(BaseModel):
    repo_full_name: str
    title: str
    description: str
    priority: str = "medium"
    effort: str = "medium"
    seen_in: list[str] = []


class UpdateFeatureRequest(BaseModel):
    status: FeatureStatus


@router.post("/")
async def save_feature(
    body: SaveFeatureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feature = SavedFeature(
        user_id=current_user.id,
        repo_full_name=body.repo_full_name,
        title=body.title,
        description=body.description,
        priority=body.priority,
        effort=body.effort,
        seen_in=json.dumps(body.seen_in),
    )
    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    return _serialize(feature)


@router.get("/")
async def list_features(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedFeature)
        .where(SavedFeature.user_id == current_user.id)
        .order_by(SavedFeature.created_at.desc())
    )
    features = result.scalars().all()
    return {"features": [_serialize(f) for f in features]}


@router.get("/counts")
async def feature_counts_by_repo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Her repo için bekleyen feature sayısı — dashboard badge için."""
    result = await db.execute(
        select(SavedFeature.repo_full_name, func.count(SavedFeature.id))
        .where(
            SavedFeature.user_id == current_user.id,
            SavedFeature.status == FeatureStatus.pending,
        )
        .group_by(SavedFeature.repo_full_name)
    )
    rows = result.all()
    return {"counts": {row[0]: row[1] for row in rows}}


@router.patch("/{feature_id}")
async def update_feature_status(
    feature_id: int,
    body: UpdateFeatureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedFeature).where(
            SavedFeature.id == feature_id,
            SavedFeature.user_id == current_user.id,
        )
    )
    feature = result.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature bulunamadı")
    feature.status = body.status
    await db.commit()
    return _serialize(feature)


@router.delete("/{feature_id}")
async def delete_feature(
    feature_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedFeature).where(
            SavedFeature.id == feature_id,
            SavedFeature.user_id == current_user.id,
        )
    )
    feature = result.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature bulunamadı")
    await db.delete(feature)
    await db.commit()
    return {"ok": True}


def _serialize(f: SavedFeature) -> dict:
    return {
        "id": f.id,
        "repo_full_name": f.repo_full_name,
        "title": f.title,
        "description": f.description,
        "priority": f.priority,
        "effort": f.effort,
        "status": f.status,
        "seen_in": json.loads(f.seen_in) if f.seen_in else [],
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
