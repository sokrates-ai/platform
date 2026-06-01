'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { useSession } from '@/shared/hooks/useSession'

const READY_STATE_LABELS: Record<number, string> = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED',
}

const KIND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  lifecycle: {
    bg: '#F5F5F5',
    text: '#4B4B4B',
    border: '#9A9A9A',
  },
  status: {
    bg: '#EEF5FF',
    text: '#2756A5',
    border: '#8CA6D8',
  },
  auth: {
    bg: '#EFF9F1',
    text: '#2E6E3E',
    border: '#92C6A0',
  },
  sync: {
    bg: '#FFF7E9',
    text: '#8E5B13',
    border: '#D7B178',
  },
  awareness: {
    bg: '#F6F0FF',
    text: '#6B46A9',
    border: '#B59BDE',
  },
  stateless: {
    bg: '#FFF0EA',
    text: '#9A431D',
    border: '#D39A82',
  },
  error: {
    bg: '#FFF0F0',
    text: '#A23131',
    border: '#D29595',
  },
}

const formatClock = (timestamp: number | null) => {
  if (!timestamp) return 'never'
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const formatReadyState = (value: number | null) => {
  if (value === null || typeof value !== 'number') return 'UNKNOWN'
  return READY_STATE_LABELS[value] ?? String(value)
}

const shouldForceDebug = (value: string | null) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'open'].includes(value.toLowerCase())
}

function Metric({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        border: '1px solid #B3B3B3',
        background: '#FBFBFB',
      }}
    >
      <div className="text-[11px] font-semibold tracking-[0.08em] text-[#7A7A7A]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[#202020]">{value}</div>
    </div>
  )
}

export default function WorkspaceWebsocketDebugPanel() {
  const searchParams = useSearchParams()
  const { websocketDebug, clearWebsocketDebugEvents } = useSession()

  const forced = React.useMemo(
    () => shouldForceDebug(searchParams?.get('wsDebug')),
    [searchParams]
  )
  const available = forced || process.env.NODE_ENV !== 'production'
  const [open, setOpen] = React.useState(forced)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (forced) {
      setOpen(true)
    }
  }, [forced])

  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!available) {
    return null
  }

  const copySnapshot = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            websocket: websocketDebug,
          },
          null,
          2
        )
      )
      setCopied(true)
    } catch {}
  }

  const statusTone =
    websocketDebug.status === 'connected'
      ? {
          bg: '#EFF9F1',
          text: '#2E6E3E',
          border: '#92C6A0',
          icon: <Wifi className="size-4" />,
        }
      : {
          bg: '#FFF0F0',
          text: '#8E3333',
          border: '#D39A9A',
          icon: <WifiOff className="size-4" />,
        }

  return (
    <div className="fixed bottom-[7.5rem] right-4 z-[80] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold"
        style={{
          border: '1px solid #626262',
          background:
            'linear-gradient(135deg,#f7f7f7 0%,#ececec 100%)',
          color: '#2A2A2A',
          boxShadow: '0 3px 0 #454545',
        }}
      >
        <Bug className="size-4" />
        <span>WS Debug</span>
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronUp className="size-4" />
        )}
      </button>

      {open && (
        <section
          className="w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl"
          style={{
            border: '1px solid #626262',
            background:
              'linear-gradient(135deg,#F7F7F7 0%,#ECECEC 100%)',
            boxShadow: '0 4px 0 #454545',
          }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{
              borderColor: '#B3B3B3',
            }}
          >
            <div className="min-w-0">
              <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#5C5C5C]">
                Workspace Websocket
              </div>
              <div className="mt-1 truncate text-xs text-[#6F6F6F]">
                {websocketDebug.documentName || 'No document'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
                style={{
                  background: statusTone.bg,
                  color: statusTone.text,
                  border: `1px solid ${statusTone.border}`,
                }}
              >
                {statusTone.icon}
                <span>{websocketDebug.status.toUpperCase()}</span>
              </div>

              <button
                type="button"
                onClick={copySnapshot}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                style={{
                  border: '1px solid #7E7E7E',
                  background: copied ? '#EFF9F1' : '#FFFFFF',
                  color: copied ? '#2E6E3E' : '#2A2A2A',
                }}
                title="Copy websocket snapshot"
              >
                {copied ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>

              <button
                type="button"
                onClick={clearWebsocketDebugEvents}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                style={{
                  border: '1px solid #7E7E7E',
                  background: '#FFFFFF',
                  color: '#2A2A2A',
                }}
                title="Clear websocket log"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Ready State" value={formatReadyState(websocketDebug.websocketReadyState)} />
              <Metric label="Authenticated" value={websocketDebug.authenticated ? 'YES' : 'NO'} />
              <Metric label="Synced" value={websocketDebug.synced ? 'YES' : 'NO'} />
              <Metric label="Unsynced" value={websocketDebug.unsyncedChanges} />
              <Metric label="Presence" value={websocketDebug.awarenessUsers} />
              <Metric
                label="Messages"
                value={`${websocketDebug.incomingMessages} in / ${websocketDebug.outgoingMessages} out`}
              />
              <Metric
                label="Stateless"
                value={`${websocketDebug.statelessIncoming} in / ${websocketDebug.statelessOutgoing} out`}
              />
              <Metric
                label="Last Server Msg"
                value={formatClock(websocketDebug.lastMessageReceivedAt)}
              />
            </div>

            <div className="space-y-2 text-xs text-[#484848]">
              <div>
                <div className="font-semibold uppercase tracking-[0.08em] text-[#7A7A7A]">
                  Server
                </div>
                <div className="mt-1 break-all rounded-md border border-[#B3B3B3] bg-[#FBFBFB] px-3 py-2 font-mono text-[11px]">
                  {websocketDebug.serverUrl || 'Unavailable'}
                </div>
              </div>

              <div>
                <div className="font-semibold uppercase tracking-[0.08em] text-[#7A7A7A]">
                  Last Incoming
                </div>
                <div className="mt-1 rounded-md border border-[#B3B3B3] bg-[#FBFBFB] px-3 py-2 font-mono text-[11px]">
                  {websocketDebug.lastIncomingMessage || 'None yet'}
                </div>
              </div>

              <div>
                <div className="font-semibold uppercase tracking-[0.08em] text-[#7A7A7A]">
                  Last Outgoing
                </div>
                <div className="mt-1 rounded-md border border-[#B3B3B3] bg-[#FBFBFB] px-3 py-2 font-mono text-[11px]">
                  {websocketDebug.lastOutgoingMessage || 'None yet'}
                </div>
              </div>

              {websocketDebug.lastError && (
                <div>
                  <div className="font-semibold uppercase tracking-[0.08em] text-[#A23131]">
                    Last Error
                  </div>
                  <div className="mt-1 rounded-md border border-[#D29595] bg-[#FFF0F0] px-3 py-2 font-mono text-[11px] text-[#8E3333]">
                    {websocketDebug.lastError}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#7A7A7A]">
                Event Log
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[#B3B3B3] bg-white/60 p-2">
                {websocketDebug.events.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-[#6E6E6E]">
                    No websocket events captured yet.
                  </div>
                ) : (
                  websocketDebug.events.map((event) => {
                    const tone = KIND_COLORS[event.kind] || KIND_COLORS.lifecycle
                    return (
                      <div
                        key={event.id}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: tone.border,
                          background: tone.bg,
                          color: tone.text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em]">
                            {event.label}
                          </div>
                          <div className="text-[11px] font-mono opacity-80">
                            {formatClock(event.at)}
                          </div>
                        </div>
                        {event.detail && (
                          <div className="mt-1 break-words font-mono text-[11px] leading-5">
                            {event.detail}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
