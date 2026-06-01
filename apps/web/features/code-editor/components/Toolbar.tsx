"use client"

import React from "react"
import { Button } from "@/shared/ui/button"
import { Loader2, PanelRightClose, PanelRightOpen, Play, RotateCw, Square } from "lucide-react"
import type { PresenceUser } from "@/features/collaboration/hooks/useAwarenessPresence"
import { PresenceLane } from "./PresenceLane"

export function Toolbar({
  pyodideLoading,
  pyodideReady,
  isRunning,
  onReset,
  onRun,
  onStop,
  onToggleConsole,
  showConsole,
  presentUsers,
  currentUser,
}: {
  pyodideLoading: boolean
  pyodideReady: boolean
  isRunning: boolean
  onReset: () => void
  onRun: () => void
  onStop: () => void
  onToggleConsole: () => void
  showConsole: boolean
  presentUsers: PresenceUser[]
  currentUser?: PresenceUser | null
}) {
  return (
    <div className="flex items-center px-3 py-1.5 border-b border-[#707070]/60 bg-[#EBEBEB] gap-2">
      <div className="shrink-0 flex items-center gap-2 px-2 py-1">
        <span className="text-sm font-medium text-[#454545]">main.py</span>
      </div>
      <PresenceLane users={presentUsers} currentUser={currentUser ?? null} />
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="hidden md:inline-flex items-center text-xs text-[#6a6a6a] mr-1.5">
          {pyodideLoading ? (
            <>
              <Loader2 size={14} className="mr-1 animate-spin" />
              <span>Python loading…</span>
            </>
          ) : pyodideReady ? (
            <span className="text-[#2ECC71]">Python ready</span>
          ) : (
            <span>Python idle</span>
          )}
        </span>
        <Button variant="ghost" size="icon" onClick={onReset} className="inline-flex items-center rounded px-2 py-1 hover:bg-[#E8E8E8] active:translate-y-px" aria-label="Reset" title="Reset">
          <RotateCw size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRun} disabled={isRunning || pyodideLoading} className="inline-flex items-center rounded px-2 py-1 hover:bg-[#E8E8E8] disabled:opacity-50 active:translate-y-px" aria-label="Run" title="Run">
          <Play size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onStop} disabled={!isRunning} className="inline-flex items-center rounded px-2 py-1 hover:bg-[#E8E8E8] disabled:opacity-50 active:translate-y-px" aria-label="Stop" title="Stop">
          <Square size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleConsole} className="inline-flex items-center rounded px-2 py-1 hover:bg-[#E8E8E8] active:translate-y-px" aria-label="Toggle Console" title="Toggle Console">
          {showConsole ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </Button>
      </div>
    </div>
  )
} 