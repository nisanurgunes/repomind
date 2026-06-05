from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.get("/")
async def get_repos(db: AsyncSession = Depends(get_db)):
    return {"repos": []}

@router.get("/{owner}/{name}")
async def get_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    return {"owner": owner, "name": name}

@router.post("/analyze")
async def analyze_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    return {"status": "pending", "repo": f"{owner}/{name}"}