from typing import List
from pydantic import BaseModel
from openai import OpenAI
from src.db.tasks import TaskBase, TaskType
from src.services.courses.activities.workspaces_prompts import GENERATE_GRADING_CRITERIA
import asyncio

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


class GenerateGradingCriteria(TaskBase):
    user_input: str

async def generate_task_grading_criteria(
    inputs: GenerateGradingCriteria,
) -> TaskGradingCriteria:
    # Prompt the LLM to get the grading criteria
    client = OpenAI()

    print("A")

    if inputs.task_type != TaskType.AI:
        raise Exception("Unsupported task type: Only works with AI tasks")

    text = (
        f"{GENERATE_GRADING_CRITERIA}\n"
        f"Furthermore, respect the following input when generating your answer. Respect this input AT ALL COST: {inputs.user_input}\n"
        f"Finally, here is the task:\n"
        f"Title: {inputs.title}\n"
        f"Description: {inputs.description}\n"
        f"Task Instructions: {inputs.ai_instruction}\n"
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
        text_format=TaskGradingCriteria,
    )

    return response.output_parsed



