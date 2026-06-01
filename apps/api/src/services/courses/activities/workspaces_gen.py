import asyncio
from typing import Any, List

from pydantic import BaseModel, ValidationError

from src.db.tasks import TaskBase, TaskType
from src.services.ai.client import AIProviderError, get_llm_client, get_llm_provider_settings
from src.services.courses.activities.workspaces_prompts import GENERATE_GRADING_CRITERIA


class TaskGradingCriteria(BaseModel):
    id_slug: str
    short: str
    detail: str
    must_fix: bool
    weight: float


class TaskGradingCriteriaCollection(BaseModel):
    list: List[TaskGradingCriteria]


class GenerateGradingCriteria(TaskBase):
    user_input: str


def _coerce_grading_criteria_payload(payload: dict[str, Any]) -> TaskGradingCriteriaCollection:
    if "list" not in payload and isinstance(payload.get("criteria"), list):
        payload = {"list": payload.get("criteria")}

    try:
        return TaskGradingCriteriaCollection.parse_obj(payload)
    except ValidationError as exc:
        raise AIProviderError(
            "AI provider returned an invalid grading criteria payload."
        ) from exc


async def generate_task_grading_criteria(
    inputs: GenerateGradingCriteria,
) -> TaskGradingCriteriaCollection:
    if inputs.task_type != TaskType.AI:
        raise Exception("Unsupported task type: Only works with AI tasks")

    text = (
        f"{GENERATE_GRADING_CRITERIA}\n"
        f"START OF TASK: Task Title: {inputs.title}\n"
        f"Task Description: {inputs.description}\n"
        f"Task Data: {inputs.ai_instruction}\n"
        f"END OF TASK. Furthermore, add an additional grading criterion based on the following requirements MUST be generated. Do not mention that this information is not from the task context. Here is the additional information: {inputs.user_input}\n"
        'Return a single JSON object with a top-level key "list".\n'
    )
    client = get_llm_client()
    settings = get_llm_provider_settings()

    payload = await asyncio.to_thread(
        client.generate_json,
        system_prompt=(
            "You generate grading criteria for educational tasks and return JSON only."
        ),
        user_prompt=text,
        model=settings.grading_criteria_model,
        temperature=0.2,
    )
    output = _coerce_grading_criteria_payload(payload)

    for item in output.list:
        if item.weight > 1.0:
            item.weight = 1.0

    return output


