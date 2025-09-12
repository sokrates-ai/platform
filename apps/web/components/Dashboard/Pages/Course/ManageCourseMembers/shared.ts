//
// Students
//

export interface ExerciseLog {
  task_id: number;
  user_uuid: string;
  date: string; // ISO date string
  correct: boolean;
  id: number;
}

export interface ApiStudent {
    id: number,
    user_uuid: string,
    first_name: string,
    last_name: string,
    email: string,
    avatar_image: string, // URL of the avatar image
    log: ExerciseLog[]
}

//
// Tasks
//

interface GradingCriteriaItem {
  id_slug: string;
  short: string;
  detail: string;
  must_fix: boolean;
  weight: number;
}

interface GradingCriteria {
  criteria?: GradingCriteriaItem[];
}

interface AiInstruction {
  task_instruction: string;
  proposed_solution: string;
  grading_criteria: GradingCriteria;
}

interface MultipleChoiceAnswer {
  text: string;
  is_correct: boolean;
}

interface MultipleChoiceData {
  answers?: MultipleChoiceAnswer[];
}


export type TaskType = "ai" | "multiple_choice"

export interface ApiExercise {
  title: string;
  description: string;
  task_type: TaskType;
  /** Only when using type=AI */
  ai_instruction: AiInstruction;
  /** Only when using type=Multiple Choice */
  multiple_choice_data: MultipleChoiceData;
  xp_reward: number;
  coin_reward: number;
  id?: number;
  tags: string[];
  course_id?: number | null;
}
