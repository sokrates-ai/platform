'use client'

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as Y from 'yjs'
import { Editor } from '@/features/text-editor/components/TextEditor'
import type { HighlightSpec } from '@/features/text-editor/types/highlightTypes'
import type { WorkspaceJob } from '@/shared/services/api'
import { Button } from '@/shared/ui/button'
import { Keyboard, Upload } from 'lucide-react'
import UploadDialog from '@/features/workspace/components/UploadDialog'
import { useSession } from '@/shared/hooks/useSession'

interface SheetProps {
  onActionStarted: () => void
  onUploadDialogOpen?: () => void
  triggerUpload?: boolean
  onCompleted?: () => void
}

interface FeedbackComment {
  id: string
  title: string
  text?: string
  content?: string
  type: 'mistake' | 'suggestion' | 'praise'
  citation?: {
    text?: string
    location?: { start: number; end: number }
  }
}

interface FeedbackPayload {
  comments?: FeedbackComment[]
  summary?: string
  message?: string
  status?: string
  is_valid?: boolean
}

const JOB_POLL_INTERVAL_MS = 1200
const JOB_POLL_TIMEOUT_MS = 45000

export type SheetRef = {
  requestFeedback: () => Promise<void>
  clearMarkers: () => void
}

export const Sheet = forwardRef<SheetRef, SheetProps>(({ onActionStarted, onUploadDialogOpen, triggerUpload, onCompleted }, ref) => {
  const { workspaceContent, updateWorkspaceContent, isInitialContentLoaded, ydoc, awareness, currentUser, apiClient, refreshRateLimit, refreshUserStats, provider, jobsActive, latestTextFeedback, commentsVisible } = useSession();
  const [showEditor, setShowEditor] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [draggedFile, setDraggedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [insertContent, setInsertContent] = useState<((content: string) => void) | null>(null)
  const [editorHighlights, setEditorHighlights] = useState<HighlightSpec[]>([])

  const handleStartTyping = () => {
    setShowEditor(true)
    onActionStarted()
  }

  const handleUpload = () => {
    setShowEditor(true)
    onActionStarted()
    setUploadDialogOpen(true)
    onUploadDialogOpen?.()
  }

  const handleEditorReady = useCallback((insertContentFn: (content: string) => void) => {
    setInsertContent(() => insertContentFn)
  }, [])

  const handleUploadComplete = useCallback((content: string) => {
    if (insertContent) {
      insertContent(content)
    }
  }, [insertContent])

  const handleHighlightClick = useCallback(() => { }, [])

  const clearFeedbackMarkers = useCallback(() => {
    setEditorHighlights([])
    if (!ydoc) return
    try {
      const doc = ydoc as Y.Doc
      doc.transact(() => {
        const runtime = doc.getMap('runtime') as Y.Map<any>
        const current = runtime.get('text:feedback')
        if (!current || typeof current !== 'object') return

        const container = { ...(current as Record<string, any>) }
        const baseValue = ((container.value ?? container.payload) && typeof (container.value ?? container.payload) === 'object')
          ? { ...(container.value ?? container.payload) as Record<string, any> }
          : {}
        const sanitizedValue = { ...baseValue, comments: [] as any[] }

        const nextPayload: Record<string, any> = {
          ...container,
          value: sanitizedValue,
          updatedAt: Date.now(),
        }

        if (container.payload && typeof container.payload === 'object') {
          nextPayload.payload = sanitizedValue
        }

        runtime.set('text:feedback', nextPayload)
      })
    } catch (err) {
      console.warn('[Sheet] Failed to clear shared feedback markers', err)
    }
  }, [ydoc])

  const handleFeedbackReceived = useCallback((feedback: FeedbackPayload) => {
    // Always reset highlights first to avoid stale ones sticking around
    setEditorHighlights([])
    const htmlWithNewlines = workspaceContent
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<br\s*\/?>(?=\n|$)/gi, '\n')
      .replace(/<[^>]*>/g, '');

    const plainText = htmlWithNewlines.trim();

    const convertAbsoluteToLinePositions = (absoluteStart: number, absoluteEnd: number) => {
      const lines = plainText.split('\n');
      let currentPos = 0;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const lineLength = lines[lineIndex].length;
        const lineEnd = currentPos + lineLength;
        if (absoluteStart >= currentPos && absoluteStart < lineEnd) {
          const relativeStart = absoluteStart - currentPos;
          let relativeEnd = absoluteEnd - currentPos;
          if (absoluteEnd > lineEnd) {
            relativeEnd = lineLength;
          }
          return { line: lineIndex + 1, from: relativeStart, to: relativeEnd };
        }
        currentPos = lineEnd + 1;
      }
      return { line: 1, from: Math.min(absoluteStart, plainText.length), to: Math.min(absoluteEnd, plainText.length) };
    };

    if (feedback?.comments && Array.isArray(feedback.comments)) {
      const highlights: HighlightSpec[] = []
      for (const comment of feedback.comments) {
        let highlightType: 'issue' | 'advice' | 'praise' = 'advice'
        if (comment.type === 'mistake') highlightType = 'issue'
        else if (comment.type === 'suggestion') highlightType = 'advice'
        else if (comment.type === 'praise') highlightType = 'praise'

        const citation = comment.citation
        if (citation?.location && citation.location.start !== undefined && citation.location.end !== undefined) {
          const linePosition = convertAbsoluteToLinePositions(citation.location.start, citation.location.end)
          highlights.push({
            id: comment.id,
            line: linePosition.line,
            from: linePosition.from,
            to: linePosition.to,
            type: highlightType,
            message: `${comment.title}: ${comment.text || comment.content || 'No details available'}`,
          })
        }
      }
      setEditorHighlights(highlights)
    }
  }, [workspaceContent])

  const handleHighlightsInvalidated = useCallback((ids: string[]) => {
    if (!ids.length) return
    clearFeedbackMarkers()
  }, [clearFeedbackMarkers])

  // Re-apply last feedback on load and updates
  useEffect(() => {
    if (latestTextFeedback) {
      try { handleFeedbackReceived(latestTextFeedback as any) } catch {}
    }
  }, [latestTextFeedback, handleFeedbackReceived])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.includes('document') || file.type.includes('text')) {
        setDraggedFile(file)
        setShowEditor(true)
        onActionStarted()
        setUploadDialogOpen(true)
        onUploadDialogOpen?.()
      }
    }
  }, [onActionStarted, onUploadDialogOpen])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])

  useEffect(() => { if (!uploadDialogOpen) setDraggedFile(null) }, [uploadDialogOpen])
  useEffect(() => { if (triggerUpload) { setUploadDialogOpen(true); onUploadDialogOpen?.() } }, [triggerUpload, onUploadDialogOpen])
  useEffect(() => {
    if (isInitialContentLoaded && workspaceContent && workspaceContent.trim()) {
      setShowEditor(true)
      onActionStarted()
    }
  }, [isInitialContentLoaded, workspaceContent, onActionStarted])

  useEffect(() => {
    if (typeof document !== 'undefined') { document.body.classList.add('overflow-hidden-initial') }
    if (showEditor) { document.body.classList.remove('overflow-hidden-initial') } else { document.body.classList.add('overflow-hidden-initial') }
    return () => { if (typeof document !== 'undefined') { document.body.classList.remove('overflow-hidden-initial') } }
  }, [showEditor])

  const formatLearnerError = useCallback((message: string) => {
    const trimmed = message.trim()
    if (!trimmed || trimmed === 'api_request_failed') {
      return 'AI feedback could not be requested right now. Your draft is still saved. Please try again in a moment.'
    }
    return trimmed
  }, [])

  const buildDeliveryFailurePayload = useCallback((message: string): FeedbackPayload => ({
    status: 'error',
    summary: 'Feedback results could not be delivered.',
    message,
    is_valid: false,
    comments: [],
  }), [])

  const applyPolledJobState = useCallback((jobId: string, status: 'done' | 'error', result: FeedbackPayload) => {
    if (ydoc) {
      try {
        const doc = ydoc as Y.Doc
        doc.transact(() => {
          const jobs = doc.getMap('jobs') as Y.Map<any>
          const runtime = doc.getMap('runtime') as Y.Map<any>
          const prev = (jobs.get(jobId) as Record<string, any> | undefined) || {}
          const nextJob: Record<string, any> = {
            ...prev,
            status,
            result,
            finishedAt: Date.now(),
            updatedAt: Date.now(),
          }
          if (status === 'error') {
            nextJob.error =
              result?.message ||
              result?.summary ||
              prev.error ||
              'job_failed'
          }
          jobs.set(jobId, nextJob)
          runtime.set('text:feedback', {
            status,
            value: result,
            updatedAt: Date.now(),
          })
        })
        return
      } catch (error) {
        console.error('[Sheet] Failed to apply polled job state to collaboration doc', error)
      }
    }

    if (status === 'done') {
      handleFeedbackReceived(result)
      try { if (result?.is_valid) onCompleted?.() } catch {}
      return
    }

    alert(
      formatLearnerError(
        result?.message ||
          result?.summary ||
          'Feedback results could not be delivered. Please try again in a moment.'
      )
    )
  }, [formatLearnerError, handleFeedbackReceived, onCompleted, ydoc])

  const waitForSettledJob = useCallback(async (jobId: string, isSettled: () => boolean): Promise<WorkspaceJob | null> => {
    if (!apiClient) return null
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const startedAt = Date.now()

    while (!isSettled() && Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
      try {
        const job = await apiClient.getWorkspaceJob(jobId)
        if (job.status === 'done' || job.status === 'error') {
          return job
        }
      } catch (error: unknown) {
        const status =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof (error as { status?: unknown }).status === 'number'
            ? Number((error as { status?: number }).status)
            : 0

        if (status !== 404) {
          console.error('[Sheet] Failed to poll workspace job', { jobId, error })
        }
      }

      await sleep(JOB_POLL_INTERVAL_MS)
    }

    return null
  }, [apiClient])

  const requestFeedback = useCallback(async () => {
    if (!apiClient || !workspaceContent.trim()) { alert('Please write something in the editor first.'); return }

    // Fetch the latest rate limit from the server and only block when no requests remain
    try {
      const latest = await apiClient.getRateLimit('text.eval')
      if ((latest?.remaining ?? 0) === 0) {
        try { await refreshRateLimit() } catch { }
        try { await refreshUserStats() } catch { }
        alert(`Please wait ${latest.resetSec ?? 0} seconds before requesting feedback again.`)
        return
      }
    } catch { }
    try {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = workspaceContent
      const plainTextContent = tempDiv.textContent || tempDiv.innerText || ''

      // Create a job id and send stateless command via provider
      const jobId = Math.random().toString(36).slice(2)
      if (provider?.sendStateless) {
        provider.sendStateless(
          JSON.stringify({ type: 'text.eval', jobId, submission: plainTextContent })
        )
      } else {
        await apiClient.submitForEvaluationY({
          submission: plainTextContent,
          jobId,
        })
      }

      // Observe Y.Doc jobs/runtime for this job
      const doc = ydoc
      const jobs = doc?.getMap('jobs') as any
      const runtime = doc?.getMap('runtime') as any
      let settled = false
      const markSettled = () => {
        if (settled) return false
        settled = true
        return true
      }
      const unsub = () => {
        try { jobs?.unobserve(onJobs) } catch {}
        try { runtime?.unobserve(onRuntime) } catch {}
      }
      const onJobs = () => {
        try {
          const j = jobs?.get(jobId)
          if ((j?.status === 'done' || j?.status === 'error') && j?.result && markSettled()) {
            unsub()
            applyPolledJobState(jobId, j.status, j.result as FeedbackPayload)
          }
        } catch {}
      }
      const onRuntime = () => {
        try {
          const data = runtime?.get('text:feedback') || runtime?.get(`job:${jobId}`)
          if ((data?.value || data?.payload) && markSettled()) {
            const result = (data.value ?? data.payload)
            unsub()
            handleFeedbackReceived(result)
            try { if (result?.is_valid) onCompleted?.() } catch {}
          }
        } catch {}
      }
      try { jobs?.observe(onJobs); runtime?.observe(onRuntime) } catch {}

      void waitForSettledJob(jobId, () => settled)
        .then((job) => {
          if (!job || settled) return

          const result =
            job.result && typeof job.result === 'object'
              ? job.result as FeedbackPayload
              : buildDeliveryFailurePayload(
                  'Feedback results could not be delivered. Please try again in a moment.'
                )

          if (!markSettled()) return
          unsub()
          applyPolledJobState(
            jobId,
            job.status === 'done' ? 'done' : 'error',
            result
          )
        })
        .catch((error) => {
          if (!markSettled()) return
          unsub()
          console.error('[Sheet] Unexpected job polling failure', { jobId, error })
          applyPolledJobState(
            jobId,
            'error',
            buildDeliveryFailurePayload(
              'Feedback results could not be delivered. Please try again in a moment.'
            )
          )
        })
    } catch (error: unknown) {
      const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message) : ''
      if (message.includes('429') || message.includes('Rate limit')) {
          await refreshRateLimit()
          await refreshUserStats()
      } else {
        alert(formatLearnerError(message || 'Failed to get feedback. Please try again.'))
      }
    }
  }, [apiClient, workspaceContent, refreshRateLimit, refreshUserStats, handleFeedbackReceived, onCompleted, provider, ydoc, formatLearnerError, waitForSettledJob, applyPolledJobState, buildDeliveryFailurePayload])

  const isProcessing = jobsActive

  useImperativeHandle(ref, () => ({ requestFeedback, clearMarkers: clearFeedbackMarkers }))

  return (
    <div className="w-full flex items-end justify-center p-4 pb-28 sm:p-8 sm:pb-40">
      <div
        className={`
          relative w-full max-w-[250mm] sm:max-w-[95vw] md:max-w-[75vw] lg:max-w-[70vw]
          mx-auto
          aspect-[210/297]
          ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        `}
        style={{
          borderRadius: '1.5rem',
          border: `1px solid ${isDragOver ? '#3B82F6' : '#707070'}`,
          background: 'radial-gradient(97.39% 78.5% at 6.52% 92.54%, #EFEFEF 0%, #F8F8F8 100%)',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="w-full h-full flex flex-col">
          {!isInitialContentLoaded ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading workspace...</p>
              </div>
            </div>
          ) : !showEditor ? (
            <div className="w-full h-full flex flex-col sm:flex-row items-start justify-center gap-4 sm:gap-0 p-4 sm:p-8 pt-5 sm:pt-24">
              <div className="flex flex-col items-center w-full max-w-sm">
                <Button variant="secondary" className="w-full h-40 sm:w-[236px] sm:h-[236px] flex-col gap-3 sm:gap-4" onClick={handleStartTyping}>
                  <Keyboard className="size-10 sm:size-12" />
                  <span className="text-base sm:text-lg font-medium">Start with typing</span>
                </Button>
              </div>
              <div className="hidden sm:flex items-center justify-center pt-24">
                <span className="text-2xl font-bold text-[#3C3C3C]">OR</span>
              </div>
              <div className="flex flex-col items-center w-full max-w-sm">
                <Button variant="secondary" className="w-full h-40 sm:w-[236px] sm:h-[236px] flex-col gap-3 sm:gap-4" onClick={handleUpload}>
                  <Upload className="size-10 sm:size-12" />
                  <span className="text-base sm:text-lg font-medium text-center">Upload your<br className='hidden sm:block' />Document or Image</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 lg:p-16">
              <Editor
                content={workspaceContent}
                highlights={editorHighlights}
                highlightsEnabled={commentsVisible}
                onEditorReady={handleEditorReady}
                onHighlightClick={handleHighlightClick}
                onContentChange={updateWorkspaceContent}
                onHighlightsInvalidated={handleHighlightsInvalidated}
                placeholder="Start writing your solution here..."
                ydoc={ydoc || undefined}
                awareness={awareness}
                currentUser={currentUser || undefined}
                readOnly={isProcessing}
              />
              {isProcessing && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl">
                  <div className="absolute inset-0 animate-pulse bg-gray-200/20" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <UploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onUploadComplete={handleUploadComplete} initialFile={draggedFile} />
    </div>
  )
})

Sheet.displayName = 'Sheet'

export default Sheet 
