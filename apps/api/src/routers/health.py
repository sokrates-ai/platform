from fastapi import Depends, APIRouter
from sqlmodel import Session
from src.services.health.health import check_health
from src.core.events.database import get_db_session
from src.services.ai.client import get_llm_provider_status


router = APIRouter()

@router.get("")
async def health(db_session: Session = Depends(get_db_session)):
    return await check_health(db_session)


@router.get("/ai")
async def ai_health():
    """Return non-secret AI provider readiness and circuit state."""
    return get_llm_provider_status()
