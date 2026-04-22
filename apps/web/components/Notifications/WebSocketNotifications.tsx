'use client'

import React from 'react'
import { useSession } from 'next-auth/react'

import { useToast } from '@/hooks/use-toast'
import { getWebSocketUrl } from '@services/config/config'

type NotificationPayload = {
  id?: string
  topic?: string
  title?: string
  body?: string
  level?: 'info' | 'success' | 'warning' | 'error'
  data?: Record<string, unknown>
  timestamp?: string
}

type NotificationMessage = {
  type: 'notification'
  notification: NotificationPayload
}

type SystemMessage = {
  type: 'system'
  event?: string
  data?: Record<string, unknown>
  timestamp?: string
}

type PingMessage = {
  type: 'ping' | 'pong'
  timestamp?: string
}

type WebSocketMessage = NotificationMessage | SystemMessage | PingMessage

const MAX_RETRY_DELAY_MS = 30000

export default function WebSocketNotifications() {
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const topics = React.useMemo(() => {
    const base = ['broadcast']
    const userId = session?.user?.id
    if (typeof userId === 'number') {
      base.push(`user/${userId}`)
    }
    return base
  }, [session?.user?.id])

  const wsRef = React.useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = React.useRef(0)
  const mountedRef = React.useRef(false)
  const connectRef = React.useRef<() => void>(() => {})

  const cleanup = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const handleMessage = React.useCallback(
    (event: MessageEvent) => {
      let parsed: WebSocketMessage | null = null
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }

      if (!parsed || typeof parsed !== 'object') {
        return
      }

      if (parsed.type === 'notification') {
        const notification = parsed.notification || {}
        const data = notification.data || {}
        if (data.kind === 'reward_update') {
          if (typeof window !== 'undefined') {
            const detail: Record<string, number> = {}
            if (typeof data.coins === 'number') {
              detail.coins = data.coins
            }
            if (typeof data.level === 'number') {
              detail.level = data.level
            }
            if (typeof data.level_progress === 'number') {
              detail.level_progress = data.level_progress
            }
            window.dispatchEvent(
              new CustomEvent('reward_update', {
                detail,
              })
            )
          }
          const deltaCoins =
            typeof data.delta_coins === 'number' ? data.delta_coins : 0
          if (
            deltaCoins > 0 &&
            typeof navigator !== 'undefined' &&
            'vibrate' in navigator
          ) {
            navigator.vibrate(50)
          }
          return
        }
        const variant = notification.level === 'error' ? 'destructive' : 'default'
        toast({
          title: notification.title || 'Notification',
          description: notification.body || '',
          variant,
          duration: 5000,
        })
        return
      }

      if (parsed.type === 'ping') {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            })
          )
        }
      }
    },
    [toast]
  )

  const scheduleReconnect = React.useCallback(() => {
    if (!mountedRef.current || status !== 'authenticated') {
      return
    }

    const baseDelay = Math.min(1000 * 2 ** retryCountRef.current, MAX_RETRY_DELAY_MS)
    const jitter = Math.floor(Math.random() * 300)
    retryCountRef.current += 1

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current()
    }, baseDelay + jitter)
  }, [status])

  const connect = React.useCallback(() => {
    if (status !== 'authenticated') {
      return
    }

    cleanup()

    const baseUrl = getWebSocketUrl()
    if (!baseUrl) {
      return
    }

    const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const url = new URL(`${normalized}notifications/ws`)
    if (topics.length > 0) {
      url.searchParams.set('topics', topics.join(','))
    }

    const accessToken = session?.tokens?.access_token
    if (accessToken) {
      url.searchParams.set('token', accessToken)
    }

    const socket = new WebSocket(url.toString())
    wsRef.current = socket

    socket.onopen = () => {
      retryCountRef.current = 0
      if (topics.length > 0) {
        socket.send(
          JSON.stringify({
            type: 'set_subscriptions',
            topics,
          })
        )
      }
    }

    socket.onmessage = handleMessage

    socket.onerror = () => {
      socket.close()
    }

    socket.onclose = () => {
      scheduleReconnect()
    }
  }, [cleanup, handleMessage, scheduleReconnect, session?.tokens?.access_token, status, topics])

  React.useEffect(() => {
    connectRef.current = connect
  }, [connect])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  React.useEffect(() => {
    if (status !== 'authenticated') {
      cleanup()
      return
    }

    connect()
    return cleanup
  }, [cleanup, connect, status, session?.tokens?.access_token])

  return null
}
