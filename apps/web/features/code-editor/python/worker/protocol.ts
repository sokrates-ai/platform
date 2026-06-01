export type WorkerInMessage =
  | { type: 'INIT', payload: { indexURL: string, extraPaths?: string[], pythonPath?: string } }
  | { type: 'RUN', payload: { executionId: number, code: string } }
  | { type: 'STOP', payload: { executionId: number } }
  | { type: 'PING' }

export type WorkerOutMessage =
  | { type: 'INIT_OK', payload: { version: string } }
  | { type: 'INIT_ERROR', payload: { message: string } }
  | { type: 'STDOUT', payload: { executionId: number, chunk: string } }
  | { type: 'STDERR', payload: { executionId: number, chunk: string } }
  | { type: 'RESULT', payload: { executionId: number, result?: string | null } }
  | { type: 'ERROR', payload: { executionId: number, message: string } }
  | { type: 'STOPPED', payload: { executionId: number } }
  | { type: 'PONG' } 