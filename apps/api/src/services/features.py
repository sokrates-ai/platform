from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from src.db.feature_flags import (
    EffectiveFeatureFlags,
    FEATURE_AUDIENCE_ROLES,
    FeatureAudience,
    FeatureDefinition,
    FeatureFlagRead,
    FeatureFlagUpdate,
    FeatureKey,
    InstanceFeatureFlag,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser


FEATURE_REGISTRY: dict[FeatureKey, FeatureDefinition] = {
    "pride_mode": FeatureDefinition(
        key="pride_mode",
        label="Pride mode",
        description="Shows the seasonal pride footer and pride navigation styling.",
        category="Experience",
        default_enabled=False,
        default_audience=FeatureAudience(type="roles", roles=["student"]),
    )
}

ROLE_UUID_TO_AUDIENCE_ROLE = {
    "role_global_student": "student",
    "role_global_tutor": "tutor",
    "role_global_maintainer": "maintainer",
    "role_global_admin": "admin",
}

ROLE_ID_TO_AUDIENCE_ROLE = {
    1: "admin",
    2: "maintainer",
    3: "student",
    4: "tutor",
}


def _normalize_audience(raw_audience: dict | FeatureAudience | None) -> FeatureAudience:
    if isinstance(raw_audience, FeatureAudience):
        return raw_audience
    if not raw_audience:
        return FeatureAudience(type="roles", roles=[])
    return FeatureAudience(**raw_audience)


def _stored_flags(db_session: Session) -> dict[str, InstanceFeatureFlag]:
    flags = db_session.exec(select(InstanceFeatureFlag)).all()
    return {flag.key: flag for flag in flags}


def _read_flag(definition: FeatureDefinition, stored: InstanceFeatureFlag | None) -> FeatureFlagRead:
    audience = (
        _normalize_audience(stored.audience)
        if stored
        else definition.default_audience
    )
    return FeatureFlagRead(
        key=definition.key,
        label=definition.label,
        description=definition.description,
        category=definition.category,
        enabled=stored.enabled if stored else definition.default_enabled,
        audience=audience,
        default_enabled=definition.default_enabled,
        default_audience=definition.default_audience,
        updated_at=stored.update_date if stored else None,
    )


def _roles_for_user_in_org(
    db_session: Session,
    user_id: int,
    org_id: int,
) -> list[str]:
    roles = db_session.exec(
        select(Role)
        .join(UserOrganization, Role.id == UserOrganization.role_id)
        .where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id,
        )
    ).all()

    audience_roles: list[str] = []
    for role in roles:
        mapped_role = ROLE_UUID_TO_AUDIENCE_ROLE.get(role.role_uuid)
        if not mapped_role and role.id is not None:
            mapped_role = ROLE_ID_TO_AUDIENCE_ROLE.get(role.id)
        if mapped_role and mapped_role not in audience_roles:
            audience_roles.append(mapped_role)
    return audience_roles


def _require_admin(db_session: Session, current_user: PublicUser) -> None:
    user_roles = db_session.exec(
        select(Role)
        .join(UserOrganization, Role.id == UserOrganization.role_id)
        .where(UserOrganization.user_id == current_user.id)
    ).all()
    is_admin = any(
        role.id == 1 or role.role_uuid == "role_global_admin"
        for role in user_roles
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required.")


def list_admin_feature_flags(
    db_session: Session,
    current_user: PublicUser,
) -> list[FeatureFlagRead]:
    _require_admin(db_session, current_user)
    stored_by_key = _stored_flags(db_session)
    return [
        _read_flag(definition, stored_by_key.get(key))
        for key, definition in FEATURE_REGISTRY.items()
    ]


def update_admin_feature_flag(
    key: str,
    update: FeatureFlagUpdate,
    db_session: Session,
    current_user: PublicUser,
) -> FeatureFlagRead:
    _require_admin(db_session, current_user)
    if key not in FEATURE_REGISTRY:
        raise HTTPException(status_code=404, detail="Unknown feature flag")

    invalid_roles = [
        role for role in update.audience.roles
        if role not in FEATURE_AUDIENCE_ROLES
    ]
    if invalid_roles:
        raise HTTPException(status_code=422, detail="Unknown audience role")

    stored = db_session.exec(
        select(InstanceFeatureFlag).where(InstanceFeatureFlag.key == key)
    ).first()
    now = str(datetime.now())
    if stored is None:
        stored = InstanceFeatureFlag(
            key=key,
            enabled=update.enabled,
            audience=update.audience.dict(),
            creation_date=now,
            update_date=now,
        )
    else:
        stored.enabled = update.enabled
        stored.audience = update.audience.dict()
        stored.update_date = now

    db_session.add(stored)
    db_session.commit()
    db_session.refresh(stored)

    return _read_flag(FEATURE_REGISTRY[key], stored)


def get_effective_feature_flags(
    org_id: int,
    db_session: Session,
    current_user: PublicUser,
) -> EffectiveFeatureFlags:
    audience_roles = _roles_for_user_in_org(db_session, current_user.id, org_id)
    if not audience_roles:
        return EffectiveFeatureFlags(
            flags={key: False for key in FEATURE_REGISTRY.keys()}
        )

    stored_by_key = _stored_flags(db_session)
    flags: dict[FeatureKey, bool] = {}
    for key, definition in FEATURE_REGISTRY.items():
        readable_flag = _read_flag(definition, stored_by_key.get(key))
        if not readable_flag.enabled:
            flags[key] = False
            continue
        if readable_flag.audience.type == "all":
            flags[key] = True
            continue
        flags[key] = any(role in readable_flag.audience.roles for role in audience_roles)

    return EffectiveFeatureFlags(flags=flags)
