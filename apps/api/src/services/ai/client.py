from __future__ import annotations

import json
import hashlib
import threading
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal, Protocol

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError
from redis import Redis

from config.config import LearnHouseConfig, get_learnhouse_config


LLMProviderType = Literal["openai", "self_hosted", "vllm_openai_compatible"]


@dataclass(frozen=True)
class LLMProviderSettings:
    provider: LLMProviderType
    api_key: str | None
    base_url: str | None
    text_eval_model: str
    grading_criteria_model: str
    timeout_sec: int
    enabled: bool = True
    max_concurrent_requests: int = 2
    circuit_store_url: str | None = None


class AIProviderError(RuntimeError):
    pass


class AIProviderUnavailableError(AIProviderError):
    """The provider is temporarily unavailable or the local gate is open."""


class _CircuitBreaker:
    def __init__(
        self,
        *,
        failure_threshold: int = 3,
        cooldown_sec: float = 30.0,
        store_url: str | None = None,
        identity: str = "default",
    ):
        self._failure_threshold = failure_threshold
        self._cooldown_sec = cooldown_sec
        self._lock = threading.Lock()
        self._consecutive_failures = 0
        self._opened_until = 0.0
        self._probe_in_flight = False
        self._last_failure_at = 0.0
        self._remote_probe = False
        self._remote = None
        self._remote_key = ""
        if store_url:
            try:
                self._remote = Redis.from_url(
                    store_url,
                    decode_responses=True,
                    socket_connect_timeout=0.25,
                    socket_timeout=0.25,
                )
                digest = hashlib.sha256(identity.encode()).hexdigest()[:24]
                self._remote_key = f"sokrates:ai:circuit:{digest}"
            except Exception:
                self._remote = None

    def before_call(self) -> None:
        now = time.monotonic()
        with self._lock:
            if self._opened_until <= now:
                if self._opened_until and self._probe_in_flight:
                    raise AIProviderUnavailableError(
                        "AI provider is temporarily unavailable."
                    )
                if self._opened_until:
                    self._probe_in_flight = True
                return
            raise AIProviderUnavailableError(
                "AI provider is temporarily unavailable. Please try again shortly."
            )
        self._remote_before_call()

    def _remote_before_call(self) -> None:
        if self._remote is None:
            return
        try:
            state = self._remote.hgetall(self._remote_key)
            opened_until = float(state.get("opened_until") or 0)
            if opened_until > time.time():
                raise AIProviderUnavailableError(
                    "AI provider is temporarily unavailable. Please try again shortly."
                )
            if opened_until:
                if not self._remote.set(
                    f"{self._remote_key}:probe", "1", nx=True, ex=10
                ):
                    raise AIProviderUnavailableError(
                        "AI provider is temporarily unavailable."
                    )
                self._remote_probe = True
        except AIProviderUnavailableError:
            raise
        except Exception:
            self._remote = None

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._opened_until = 0.0
            self._probe_in_flight = False
            self._remote_probe = False
            if self._remote is not None:
                try:
                    self._remote.delete(self._remote_key, f"{self._remote_key}:probe")
                except Exception:
                    self._remote = None

    def record_failure(self, *, transient: bool) -> None:
        if not transient:
            return
        with self._lock:
            self._probe_in_flight = False
            self._last_failure_at = time.time()
            self._consecutive_failures += 1
            if self._consecutive_failures >= self._failure_threshold:
                self._opened_until = time.monotonic() + self._cooldown_sec
            if self._remote is not None:
                try:
                    failures = int(self._remote.hincrby(self._remote_key, "failures", 1))
                    self._remote.hset(
                        self._remote_key,
                        mapping={"last_failure_at": str(self._last_failure_at)},
                    )
                    self._remote.expire(self._remote_key, 120)
                    if failures >= self._failure_threshold:
                        self._remote.hset(
                            self._remote_key,
                            "opened_until",
                            str(time.time() + self._cooldown_sec),
                        )
                    if self._remote_probe:
                        self._remote.delete(f"{self._remote_key}:probe")
                        self._remote_probe = False
                except Exception:
                    self._remote = None

    def snapshot(self) -> dict[str, Any]:
        now = time.monotonic()
        with self._lock:
            if self._opened_until > now:
                state = "open"
                retry_after = max(0, int(self._opened_until - now + 0.999))
            elif self._opened_until and self._probe_in_flight:
                state = "half_open"
                retry_after = 0
            else:
                state = "closed"
                retry_after = 0
            failures = self._consecutive_failures
            last_failure_at = self._last_failure_at or None
            if self._remote is not None:
                try:
                    remote = self._remote.hgetall(self._remote_key)
                    failures = max(failures, int(remote.get("failures") or 0))
                    last_failure_at = max(
                        last_failure_at or 0,
                        float(remote.get("last_failure_at") or 0),
                    ) or None
                    remote_opened_until = float(remote.get("opened_until") or 0)
                    if remote_opened_until > time.time():
                        state = "open"
                        retry_after = max(
                            0, int(remote_opened_until - time.time() + 0.999)
                        )
                except Exception:
                    self._remote = None
            return {
                "state": state,
                "retry_after_sec": retry_after,
                "consecutive_failures": failures,
                "last_failure_at": last_failure_at,
            }


def _is_transient_provider_error(exc: Exception) -> bool:
    if isinstance(exc, (APIConnectionError, APITimeoutError, RateLimitError)):
        return True
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int) and (status_code == 408 or status_code == 429 or status_code >= 500):
        return True
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "connection",
            "timed out",
            "timeout",
            "temporarily unavailable",
            "connection refused",
            "name or service not known",
        )
    )


def _is_json_response_format_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    message = str(exc).lower()
    return (
        isinstance(exc, APIStatusError)
        and status_code == 400
        and "response_format" in message
    ) or (
        status_code == 400
        and "json_object" in message
        and "response format" in message
    )


class LLMClient(Protocol):
    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        ...


def build_llm_provider_settings(
    learnhouse_config: LearnHouseConfig,
) -> LLMProviderSettings:
    ai_config = learnhouse_config.ai_config
    return LLMProviderSettings(
        provider=ai_config.provider,
        api_key=ai_config.api_key,
        base_url=ai_config.base_url,
        text_eval_model=ai_config.text_eval_model,
        grading_criteria_model=ai_config.grading_criteria_model,
        timeout_sec=ai_config.timeout_sec,
        enabled=ai_config.enabled,
        max_concurrent_requests=ai_config.max_concurrent_requests,
        circuit_store_url=learnhouse_config.redis_config.redis_connection_string,
    )


def get_llm_provider_settings(
    learnhouse_config: LearnHouseConfig | None = None,
) -> LLMProviderSettings:
    config = learnhouse_config or get_learnhouse_config()
    return build_llm_provider_settings(config)


def build_openai_client_kwargs(settings: LLMProviderSettings) -> dict[str, Any]:
    client_kwargs: dict[str, Any] = {"timeout": settings.timeout_sec}
    if settings.provider == "openai":
        if not settings.api_key:
            raise AIProviderError("OpenAI API key is not configured.")
        client_kwargs["api_key"] = settings.api_key
        return client_kwargs

    if settings.provider in {"self_hosted", "vllm_openai_compatible"}:
        if not settings.base_url:
            raise AIProviderError(
                "AI base URL is required when using the self-hosted AI provider."
            )
        client_kwargs["api_key"] = settings.api_key or "EMPTY"
        client_kwargs["base_url"] = settings.base_url
        return client_kwargs

    raise AIProviderError(f"Unsupported AI provider: {settings.provider}")


class OpenAICompatibleLLMClient:
    def __init__(self, settings: LLMProviderSettings):
        self.settings = settings
        if not settings.enabled:
            raise AIProviderError("AI features are disabled on this server.")
        self.client = OpenAI(**build_openai_client_kwargs(settings))
        self._circuit = _CircuitBreaker(
            store_url=settings.circuit_store_url,
            identity=(
                f"{settings.provider}|{settings.base_url}|"
                f"{settings.text_eval_model}|{settings.grading_criteria_model}"
            ),
        )
        self._concurrency = threading.BoundedSemaphore(
            max(1, min(settings.max_concurrent_requests, 32))
        )

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        if not self._concurrency.acquire(timeout=1.0):
            raise AIProviderUnavailableError(
                "AI provider is busy. Please try again shortly."
            )

        try:
            response = None
            last_error: Exception | None = None
            for attempt in range(2):
                self._circuit.before_call()
                try:
                    request = {
                        "model": model,
                        "temperature": temperature,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    }
                    try:
                        response = self.client.chat.completions.create(
                            **request,
                            response_format={"type": "json_object"},
                        )
                    except Exception as format_error:
                        if not _is_json_response_format_error(format_error):
                            raise
                        # Some OpenAI-compatible servers accept JSON prompts but
                        # reject the newer response_format parameter.
                        response = self.client.chat.completions.create(**request)
                    self._circuit.record_success()
                    break
                except Exception as exc:
                    last_error = exc
                    transient = _is_transient_provider_error(exc)
                    if transient and attempt == 0:
                        time.sleep(0.15)
                        continue
                    self._circuit.record_failure(transient=transient)
                    if isinstance(exc, AIProviderUnavailableError):
                        raise
                    raise AIProviderError(
                        "AI provider request failed "
                        f"(provider={self.settings.provider}, model={model}): {exc}"
                    ) from exc

            if response is None:
                raise AIProviderError(
                    "AI provider request failed without a response."
                ) from last_error

            choices = getattr(response, "choices", None) or []
            if not choices or not getattr(choices[0], "message", None):
                raise AIProviderError(
                    "AI provider returned an empty response "
                    f"(provider={self.settings.provider}, model={model})."
                )
            content = choices[0].message.content or "{}"
        finally:
            self._concurrency.release()

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIProviderError(
                "AI provider returned invalid JSON "
                f"(provider={self.settings.provider}, model={model})."
            ) from exc

        if not isinstance(parsed, dict):
            raise AIProviderError(
                "AI provider returned a non-object JSON response "
                f"(provider={self.settings.provider}, model={model})."
            )
        return parsed

    def status(self) -> dict[str, Any]:
        circuit = self._circuit.snapshot()
        return {
            "enabled": self.settings.enabled,
            "provider": self.settings.provider,
            "configured": True,
            "state": circuit["state"],
            "retry_after_sec": circuit["retry_after_sec"],
            "consecutive_failures": circuit["consecutive_failures"],
            "last_failure_at": circuit["last_failure_at"],
        }


def build_llm_client(settings: LLMProviderSettings) -> LLMClient:
    return OpenAICompatibleLLMClient(settings)


@lru_cache(maxsize=8)
def _get_cached_llm_client(settings: LLMProviderSettings) -> LLMClient:
    return build_llm_client(settings)


def get_llm_client(learnhouse_config: LearnHouseConfig | None = None) -> LLMClient:
    return _get_cached_llm_client(get_llm_provider_settings(learnhouse_config))


def get_llm_provider_status(
    learnhouse_config: LearnHouseConfig | None = None,
) -> dict[str, Any]:
    settings = get_llm_provider_settings(learnhouse_config)
    base = {
        "enabled": settings.enabled,
        "provider": settings.provider,
        "configured": False,
        "state": "disabled" if not settings.enabled else "unconfigured",
        "retry_after_sec": 0,
        "consecutive_failures": 0,
        "last_failure_at": None,
    }
    if not settings.enabled:
        return base
    try:
        client = get_llm_client(learnhouse_config)
    except AIProviderError:
        return base
    if isinstance(client, OpenAICompatibleLLMClient):
        return client.status()
    return base
