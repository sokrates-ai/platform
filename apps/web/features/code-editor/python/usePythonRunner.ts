"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { initWorker, runCode, stopRun } from "./client"
import type { RunnerStatus } from "./types"

export function usePythonRunner({
  indexURL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  onAppendLine,
  onSetResults,
}: {
  indexURL?: string
  onAppendLine: (s: string) => void
  onSetResults: (html: string) => void
}) {
  const [status, setStatus] = useState<RunnerStatus>("idle")
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [pyodideReady, setPyodideReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const lastExecId = useRef<number | null>(null)
  const versionRef = useRef<string | null>(null)

  const ensureInit = useCallback(async () => {
    if (pyodideReady) return
    setPyodideLoading(true)
    setStatus("loading")
    try {
      onAppendLine("Loading…")
      const { version } = await initWorker(indexURL)
      versionRef.current = version
      setPyodideReady(true)
      setPyodideLoading(false)
      setStatus("ready")
      onAppendLine(version ? `Pyodide ready (v${version})` : "Pyodide ready")
    } catch (e: any) {
      setPyodideLoading(false)
      setStatus("idle")
      onAppendLine(`Pyodide load error: ${e?.message || String(e)}`)
      throw e
    }
  }, [indexURL, pyodideReady, onAppendLine])

  const run = useCallback(async (code: string) => {
    await ensureInit()
    setIsRunning(true)
    setStatus("running")
    onAppendLine("▶ Running…")
    const handle = runCode(code)
    lastExecId.current = handle.executionId
    handle.onStdout((s) => onAppendLine(s))
    handle.onStderr((s) => onAppendLine(s))
    try {
      const { result } = await handle.done
      if (lastExecId.current === handle.executionId && result != null) {
        onSetResults(String(result))
      }
    } catch (e: any) {
      onAppendLine(e?.message || String(e))
    } finally {
      if (lastExecId.current === handle.executionId) {
        setIsRunning(false)
        setStatus(pyodideReady ? "ready" : "idle")
        onAppendLine("■ Stopped.")
      }
    }
  }, [ensureInit, onAppendLine, onSetResults, pyodideReady])

  const stop = useCallback(() => {
    const id = lastExecId.current
    if (id == null) return
    stopRun(id)
    setIsRunning(false)
    setStatus(pyodideReady ? "ready" : "idle")
    onAppendLine("■ Stopped.")
  }, [pyodideReady, onAppendLine])

  return useMemo(() => ({
    status,
    pyodideLoading,
    pyodideReady,
    isRunning,
    run,
    stop,
  }), [status, pyodideLoading, pyodideReady, isRunning, run, stop])
} 