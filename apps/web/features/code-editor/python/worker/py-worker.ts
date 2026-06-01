/// <reference lib="webworker" />

import type { WorkerInMessage, WorkerOutMessage } from "./protocol"

let pyodide: any = null
let currentExec = 0
let ready = false

function post(msg: WorkerOutMessage) {
  ;(self as unknown as Worker).postMessage(msg)
}

self.addEventListener('message', async (ev: MessageEvent<WorkerInMessage>) => {
  const data = ev.data
  if (!data) return
  try {
    if (data.type === 'INIT') {
      if (!ready) {
        const { indexURL, extraPaths } = data.payload
        try {
          // Load pyodide runtime
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          importScripts(`${indexURL}pyodide.js`)
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          pyodide = await (self as any).loadPyodide({ indexURL })
          ready = true

          // Wire stdout/stderr
          if (typeof pyodide.setStdout === 'function') {
            pyodide.setStdout({ batched: (s: string) => post({ type: 'STDOUT', payload: { executionId: currentExec, chunk: s } }) })
            pyodide.setStderr?.({ batched: (s: string) => post({ type: 'STDERR', payload: { executionId: currentExec, chunk: s } }) })
          } else {
            await pyodide.runPythonAsync(`
import sys
class _W:
    def write(self, s):
        from js import postMessage as _pm
        _pm({ 'type': 'STDOUT', 'payload': { 'executionId': ${currentExec}, 'chunk': str(s) } })
    def flush(self):
        pass
sys.stdout = _W()
sys.stderr = _W()
`)
          }

          if (extraPaths && extraPaths.length) {
            try {
              await pyodide.runPythonAsync(`import sys; sys.path.extend(${JSON.stringify(extraPaths)})`)
            } catch {}
          }

          let version = ''
          try { version = pyodide.version || (await pyodide.runPythonAsync('import sys; sys.version.split()[0]')) } catch {}
          post({ type: 'INIT_OK', payload: { version: String(version || '') } })
        } catch (e: any) {
          post({ type: 'INIT_ERROR', payload: { message: e?.message || String(e) } })
        }
      } else {
        let version = ''
        try { version = pyodide.version || (await pyodide.runPythonAsync('import sys; sys.version.split()[0]')) } catch {}
        post({ type: 'INIT_OK', payload: { version: String(version || '') } })
      }
      return
    }

    if (data.type === 'RUN') {
      const { executionId, code } = data.payload
      currentExec = executionId
      try {
        const result = await pyodide.runPythonAsync(code)
        if (executionId === currentExec) {
          post({ type: 'RESULT', payload: { executionId, result: result == null ? null : String(result) } })
        }
      } catch (e: any) {
        post({ type: 'ERROR', payload: { executionId, message: e?.message || String(e) } })
      }
      return
    }

    if (data.type === 'STOP') {
      const { executionId } = data.payload
      if (executionId === currentExec) currentExec += 1
      post({ type: 'STOPPED', payload: { executionId } })
      return
    }

    if (data.type === 'PING') {
      post({ type: 'PONG' })
      return
    }
  } catch (_e) {
    // swallow
  }
}) 