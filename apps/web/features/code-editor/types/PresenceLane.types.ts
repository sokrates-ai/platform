import type { PresenceUser } from "@/features/collaboration/hooks/useAwarenessPresence"

export interface PresenceLaneProps {
  users: PresenceUser[]
  currentUser: PresenceUser | null | undefined
  className?: string
} 