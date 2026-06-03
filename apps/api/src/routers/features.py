from fastapi import APIRouter, Depends
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.feature_flags import EffectiveFeatureFlags, FeatureFlagRead, FeatureFlagUpdate
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.features import (
    get_effective_feature_flags,
    list_admin_feature_flags,
    update_admin_feature_flag,
)


router = APIRouter()


@router.get("/effective")
async def api_get_effective_feature_flags(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EffectiveFeatureFlags:
    return get_effective_feature_flags(org_id, db_session, current_user)


@router.get("/admin")
async def api_get_admin_feature_flags(
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> list[FeatureFlagRead]:
    return list_admin_feature_flags(db_session, current_user)


@router.put("/admin/{key}")
async def api_update_admin_feature_flag(
    key: str,
    update: FeatureFlagUpdate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FeatureFlagRead:
    return update_admin_feature_flag(key, update, db_session, current_user)
