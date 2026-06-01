"use client"

import React from "react"
import { PresenceBar } from "@/features/collaboration/components/PresenceBar"
import type { PresenceLaneProps } from "@/features/collaboration/types/PresenceLane.types"

export function PresenceLane({ users, currentUser, className }: PresenceLaneProps) {
  return (
    <div className={`flex-1 min-w-0 relative overflow-hidden ${className ?? ''}`}>
      <div className="no-scrollbar flex justify-end w-full overflow-x-auto overflow-y-hidden">
        <PresenceBar users={users} currentUser={currentUser} variant="inline" className="w-full" />
      </div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#EBEBEB] to-transparent" />
    </div>
  )
} 