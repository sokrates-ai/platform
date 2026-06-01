import type { WorkerInMessage, WorkerOutMessage } from "./worker/protocol"

type StdHandler = (chunk: string) => void

interface RunHandle {
  executionId: number
  onStdout: (cb: StdHandler) => void
  onStderr: (cb: StdHandler) => void
  done: Promise<{ result?: string | null }>
}

let worker: Worker | null = null
let nextExecId = 1

const pending: Map<number, {
  resolve: (v: { result?: string | null }) => void
  reject: (e: unknown) => void
  stdout?: StdHandler
  stderr?: StdHandler
}> = new Map()

function ensureWorker(): Worker {
  if (worker) return worker
  // Vite/Next style worker URL
  worker = new Worker(new URL('./worker/py-worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
    const msg = ev.data
    switch (msg.type) {
      case 'INIT_OK':
      case 'INIT_ERROR': {
        // Surface to whoever is awaiting init via the special execId 0? We'll just resolve a special map key.
        const entry = pending.get(0)
        if (!entry) return
        if (msg.type === 'INIT_OK') entry.resolve({ result: msg.payload.version })
        else entry.reject(new Error(msg.payload.message))
        pending.delete(0)
        break
      }
      case 'STDOUT': {
        const h = pending.get(msg.payload.executionId)
        h?.stdout?.(msg.payload.chunk)
        break
      }
      case 'STDERR': {
        const h = pending.get(msg.payload.executionId)
        h?.stderr?.(msg.payload.chunk)
        break
      }
      case 'RESULT': {
        const h = pending.get(msg.payload.executionId)
        if (h) {
          h.resolve({ result: msg.payload.result ?? null })
          pending.delete(msg.payload.executionId)
        }
        break
      }
      case 'ERROR': {
        const h = pending.get(msg.payload.executionId)
        if (h) {
          h.reject(new Error(msg.payload.message))
          pending.delete(msg.payload.executionId)
        }
        break
      }
      case 'STOPPED': {
        const h = pending.get(msg.payload.executionId)
        if (h) {
          h.reject(new Error('stopped'))
          pending.delete(msg.payload.executionId)
        }
        break
      }
      default:
        break
    }
  }
  return worker
}

export async function initWorker(indexURL: string): Promise<{ version: string }> {
  const w = ensureWorker()
  const done = new Promise<{ result?: string | null }>((resolve, reject) => {
    pending.set(0, { resolve, reject })
  })
  const msg: WorkerInMessage = { type: 'INIT', payload: { indexURL } }
  w.postMessage(msg)
  const r = await done
  return { version: String(r.result || '') }
}

export function runCode(code: string): RunHandle {
  const w = ensureWorker()
  const executionId = nextExecId++
  let stdout: StdHandler | undefined
  let stderr: StdHandler | undefined
  const done = new Promise<{ result?: string | null }>((resolve, reject) => {
    pending.set(executionId, { resolve, reject, stdout, stderr })
  })

  const onStdout = (cb: StdHandler) => { const e = pending.get(executionId); if (e) e.stdout = cb }
  const onStderr = (cb: StdHandler) => { const e = pending.get(executionId); if (e) e.stderr = cb }

  const msg: WorkerInMessage = { type: 'RUN', payload: { executionId, code } }
  w.postMessage(msg)

  return { executionId, onStdout, onStderr, done }
}

export function stopRun(executionId: number) {
  const w = ensureWorker()
  const msg: WorkerInMessage = { type: 'STOP', payload: { executionId } }
  w.postMessage(msg)
} 