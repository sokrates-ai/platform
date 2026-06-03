import pytest
from fastapi import HTTPException
from sqlmodel import Session, select

from src.db.feature_flags import FeatureAudience, FeatureFlagUpdate, InstanceFeatureFlag
from src.db.organizations import Organization
from src.db.users import PublicUser, User
from src.services.features import (
    get_effective_feature_flags,
    list_admin_feature_flags,
    update_admin_feature_flag,
)


def _user(session: Session, username: str) -> PublicUser:
    user = session.exec(select(User).where(User.username == username)).first()
    assert user is not None
    return PublicUser(
        id=user.id or 0,
        user_uuid=user.user_uuid,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        avatar_image=user.avatar_image,
        bio=user.bio,
        coins=user.coins,
        level=user.level,
        level_progress=user.level_progress,
    )


def _org(session: Session) -> Organization:
    org = session.exec(select(Organization).where(Organization.slug == "wayne")).first()
    assert org is not None
    return org


def _clear_feature_flags(session: Session) -> None:
    flags = session.exec(select(InstanceFeatureFlag)).all()
    for flag in flags:
        session.delete(flag)
    session.commit()


def test_effective_flags_default_to_disabled(session: Session):
    _clear_feature_flags(session)
    org = _org(session)
    robin = _user(session, "robin")

    result = get_effective_feature_flags(org.id or 0, session, robin)

    assert result.flags["pride_mode"] is False


def test_role_audience_limits_feature_to_students(session: Session):
    _clear_feature_flags(session)
    org = _org(session)
    admin = _user(session, "batman")
    student = _user(session, "robin")

    update_admin_feature_flag(
        "pride_mode",
        FeatureFlagUpdate(
            enabled=True,
            audience=FeatureAudience(type="roles", roles=["student"]),
        ),
        session,
        admin,
    )

    assert get_effective_feature_flags(org.id or 0, session, student).flags["pride_mode"] is True
    assert get_effective_feature_flags(org.id or 0, session, admin).flags["pride_mode"] is False


def test_all_audience_enables_feature_for_all_org_members(session: Session):
    _clear_feature_flags(session)
    org = _org(session)
    admin = _user(session, "batman")
    student = _user(session, "robin")

    update_admin_feature_flag(
        "pride_mode",
        FeatureFlagUpdate(
            enabled=True,
            audience=FeatureAudience(type="all", roles=[]),
        ),
        session,
        admin,
    )

    assert get_effective_feature_flags(org.id or 0, session, student).flags["pride_mode"] is True
    assert get_effective_feature_flags(org.id or 0, session, admin).flags["pride_mode"] is True


def test_non_admin_cannot_read_admin_feature_settings(session: Session):
    _clear_feature_flags(session)
    student = _user(session, "robin")

    with pytest.raises(HTTPException) as error:
        list_admin_feature_flags(session, student)

    assert error.value.status_code == 403
