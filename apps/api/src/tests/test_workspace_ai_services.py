import asyncio

import pytest

from src.services.ai.client import AIProviderError, LLMProviderSettings
from src.services.courses.activities import workspaces_gen
from src.services.courses.activities.workspaces_gen import GenerateGradingCriteria
from src.services.workspace import text_eval


class StubLLMClient:
    def __init__(self, *, payload=None, error: Exception | None = None, calls=None):
        self.payload = payload or {}
        self.error = error
        self.calls = calls if calls is not None else []

    def generate_json(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.payload


async def _run_inline(func, *args, **kwargs):
    return func(*args, **kwargs)


def test_evaluate_text_submission_uses_shared_llm_client(
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[dict] = []
    stub = StubLLMClient(
        payload={
            "summary": "Looks good.",
            "is_valid": True,
            "comments": [
                {
                    "id": "comment-1",
                    "title": "Correct answer",
                    "content": "The final value is correct.",
                    "type": "praise",
                    "quote": "1/3",
                }
            ],
        },
        calls=calls,
    )
    monkeypatch.setattr(text_eval, "get_llm_client", lambda: stub)
    monkeypatch.setattr(text_eval.asyncio, "to_thread", _run_inline)

    result = asyncio.run(
        text_eval.evaluate_text_submission(
            {"task": "Solve for x.", "solution": "1/3", "grading_criteria": []},
            "x = 1/3",
            "test-model",
        )
    )

    assert result["summary"] == "Looks good."
    assert result["is_valid"] is True
    assert result["comments"][0]["citation"]["location"] == {"start": 4, "end": 7}
    assert calls[0]["model"] == "test-model"


def test_evaluate_text_submission_reports_missing_provider_config(
    monkeypatch: pytest.MonkeyPatch,
):
    stub = StubLLMClient(error=AIProviderError("OpenAI API key is not configured."))
    monkeypatch.setattr(text_eval, "get_llm_client", lambda: stub)
    monkeypatch.setattr(text_eval.asyncio, "to_thread", _run_inline)

    with pytest.raises(text_eval.TextEvaluationUnavailable) as exc_info:
        asyncio.run(
            text_eval.evaluate_text_submission(
                {"task": "Solve for x.", "solution": "1/3", "grading_criteria": []},
                "x = 1/3",
                "test-model",
            )
        )

    assert (
        exc_info.value.user_message
        == "AI feedback is disabled or not configured on this server. Your draft is still saved."
    )


def test_generate_task_grading_criteria_uses_shared_llm_client(
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[dict] = []
    stub = StubLLMClient(
        payload={
            "criteria": [
                {
                    "id_slug": "correctness",
                    "short": "Produces the correct result.",
                    "detail": "The answer matches the reference solution.",
                    "must_fix": True,
                    "weight": 1.2,
                }
            ]
        },
        calls=calls,
    )
    monkeypatch.setattr(workspaces_gen, "get_llm_client", lambda: stub)
    monkeypatch.setattr(workspaces_gen.asyncio, "to_thread", _run_inline)
    monkeypatch.setattr(
        workspaces_gen,
        "get_llm_provider_settings",
        lambda: LLMProviderSettings(
            provider="openai",
            api_key="test-key",
            base_url=None,
            text_eval_model="gpt-4.1-mini",
            grading_criteria_model="criteria-model",
            timeout_sec=60,
        ),
    )

    result = asyncio.run(
        workspaces_gen.generate_task_grading_criteria(
            GenerateGradingCriteria(
                title="Solve for x",
                description="Find the solution.",
                task_type="ai",
                ai_instruction={
                    "task_instruction": "Solve 15x + 5 = 10.",
                    "proposed_solution": "1/3",
                },
                multiple_choice_data={},
                xp_reward=0,
                coin_reward=0,
                user_input="Focus on correctness.",
            )
        )
    )

    assert result.list[0].id_slug == "correctness"
    assert result.list[0].weight == 1.0
    assert calls[0]["model"] == "criteria-model"
