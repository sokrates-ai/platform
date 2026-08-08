import os
import secrets
import yaml
from typing import Literal, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

_EPHEMERAL_DEVELOPMENT_JWT_SECRET = secrets.token_urlsafe(32)


def _as_bool(value: object, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: object, *, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


class CookieConfig(BaseModel):
    domain: str


class GeneralConfig(BaseModel):
    development_mode: bool
    install_mode: bool


class SecurityConfig(BaseModel):
    auth_jwt_secret_key: str


class ChromaDBConfig(BaseModel):
    isSeparateDatabaseEnabled: bool | None 
    db_host: str | None 


AIProviderType = Literal["openai", "self_hosted", "vllm_openai_compatible"]


def _normalize_ai_provider(
    value: object | None,
    *,
    default: AIProviderType,
) -> AIProviderType:
    if value is None:
        return default

    raw = str(value).strip().lower().replace("-", "_")
    if not raw:
        return default
    if raw in {
        "self_hosted",
        "self_hosted_openai_compatible",
        "openai_compatible",
        "vllm",
        "vllm_openai_compatible",
    }:
        return "self_hosted"
    if raw == "openai":
        return "openai"
    return default


class AIConfig(BaseModel):
    enabled: bool = True
    provider: AIProviderType = "openai"
    api_key: str | None = None
    base_url: str | None = None
    text_eval_model: str = "gpt-4.1-mini"
    grading_criteria_model: str = "gpt-4.1-nano"
    timeout_sec: int = 60
    max_concurrent_requests: int = 2
    chromadb_config: ChromaDBConfig | None

    @property
    def openai_api_key(self) -> str | None:
        return self.api_key

    @property
    def is_ai_enabled(self) -> bool:
        return self.enabled


class S3ApiConfig(BaseModel):
    bucket_name: str | None
    endpoint_url: str | None


class ContentDeliveryConfig(BaseModel):
    type: Literal["filesystem", "s3api"]
    s3api: S3ApiConfig


class HostingConfig(BaseModel):
    domain: str
    ssl: bool
    port: int
    use_default_org: bool
    allowed_origins: list
    allowed_regexp: str
    self_hosted: bool
    cookie_config: CookieConfig
    content_delivery: ContentDeliveryConfig


class MailingConfig(BaseModel):
    resend_api_key: str
    system_email_address: str


class DatabaseConfig(BaseModel):
    sql_connection_string: Optional[str]


class RedisConfig(BaseModel):
    redis_connection_string: Optional[str]


class LearnHouseConfig(BaseModel):
    site_name: str
    site_description: str
    contact_email: str
    general_config: GeneralConfig
    hosting_config: HostingConfig
    database_config: DatabaseConfig
    redis_config: RedisConfig
    security_config: SecurityConfig
    ai_config: AIConfig
    mailing_config: MailingConfig


def get_learnhouse_config() -> LearnHouseConfig:

    load_dotenv()

    # Get the YAML file
    yaml_path = os.path.join(os.path.dirname(__file__), "config.yaml")

    # Load the YAML file
    with open(yaml_path, "r") as f:
        yaml_config = yaml.safe_load(f)

    # General Config

    # Development Mode & Install Mode
    env_development_mode = eval(os.environ.get("LEARNHOUSE_DEVELOPMENT_MODE", "None"))
    development_mode = (
        env_development_mode
        if env_development_mode is not None
        else yaml_config.get("general", {}).get("development_mode")
    )

    env_install_mode = os.environ.get("LEARNHOUSE_INSTALL_MODE", "None")
    install_mode = (
        env_install_mode
        if env_install_mode is not None
        else yaml_config.get("general", {}).get("install_mode")
    )

    # Security Config
    env_auth_jwt_secret_key = os.environ.get("LEARNHOUSE_AUTH_JWT_SECRET_KEY")
    auth_jwt_secret_key = env_auth_jwt_secret_key or yaml_config.get(
        "security", {}
    ).get("auth_jwt_secret_key")
    if not auth_jwt_secret_key:
        if development_mode:
            auth_jwt_secret_key = _EPHEMERAL_DEVELOPMENT_JWT_SECRET
        else:
            raise ValueError(
                "LEARNHOUSE_AUTH_JWT_SECRET_KEY must be configured outside development"
            )

    # Check if environment variables are defined
    env_site_name = os.environ.get("LEARNHOUSE_SITE_NAME")
    env_site_description = os.environ.get("LEARNHOUSE_SITE_DESCRIPTION")
    env_contact_email = os.environ.get("LEARNHOUSE_CONTACT_EMAIL")
    env_domain = os.environ.get("LEARNHOUSE_DOMAIN")
    os.environ.get("LEARNHOUSE_PORT")
    env_ssl = os.environ.get("LEARNHOUSE_SSL")
    env_port = os.environ.get("LEARNHOUSE_PORT")
    env_use_default_org = os.environ.get("LEARNHOUSE_USE_DEFAULT_ORG")
    env_allowed_origins = os.environ.get("LEARNHOUSE_ALLOWED_ORIGINS")
    env_cookie_domain = os.environ.get("LEARNHOUSE_COOKIE_DOMAIN")

    # Allowed origins should be a comma separated string
    if env_allowed_origins:
        env_allowed_origins = env_allowed_origins.split(",")
    env_allowed_regexp = os.environ.get("LEARNHOUSE_ALLOWED_REGEXP")
    env_self_hosted = os.environ.get("LEARNHOUSE_SELF_HOSTED")
    env_sql_connection_string = os.environ.get("LEARNHOUSE_SQL_CONNECTION_STRING")

    # Fill in values with YAML file if they are not provided
    site_name = env_site_name or yaml_config.get("site_name")
    site_description = env_site_description or yaml_config.get("site_description")
    contact_email = env_contact_email or yaml_config.get("contact_email")

    domain = env_domain or yaml_config.get("hosting_config", {}).get("domain")
    ssl = env_ssl or yaml_config.get("hosting_config", {}).get("ssl")
    port = env_port or yaml_config.get("hosting_config", {}).get("port")
    use_default_org = env_use_default_org or yaml_config.get("hosting_config", {}).get(
        "use_default_org"
    )
    allowed_origins = env_allowed_origins or yaml_config.get("hosting_config", {}).get(
        "allowed_origins"
    )
    allowed_regexp = env_allowed_regexp or yaml_config.get("hosting_config", {}).get(
        "allowed_regexp"
    )
    self_hosted = env_self_hosted or yaml_config.get("hosting_config", {}).get(
        "self_hosted"
    )

    cookies_domain = env_cookie_domain or yaml_config.get("hosting_config", {}).get(
        "cookies_config", {}
    ).get("domain")
    cookie_config = CookieConfig(domain=cookies_domain)

    env_content_delivery_type = os.environ.get("LEARNHOUSE_CONTENT_DELIVERY_TYPE")
    content_delivery_type: str = env_content_delivery_type or (
        (yaml_config.get("hosting_config", {}).get("content_delivery", {}).get("type"))
        or "filesystem"
    )  # default to filesystem

    env_bucket_name = os.environ.get("LEARNHOUSE_S3_API_BUCKET_NAME")
    env_endpoint_url = os.environ.get("LEARNHOUSE_S3_API_ENDPOINT_URL")
    bucket_name = (
        yaml_config.get("hosting_config", {})
        .get("content_delivery", {})
        .get("s3api", {})
        .get("bucket_name")
    ) or env_bucket_name
    endpoint_url = (
        yaml_config.get("hosting_config", {})
        .get("content_delivery", {})
        .get("s3api", {})
        .get("endpoint_url")
    ) or env_endpoint_url

    content_delivery = ContentDeliveryConfig(
        type=content_delivery_type,  # type: ignore
        s3api=S3ApiConfig(bucket_name=bucket_name, endpoint_url=endpoint_url),  # type: ignore
    )

    # Database config
    sql_connection_string = env_sql_connection_string or yaml_config.get(
        "database_config", {}
    ).get("sql_connection_string")

    # AI Config
    env_ai_provider = os.environ.get("LEARNHOUSE_AI_PROVIDER")
    env_ai_api_key = (
        os.environ.get("LEARNHOUSE_AI_API_KEY")
        or os.environ.get("LEARNHOUSE_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )
    env_ai_base_url = (
        os.environ.get("LEARNHOUSE_AI_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
    )
    env_ai_text_eval_model = (
        os.environ.get("LEARNHOUSE_AI_TEXT_EVAL_MODEL")
        or os.environ.get("LEARNHOUSE_WORKSPACE_TEXT_EVAL_MODEL")
    )
    env_ai_grading_criteria_model = os.environ.get(
        "LEARNHOUSE_AI_GRADING_CRITERIA_MODEL"
    )
    env_ai_timeout_sec = os.environ.get("LEARNHOUSE_AI_TIMEOUT_SEC")
    env_ai_max_concurrent = os.environ.get("LEARNHOUSE_AI_MAX_CONCURRENT_REQUESTS")
    env_is_ai_enabled = os.environ.get("LEARNHOUSE_IS_AI_ENABLED")
    env_chromadb_separate = os.environ.get("LEARNHOUSE_CHROMADB_SEPARATE")
    env_chromadb_host = os.environ.get("LEARNHOUSE_CHROMADB_HOST")

    ai_yaml = yaml_config.get("ai_config", {})
    ai_provider_default: AIProviderType = (
        "self_hosted" if _as_bool(self_hosted) else "openai"
    )
    raw_ai_provider = env_ai_provider or ai_yaml.get("provider")
    if (
        env_ai_provider is None
        and _as_bool(self_hosted)
        and (
            raw_ai_provider is None
            or str(raw_ai_provider).strip().lower().replace("-", "_") == "openai"
        )
    ):
        raw_ai_provider = "self_hosted"
    ai_provider = _normalize_ai_provider(
        raw_ai_provider,
        default=ai_provider_default,
    )
    ai_api_key = env_ai_api_key or ai_yaml.get("api_key") or ai_yaml.get("openai_api_key")
    ai_base_url = env_ai_base_url or ai_yaml.get("base_url")
    ai_text_eval_model = (
        env_ai_text_eval_model or ai_yaml.get("text_eval_model") or "gpt-4.1-mini"
    )
    ai_grading_criteria_model = (
        env_ai_grading_criteria_model
        or ai_yaml.get("grading_criteria_model")
        or "gpt-4.1-nano"
    )
    ai_timeout_sec = max(
        5,
        min(_as_int(env_ai_timeout_sec or ai_yaml.get("timeout_sec"), default=60), 120),
    )
    ai_max_concurrent = max(
        1,
        min(
            _as_int(
                env_ai_max_concurrent or ai_yaml.get("max_concurrent_requests"),
                default=2,
            ),
            32,
        ),
    )
    is_ai_enabled = (
        env_is_ai_enabled
        if env_is_ai_enabled is not None
        else ai_yaml.get("enabled", ai_yaml.get("is_ai_enabled", True))
    )
    chromadb_separate = env_chromadb_separate or ai_yaml.get(
        "chromadb_config", {}
    ).get("isSeparateDatabaseEnabled")
    chromadb_host = env_chromadb_host or ai_yaml.get("chromadb_config", {}).get("db_host")

    # Redis config
    env_redis_connection_string = os.environ.get("LEARNHOUSE_REDIS_CONNECTION_STRING")
    redis_connection_string = env_redis_connection_string or yaml_config.get(
        "redis_config", {}
    ).get("redis_connection_string")

    # Mailing config
    env_resend_api_key = os.environ.get("LEARNHOUSE_RESEND_API_KEY")
    env_system_email_address = os.environ.get("LEARNHOUSE_SYSTEM_EMAIL_ADDRESS")
    resend_api_key = env_resend_api_key or yaml_config.get("mailing_config", {}).get(
        "resend_api_key"
    )
    system_email_address = env_system_email_address or yaml_config.get(
        "mailing_config", {}
    ).get("system_email_adress")

    # Create HostingConfig and DatabaseConfig objects
    hosting_config = HostingConfig(
        domain=domain,
        ssl=bool(ssl),
        port=int(port),
        use_default_org=bool(use_default_org),
        allowed_origins=list(allowed_origins),
        allowed_regexp=allowed_regexp,
        self_hosted=bool(self_hosted),
        cookie_config=cookie_config,
        content_delivery=content_delivery,
    )
    database_config = DatabaseConfig(
        sql_connection_string=sql_connection_string,
    )

    # AI Config
    ai_config = AIConfig(
        enabled=_as_bool(is_ai_enabled, default=True),
        provider=ai_provider,  # type: ignore[arg-type]
        api_key=ai_api_key,
        base_url=ai_base_url,
        text_eval_model=ai_text_eval_model,
        grading_criteria_model=ai_grading_criteria_model,
        timeout_sec=ai_timeout_sec,
        max_concurrent_requests=ai_max_concurrent,
        chromadb_config=ChromaDBConfig(
            isSeparateDatabaseEnabled=_as_bool(chromadb_separate),
            db_host=chromadb_host,
        ),
    )

    # Create LearnHouseConfig object
    config = LearnHouseConfig(
        site_name=site_name,
        site_description=site_description,
        contact_email=contact_email,
        general_config=GeneralConfig(
            development_mode=bool(development_mode), install_mode=bool(install_mode)
        ),
        hosting_config=hosting_config,
        database_config=database_config,
        security_config=SecurityConfig(auth_jwt_secret_key=auth_jwt_secret_key),
        ai_config=ai_config,
        redis_config=RedisConfig(redis_connection_string=redis_connection_string),
        mailing_config=MailingConfig(
            resend_api_key=resend_api_key, system_email_address=system_email_address
        )
    )

    return config
