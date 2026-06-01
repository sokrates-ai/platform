from __future__ import annotations

import os
from dataclasses import dataclass

from config.config import LearnHouseConfig


def _env(name: str, *fallbacks: str, default: str | None = None) -> str | None:
    for key in (name, *fallbacks):
        value = os.getenv(key)
        if value is not None and value != "":
            return value
    return default


def _env_int(name: str, *fallbacks: str, default: int) -> int:
    value = _env(name, *fallbacks)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, *fallbacks: str, default: bool) -> bool:
    value = _env(name, *fallbacks)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class WorkspaceSettings:
    redis_url: str | None
    dev_mode: bool
    collab_jwt_secret: str
    collab_bridge_url: str | None
    jwt_ttl_min: int
    exercise_refresh_minutes: int
    text_eval_model: str
    rate_limit_text_eval_max: int
    rate_limit_text_eval_window_sec: int
    rate_limit_code_run_max: int
    rate_limit_code_run_window_sec: int
    rate_limit_code_judge_max: int
    rate_limit_code_judge_window_sec: int
    rate_limit_flashcard_validate_max: int
    rate_limit_flashcard_validate_window_sec: int
    analytics_host: str | None
    analytics_api_key: str | None
    judge0_base_url: str | None
    judge0_token: str | None
    judge0_webhook_secret: str | None
    mathpix_api_key: str | None
    mathpix_app_id: str | None
    max_upload_size: int = 20 * 1024 * 1024


def build_workspace_settings(learnhouse_config: LearnHouseConfig) -> WorkspaceSettings:
    collab_secret = _env(
        "LEARNHOUSE_WORKSPACE_SHARED_COLLAB_JWT_SECRET",
        "SHARED_COLLAB_JWT_SECRET",
        "LEARNHOUSE_AUTH_JWT_SECRET_KEY",
        default=learnhouse_config.security_config.auth_jwt_secret_key,
    )
    if not collab_secret:
        collab_secret = learnhouse_config.security_config.auth_jwt_secret_key

    return WorkspaceSettings(
        redis_url=_env(
            "LEARNHOUSE_WORKSPACE_REDIS_URL",
            "LEARNHOUSE_REDIS_CONNECTION_STRING",
            default=learnhouse_config.redis_config.redis_connection_string,
        ),
        dev_mode=_env_bool(
            "LEARNHOUSE_WORKSPACE_DEV_MODE",
            "LEARNHOUSE_DEVELOPMENT_MODE",
            default=bool(learnhouse_config.general_config.development_mode),
        ),
        collab_jwt_secret=collab_secret,
        collab_bridge_url=_env(
            "LEARNHOUSE_WORKSPACE_COLLAB_BRIDGE_URL",
            "API_COLLAB_BRIDGE_URL",
            default=None,
        ),
        jwt_ttl_min=_env_int(
            "LEARNHOUSE_WORKSPACE_JWT_TTL_MIN",
            "API_JWT_TTL_MIN",
            default=30,
        ),
        exercise_refresh_minutes=_env_int(
            "LEARNHOUSE_WORKSPACE_EXERCISE_REFRESH_MINUTES",
            "API_EXERCISE_REFRESH_MINUTES",
            default=5,
        ),
        text_eval_model=_env(
            "LEARNHOUSE_WORKSPACE_TEXT_EVAL_MODEL",
            "LEARNHOUSE_AI_TEXT_EVAL_MODEL",
            default=learnhouse_config.ai_config.text_eval_model,
        )
        or learnhouse_config.ai_config.text_eval_model,
        rate_limit_text_eval_max=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_TEXT_EVAL_MAX",
            "API_RATE_LIMIT_TEXT_EVAL_MAX",
            default=1,
        ),
        rate_limit_text_eval_window_sec=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_TEXT_EVAL_WINDOW_SEC",
            "API_RATE_LIMIT_TEXT_EVAL_WINDOW_SEC",
            default=60,
        ),
        rate_limit_code_run_max=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_CODE_RUN_MAX",
            "API_RATE_LIMIT_CODE_RUN_MAX",
            default=10,
        ),
        rate_limit_code_run_window_sec=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_CODE_RUN_WINDOW_SEC",
            "API_RATE_LIMIT_CODE_RUN_WINDOW_SEC",
            default=60,
        ),
        rate_limit_code_judge_max=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_CODE_JUDGE_MAX",
            "API_RATE_LIMIT_CODE_JUDGE_MAX",
            default=4,
        ),
        rate_limit_code_judge_window_sec=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_CODE_JUDGE_WINDOW_SEC",
            "API_RATE_LIMIT_CODE_JUDGE_WINDOW_SEC",
            default=60,
        ),
        rate_limit_flashcard_validate_max=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_FLASHCARD_VALIDATE_MAX",
            "API_RATE_LIMIT_FLASHCARD_VALIDATE_MAX",
            default=2,
        ),
        rate_limit_flashcard_validate_window_sec=_env_int(
            "LEARNHOUSE_WORKSPACE_RATE_LIMIT_FLASHCARD_VALIDATE_WINDOW_SEC",
            "API_RATE_LIMIT_FLASHCARD_VALIDATE_WINDOW_SEC",
            default=2,
        ),
        analytics_host=_env(
            "LEARNHOUSE_WORKSPACE_ANALYTICS_HOST",
            "API_ANALYTICS_HOST",
            default=None,
        ),
        analytics_api_key=_env(
            "LEARNHOUSE_WORKSPACE_ANALYTICS_API_KEY",
            "API_ANALYTICS_API_KEY",
            default=None,
        ),
        judge0_base_url=_env(
            "LEARNHOUSE_WORKSPACE_JUDGE0_BASE_URL",
            "API_JUDGE0_BASE_URL",
            default=None,
        ),
        judge0_token=_env(
            "LEARNHOUSE_WORKSPACE_JUDGE0_TOKEN",
            "API_JUDGE0_TOKEN",
            default=None,
        ),
        judge0_webhook_secret=_env(
            "LEARNHOUSE_WORKSPACE_JUDGE0_WEBHOOK_SECRET",
            "API_JUDGE0_WEBHOOK_SECRET",
            default=None,
        ),
        mathpix_app_id=_env(
            "LEARNHOUSE_WORKSPACE_MATHPIX_APP_ID",
            "MATHPIX_APP_ID",
            default=None,
        ),
        mathpix_api_key=_env(
            "LEARNHOUSE_WORKSPACE_MATHPIX_API_KEY",
            "MATHPIX_API_KEY",
            default=None,
        ),
    )
