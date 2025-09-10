from typing import List
from pydantic import BaseModel
from openai import OpenAI
from src.db.tasks import TaskBase, TaskType
from src.services.courses.activities.workspaces_prompts import GENERATE_GRADING_CRITERIA


class Evidence(BaseModel):
    targets: List[str]
    methods: List[str]
    forms: List[str]


class TaskGradingCriteria(BaseModel):
    id_slug: str
    type: str
    short: str
    detail: str
    must_fix: bool
    weight: float
    prereqs: List[str]
    evidence: Evidence


class TaskGradingCriteriaCollection(BaseModel):
    list: List[TaskGradingCriteria]


async def generate_task_grading_criteria(
    task_contents: TaskBase,
) -> TaskGradingCriteria:
    # Prompt the LLM to get the grading criteria
    client = OpenAI()

    print("A")

    if task_contents.task_type != TaskType.AI:
        raise Exception("Unsupported task type: Only works with AI tasks")

    response = client.responses.parse(
        model="gpt-5",
        input=[
            {
            "role": "developer",
            "content": [
                {
                "type": "input_text",
                "text": f"{GENERATE_GRADING_CRITERIA}\nHere is the task:\nTitle: {task_contents.title}\nDescription: {task_contents.description}\nTask Instructions: {task_contents._type_ai_instruction}"
                }
            ]
            }
        ],
        text_format=TaskGradingCriteria,
        )

    return response.output_parsed



