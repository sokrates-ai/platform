'use client'

import React from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mathematics from '@tiptap/extension-mathematics'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { Extensions } from '@tiptap/core'
import { HighlightMark } from '@/features/text-editor/components/HighlightMark'
import { HighlightController } from '@/features/text-editor/components/HighlightController'
import { HighlightPopover } from '@/features/text-editor/components/HighlightPopover'
import { useHighlightPopover } from '@/features/text-editor/hooks/useHighlightPopover'
import type { HighlightSpec, HighlightEvent, HighlightKind } from '@/features/text-editor/types/highlightTypes'
import type { HighlightDebugEvent } from '@/features/text-editor/components/HighlightController'
import '@/features/text-editor/styles/editor.css'
import { PresenceBar } from '@/features/collaboration/components/PresenceBar'
import { useAwarenessPresence } from '@/features/collaboration/hooks/useAwarenessPresence'
import type { PresenceUser } from '@/features/collaboration/hooks/useAwarenessPresence'

const ENABLE_HIGHLIGHT_DEBUG = false // Flip to false to remove debug overlay and logs

interface EditorProps {
    /** Initial content for the editor (HTML string) */
    content?: string
    /** Array of highlight specifications to apply to the content */
    highlights?: HighlightSpec[]
    /** Whether highlights should be rendered (client-only visibility toggle) */
    highlightsEnabled?: boolean
    /** Callback when editor is ready, provides function to insert content */
    onEditorReady?: (insertContent: (content: string) => void) => void
    /** Callback when a highlight is clicked */
    onHighlightClick?: (event: HighlightEvent) => void
    /** Callback when content changes */
    onContentChange?: (content: string) => void
    /** Callback when highlights are invalidated by user edits */
    onHighlightsInvalidated?: (invalidIds: string[]) => void
    /** Placeholder text for empty editor */
    placeholder?: string
    /** Y.Doc for collaboration. If provided, Collaboration will be enabled. */
    ydoc?: Y.Doc
    /** Awareness instance from provider for presence */
    awareness?: Awareness | null
    /** Current user for local cursor/label */
    currentUser?: PresenceUser | null
    /** When true, editor is read-only (no edits) */
    readOnly?: boolean
}

/**
 * Main Editor component with TipTap, Math rendering, and highlighting functionality
 */
export const Editor: React.FC<EditorProps> = ({
    content = '',
    highlights = [],
    highlightsEnabled = true,
    onEditorReady,
    onHighlightClick,
    onContentChange,
    onHighlightsInvalidated,
    placeholder = 'Start writing your solution… Use $ for inline math: $x^2 + y^2 = z^2$',
    ydoc,
    awareness,
    currentUser,
    readOnly,
}) => {
    const { popoverState, isExpanded, showEllipsis, handlers } = useHighlightPopover()
    const highlightControllerRef = React.useRef<HighlightController | null>(null)
    const isApplyingHighlightsRef = React.useRef<boolean>(false)
    const initialContentAppliedRef = React.useRef<boolean>(false)
    const [debugEvents, setDebugEvents] = React.useState<HighlightDebugEvent[]>([])
    const [debugHighlights, setDebugHighlights] = React.useState<HighlightSpec[]>([])

    const presentUsers = useAwarenessPresence(awareness || null, currentUser || null)
    const showPresence = React.useMemo(() => new Set(presentUsers.map(u => u.id)).size >= 2, [presentUsers])

    /**
     * Calculate the center position of a highlight element for popover positioning
     */
    const getHighlightCenterPosition = React.useCallback((element: HTMLElement): { x: number; y: number } => {
        const rect = element.getBoundingClientRect()
        return {
            // Anchor at the right edge for a right-side popover
            x: rect.right,
            // Vertically centered relative to the highlight
            y: rect.top + rect.height / 2,
        }
    }, [])

    /**
     * Create a highlight event from a DOM element
     */
    const createHighlightEvent = React.useCallback((element: HTMLElement): HighlightEvent => {
        const type = element.getAttribute('data-hl') as HighlightKind
        const message = element.getAttribute('data-hl-message') || ''
        const position = getHighlightCenterPosition(element)

        return { highlightType: type, message, position }
    }, [getHighlightCenterPosition])

    /**
     * Handle click events for highlights
     */
    const handleEditorClick = React.useCallback((event: MouseEvent) => {
        const target = event.target as HTMLElement
        const highlightEl = target.closest('[data-hl]') as HTMLElement

        if (highlightEl) {
            const highlightEvent = createHighlightEvent(highlightEl)
            onHighlightClick?.(highlightEvent)
        }
    }, [createHighlightEvent, onHighlightClick])

    /**
     * Handle mouse over events for highlights
     */
    const handleEditorMouseOver = React.useCallback((event: MouseEvent) => {
        const target = event.target as HTMLElement
        const highlightEl = target.closest('[data-hl]') as HTMLElement

        if (highlightEl) {
            const highlightEvent = createHighlightEvent(highlightEl)
            handlers.onHighlightHover(highlightEvent)
        }
    }, [handlers, createHighlightEvent])

    /**
     * Handle mouse out events for highlights
     */
    const handleEditorMouseOut = React.useCallback((event: MouseEvent) => {
        const target = event.target as HTMLElement
        const highlightEl = target.closest('[data-hl]')

        if (highlightEl) {
            handlers.onHighlightLeave()
        }
    }, [handlers])

    // Build extensions dynamically depending on collaboration
    const extensions = React.useMemo(() => {
        const base = [
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
            HighlightMark.configure({}),
        ]
        if (ydoc) {
            const withCollab: Extensions = [
                StarterKit.configure({ history: false }),
                ...base,
                Collaboration.configure({ document: ydoc }),
            ]
            if (awareness && currentUser) {
                const providerForCursors: { awareness: Awareness } = { awareness }
                withCollab.push(
                    CollaborationCursor.configure({
                        provider: providerForCursors,
                        user: {
                            name: currentUser.name,
                            color: currentUser.color,
                        },
                    })
                )
            }
            return withCollab
        }
        return [StarterKit, ...base]
    }, [placeholder, ydoc, awareness, currentUser])

    // Initialize TipTap editor
    const editor = useEditor({
        extensions,
        // With collaboration, don’t set initial content here to avoid clobbering CRDT state
        ...(ydoc ? {} : { content }),
        onUpdate: ({ editor }) => {
            // Skip content updates when highlights are being applied programmatically
            if (isApplyingHighlightsRef.current) return
            const html = editor.getHTML()
            onContentChange?.(html)
        },
        editorProps: {
            attributes: {
                class: 'prose prose-gray max-w-none focus:outline-none',
            },
            handleClick(view, pos, event) {
                // If clicking at the end of a line whose last inline is math, keep the caret at end
                try {
                    const target = event.target as HTMLElement
                    const withinMath = !!target.closest('.katex')
                    const $pos = view.state.doc.resolve(pos)
                    const atEndOfParent = $pos.parentOffset >= $pos.parent.content.size
                    const nodeBefore = $pos.nodeBefore as any
                    const nodeBeforeIsMath = !!(nodeBefore && typeof nodeBefore.type?.name === 'string' && nodeBefore.type.name.toLowerCase().includes('math'))
                    if (atEndOfParent && (withinMath || nodeBeforeIsMath)) {
                        const endPos = $pos.end()
                        const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, endPos))
                        view.dispatch(tr)
                        return true
                    }
                } catch {}
                return false
            },
        },
    })

    // Apply initial content once when collaboration is active and no content is set yet
    React.useEffect(() => {
        if (!editor || !ydoc) return
        if (!content || initialContentAppliedRef.current) return
        const timer = window.setTimeout(() => {
            try {
                const config = ydoc.getMap<unknown>('config') as Y.Map<unknown>
                // We store a flag to avoid re-setting on reconnect
                const loaded = (config.get('initialContentLoaded') as boolean | undefined) === true
                const currentHtml = editor.getHTML().trim()
                const hasExistingContent =
                    currentHtml !== '' &&
                    currentHtml !== '<p></p>'

                if (loaded || hasExistingContent) {
                    config.set('initialContentLoaded', true)
                    initialContentAppliedRef.current = true
                    return
                }

                editor.commands.setContent(content)
                config.set('initialContentLoaded', true)
                initialContentAppliedRef.current = true
            } catch {
                // no-op
            }
        }, 350)
        return () => { window.clearTimeout(timer) }
    }, [editor, ydoc, content])

    // Ensure the parent receives content at least once (e.g., after reload with existing collab content)
    const emittedInitialRef = React.useRef<boolean>(false)
    React.useEffect(() => {
        if (!editor || emittedInitialRef.current) return
        try {
            const html = editor.getHTML()
            if (html && html.trim() && html !== '<p></p>') {
                onContentChange?.(html)
                emittedInitialRef.current = true
            }
        } catch {}
        const t = setTimeout(() => {
            if (emittedInitialRef.current || !editor) return
            try {
                const html = editor.getHTML()
                if (html && html.trim() && html !== '<p></p>') {
                    onContentChange?.(html)
                    emittedInitialRef.current = true
                }
            } catch {}
        }, 300)
        return () => { clearTimeout(t) }
    }, [editor, onContentChange])

    // Toggle editability when readOnly changes
    React.useEffect(() => {
        if (!editor) return
        try { editor.setEditable(!(readOnly === true)) } catch {}
    }, [editor, readOnly])

    // Initialize highlight controller when editor is ready
    React.useEffect(() => {
        if (editor) {
            const controller = new HighlightController(editor)
            highlightControllerRef.current = controller

            controller.setInvalidationCallback((ids) => {
                if (ids.length) onHighlightsInvalidated?.(ids)
            })

            if (ENABLE_HIGHLIGHT_DEBUG) {
                controller.setDebugCallback((event) => {
                    setDebugEvents(prev => {
                        const next = [event, ...prev]
                        return next.slice(0, 20)
                    })
                })
            }
        }
        return () => {
            highlightControllerRef.current?.setDebugCallback(undefined)
            highlightControllerRef.current?.setInvalidationCallback(undefined)
            highlightControllerRef.current = null
        }
    }, [editor, onHighlightsInvalidated])

    // Apply or clear highlights when inputs change
    React.useEffect(() => {
        if (!editor || !highlightControllerRef.current) return
        const controller = highlightControllerRef.current
        if (!highlightsEnabled) {
            controller.clearHighlights()
            return
        }
        // Apply immediately when enabled
        isApplyingHighlightsRef.current = true
        try {
            controller.applyHighlights(highlights)
            if (ENABLE_HIGHLIGHT_DEBUG) {
                setDebugHighlights(highlights)
            }
        } finally {
            setTimeout(() => { isApplyingHighlightsRef.current = false }, 50)
        }
        // Also clear on unmount to avoid stale decorations
        return () => { try { controller.clearHighlights() } catch {} }
    }, [editor, highlightsEnabled, highlights])

    // Set up DOM event listeners for highlight interactions (including touch on mobile)
    React.useEffect(() => {
        if (!editor) return

        const editorElement = editor.view.dom

        editorElement.addEventListener('click', handleEditorClick)
        editorElement.addEventListener('mouseover', handleEditorMouseOver)
        editorElement.addEventListener('mouseout', handleEditorMouseOut)
        // Touch support for mobile: treat tap as click on highlights
        const handleTouchEnd = (e: TouchEvent) => {
            const touch = e.changedTouches && e.changedTouches[0]
            if (!touch) return
            const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
            if (!target) return
            const highlightEl = target.closest('[data-hl]') as HTMLElement | null
            if (highlightEl) {
                // Stop immediate closing caused by outside-click listener
                e.stopPropagation()
                const highlightEvent = createHighlightEvent(highlightEl)
                handlers.onHighlightClick(highlightEvent)
                e.preventDefault()
            }
        }
        editorElement.addEventListener('touchend', handleTouchEnd, { passive: false })

        return () => {
            editorElement.removeEventListener('click', handleEditorClick)
            editorElement.removeEventListener('mouseover', handleEditorMouseOver)
            editorElement.removeEventListener('mouseout', handleEditorMouseOut)
            editorElement.removeEventListener('touchend', handleTouchEnd as any)
        }
    }, [editor, handleEditorClick, handleEditorMouseOver, handleEditorMouseOut, createHighlightEvent, handlers])

    // Expose content insertion functionality when editor is ready
    React.useEffect(() => {
        if (editor && onEditorReady) {
            const insertContent = (content: string) => {
                if (editor) {
                    const doc = editor.state.doc
                    const endPosition = doc.content.size
                    editor.chain().focus().insertContentAt(endPosition, content).run()
                    setTimeout(() => {
                        const newDoc = editor.state.doc
                        const newEndPosition = newDoc.content.size
                        editor.chain().focus().setTextSelection(newEndPosition).run()
                    }, 100)
                }
            }
            onEditorReady(insertContent)
        }
    }, [editor, onEditorReady])

    return (
        <div className="relative w-full h-full pt-8">
            {ENABLE_HIGHLIGHT_DEBUG && (
                <div className="sticky top-0 z-50 mb-4 rounded-md border border-amber-500 bg-amber-100/90 p-3 text-xs text-amber-900 shadow">
                    <div className="font-semibold">Highlight Debug Panel</div>
                    <div className="mt-1 flex flex-wrap gap-4">
                        <div>Incoming specs: {highlights.length}</div>
                        <div>Applied specs: {debugHighlights.length}</div>
                        <div>Latest event: {debugEvents[0]?.message ?? 'none'}</div>
                    </div>
                    <div className="mt-2 max-h-32 overflow-y-auto rounded bg-white/70 p-2 text-[11px] font-mono text-amber-950">
                        {debugEvents.length === 0 ? (
                            <div>No events yet.</div>
                        ) : (
                            debugEvents.map((event, idx) => (
                                <div key={`${event.timestamp}-${idx}`} className="mb-1">
                                    <span className="font-semibold">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                    : {event.message}
                                    {event.data ? ` ${JSON.stringify(event.data)}` : ''}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {showPresence && (
                <PresenceBar users={presentUsers} currentUser={currentUser || undefined} variant="overlay" />
            )}
            <EditorContent
                editor={editor}
                className={`w-full h-full editor-content ${highlightsEnabled ? '' : 'hl-hidden'}`}
                style={{ ...({ ['--cursor-color']: currentUser?.color || '#3498DB' } as React.CSSProperties & { ['--cursor-color']: string }), paddingTop: showPresence ? 44 : 0 }}
            />

            <HighlightPopover
                popoverState={popoverState}
                isExpanded={isExpanded}
                showEllipsis={showEllipsis}
                onMouseEnter={handlers.onPopoverMouseEnter}
                onMouseLeave={handlers.onPopoverMouseLeave}
                onToggleExpansion={handlers.onToggleExpansion}
                onClose={handlers.onPopoverClose}
            />
        </div>
    )
}

export default Editor
