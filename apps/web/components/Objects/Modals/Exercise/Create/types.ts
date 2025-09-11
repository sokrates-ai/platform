import { getAPIUrl } from "@services/config/config";
import { RequestBodyWithAuthHeader } from "@services/utils/ts/requests";

export type TaskType = "ai" | "multiple_choice"

export interface Exercise {
  title: string;
  description: string;
  task_type: TaskType;
  /** Only when using type=AI */
  ai_instruction: Record<string, any>;
  /** Only when using type=Multiple Choice */
  multiple_choice_data: Record<string, any>;
  xp_reward: number;
  coin_reward: number;
}

export async function generateGradingCriteria(
  data: Exercise & { user_input: string },
  access_token: string,
) {
  let urlComplete = `${getAPIUrl()}tasks/criteria/`
  // TODO: use relative URL if not in localhost!!!

  console.log('generate grading criteria url, ', urlComplete)

  // Normalize fields like in createExercise if needed
  // (course_id handling is not mentioned for criteria, so skipping here)

  const result = await fetch(
    urlComplete,
    RequestBodyWithAuthHeader(
      'POST',
      data,
      { revalidate: 0, tags: ['criteria'] },
      access_token,
    )
  )

  if (!result.ok) {
    throw new Error(`Failed to generate grading criteria: ${result.status} ${result.statusText}`)
  }

  const res = await result.json()
  return res
}
