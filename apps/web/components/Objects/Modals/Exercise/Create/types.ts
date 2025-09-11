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

export async function generateGradingCriteria() {
    // CODING AGENT: FETCH THIS: /api/v1/tasks/criteria
}
