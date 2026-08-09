import pytest
import time
from types import SimpleNamespace

from config.config import get_learnhouse_config
from src.services.ai.client import (
    AIProviderError,
    LLMProviderSettings,
    OpenAICompatibleLLMClient,
    _CircuitBreaker,
    _get_cached_llm_client,
    build_openai_client_kwargs,
)


def _clear_ai_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "LEARNHOUSE_OPENAI_API_KEY",
        "LEARNHOUSE_SELF_HOSTED",
        "LEARNHOUSE_AI_PROVIDER",
        "LEARNHOUSE_AI_API_KEY",
        "LEARNHOUSE_AI_BASE_URL",
        "LEARNHOUSE_AI_TEXT_EVAL_MODEL",
        "LEARNHOUSE_AI_GRADING_CRITERIA_MODEL",
        "LEARNHOUSE_AI_TIMEOUT_SEC",
        "LEARNHOUSE_WORKSPACE_TEXT_EVAL_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)


def test_ai_config_defaults_to_openai_provider(monkeypatch: pytest.MonkeyPatch):
    _clear_ai_env(monkeypatch)

    config = get_learnhouse_config()

    assert config.ai_config.provider == "openai"
    assert config.ai_config.text_eval_model == "gpt-4.1-mini"
    assert config.ai_config.grading_criteria_model == "gpt-4.1-nano"


def test_ai_config_defaults_to_self_hosted_provider_when_self_hosted_enabled(
    monkeypatch: pytest.MonkeyPatch,
):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("LEARNHOUSE_SELF_HOSTED", "true")

    config = get_learnhouse_config()

    assert config.ai_config.provider == "self_hosted"


def test_ai_config_normalizes_self_hosted_provider_aliases(
    monkeypatch: pytest.MonkeyPatch,
):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("LEARNHOUSE_AI_PROVIDER", "self-hosted")

    config = get_learnhouse_config()

    assert config.ai_config.provider == "self_hosted"


def test_ai_config_supports_openai_base_url_env(
    monkeypatch: pytest.MonkeyPatch,
):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("OPENAI_BASE_URL", "http://localhost:8000/v1")

    config = get_learnhouse_config()

    assert config.ai_config.base_url == "http://localhost:8000/v1"


def test_ai_config_supports_legacy_openai_api_key_env(
    monkeypatch: pytest.MonkeyPatch,
):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("LEARNHOUSE_OPENAI_API_KEY", "legacy-key")

    config = get_learnhouse_config()

    assert config.ai_config.api_key == "legacy-key"


def test_openai_provider_requires_api_key():
    settings = LLMProviderSettings(
        provider="openai",
        api_key=None,
        base_url=None,
        text_eval_model="gpt-4.1-mini",
        grading_criteria_model="gpt-4.1-nano",
        timeout_sec=60,
    )

    with pytest.raises(AIProviderError, match="API key is not configured"):
        build_openai_client_kwargs(settings)


def test_vllm_provider_requires_base_url():
    settings = LLMProviderSettings(
        provider="vllm_openai_compatible",
        api_key=None,
        base_url=None,
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
    )

    with pytest.raises(AIProviderError, match="base URL is required"):
        build_openai_client_kwargs(settings)


def test_self_hosted_provider_requires_base_url():
    settings = LLMProviderSettings(
        provider="self_hosted",
        api_key=None,
        base_url=None,
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
    )

    with pytest.raises(AIProviderError, match="base URL is required"):
        build_openai_client_kwargs(settings)


def test_self_hosted_provider_uses_dummy_api_key_when_missing():
    settings = LLMProviderSettings(
        provider="self_hosted",
        api_key=None,
        base_url="http://localhost:8000/v1",
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
    )

    kwargs = build_openai_client_kwargs(settings)

    assert kwargs["api_key"] == "EMPTY"
    assert kwargs["base_url"] == "http://localhost:8000/v1"
    assert kwargs["timeout"] == 60


def test_vllm_provider_uses_dummy_api_key_when_missing():
    settings = LLMProviderSettings(
        provider="vllm_openai_compatible",
        api_key=None,
        base_url="http://localhost:8000/v1",
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
    )

    kwargs = build_openai_client_kwargs(settings)

    assert kwargs["api_key"] == "EMPTY"
    assert kwargs["base_url"] == "http://localhost:8000/v1"
    assert kwargs["timeout"] == 60


def test_ai_config_clamps_provider_timeout_and_concurrency(
    monkeypatch: pytest.MonkeyPatch,
):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("LEARNHOUSE_AI_TIMEOUT_SEC", "1")
    monkeypatch.setenv("LEARNHOUSE_AI_MAX_CONCURRENT_REQUESTS", "100")

    config = get_learnhouse_config()

    assert config.ai_config.timeout_sec == 5
    assert config.ai_config.max_concurrent_requests == 32


def test_ai_config_can_disable_provider(monkeypatch: pytest.MonkeyPatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("LEARNHOUSE_IS_AI_ENABLED", "false")

    config = get_learnhouse_config()

    assert config.ai_config.enabled is False


def test_disabled_provider_is_rejected_before_client_creation():
    settings = LLMProviderSettings(
        provider="self_hosted",
        api_key=None,
        base_url="http://localhost:8000/v1",
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
        enabled=False,
    )

    with pytest.raises(AIProviderError, match="disabled"):
        OpenAICompatibleLLMClient(settings)


def test_provider_client_is_cached_per_settings():
    settings = LLMProviderSettings(
        provider="self_hosted",
        api_key=None,
        base_url="http://localhost:8000/v1",
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=60,
    )
    _get_cached_llm_client.cache_clear()

    first = _get_cached_llm_client(settings)
    second = _get_cached_llm_client(settings)

    assert first is second
    _get_cached_llm_client.cache_clear()


def test_circuit_breaker_rejects_after_repeated_transient_failures():
    breaker = _CircuitBreaker(failure_threshold=2, cooldown_sec=0.01)

    breaker.before_call()
    breaker.record_failure(transient=True)
    breaker.before_call()
    breaker.record_failure(transient=True)

    with pytest.raises(AIProviderError, match="temporarily unavailable"):
        breaker.before_call()

    time.sleep(0.02)
    breaker.before_call()
    breaker.record_success()
    breaker.before_call()


def test_circuit_breaker_honors_remote_open_state():
    class OpenCircuitStore:
        def hgetall(self, _key):
            return {"opened_until": str(time.time() + 60)}

    breaker = _CircuitBreaker()
    breaker._remote = OpenCircuitStore()
    breaker._remote_key = "test:ai:circuit"

    with pytest.raises(AIProviderError, match="temporarily unavailable"):
        breaker.before_call()


def test_invalid_provider_responses_open_circuit():
    settings = LLMProviderSettings(
        provider="self_hosted",
        api_key=None,
        base_url="http://localhost:8000/v1",
        text_eval_model="model",
        grading_criteria_model="model",
        timeout_sec=5,
    )
    client = OpenAICompatibleLLMClient(settings)

    class InvalidCompletions:
        def create(self, **_kwargs):
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="not-json"))]
            )

    client.client = SimpleNamespace(
        chat=SimpleNamespace(completions=InvalidCompletions())
    )

    for _ in range(3):
        with pytest.raises(AIProviderError, match="invalid JSON"):
            client.generate_json(
                system_prompt="system",
                user_prompt="user",
                model="model",
            )

    with pytest.raises(AIProviderError, match="temporarily unavailable"):
        client.generate_json(
            system_prompt="system",
            user_prompt="user",
            model="model",
        )
