import * as React from "react"
import type { Awareness } from "y-protocols/awareness"

export interface PresenceUser {
  id: string
  name: string
  color: string
}

/**
 * Hook to derive present users from a Yjs Awareness instance.
 * It merges the current user (if provided) with remote peers from awareness.
 */
export function useAwarenessPresence(awareness: Awareness | null, currentUser: PresenceUser | null): PresenceUser[] {
  const [users, setUsers] = React.useState<PresenceUser[]>(() => (currentUser ? [currentUser] : []))

  React.useEffect(() => {
    if (!awareness) {
      setUsers(currentUser ? [currentUser] : [])
      return
    }

    const toUser = (clientId: number, state: unknown): PresenceUser | null => {
      const s = state as { user?: Partial<PresenceUser> } | undefined
      const base = s?.user ?? (state as Partial<PresenceUser> | undefined)
      if (!base) return null
      return {
        id: String(base.id ?? clientId),
        name: String(base.name ?? "Anonymous"),
        color: String(base.color ?? "#3498DB"),
      }
    }

    const recompute = () => {
      const map = awareness.getStates() as Map<number, unknown>
      const remotes: PresenceUser[] = []
      map.forEach((state, clientId) => {
        const u = toUser(clientId, state)
        if (!u) return
        // Filter out local presence duplicate by clientId and id
        if (clientId === (awareness as any).clientID) return
        if (currentUser && u.id === currentUser.id) return
        remotes.push(u)
      })
      const merged: PresenceUser[] = []
      if (currentUser) merged.push(currentUser)
      const seenIds = new Set(merged.map((u) => u.id))
      const seenKey = new Set(merged.map((u) => `${u.name}:${u.color}`))
      for (const u of remotes) {
        const key = `${u.name}:${u.color}`
        if (seenIds.has(u.id) || (currentUser && key === `${currentUser.name}:${currentUser.color}`)) continue
        seenIds.add(u.id)
        seenKey.add(key)
        merged.push(u)
      }
      setUsers(merged)
    }

    recompute()
    const onChange = () => recompute()
    awareness.on("change", onChange)
    awareness.on("update", onChange)
    awareness.on("destroy", onChange)
    return () => {
      awareness.off("change", onChange)
      awareness.off("update", onChange)
      awareness.off("destroy", onChange)
    }
  }, [awareness, currentUser])

  return users
}

export default useAwarenessPresence 
