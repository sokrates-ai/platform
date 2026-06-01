'use client'

import Image from 'next/image'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import CodeEditor, { type CodeEditorRef } from '@/features/code-editor'
import BottomMenu from '@/features/menu/BottomMenu'
import TopMenu from '@/features/menu/TopMenu'
import type { SheetRef } from '@/features/text-editor/components/Sheet'
import FlashCardWorkspace, {
  type FlashCardRef,
} from '@/features/workspace/components/FlashCardWorkspace'
import WorkspaceBlockingErrorOverlay from '@/features/workspace/components/WorkspaceBlockingErrorOverlay'
import Task from '@/features/workspace/components/Task'
import TextWorkspace from '@/features/workspace/components/TextWorkspace'
import WorkspaceWebsocketDebugPanel from '@/features/workspace/components/WorkspaceWebsocketDebugPanel'
import { useSession } from '@/shared/hooks/useSession'
import { celebrateOnce } from '@/shared/utils/confetti'

export default function WorkspacePage() {
  const router = useRouter()
  const {
    userStats,
    exercise,
    workspaceInfo,
    jobsRunning,
    latestJobText,
    latestTextResult,
    latestTextFeedback,
    commentsVisible,
    setCommentsVisible,
    taskJustChanged,
    apiClient,
    refreshUserStats,
  } = useSession()

  const [triggerUpload, setTriggerUpload] = useState(false)
  const [completing, setCompleting] = useState(false)

  const sheetRef = useRef<SheetRef | null>(null)
  const flashRef = useRef<FlashCardRef | null>(null)
  const codeRef = useRef<CodeEditorRef | null>(null)
  const hasCelebratedRef = useRef(false)

  const stats = userStats ?? { xp: 0, coins: 0, level: 0 }
  const showClearButton = (latestTextFeedback?.comments?.length ?? 0) > 0

  const handleUploadButtonClick = () => {
    setTriggerUpload(true)
  }

  const handleCompleted = () => {
    if (hasCelebratedRef.current) {
      return
    }
    hasCelebratedRef.current = true
    celebrateOnce()
  }

  const handleCompleteClick = async () => {
    if (!apiClient || completing) {
      return
    }
    setCompleting(true)
    try {
      await apiClient.completeWorkspace()
      await refreshUserStats()
      handleCompleted()
    } catch (error) {
      console.error('Failed to mark workspace complete', error)
      alert('Failed to mark complete. Please try again.')
    } finally {
      setCompleting(false)
    }
  }

  const handleCheck = async () => {
    if (!workspaceInfo) {
      return
    }
    if (workspaceInfo.workspaceType === 'text') {
      await sheetRef.current?.requestFeedback()
      return
    }
    if (workspaceInfo.workspaceType === 'flashcard') {
      await flashRef.current?.checkCurrent()
      return
    }
    if (workspaceInfo.workspaceType === 'code') {
      await codeRef.current?.runCurrent()
    }
  }

  const handleClearMarkers = () => {
    sheetRef.current?.clearMarkers()
  }

  if (!exercise || !workspaceInfo) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
            <p className="text-gray-600">Loading workspace...</p>
          </div>
        </div>
        <WorkspaceBlockingErrorOverlay />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopMenu stats={stats} />

      <main
        className="flex-1 pb-28 sm:pb-32"
        style={{ paddingTop: 'var(--workspace-topmenu-height, 8rem)' }}
      >
        {workspaceInfo.workspaceType !== 'flashcard' && (
          <div className="mx-auto mt-6 w-full max-w-[250mm] px-4 sm:mt-8 sm:max-w-[95vw] sm:px-6 md:max-w-[75vw] md:px-8 lg:max-w-[70vw]">
            <Task title={exercise.title} instruction={exercise.task} />
          </div>
        )}

        {workspaceInfo.workspaceType === 'text' ? (
          <TextWorkspace
            onActionStarted={() => {}}
            triggerUpload={triggerUpload}
            setTriggerUpload={setTriggerUpload}
            sheetRef={sheetRef}
            onCompleted={handleCompleted}
          />
        ) : workspaceInfo.workspaceType === 'flashcard' ? (
          <FlashCardWorkspace
            ref={flashRef}
            onCompleted={handleCompleted}
            onBack={() => router.back()}
          />
        ) : (
          <CodeEditor ref={codeRef} />
        )}
      </main>

      <BottomMenu
        canUpload={workspaceInfo.workspaceType === 'text'}
        onBack={() => router.back()}
        onUpload={handleUploadButtonClick}
        showCheck={true}
        onCheck={handleCheck}
        checking={jobsRunning}
        onComplete={handleCompleteClick}
        completing={completing}
      />

      <WorkspaceWebsocketDebugPanel />
      <WorkspaceBlockingErrorOverlay />

      {jobsRunning && (
        <div
          className="fixed inset-x-0 z-[60] flex justify-center"
          style={{ bottom: '6.5rem' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2 shadow-sm"
            style={{
              borderRadius: '0.5rem',
              border: '1px solid #626262',
              background: '#F4F4F4',
              color: '#747474',
            }}
          >
            <div
              className="w-5 h-5 rounded-full animate-spin"
              style={{
                border: '2px solid #747474',
                borderTopColor: 'transparent',
              }}
            />
            <span className="text-sm sm:text-base animate-pulse whitespace-pre-line">
              {latestJobText || 'Processing…'}
            </span>
          </div>
        </div>
      )}

      {taskJustChanged && (
        <div
          className="fixed inset-x-0 z-[60] flex justify-center"
          style={{ bottom: '9.5rem' }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 shadow-sm text-xs sm:text-sm"
            style={{
              borderRadius: '0.5rem',
              border: '1px solid #9D8DE5',
              background: '#F3F0FF',
              color: '#6956BC',
            }}
          >
            <span>Task updated</span>
          </div>
        </div>
      )}

      {!jobsRunning &&
        workspaceInfo.workspaceType === 'text' &&
        latestTextResult && (
          <div
            className="fixed inset-x-0 z-[60] flex justify-center"
            style={{ bottom: '6.5rem' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2 shadow-sm"
              style={{
                borderRadius: '0.5rem',
                border: '1px solid #626262',
                background: '#FFFFFF',
                color: '#747474',
              }}
            >
              <Image
                src={
                  latestTextResult.status === 'success'
                    ? '/checkmark.svg'
                    : '/crossmark.svg'
                }
                alt="result"
                width={20}
                height={20}
              />
              <span className="text-sm sm:text-base whitespace-pre-line">
                {latestTextResult.text}
              </span>
              {showClearButton && (
                <button
                  className="ml-2 rounded p-1"
                  style={{ color: '#747474' }}
                  onClick={handleClearMarkers}
                  title="Delete all highlights"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                className="ml-2 rounded p-1"
                style={{ color: '#747474' }}
                onClick={() => setCommentsVisible(!commentsVisible)}
                title={commentsVisible ? 'Hide comments' : 'Show comments'}
              >
                {commentsVisible ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
    </div>
  )
}
