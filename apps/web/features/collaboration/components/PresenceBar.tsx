import * as React from "react"
import type { PresenceUser } from "@/features/collaboration/hooks/useAwarenessPresence"

interface PresenceBarProps {
  users: PresenceUser[]
  currentUser?: PresenceUser | null
  variant?: "overlay" | "inline"
  className?: string
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ users, currentUser, variant = "inline", className }) => {
  const others = React.useMemo(() => users.filter((u) => !currentUser || u.id !== currentUser.id), [users, currentUser])

  const uniqueCount = React.useMemo(() => new Set([...(currentUser ? [currentUser.id] : []), ...users.map(u => u.id)]).size, [users, currentUser])
  if (uniqueCount < 2) return null

  const Chips = (
    <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap flex-nowrap">
      {currentUser && (
        <div
          className="flex items-center gap-2 px-2 py-1 rounded border shrink-0"
          style={{ backgroundColor: `${currentUser.color}10`, borderColor: `${currentUser.color}55` }}
        >
          <span className="text-xs text-gray-500 mr-1">You</span>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentUser.color }} />
          <span className="text-sm" style={{ color: "#3C3C3C" }}>{currentUser.name}</span>
        </div>
      )}
      {others.map((u, idx) => (
        <div
          key={`${u.id || "user"}-${idx}`}
          className="flex items-center gap-2 px-2 py-1 rounded border shrink-0"
          style={{ backgroundColor: `${u.color}10`, borderColor: `${u.color}55` }}
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
          <span className="text-sm" style={{ color: "#3C3C3C" }}>{u.name}</span>
        </div>
      ))}
    </div>
  )

  if (variant === "overlay") {
    return (
      <div className={`absolute top-0 left-0 right-0 z-10 h-11 ${className ?? ""}`}>
        <div className="flex items-center gap-2 py-2 px-2 border-b border-gray-200">
          {Chips}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">{Chips}</div>
    </div>
  )
}

export default PresenceBar 