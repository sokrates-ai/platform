'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mathematics from '@tiptap/extension-mathematics'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

type RichInputProps = {
  placeholder: string
  initialContent: string
  onChange: (html: string) => void
}

const RichInput = ({ placeholder, initialContent, onChange }: RichInputProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
        shouldRender: (state, pos, node) =>
          node.type.name === 'text' &&
          state.doc.resolve(pos).parent.type.name !== 'codeBlock',
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm prose-gray max-w-none focus:outline-none min-h-[160px]',
        'aria-label': 'Sandbox editor',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  return (
    <EditorContent
      editor={editor}
      className="h-full w-full overflow-auto px-3 py-2"
    />
  )
}

type SandboxState = {
  problem: string
  solution: string
  rubric: string
}

const EMPTY_STATE: SandboxState = { problem: '', solution: '', rubric: '' }

type FeedbackComment = {
  id: string
  title: string
  content: string
  type: 'mistake' | 'suggestion' | 'praise'
  citation?: { text: string; location: { start: number; end: number } }
}

type Feedback = {
  summary: string
  is_valid: boolean
  comments: FeedbackComment[]
}

const buildStorageKey = (
  userId: number | null,
  courseUuid: string,
): string | null => {
  if (!courseUuid) return null
  const userPart = userId == null ? 'anon' : String(userId)
  return `sokrates:sandbox:${userPart}:${courseUuid}`
}

const readSandboxState = (key: string | null): SandboxState => {
  if (!key || typeof window === 'undefined') return EMPTY_STATE
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    return {
      problem: typeof parsed?.problem === 'string' ? parsed.problem : '',
      solution: typeof parsed?.solution === 'string' ? parsed.solution : '',
      rubric: typeof parsed?.rubric === 'string' ? parsed.rubric : '',
    }
  } catch {
    return EMPTY_STATE
  }
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

type Props = {
  courseUuid: string
  userId: number | null
  accessToken: string | null
  onClose?: () => void
}

const CourseSandbox = ({ courseUuid, userId, accessToken, onClose: _onClose }: Props) => {
  const { toast } = useToast()

  const storageKey = useMemo(
    () => buildStorageKey(userId, courseUuid),
    [userId, courseUuid],
  )

  const initialRef = useRef<SandboxState | null>(null)
  if (initialRef.current === null) {
    initialRef.current = readSandboxState(storageKey)
  }

  const [problem, setProblem] = useState(initialRef.current.problem)
  const [solution, setSolution] = useState(initialRef.current.solution)
  const [rubric, setRubric] = useState(initialRef.current.rubric)
  const [checking, setChecking] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    const payload: SandboxState = { problem, solution, rubric }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // Quota or serialization errors are non-fatal here.
    }
  }, [storageKey, problem, solution, rubric])

  const isEmpty = (html: string) => stripHtml(html).length === 0

  const handleCheck = async () => {
    if (checking) return
    if (isEmpty(problem) || isEmpty(solution)) {
      toast({
        title: 'Add a problem and solution',
        description:
          'The AI needs both the problem statement and your solution to evaluate.',
        variant: 'destructive',
        duration: 4000,
      })
      return
    }
    if (!accessToken) {
      toast({
        title: 'Sign in required',
        description: 'You need to be signed in to use the AI sandbox.',
        variant: 'destructive',
        duration: 4000,
      })
      return
    }

    setChecking(true)
    setFeedback(null)
    try {
      const response = await fetch(
        `${getAPIUrl()}sandbox/check`,
        RequestBodyWithAuthHeader(
          'POST',
          {
            problem: stripHtml(problem),
            solution: stripHtml(solution),
            rubric: rubric.trim(),
          },
          null,
          accessToken,
        ),
      )
      const text = await response.text()
      const data = text ? JSON.parse(text) : null
      if (!response.ok) {
        const detail =
          (data && typeof data.detail === 'string' && data.detail) ||
          `Sandbox check failed (${response.status})`
        throw new Error(detail)
      }
      setFeedback({
        summary: String(data?.summary ?? ''),
        is_valid: Boolean(data?.is_valid),
        comments: Array.isArray(data?.comments) ? data.comments : [],
      })
    } catch (error) {
      toast({
        title: 'Sandbox check failed',
        description:
          error instanceof Error ? error.message : 'Unexpected error.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#FF6934]" />
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              AI Sandbox
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Paste any problem and your solution. The AI will evaluate it against
            the rubric you supply.
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Problem statement
          </div>
          <RichInput
            placeholder="Paste or type the problem you want the AI to check…"
            initialContent={initialRef.current.problem}
            onChange={setProblem}
          />
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your solution
          </div>
          <RichInput
            placeholder="Write your solution. Use $…$ for inline math."
            initialContent={initialRef.current.solution}
            onChange={setSolution}
          />
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
        <label
          htmlFor="sandbox-rubric"
          className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          Grading criteria (optional)
        </label>
        <textarea
          id="sandbox-rubric"
          value={rubric}
          onChange={(e) => setRubric(e.target.value)}
          placeholder="e.g. The proof must use induction; final answer must be simplified."
          className="min-h-[64px] w-full resize-y rounded-b-lg bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      {feedback ? (
        <div
          className={
            'flex flex-col gap-2 rounded-lg border p-3 ' +
            (feedback.is_valid
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50')
          }
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {feedback.is_valid ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-amber-600" />
            )}
            <span
              className={
                feedback.is_valid ? 'text-emerald-800' : 'text-amber-800'
              }
            >
              {feedback.summary ||
                (feedback.is_valid
                  ? 'Looks correct.'
                  : 'Some issues were found.')}
            </span>
          </div>
          {feedback.comments.length > 0 ? (
            <ul className="space-y-1 text-sm text-gray-700">
              {feedback.comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span className="font-semibold">{c.title}:</span>
                  <span>{c.content}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="bg-[#FF6934] text-white hover:bg-[#E55A28]"
        >
          {checking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {checking ? 'Checking…' : 'Check with AI'}
        </Button>
      </div>
    </div>
  )
}

export default CourseSandbox
