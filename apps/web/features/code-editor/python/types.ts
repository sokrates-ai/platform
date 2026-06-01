export interface PyodideLike {
  version?: string
  runPython: (code: string) => unknown
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout?: (opts: { batched: (s: string) => void }) => void
  setStderr?: (opts: { batched: (s: string) => void }) => void
}

export interface InitOptions {
  indexURL: string
  extraPaths?: string[]
  pythonPath?: string
}

export interface InitOk { version: string }

export type RunnerStatus = "idle" | "loading" | "ready" | "running" 