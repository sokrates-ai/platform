from typing import List
from pydantic import BaseModel
from openai import OpenAI
from src.db.tasks import TaskBase, TaskType
from src.services.courses.activities.workspaces_prompts import GENERATE_GRADING_CRITERIA
import asyncio


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


async def generate_task_grading_criteria(
    inputs: GenerateGradingCriteria,
) -> TaskGradingCriteriaCollection:
    # Prompt the LLM to get the grading criteria
    client = OpenAI()

    print("A")

    if inputs.task_type != TaskType.AI:
        raise Exception("Unsupported task type: Only works with AI tasks")

    text = (
        f"{GENERATE_GRADING_CRITERIA}\n"
        f"START OF TASK: Task Title: {inputs.title}\n"
        f"Task Description: {inputs.description}\n"
        f"Task Data: {inputs.ai_instruction}\n"
        f"END OF TASK. Furthermore, add an additional grading criterion based on the following requirements MUST be generated. Do not mention that this information is not from the task context. Here is the additional information: {inputs.user_input}\n"
    )
    print(f"Gen with user input: {text}")

    # Run the blocking call in a thread to avoid blocking the event loop
    response = await asyncio.to_thread(
        client.responses.parse,
        model="gpt-4.1-nano", # USE GPT 5 later
        input=[
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": text,
                    }
                ]
            }
        ],
        text_format=TaskGradingCriteriaCollection,
    )

    output: TaskGradingCriteriaCollection = response.output_parsed

    for item in output.list:
        if item.weight > 1.0:
            print(f"WARN: generated weight is > 1.0 ({item.weight}), ceiling it")
            item.weight = 1.0

    return response.output_parsed



