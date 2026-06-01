from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from openai import OpenAI

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


class AIProviderError(RuntimeError):
    pass


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
        self.client = OpenAI(**build_openai_client_kwargs(settings))

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        try:
            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
            )
        except Exception as exc:
            raise AIProviderError(
                "AI provider request failed "
                f"(provider={self.settings.provider}, model={model}): {exc}"
            ) from exc

        content = response.choices[0].message.content or "{}"
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


def build_llm_client(settings: LLMProviderSettings) -> LLMClient:
    return OpenAICompatibleLLMClient(settings)


def get_llm_client(learnhouse_config: LearnHouseConfig | None = None) -> LLMClient:
    return build_llm_client(get_llm_provider_settings(learnhouse_config))
