from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.tasks import Task, TaskType
from src.services.users.users import read_user_by_uuid_unauth
from src.services.workspace.collab_bridge import try_post_workspace_result
from src.services.workspace.state import get_workspace_runtime


logger = logging.getLogger(__name__)

SESSION_DATA_PREFIX = "workspace:session:data:"
SESSION_LOOKUP_PREFIX = "workspace:session:lookup:"


def _session_data_key(token: str) -> str:
    return f"{SESSION_DATA_PREFIX}{token}"


def _session_lookup_key(user_uuid: str, activity_uuid: str, exercise_id: int) -> str:
    return f"{SESSION_LOOKUP_PREFIX}{user_uuid}:{activity_uuid}:{exercise_id}"


async def save_session_to_redis(token: str, session_data: dict[str, Any]) -> None:
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        raise RuntimeError("Workspace Redis is not configured")
    session_data["timestamp"] = datetime.now(timezone.utc).isoformat()
    await runtime.redis_client.set(_session_data_key(token), json.dumps(session_data))


def _dev_session_for_token(token: str) -> dict[str, Any] | None:
    runtime = get_workspace_runtime()
    if not (runtime.settings.dev_mode and token and token.startswith("dev-")):
        return None

    now = datetime.now(timezone.utc).isoformat()
    defaults: dict[str, dict[str, Any]] = {
        "dev-1": {
            "workspaceType": "text",
            "workspaceSpec": None,
            "exercise": {
                "id": 42,
                "title": "I. Solve for x.",
                "description": "You are supposed to solve for x.",
                "task": "Given: 15x + 5 = 10. Solve for x.",
                "solution": "1/3",
            },
        },
        "dev-2": {
            "workspaceType": "flashcard",
            "workspaceSpec": {
                "questions": [
                    {
                        "id": "q1",
                        "prompt": "Which of the following are prime numbers?",
                        "multiple": True,
                        "options": [
                            {"id": "o1", "label": "$2$"},
                            {"id": "o2", "label": "$4$"},
                            {"id": "o3", "label": "$5$"},
                        ],
                        "correct": ["o1", "o3"],
                    }
                ]
            },
            "exercise": {
                "id": 42,
                "title": "Prime numbers",
                "description": "Select the correct answers.",
                "task": "Identify the prime numbers.",
                "solution": "",
            },
        },
        "dev-3": {
            "workspaceType": "code",
            "workspaceSpec": {
                "language": "python",
                "starterCode": (
                    "import sys\n\n"
                    "def solve(x: int) -> int:\n"
                    "    return x\n\n"
                    'if __name__ == "__main__":\n'
                    "    data = sys.stdin.read().strip()\n"
                    "    x = int(data) if data else 0\n"
                    "    print(solve(x))\n"
                ),
                "tests": [
                    {"id": "t1", "stdin": "3\n", "expected": "9\n"},
                    {"id": "t2", "stdin": "0\n", "expected": "0\n"},
                ],
            },
            "exercise": {
                "id": 1001,
                "title": "Square a number",
                "description": "Read an integer n and print n^2.",
                "task": "Implement solve(x) that returns x*x.",
                "solution": "def solve(x):\n    return x * x",
            },
        },
    }
    preset = defaults.get(token, defaults["dev-1"])
    exercise_id = int(preset["exercise"].get("id", 42))
    return {
        "activity_uuid": "dev-activity",
        "user_uuid": token,
        "exercise_id": exercise_id,
        "exercise": preset["exercise"],
        "workspaceContent": "",
        "workspaceType": preset["workspaceType"],
        "workspaceSpec": preset["workspaceSpec"],
        "active": False,
        "timestamp": now,
    }


async def get_session_from_redis(token: str) -> dict[str, Any] | None:
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        raise RuntimeError("Workspace Redis is not configured")
    session_json = await runtime.redis_client.get(_session_data_key(token))
    if session_json:
        return json.loads(session_json)

    dev_session = _dev_session_for_token(token)
    if dev_session is not None:
        await save_session_to_redis(token, dev_session)
        return dev_session

    return None


async def set_session_active(token: str, active: bool) -> None:
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        return
    session = await get_session_from_redis(token)
    if session is None:
        return
    session["active"] = active
    await save_session_to_redis(token, session)


async def fetch_exercise_data(
    db_session: Session,
    exercise_id: int,
) -> dict[str, Any]:
    task = db_session.exec(select(Task).where(Task.id == exercise_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task does not exist")

    if task.task_type == TaskType.AI:
        ai_instruction = task.ai_instruction or {}
        criteria = (
            (ai_instruction.get("grading_criteria") or {}).get("criteria")
            if isinstance(ai_instruction, dict)
            else None
        )
        exercise = {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "task": str(ai_instruction.get("task_instruction") or task.description or ""),
            "solution": str(ai_instruction.get("proposed_solution") or ""),
            "grading_criteria": criteria or [],
        }
        return {
            "exercise": exercise,
            "workspaceType": "text",
            "workspaceSpec": None,
        }

    multiple_choice_data = task.multiple_choice_data or {}
    questions = []
    for question_index, question in enumerate(
        multiple_choice_data.get("questions") or [],
        start=1,
    ):
        answers = question.get("answers") or []
        questions.append(
            {
                "id": f"q-{question_index}",
                "prompt": question.get("user_question") or f"Question {question_index}",
                "multiple": sum(1 for answer in answers if answer.get("is_correct")) > 1,
                "options": [
                    {"id": f"o{answer_index}", "label": answer.get("text") or ""}
                    for answer_index, answer in enumerate(answers, start=1)
                ],
                "correct": [
                    f"o{answer_index}"
                    for answer_index, answer in enumerate(answers, start=1)
                    if answer.get("is_correct")
                ],
            }
        )

    return {
        "exercise": {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "task": task.title or "Multiple choice exercise",
            "solution": "",
        },
        "workspaceType": "flashcard",
        "workspaceSpec": {"questions": questions},
    }


async def create_or_get_session(
    db_session: Session,
    *,
    user_uuid: str,
    activity_uuid: str,
    exercise_id: int,
    workspace_type: str | None = None,
    workspace_spec: dict[str, Any] | None = None,
) -> str:
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        raise RuntimeError("Workspace Redis is not configured")

    lookup_key = _session_lookup_key(user_uuid, activity_uuid, exercise_id)
    existing_token = await runtime.redis_client.get(lookup_key)
    if existing_token:
        token = existing_token if isinstance(existing_token, str) else str(existing_token)
        session = await get_session_from_redis(token)
        if session is not None:
            return token

    fetched = await fetch_exercise_data(db_session, exercise_id)

    token = str(uuid.uuid4())
    session_data = {
        "activity_uuid": activity_uuid,
        "exercise_id": exercise_id,
        "user_uuid": user_uuid,
        "exercise": fetched.get("exercise"),
        "workspaceType": workspace_type or fetched.get("workspaceType") or "text",
        "workspaceSpec": workspace_spec if workspace_spec is not None else fetched.get("workspaceSpec"),
        "workspaceContent": "",
        "active": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await save_session_to_redis(token, session_data)
    await runtime.redis_client.set(lookup_key, token)
    return token


async def refresh_all_sessions(db_session: Session) -> dict[str, int]:
    runtime = get_workspace_runtime()
    if runtime.redis_client is None:
        raise RuntimeError("Workspace Redis is not configured")

    summary = {
        "processed": 0,
        "exerciseUpdated": 0,
        "workspaceSpecUpdated": 0,
        "workspaceTypeUpdated": 0,
        "errors": 0,
    }

    async for key in runtime.redis_client.scan_iter(f"{SESSION_DATA_PREFIX}*"):
        try:
            raw = await runtime.redis_client.get(key)
            if not raw:
                continue
            session = json.loads(raw)
            exercise_id = session.get("exercise_id")
            if not exercise_id:
                continue
            fetched = await fetch_exercise_data(db_session, int(exercise_id))

            previous_exercise = session.get("exercise")
            previous_spec = session.get("workspaceSpec")
            previous_type = session.get("workspaceType")

            session["exercise"] = fetched.get("exercise") or previous_exercise
            session["workspaceSpec"] = fetched.get("workspaceSpec")
            session["workspaceType"] = fetched.get("workspaceType") or previous_type
            await save_session_to_redis(key.replace(SESSION_DATA_PREFIX, "", 1), session)

            if previous_exercise != session["exercise"]:
                summary["exerciseUpdated"] += 1
            if previous_spec != session["workspaceSpec"]:
                summary["workspaceSpecUpdated"] += 1
            if previous_type != session["workspaceType"]:
                summary["workspaceTypeUpdated"] += 1

            summary["processed"] += 1

            workspace_id = key.replace(SESSION_DATA_PREFIX, "", 1)
            await try_post_workspace_result(
                workspace_id,
                {"jobId": "workspace:update", "progressText": "exerciseRefreshed"},
                context="workspace_refresh_progress",
            )
            await try_post_workspace_result(
                workspace_id,
                {
                    "jobId": "workspace:update",
                    "cellId": "workspace:update",
                    "value": {
                        "exercise": session.get("exercise"),
                        "workspaceSpec": session.get("workspaceSpec"),
                        "workspaceType": session.get("workspaceType"),
                    },
                },
                context="workspace_refresh_result",
            )
        except Exception:
            summary["errors"] += 1
            logger.warning("workspace_session_refresh_failed", exc_info=True)
    return summary


async def get_user_stats(
    request: Request,
    db_session: Session,
    token: str,
) -> dict[str, int] | None:
    session = await get_session_from_redis(token)
    if not session:
        return None

    user_uuid = session.get("user_uuid")
    if not user_uuid:
        return None

    user = await read_user_by_uuid_unauth(request, db_session, user_uuid)
    return {
        "xp": user.level_progress,
        "coins": user.coins,
        "level": user.level,
    }
