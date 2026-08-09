"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { useSession } from "@/shared/hooks/useSession"
import { PresenceBar } from "@/features/collaboration/components/PresenceBar"
import { useAwarenessPresence } from "@/features/collaboration/hooks/useAwarenessPresence"
import type { Awareness } from "y-protocols/awareness"
import { Progress } from "@/shared/ui/progress"
import { Button } from "@/shared/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Check } from "lucide-react"
import Markdown from "@/shared/ui/Markdown"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mathematics from "@tiptap/extension-mathematics"

interface QAQuestionBase { id: string; prompt: string }
interface QAQuestionMCQ extends QAQuestionBase { type?: "multiple_choice"; multiple?: boolean; options: { id: string; label: string }[]; correct?: string[] }
interface QAQuestionInput extends QAQuestionBase { type?: "constrained_input"; inputType?: "number" | "date"; correct?: string | number }
type QAQuestion = QAQuestionMCQ | QAQuestionInput
type QAStatus = "unanswered" | "correct" | "incorrect"

const flashcardPalette = ["#D83A52", "#E67E22", "#F1C40F", "#2ECC71", "#1ABC9C", "#3498DB", "#7E5BEF", "#E84393"]
const colorForId = (id: string) => flashcardPalette[Math.abs(Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0)) % flashcardPalette.length]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ADD below hexToRgba
const cardBases = ['#D6D0F2', '#F2D6D0', '#D0F2D6', '#D0E6F2', '#F2E6D0', '#E6D0F2', '#D0F2F0', '#F2D0EC']

const hexToRgb = (hex: string) => {
  const m = hex.replace('#', '')
  const f = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  return [0, 1, 2].map(i => parseInt(f.slice(i * 2, i * 2 + 2), 16)) as [number, number, number]
}
const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(v => Math.max(0, Math.min(255, v))).map(v => v.toString(16).padStart(2, '0')).join('')}`

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

interface ProgressOpts {
  head?: number;      // starting fill at 0/total (e.g., 0.10 = 10%)
  tail?: number;      // reserved slack before the final step (e.g., 0.08 = 8%)
  capShownAt99?: boolean; // keep the *label* at 99% until complete
}

function enhancedProgress(
  currentIdx: number,   // 0..total
  total: number,        // >= 0
  opts: ProgressOpts = {}
) {
  const {
    head = 0.10,
    tail = 0.08,
    capShownAt99 = true,
  } = opts;

  const safeTotal = Math.max(0, total);
  const raw = safeTotal > 0 ? clamp01(Math.min(currentIdx, safeTotal) / safeTotal) : 0;

  // Map raw 0..1 linearly into [head, 1-tail]
  let bar = head + (1 - head - tail) * raw;

  // Snap to 100% only when truly finished
  if (currentIdx >= safeTotal && safeTotal > 0) bar = 1;

  // What you *render* in the bar (width)
  const barPercent = bar * 100;

  // Optional: what you *show* as text (keeps 99% until done)
  const labelPercent = (capShownAt99 && bar < 1) ? Math.min(99, Math.floor(barPercent)) : Math.round(barPercent);

  return { barPercent, labelPercent };
}

const DELTA_DARK = [-12, -14, +1]   // -> #CAC2F3
const DELTA_STROKE = [-32, -39, +7]   // -> #B6A9F9
const DELTA_SHADOW = [-54, -59, -23]  // -> #A095DB

const applyDelta = (baseHex: string, [dr, dg, db]: number[]) => {
  const [r, g, b] = hexToRgb(baseHex)
  return rgbToHex(r + dr, g + dg, b + db)
}
const deriveCardColors = (baseHex: string) => ({
  base: baseHex,
  dark: applyDelta(baseHex, DELTA_DARK),
  stroke: applyDelta(baseHex, DELTA_STROKE),
  shadow: applyDelta(baseHex, DELTA_SHADOW),
})
const cardBaseForId = (id: string) =>
  cardBases[Math.abs(Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0)) % cardBases.length]

// Golden theme for the final completion card
const GOLD_THEME = {
  base: '#F2C94C',   // warm gold
  dark: '#E5B93A',   // deeper gold
  stroke: '#D4A514', // border accent
  shadow: '#C4950A', // drop shadow accent
}

export interface FlashCardWorkspaceProps { onCompleted?: () => void; onBack?: () => void }
export type FlashCardRef = { checkCurrent: () => Promise<void> }

const FlashCardWorkspace = forwardRef<FlashCardRef, FlashCardWorkspaceProps>(({ onCompleted, onBack }, ref) => {
  const { ydoc, workspaceInfo, apiClient, awareness, currentUser, refreshRateLimit, refreshUserStats } = useSession() as {
    ydoc?: any
    workspaceInfo?: any
    apiClient?: any
    awareness?: Awareness | null
    currentUser?: any
    refreshRateLimit: () => Promise<void>
    refreshUserStats: () => Promise<void>
  }

  const questions: QAQuestion[] = useMemo(() => {
    const q = (workspaceInfo?.workspaceSpec as Record<string, unknown> | undefined)?.questions
    if (Array.isArray(q)) return q as QAQuestion[]
    return []
  }, [workspaceInfo])

  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [currentIdx, setCurrentIdx] = useState<number>(0)
  const [status, setStatus] = useState<Record<string, QAStatus>>({})
  const [shakeWrong, setShakeWrong] = useState(false)
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrongTsRef = useRef<number>(0)

  // Presence
  const presentUsers = useAwarenessPresence(awareness as Awareness, currentUser || null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [cursors, setCursors] = useState<Array<{ id: string; name?: string; color: string; x: number; y: number; xBg?: number; yBg?: number }>>([])

  useEffect(() => {
    if (!awareness) return
    const update = () => {
      const arr: Array<{ id: string; name?: string; color: string; x: number; y: number; xBg?: number; yBg?: number }> = []
      let latestWrongTs = 0
        ; (awareness.getStates() as Map<number, any>).forEach((st: any) => {
          if (!st || !st.user) return
          if (currentUser && st.user?.id === currentUser.id) return
          const cursor = st.qaCursor || { x: 0, y: 0 }
          const cursorBg = st.qaCursorBg || { x: 0, y: 0 }
          arr.push({ id: String(st.user.id), name: st.user.name, color: st.user.color || colorForId(String(st.user.id)), x: cursor.x || 0, y: cursor.y || 0, xBg: cursorBg.x || 0, yBg: cursorBg.y || 0 })
          const wrong = st.qaWrongEvent
          if (wrong && typeof wrong.ts === 'number') {
            if (wrong.ts > latestWrongTs) {
              latestWrongTs = wrong.ts
            }
          }
        })
      setCursors(arr)
      if (latestWrongTs > 0 && latestWrongTs > lastWrongTsRef.current) {
        lastWrongTsRef.current = latestWrongTs
        setShakeWrong(true)
        if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
        wrongTimerRef.current = setTimeout(() => setShakeWrong(false), 700)
      }
    }
    awareness.on("change", update)
    update()
    return () => { awareness.off("change", update) }
  }, [awareness, currentUser])

  const publishBgCursor = useCallback((e: React.MouseEvent) => {
    if (!awareness || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)))
    const st = awareness.getLocalState() || {}
    awareness.setLocalState({ ...st, qaCursorBg: { x, y, ts: Date.now() } })
  }, [awareness])

  // Sync from Yjs
  useEffect(() => {
    if (!ydoc) return
    const answersMap = ydoc.getMap("qa") as any
    const metaMap = ydoc.getMap("qa.meta") as any
    const statusMap = ydoc.getMap("qa.status") as any

    if (metaMap.get("currentIndex") == null) metaMap.set("currentIndex", 0)

    const applyFromDoc = () => {
      const result: Record<string, unknown> = {}
      questions.forEach(q => {
        const val = answersMap.get(q.id)
        result[q.id] = val as unknown
      })
      setAnswers(result)

      const idx = (metaMap.get("currentIndex") as number | undefined) ?? 0
      // Allow an extra final index equal to questions.length to represent the completion screen
      setCurrentIdx(Math.max(0, Math.min(idx, Math.max(0, questions.length))))

      const st: Record<string, QAStatus> = {}
      statusMap.forEach((v: unknown, k: unknown) => {
        const s = String(v) as QAStatus
        if (s === "correct" || s === "incorrect" || s === "unanswered") st[String(k)] = s
      })
      questions.forEach(q => { if (!st[q.id]) st[q.id] = "unanswered" })
      setStatus(st)
    }

    const observer = () => applyFromDoc()
    applyFromDoc()
    answersMap.observe(observer)
    metaMap.observe(observer)
    statusMap.observe(observer)
    return () => {
      answersMap.unobserve(observer)
      metaMap.unobserve(observer)
      statusMap.unobserve(observer)
    }
  }, [ydoc, questions])

  const setDocAnswer = (id: string, value: unknown) => {
    if (!ydoc) return
    const answersMap = ydoc.getMap("qa") as any
    answersMap.set(id, value)
  }

  const setDocIndex = (idx: number) => {
    if (!ydoc) return
    const metaMap = ydoc.getMap("qa.meta") as any
    metaMap.set("currentIndex", idx)
  }

  const setDocStatus = (id: string, s: QAStatus) => {
    if (!ydoc) return
    const statusMap = ydoc.getMap("qa.status") as any
    statusMap.set(id, s)
  }

  const onToggle = async (qid: string, oid: string, multiple?: boolean) => {
    const current = answers[qid]
    let next: string[]
    if (multiple) {
      const set = new Set<string>(Array.isArray(current) ? (current as string[]) : [])
      if (set.has(oid)) set.delete(oid)
      else set.add(oid)
      next = Array.from(set)
    } else {
      const arr = Array.isArray(current) ? (current as string[]) : []
      next = arr.includes(oid) ? [] : [oid]
    }
    setDocAnswer(qid, next)
    setDocStatus(qid, "unanswered")
  }

  const inferType = (q: QAQuestion): "multiple_choice" | "constrained_input" => {
    if ((q as QAQuestionMCQ).options) return "multiple_choice"
    return "constrained_input"
  }

  const autoSubmit = async (qid: string) => {
    if (!apiClient) return
    try {
      // Read the freshest value directly from Yjs when available
      const yAnswers = ydoc ? (ydoc.getMap("qa") as any) : null
      const value = yAnswers ? yAnswers.get(qid) : answers[qid]
      const res = await apiClient.validateStep(qid, value)
      setDocStatus(qid, res.correct ? "correct" : "incorrect")
      if (res.correct) {
        const nextIdx = Math.min(currentIdx + 1, questions.length)
        setDocIndex(nextIdx)
        if (nextIdx >= questions.length) {
          onCompleted?.()
        }
      } else {
        // Brief shake + red tint on wrong attempt
        setShakeWrong(true)
        if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
        wrongTimerRef.current = setTimeout(() => setShakeWrong(false), 700)
        // Broadcast to collaborators via awareness (timestamp only)
        try {
          const st = awareness?.getLocalState() || {}
          awareness?.setLocalState({ ...st, qaWrongEvent: { ts: Date.now() } })
        } catch { }
        // Update bottom menu via session rate limit
        try { await refreshRateLimit() } catch { }
        try { await refreshUserStats() } catch { }
      }
      // Successful validation updates rate limit if backend returns it
      try { await refreshRateLimit() } catch { }
      try { await refreshUserStats() } catch { }
    } catch (e: any) {
      // Surface rate limit info from backend
      if (e && e.status === 429) {
         try { await refreshRateLimit() } catch { }
         try { await refreshUserStats() } catch { }
      }
      console.error(e)
    } finally {
      // no-op
    }
  }

  // No auto-submit; validation only when pressing CHECK

  useImperativeHandle(ref, () => ({
    checkCurrent: async () => {
      if (questions.length === 0) return
      // Do nothing on the final completion card
      if (currentIdx >= questions.length) return
      const q = questions[Math.max(0, Math.min(currentIdx, questions.length - 1))]
      if (q) await autoSubmit(q.id)
    },
  }))


  const isDone = currentIdx >= questions.length
  const current = questions[currentIdx]
  const currentType = current ? (current.type ?? inferType(current)) : undefined

  const cardBase = current ? cardBaseForId(current.id) : cardBases[0]
  const cardCols = deriveCardColors(cardBase)
  const useCols = isDone ? GOLD_THEME : cardCols

  const { barPercent } = enhancedProgress(currentIdx, questions.length, {
    head: 0.12,
    tail: 0.10,
  })
  // Ensure 100% when all questions are completed
  const displayProgress = isDone ? 100 : barPercent


  const canGoPrev = currentIdx > 0
  // Show next when there is any next step (including the final completion card)
  const hasNextStep = currentIdx < questions.length
  const allowAdvance = !!current && status[current.id] === "correct"

  const goPrev = () => setDocIndex(Math.max(0, currentIdx - 1))
  const goNext = () => {
    if (!hasNextStep || !allowAdvance) return
    // Permit moving to the final completion card at index == questions.length
    setDocIndex(Math.min(questions.length, currentIdx + 1))
  }

  // Tiptap editor for constrained input
  const tiptap = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: "Type your answer… Use $...$ for math" }),
      Mathematics,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      if (!current || currentType !== "constrained_input") return
      const text = editor.getText()
      setDocAnswer(current.id, text)
      setDocStatus(current.id, "unanswered")
    },
    editorProps: {
      attributes: {
        class: "editor-content ProseMirror",
        "aria-label": "Answer editor",
      },
    },
  })

  // Keep editor in sync with Yjs/answers when question changes
  useEffect(() => {
    if (!tiptap || !current || currentType !== "constrained_input") return
    const val = answers[current.id]
    const str = typeof val === "string" || typeof val === "number" ? String(val) : ""
    // Avoid resetting while typing if content matches
    if (tiptap.getText() !== str) {
      tiptap.commands.setContent(str)
    }
  }, [tiptap, current, currentType, answers])

  useEffect(() => {
    const t1 = wrongTimerRef.current
    const t2 = rateTimerRef.current
    return () => {
      if (t1) clearTimeout(t1)
      if (t2) clearTimeout(t2)
    }
  }, [])

  return (
    <div className="w-full flex justify-center overflow-y-auto mt-4 px-0 sm:mt-6 sm:px-4">
      <div
        ref={containerRef}
        onMouseMove={publishBgCursor}
        className="relative w-full max-w-none sm:max-w-6xl mx-auto sm:rounded-3xl sm:border-2 bg-[#F9F9F9] border-y-2 border-[#909090] sm:border-[#909090] px-3 sm:px-6 md:px-8 py-4 md:py-10 overflow-hidden max-h-svh sm:max-h-[80svh] pb-16 sm:pb-10"
      >
        {/* Wrong answer shake handled per item */}
        {/* Background floating cursors overlay */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {cursors.map(c => (
            <div key={`bg-${c.id}`} className="absolute" style={{ left: `${(c.xBg ?? 0) * 100}%`, top: `${(c.yBg ?? 0) * 100}%`, transform: "translate(-20%, -80%)" }}>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 0 2px #ffffff` }} />
                <div className="px-2 py-0.5 text-[11px] rounded-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D0D0" }}>{c.name || "User"}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#F9F9F9] to-transparent hidden sm:block" />
          <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#F9F9F9] to-transparent hidden sm:block" />
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#F9F9F9] to-transparent hidden sm:block" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#F9F9F9] to-transparent" />
        </div>

        <div className="mx-auto flex flex-col h-full gap-y-6">
          {/* Presence + progress */}
          <div className="flex w-full justify-center">
            <div className="flex-col w-8/10 justify-start">
              <div className="flex items-center justify-center mb-2">
                <div className="text-sm text-[#6a6a6a]">Flashcards</div>
                <div className="min-w-0 flex-1 ml-4">
                  <PresenceBar users={presentUsers} currentUser={currentUser || null} variant="inline" className="w-full" />
                </div>
              </div>
              <Progress value={displayProgress} className="h-2" indicatorColor={isDone ? GOLD_THEME.base : cardCols.base} />
            </div>

          </div>

          <div className="w-full flex flex-col items-center">

            <div className="relative w-full flex items-center justify-center">
              {/* Left (desktop) */}
              {canGoPrev && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goPrev}
                  aria-label="Previous"
                  className="hidden md:flex absolute left-0 -translate-x-2 rounded-xl border-2 border-[#A6A6A6] bg-white text-[#A6A6A6] z-40"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}

              {/* Flashcard */}
              <div
                className="w-full max-w-[32.1875rem] h-[28rem] sm:h-[32rem] md:h-[39rem] flex-shrink-0 rounded-2xl border-2 p-2 md:p-3"
                style={{
                  background: `linear-gradient(192deg, ${useCols.base} 8.63%, ${useCols.dark} 104.34%)`,
                  borderColor: useCols.stroke,
                  filter: `drop-shadow(0 4px 0 ${useCols.shadow})`,
                }}
              >
                <div
                  className="h-full rounded-[1.375rem] border-2 bg-white p-4 sm:p-6 md:p-8 flex flex-col justify-between overflow-visible antialiased"
                  style={{ borderColor: useCols.stroke }}
                >
                  {questions.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <div className="text-center max-w-md mx-auto">
                        <div className="text-gray-600">No questions configured.</div>
                      </div>
                    </div>
                  ) : isDone ? (
                    <div className="flex flex-1 items-center justify-center">
                      <div className="text-center max-w-md mx-auto">
                        <div className="text-2xl md:text-3xl font-semibold text-[#5A4400] mb-4">Well done!</div>
                        <div className="text-[#6B5A20] mb-6">
                          You answered all flashcards. You can review by going back, or return to where you came from.
                        </div>
                        {onBack && (
                          <Button variant="default" className="h-10 px-3 sm:px-8 font-bold text-sm sm:text-base"
                            style={{
                              background: 'linear-gradient(180deg, #F7D778 0%, #E6B93A 100%)',
                              color: '#white',
                              border: '2px solid #D4A514',
                              boxShadow: '0 2px 0 #C4950A',
                            }}
                            onClick={onBack}
                          >
                            Go Back
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Question */}
                      <div className="overflow-y-auto pr-1" style={{ maxHeight: '50%' }}>
                        <div className="text-xl md:text-[26px] tracking-tight font-medium text-[#404040]">
                          <div className="prose prose-neutral max-w-none prose-headings:inherit prose-p:inherit prose-strong:inherit prose-em:inherit prose-ul:inherit prose-ol:inherit prose-headings:my-0 prose-p:my-0">
                            <Markdown>
                              {current?.prompt || ""}
                            </Markdown>
                          </div>
                        </div>
                      </div>

                      {/* Answers / Input */}
                      {currentType === "multiple_choice" ? (
                        <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '45%' }}>
                          {(current as QAQuestionMCQ).options.map((o, idx) => {
                            const sel =
                              Array.isArray(answers[current!.id]) &&
                              (answers[current!.id] as string[]).includes(o.id)
                            const st = status[current!.id]
                            const isCorrectState = st === "correct"
                            const borderColor = sel ? cardCols.stroke : "#D0D0D0"
                            const effectiveBorder = shakeWrong ? "#E03131" : borderColor
                            const effectiveBg = shakeWrong ? "rgba(224, 49, 49, 0.08)" : (sel ? hexToRgba(cardCols.base, 0.12) : "#F4F4F4")

                            return (
                              <Button
                                key={o.id}
                                type="button"
                                variant="ghost"
                                className={`group relative justify-start gap-3 text-left md:text-base text-sm min-h-12 font-normal leading-tight select-none rounded-xl px-3 py-3 hover:bg-[#EDEDED] ${shakeWrong ? 'qa-shake' : ''}`}
                                onClick={() =>
                                  onToggle(current!.id, o.id, (current as QAQuestionMCQ).multiple)
                                }
                                aria-pressed={sel}
                                style={{
                                  borderWidth: 2,
                                  borderColor: effectiveBorder,
                                  backgroundColor: effectiveBg,
                                }}
                              >
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-md border"
                                  style={{
                                    borderColor: shakeWrong ? "#E03131" : (sel ? cardCols.stroke : "#D0D0D0"),
                                    backgroundColor: shakeWrong ? "rgba(224, 49, 49, 0.08)" : (!isCorrectState && sel ? hexToRgba(cardCols.base, 0.12) : undefined),
                                  }}
                                >
                                  {isCorrectState ? (
                                    sel ? <Check className="w-3.5 h-3.5" /> : null
                                  ) : (
                                    <span className="text-[11px] font-semibold text-[#525252]">
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                  )}
                                </span>
                                <span className="flex-1">
                                  <div className="prose prose-neutral max-w-none prose-p:my-0 prose-headings:my-0">
                                    <Markdown>
                                      {o.label}
                                    </Markdown>
                                  </div>
                                </span>
                              </Button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <div
                            className={`w-full rounded-md border text-sm ${shakeWrong ? 'qa-shake' : ''}`}
                            style={{
                              borderColor:
                                shakeWrong
                                  ? "#E03131"
                                  : status[current!.id] === "correct"
                                    ? "#2ECC71"
                                    : cardCols.stroke,
                              backgroundColor: shakeWrong ? "rgba(224, 49, 49, 0.08)" : "#F9F9F9",
                            }}
                          >
                            <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: '5.1em' }}>
                              <EditorContent editor={tiptap} className="editor-content" />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {/* Right (desktop) */}
              {hasNextStep && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goNext}
                  disabled={!allowAdvance}
                  aria-label="Next"
                  className="hidden md:flex absolute right-0 translate-x-2 rounded-xl border-2 border-[#A6A6A6] bg-white text-[#A6A6A6] z-40"
                  title={!allowAdvance ? "Answer correctly to proceed" : undefined}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}
            </div>


            {/* Mobile arrows (below, centered) */}
            <div className="mt-4 flex w-full items-center justify-center gap-4 md:hidden">
              {canGoPrev && (
                <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous"
                  className="rounded-xl border-2 border-[#A6A6A6] bg-white text-[#A6A6A6]">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              {hasNextStep && (
                <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next"
                  disabled={!allowAdvance}
                  className="rounded-xl border-2 border-[#A6A6A6] bg-white text-[#A6A6A6]"
                  title={!allowAdvance ? "Answer correctly to proceed" : undefined}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default FlashCardWorkspace 
