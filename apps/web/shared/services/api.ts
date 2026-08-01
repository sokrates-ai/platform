// API client for backend communication
import { getAPIUrl } from '@services/config/config'

export interface Exercise {
  id: number;
  title: string;
  description: string;
  task: string;
  solution: string;
}

export interface Comment {
  id: string;
  title: string;
  content: string;
  citation: {
    text: string;
    location: {
      start: number;
      end: number;
    };
  };
  type: 'mistake' | 'suggestion' | 'praise';
}

export interface Feedback {
  comments: Comment[];
  summary: string;
  is_valid: boolean;
}

export interface RateLimit {
  remaining: number;
  resetSec?: number;
  limit?: { max: number; windowSec: number };
}

export interface UserStats {
  xp: number;
  level: number;
  coins: number;
}

export interface WorkspaceJob {
  id: string;
  type: string;
  userId: string;
  workspaceId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
}

export type WorkspaceType = 'text' | 'flashcard' | 'code'

export interface WorkspaceInfo {
  workspaceType: WorkspaceType;
  workspaceSpec?: Record<string, unknown> | null;
}

export interface WorkspaceInitialState {
  exercise: Exercise;
  workspaceInfo: WorkspaceInfo;
  workspaceState: { content: string };
}

const readErrorDetail = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim();
    }
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) return text.trim();
    } catch {}
  }
  return fallback;
};

const getApiBase = (): string => {
  return getAPIUrl().replace(/\/$/, '');
};

export class ApiClient {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  async getUserStats(): Promise<UserStats> {
    const response = await fetch(`${getApiBase()}/sessions/${encodeURIComponent(this.workspaceId)}/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch user stats');
    }
    return response.json();
  }

  async getWorkspace(): Promise<{ id: string; type: WorkspaceType; spec?: Record<string, unknown> | null; exercise?: Exercise }>{
    const response = await fetch(`${getApiBase()}/workspaces/${encodeURIComponent(this.workspaceId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch workspace');
    }
    const data = await response.json();
    const rawType = String(data.type);
    const type = (rawType === 'qa' || rawType === 'mcq' ? 'flashcard' : rawType) as WorkspaceType;
    return { id: data.id, type, spec: data.spec ?? null, exercise: data.exercise };
  }

  private workspaceToExercise(ws: { spec?: Record<string, unknown> | null; exercise?: Exercise }): Exercise {
    if (ws.exercise) return ws.exercise;
    const spec = (ws.spec || {}) as Record<string, unknown>;
    return {
      id: Number(spec.id ?? 0),
      title: String(spec.title ?? 'Exercise'),
      description: String(spec.description ?? ''),
      task: String(spec.task ?? ''),
      solution: String(spec.solution ?? ''),
    };
  }

  private workspaceToInfo(ws: { type: WorkspaceType; spec?: Record<string, unknown> | null }): WorkspaceInfo {
    return { workspaceType: ws.type, workspaceSpec: ws.spec };
  }

  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const ws = await this.getWorkspace();
    return this.workspaceToInfo(ws);
  }

  async getExercise(): Promise<Exercise> {
    const ws = await this.getWorkspace();
    return this.workspaceToExercise(ws);
  }

  async getInitialState(): Promise<WorkspaceInitialState> {
    const [workspace, workspaceState] = await Promise.all([
      this.getWorkspace(),
      this.getWorkspaceState().catch(() => ({ content: '' })),
    ]);
    return {
      exercise: this.workspaceToExercise(workspace),
      workspaceInfo: this.workspaceToInfo(workspace),
      workspaceState,
    };
  }

  async validateStep(stepId: string, answer: unknown): Promise<{ correct: boolean; rateLimit?: RateLimit } & { _status?: number } > {
    const response = await fetch(`${getApiBase()}/flashcard/${encodeURIComponent(this.workspaceId)}/steps/${encodeURIComponent(stepId)}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    const status = response.status;
    if (!response.ok) {
      // Try to parse JSON; include status for caller awareness (e.g., 429)
      let payload: any = {};
      try { payload = await response.json(); } catch { }
      const err: any = new Error(payload?.detail || 'Failed to validate step');
      err.status = status;
      err.retryAfter = response.headers.get('Retry-After');
      throw err;
    }
    const data = await response.json();
    return { ...data, _status: status };
  }

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${getApiBase()}/images/${encodeURIComponent(this.workspaceId)}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.content;
  }

  async getWorkspaceState(): Promise<{ content: string }> {
    const response = await fetch(`${getApiBase()}/workspaces/${encodeURIComponent(this.workspaceId)}/state`);
    if (!response.ok) {
      throw new Error('Failed to fetch workspace state');
    }
    return response.json();
  }

  async getWorkspaceJob(jobId: string): Promise<WorkspaceJob> {
    const response = await fetch(
      `${getApiBase()}/workspaces/${encodeURIComponent(this.workspaceId)}/jobs/${encodeURIComponent(jobId)}`
    );
    if (!response.ok) {
      const detail = await readErrorDetail(response, 'Failed to fetch workspace job');
      const err: Error & { status?: number } = new Error(detail);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  async saveWorkspaceState(content: string, options?: { keepalive?: boolean }): Promise<void> {
    const response = await fetch(`${getApiBase()}/workspaces/${encodeURIComponent(this.workspaceId)}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      keepalive: options?.keepalive ?? false,
    });
    if (!response.ok) {
      const detail = await readErrorDetail(response, 'Failed to save workspace state');
      throw new Error(detail);
    }
  }

  async submitForEvaluationY({ submission, jobId, idempotencyKey }: { submission: string; jobId: string; idempotencyKey?: string }): Promise<{ jobId: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetch(`${getApiBase()}/text/${encodeURIComponent(this.workspaceId)}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ submission, jobId }),
    });
    if (!response.ok) {
      const detail = await readErrorDetail(
        response,
        `Failed to create job (${response.status})`
      );
      const err: Error & { status?: number } = new Error(detail);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    return { jobId: data.jobId };
  }

  async submitCodeRunY({ languageId, source, stdin, jobId, idempotencyKey }: { languageId: number; source: string; stdin?: string; jobId: string; idempotencyKey?: string }): Promise<{ jobId: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const body: Record<string, unknown> = { languageId, source, jobId };
    if (typeof stdin === 'string') body.stdin = stdin;
    const response = await fetch(`${getApiBase()}/code/${encodeURIComponent(this.workspaceId)}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to create run: ${response.status} ${text}`);
    }
    const data = await response.json();
    return { jobId: data.jobId };
  }

  async submitCodeJudgementY({ languageId, source, tests, jobId, idempotencyKey }: { languageId: number; source: string; tests: Array<{ stdin?: string; expected?: string }>; jobId: string; idempotencyKey?: string }): Promise<{ jobId: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetch(`${getApiBase()}/code/${encodeURIComponent(this.workspaceId)}/judgements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ languageId, source, tests, jobId }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to create code judgement: ${response.status} ${text}`);
    }
    const data = await response.json();
    return { jobId: data.jobId };
  }

  async getRateLimit(kind: 'text.eval' | 'flashcard.validate' | 'code.run' | 'code.judge'): Promise<RateLimit> {
    const response = await fetch(`${getApiBase()}/rate-limit?kind=${encodeURIComponent(kind)}&workspaceId=${encodeURIComponent(this.workspaceId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch rate limit');
    }
    return response.json();
  }

  async completeWorkspace({ correct = true }: { correct?: boolean } = {}): Promise<void> {
    const response = await fetch(`${getApiBase()}/workspaces/${encodeURIComponent(this.workspaceId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to record completion: ${response.status} ${text}`);
    }
  }
} 
