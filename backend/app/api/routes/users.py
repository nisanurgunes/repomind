from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db)):
    return {"user": None}

@router.get("/watchlist")
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    return {"watchlist": []}

@router.post("/watchlist")
async def add_to_watchlist(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    return {"status": "added", "repo": f"{owner}/{name}"}