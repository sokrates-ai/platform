"use client"

import React, { useMemo, useCallback, forwardRef, useImperativeHandle } from "react"
import * as Y from "yjs"
import type { Awareness } from "y-protocols/awareness"
import { useSession } from "@/shared/hooks/useSession"
import type { PresenceUser } from "@/features/collaboration/hooks/useAwarenessPresence"
import { useAwarenessPresence } from "@/features/collaboration/hooks/useAwarenessPresence"

import { makeCollab } from "@/features/code-editor/cm/collaboration"
import { makePythonLspExtensions } from "@/features/code-editor/cm/lsp"
import { buildExtensions } from "@/features/code-editor/cm/extensions"

import { useEditorModel } from "@/features/code-editor/state/useEditorModel"
import { useConsoleState } from "@/features/code-editor/state/useConsoleState"
import { usePythonRunner } from "@/features/code-editor/python/usePythonRunner"

import { Toolbar } from "./components/Toolbar"
import { EditorPane } from "./components/EditorPane"
import { ConsoleDesktop } from "./components/ConsoleDesktop"
import { ConsoleMobile } from "./components/ConsoleMobile"

import type { WorkspaceSpec } from "@/features/code-editor/types"

export type CodeEditorRef = { runCurrent: () => Promise<void> }

const CodeEditorContainer = forwardRef<CodeEditorRef, {}>((_props, ref) => {
  const { workspaceInfo, ydoc, awareness, currentUser, apiClient, provider, token } = useSession() as {
    workspaceInfo?: { workspaceSpec?: WorkspaceSpec } | null
    ydoc?: Y.Doc | null
    awareness?: Awareness | null
    currentUser?: PresenceUser | null
    apiClient?: import("@/shared/services/api").ApiClient | null
    provider?: any
    token?: string | null
  }

  const initialCode = useMemo(() => {
    const spec = (workspaceInfo?.workspaceSpec as WorkspaceSpec | undefined)
    return spec?.starterCode || ""
  }, [workspaceInfo])

  const editorModel = useEditorModel({ ydoc: ydoc || undefined, initialCode })
  const consoleState = useConsoleState()

  const runner = usePythonRunner({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    onAppendLine: consoleState.appendLine,
    onSetResults: consoleState.setResults,
  })

  const collab = useMemo(() => makeCollab({ ydoc: ydoc || undefined, awareness: awareness || undefined }), [ydoc, awareness])

  const spec = (workspaceInfo?.workspaceSpec as WorkspaceSpec | undefined)
  const language = spec?.language || "python"
  const base = (() => {
    const v = process.env.NEXT_PUBLIC_LSP_WS_URL as string | undefined
    if (!v) throw new Error('Missing NEXT_PUBLIC_LSP_WS_URL')
    return v
  })()
  const serverUri = (base.endsWith("/pyright") ? base : `${base.replace(/\/$/, "")}/pyright`) as `ws://${string}` | `wss://${string}`
  const rootUri = "file:///workspace"
  const documentUri = `${rootUri}/main.py`

  const initializationOptions = useMemo(() => ({
    python: {
      pythonPath: spec?.pythonPath || process.env.NEXT_PUBLIC_PYTHON_PATH || "/usr/bin/python3",
      analysis: {
        autoImportCompletions: true,
        autoSearchPaths: true,
        diagnosticMode: (spec?.diagnosticMode || "openFilesOnly") as "openFilesOnly" | "workspace",
        typeCheckingMode: (spec?.typeCheckingMode || "basic") as "off" | "basic" | "strict",
        useLibraryCodeForTypes: true,
        extraPaths: (spec?.extraPaths && spec.extraPaths.length > 0 ? spec.extraPaths : ["/workspace"]) as string[],
      },
    },
  }), [spec?.pythonPath, spec?.diagnosticMode, spec?.typeCheckingMode, spec?.extraPaths]) as any

  const lspExts = useMemo(() => makePythonLspExtensions({ serverUri, rootUri, documentUri, initializationOptions }), [serverUri, rootUri, documentUri, initializationOptions])
  const extensions = useMemo(() => buildExtensions({ language, lspExts, collabExt: collab.ext }), [language, lspExts, collab.ext])

  const presentUsers = useAwarenessPresence(awareness as Awareness, currentUser || null)

  const handleChange = useCallback((val: string) => {
    if (!collab.ytext) editorModel.setLocalValue(val)
  }, [collab.ytext, editorModel])
  const noop = useCallback(() => {}, [])

  const handleClearTerminal = useCallback(() => {
    consoleState.setTerminalLines([])
  }, [consoleState])

  // Seed initial code only once per workspace after provider sync, when Y doc is empty
  React.useEffect(() => {
    if (!provider || !collab.ytext || !ydoc) return
    const wsId = token || ''
    const seedKey = `ws-seeded-v1:${wsId || 'unknown'}`
    const doSeed = () => {
      try {
        const seeded = typeof window !== 'undefined' ? window.localStorage.getItem(seedKey) : '1'
        if (seeded) return
        const ytext = collab.ytext!
        const len = ytext.toString().length
        const seed = (workspaceInfo?.workspaceSpec as WorkspaceSpec | undefined)?.starterCode || ""
        if (!seed) return
        if (len === 0) {
          ydoc.transact(() => { ytext.insert(0, seed) })
        }
        try { window.localStorage.setItem(seedKey, '1') } catch {}
      } catch {}
    }
    const onSynced = () => { queueMicrotask(doSeed) }
    try { provider.on?.('synced', onSynced) } catch {}
    // In case it's already synced
    queueMicrotask(doSeed)
    return () => { try { provider.off?.('synced', onSynced) } catch {} }
  }, [provider, token, collab.ytext, ydoc, workspaceInfo?.workspaceSpec])

  const runWithJudge0 = useCallback(async () => {
    if (!apiClient) { alert('API not ready.'); return }

    // Reset console
    consoleState.setShowConsole(true)
    consoleState.setTerminalLines([])
    consoleState.setResults("")

    const code = editorModel.getCurrentCode()
    const langId = (() => {
      // Minimal mapping; default to Python 3
      if ((language || '').toLowerCase().startsWith('py')) return 71
      return 71
    })()

    try {
      // Prefer judgements when tests exist in spec; otherwise do a quick run
      const rawSpec: any = workspaceInfo?.workspaceSpec || {}
      const testsArr: any[] = Array.isArray(rawSpec?.tests) ? rawSpec.tests : []
      const mappedTests = testsArr
        .map((t: any) => ({ stdin: t?.stdin ?? t?.input, expected: t?.expected }))
        .filter((t: any) => typeof t.stdin !== 'undefined' || typeof t.expected !== 'undefined')

      const jobId = Math.random().toString(36).slice(2)
      if (mappedTests.length > 0) {
        try { provider?.sendStateless?.(JSON.stringify({ type: 'code.judge', jobId, languageId: langId, source: code, tests: mappedTests })) } catch {}
        await apiClient.submitCodeJudgementY({ languageId: langId, source: code, tests: mappedTests, jobId })
      } else {
        try { provider?.sendStateless?.(JSON.stringify({ type: 'code.run', jobId, languageId: langId, source: code })) } catch {}
        await apiClient.submitCodeRunY({ languageId: langId, source: code, jobId })
      }

      // Observe jobs/runtime for this job and print to console
      const doc = ydoc as Y.Doc
      const jobs = doc.getMap('jobs') as any
      const runtime = doc.getMap('runtime') as any

      const appendBlock = (label: string, text?: string | null) => {
        const s = (text ?? '').toString()
        if (!s) return
        consoleState.appendLine(`${label}:`)
        for (const line of s.split(/\r?\n/)) consoleState.appendLine(line)
      }

      const onJobs = () => {
        try {
          const j = jobs.get(jobId)
          const p = j?.progressText || j?.progress
          if (typeof p === 'string') consoleState.appendLine(p)
        } catch {}
      }
      const onRuntime = () => {
        try {
          const payload = (runtime.get('code:run') || runtime.get('code:judge') || runtime.get(`job:${jobId}`))
          if (!payload) return
          if (payload?.cases && Array.isArray(payload.cases)) {
            const agg = payload.aggregate || { passedCount: 0, total: payload.cases.length }
            consoleState.appendLine(`Passed ${agg.passedCount}/${agg.total}`)
            payload.cases.forEach((c: any, idx: number) => {
              consoleState.appendLine(`Case #${idx + 1} — ${c.status}${c.passed === true ? ' (passed)' : (c.passed === false ? ' (failed)' : '')}`)
              appendBlock('stdout', c.stdout)
              appendBlock('stderr', c.stderr)
              appendBlock('compile', c.compileOutput)
            })
            consoleState.setResults(`<div>Judgement completed: ${agg.passedCount}/${agg.total} passed.</div>`)
          } else {
            appendBlock('stdout', payload?.stdout)
            appendBlock('stderr', payload?.stderr)
            appendBlock('compile', payload?.compileOutput)
            const status = payload?.status || 'Completed'
            consoleState.setResults(`<div>Run status: ${status}</div>`)
          }
        } catch {}
      }
      const pollJob = async () => {
        for (let attempt = 0; attempt < 90; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000))
          try {
            const job = await apiClient.getWorkspaceJob(jobId)
            if (job.status === 'error') {
              const message = typeof job.result?.message === 'string'
                ? job.result.message
                : 'The code run failed. Please try again.'
              consoleState.appendLine(`Error: ${message}`)
              return
            }
            if (job.status === 'done') return
          } catch {}
        }
        consoleState.appendLine('The code run timed out. Please try again.')
      }
      try { jobs.observe(onJobs); runtime.observe(onRuntime) } catch {}
      void pollJob()
    } catch (_e) {
      consoleState.appendLine('Failed to start Judge0 run')
    }
  }, [apiClient, consoleState, editorModel, language, workspaceInfo?.workspaceSpec, provider, ydoc])

  useImperativeHandle(ref, () => ({
    runCurrent: async () => {
      try {
        await runWithJudge0()
      } catch {}
    },
  }))

  return (
    <div className="w-full flex-1 overflow-y-auto pt-0 md:pt-0 lg:pt-0 p-4 md:p-6 lg:p-8 max-w-full sm:max-w-8/12 mx-auto relative">
      <div className="space-y-3">
        <div className="rounded-lg overflow-hidden border border-[#707070] bg-[#F4F4F4] shadow-[0px_4px_0px_0px_#454545]">
          <Toolbar
            pyodideLoading={runner.pyodideLoading}
            pyodideReady={runner.pyodideReady}
            isRunning={runner.isRunning}
            onReset={editorModel.reset}
            onRun={() => runner.run(editorModel.getCurrentCode())}
            onStop={runner.stop}
            onToggleConsole={() => consoleState.setShowConsole((s) => !s)}
            showConsole={consoleState.showConsole}
            presentUsers={presentUsers}
            currentUser={currentUser}
          />

          <div className="h-[55svh] sm:h-[45svh] flex flex-col lg:flex-row gap-0 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
              <EditorPane
                key={collab.ytext ? 'collab' : 'local'}
                value={collab.ytext ? undefined : editorModel.value}
                extensions={extensions}
                onChange={handleChange}
                onTypedSpaceImportTrigger={noop}
                className="bg-[#F4F4F4] h-full"
              />
            </div>

            {consoleState.showConsole && (
              <>
                <ConsoleDesktop resultsHtml={consoleState.results} terminalLines={consoleState.terminalLines} onClearTerminal={handleClearTerminal} />
                <ConsoleMobile
                  resultsHtml={consoleState.results}
                  terminalLines={consoleState.terminalLines}
                  mobileTab={consoleState.mobileTab}
                  setMobileTab={consoleState.setMobileTab}
                  onClearTerminal={handleClearTerminal}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

CodeEditorContainer.displayName = 'CodeEditorContainer'

export default CodeEditorContainer
