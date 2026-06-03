from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field as PydanticField, validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


FeatureAudienceRole = Literal["student", "tutor", "maintainer", "admin"]
FeatureAudienceType = Literal["all", "roles"]
FeatureKey = Literal["pride_mode"]

FEATURE_AUDIENCE_ROLES: tuple[FeatureAudienceRole, ...] = (
    "student",
    "tutor",
    "maintainer",
    "admin",
)


class FeatureAudience(BaseModel):
    type: FeatureAudienceType = "roles"
    roles: list[FeatureAudienceRole] = PydanticField(default_factory=list)

    @validator("roles")
    def dedupe_roles(cls, roles: list[FeatureAudienceRole]) -> list[FeatureAudienceRole]:
        return list(dict.fromkeys(roles))


class FeatureDefinition(BaseModel):
    key: FeatureKey
    label: str
    description: str
    category: str = "General"
    default_enabled: bool = False
    default_audience: FeatureAudience


class FeatureFlagRead(BaseModel):
    key: FeatureKey
    label: str
    description: str
    category: str
    enabled: bool
    audience: FeatureAudience
    default_enabled: bool
    default_audience: FeatureAudience
    updated_at: Optional[str] = None


class FeatureFlagUpdate(BaseModel):
    enabled: bool
    audience: FeatureAudience

    @validator("audience")
    def validate_audience(cls, audience: FeatureAudience) -> FeatureAudience:
        if audience.type == "roles" and not audience.roles:
            raise ValueError("Role-based feature audiences must include at least one role")
        return audience


class EffectiveFeatureFlags(BaseModel):
    flags: dict[FeatureKey, bool]


class InstanceFeatureFlag(SQLModel, table=True):
    __tablename__ = "instance_feature_flag"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    enabled: bool = False
    audience: dict = Field(default={}, sa_column=Column(JSON))
    creation_date: str = Field(default_factory=lambda: str(datetime.now()))
    update_date: str = Field(default_factory=lambda: str(datetime.now()))
