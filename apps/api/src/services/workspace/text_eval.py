from __future__ import annotations

import asyncio
import logging
from typing import Any

from src.services.ai.client import AIProviderError, get_llm_client, get_llm_provider_settings


logger = logging.getLogger(__name__)


class TextEvaluationUnavailable(RuntimeError):
    def __init__(self, user_message: str, *, internal_message: str | None = None):
        super().__init__(internal_message or user_message)
        self.user_message = user_message
        self.internal_message = internal_message or user_message


def _quote_location(submission: str, quote: str) -> dict[str, int]:
    clean_quote = (quote or "").strip()
    if not clean_quote:
        return {"start": 0, "end": 0}
    start = submission.find(clean_quote)
    if start < 0:
        return {"start": 0, "end": 0}
    return {"start": start, "end": start + len(clean_quote)}


def _criteria_text(task: dict[str, Any]) -> str:
    items = task.get("grading_criteria") or []
    if not isinstance(items, list) or not items:
        return "No explicit grading criteria were provided."
    lines = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            continue
        short = str(item.get("short") or f"Criterion {index}").strip()
        detail = str(item.get("detail") or "").strip()
        must_fix = "must-fix" if item.get("must_fix") else "advisory"
        lines.append(f"{index}. {short} ({must_fix}) - {detail}")
    return "\n".join(lines) if lines else "No explicit grading criteria were provided."


def _coerce_feedback(payload: dict[str, Any], submission: str) -> dict[str, Any]:
    comments_in = payload.get("comments") if isinstance(payload, dict) else None
    comments_out: list[dict[str, Any]] = []
    if isinstance(comments_in, list):
        for index, item in enumerate(comments_in[:6], start=1):
            if not isinstance(item, dict):
                continue
            quote = str(item.get("quote") or item.get("citation", {}).get("text") or "").strip()
            comment_type = str(item.get("type") or "suggestion").strip().lower()
            if comment_type not in {"mistake", "suggestion", "praise"}:
                comment_type = "suggestion"
            comments_out.append(
                {
                    "id": str(item.get("id") or f"comment-{index}"),
                    "title": str(item.get("title") or "Feedback").strip() or "Feedback",
                    "content": str(item.get("content") or "").strip(),
                    "type": comment_type,
                    "citation": {
                        "text": quote,
                        "location": _quote_location(submission, quote),
                    },
                }
            )

    return {
        "summary": str(payload.get("summary") or "").strip(),
        "is_valid": bool(payload.get("is_valid")),
        "comments": comments_out,
    }


def _resolve_text_eval_model(model: str | None) -> str:
    candidate = (model or "").strip()
    if candidate:
        return candidate
    return get_llm_provider_settings().text_eval_model


def _evaluate_with_ai(
    task: dict[str, Any],
    submission: str,
    model: str | None,
) -> dict[str, Any]:
    client = get_llm_client()
    task_prompt = str(task.get("task") or "")
    solution = str(task.get("solution") or "")
    prompt = f"""
You are evaluating a student's response.

Task:
{task_prompt}

Reference solution:
{solution}

Grading criteria:
{_criteria_text(task)}

Student submission:
{submission}

Return a JSON object with this exact shape:
{{
  "summary": "short summary",
  "is_valid": true,
  "comments": [
    {{
      "id": "comment-1",
      "title": "short title",
      "content": "specific constructive feedback",
      "type": "mistake" | "suggestion" | "praise",
      "quote": "verbatim excerpt from the submission when possible"
    }}
  ]
}}

Rules:
- Be strict about mathematical correctness.
- Keep comments concise and actionable.
- Use praise only for clearly correct or high-quality parts.
- Use quotes only when they appear verbatim in the submission.
- Return valid JSON only.
""".strip()
    data = client.generate_json(
        system_prompt="You are a rigorous educational evaluator that returns JSON only.",
        user_prompt=prompt,
        model=_resolve_text_eval_model(model),
        temperature=0.2,
    )
    return _coerce_feedback(data, submission)


async def evaluate_sandbox_submission(
    *,
    problem: str,
    solution: str,
    rubric: str,
    model: str | None = None,
) -> dict[str, Any]:
    """Sandbox adapter: maps user-supplied problem/solution/rubric onto the
    workspace text-eval task shape and delegates to the existing pipeline."""
    rubric_clean = (rubric or "").strip()
    task = {
        "task": (problem or "").strip(),
        "solution": "",
        "grading_criteria": (
            [{"short": "User rubric", "detail": rubric_clean, "must_fix": True}]
            if rubric_clean
            else []
        ),
    }
    return await evaluate_text_submission(task, solution, model)


async def evaluate_text_submission(
    task: dict[str, Any],
    submission: str,
    model: str | None = None,
) -> dict[str, Any]:
    if not submission.strip():
        return {
            "summary": "The submission is empty.",
            "is_valid": False,
            "comments": [],
        }
    try:
        return await asyncio.to_thread(_evaluate_with_ai, task, submission, model)
    except AIProviderError as exc:
        logger.warning("ai_text_evaluation_failed", exc_info=True)
        internal_message = str(exc).strip()
        lowered = internal_message.lower()
        user_message = (
            "AI feedback is temporarily unavailable. Your draft is still saved. Please try again in a moment."
        )
        if (
            "not configured" in lowered
            or "api key" in lowered
            or "base url is required" in lowered
            or "unsupported ai provider" in lowered
        ):
            user_message = (
                "AI feedback is not configured on this server yet. Your draft is still saved."
            )
        elif any(
            token in lowered
            for token in (
                "connection",
                "timed out",
                "timeout",
                "refused",
                "unreachable",
                "name or service not known",
            )
        ):
            user_message = (
                "The AI provider could not be reached right now. Your draft is still saved. Please try again in a moment."
            )
        raise TextEvaluationUnavailable(
            user_message,
            internal_message=internal_message,
        ) from exc
    except Exception as exc:
        logger.warning("ai_text_evaluation_failed", exc_info=True)
        raise TextEvaluationUnavailable(
            "AI feedback is temporarily unavailable. Your draft is still saved. Please try again in a moment.",
            internal_message=str(exc),
        ) from exc
