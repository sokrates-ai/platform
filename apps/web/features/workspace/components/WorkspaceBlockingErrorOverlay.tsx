'use client'

import React from 'react'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useSession } from '@/shared/hooks/useSession'
import { Button } from '@/shared/ui/button'

export default function WorkspaceBlockingErrorOverlay() {
  const router = useRouter()
  const { workspaceBlockingError } = useSession()

  if (!workspaceBlockingError) {
    return null
  }

  const showDetail =
    Boolean(workspaceBlockingError.detail) &&
    workspaceBlockingError.code !== 'collab_permission_denied'

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center px-4 py-6"
      style={{
        background: 'rgba(244, 241, 234, 0.94)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-full max-w-[34rem] overflow-hidden rounded-[1.5rem]"
        style={{
          border: '1px solid #626262',
          background: 'linear-gradient(135deg,#F7F7F7 0%,#ECECEC 100%)',
          boxShadow: '0 6px 0 #454545',
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: '#B5B5B5' }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              border: '1px solid #D29595',
              background: '#FFF0F0',
              color: '#9B2F2F',
            }}
          >
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A4A1A]">
              Workspace Error
            </div>
            <h2 className="mt-1 text-xl font-bold text-[#222222]">
              {workspaceBlockingError.title}
            </h2>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-6 text-[#3B3B3B] sm:text-base">
            {workspaceBlockingError.message}
          </p>

          {showDetail && (
            <div
              className="rounded-xl px-4 py-3 font-mono text-xs leading-5"
              style={{
                border: '1px solid #D0C2A7',
                background: '#FFF8EA',
                color: '#6B5325',
              }}
            >
              {workspaceBlockingError.detail}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button
              variant="default"
              className="min-h-11 flex-1 justify-center"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw className="size-4" />
              Reload Workspace
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 flex-1 justify-center"
              onClick={() => router.back()}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
