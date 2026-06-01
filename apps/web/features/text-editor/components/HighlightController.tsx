import { Editor } from '@tiptap/core'
import type { HighlightSpec } from '@/features/text-editor/types/highlightTypes'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface HighlightDecorationSpec {
    highlightId: string
    highlightSpec: HighlightSpec
}

export interface HighlightDebugEvent {
    timestamp: number
    message: string
    data?: Record<string, unknown>
}

export class HighlightController {
    private editor: Editor
    private pluginKey = new PluginKey<DecorationSet>('localHighlightsDecorations')
    private pluginRegistered = false
    private debugCallback?: (event: HighlightDebugEvent) => void
    private invalidationCallback?: (ids: string[]) => void

    constructor(editor: Editor) {
        this.editor = editor
        this.ensurePlugin()
    }

    private ensurePlugin() {
        const view = this.editor?.view as any
        if (!view) return
        if (this.pluginRegistered) return
        const hasPlugin = view.state.plugins.some((p: any) => p?.key === this.pluginKey)
        if (hasPlugin) { this.pluginRegistered = true; return }
        const plugin = new Plugin<DecorationSet>({
            key: this.pluginKey,
            state: {
                init: () => DecorationSet.empty,
                apply: (tr, old) => {
                    const next = tr.getMeta(this.pluginKey) as DecorationSet | undefined
                    if (next) return next

                    if (!tr.docChanged || old === DecorationSet.empty) {
                        return old.map(tr.mapping, tr.doc)
                    }

                    const decorations = old.find()
                    if (!decorations.length) {
                        this.debug('Clearing empty decoration set after doc change')
                        return DecorationSet.empty
                    }

                    const kept: Decoration[] = []
                    const removedIds: string[] = []
                    for (const deco of decorations) {
                        const touch = this.wasDecorationTouched(tr, deco.from, deco.to)
                        if (touch.touched) {
                            const highlightId = this.getDecorationId(deco)
                            if (highlightId) removedIds.push(highlightId)
                            this.debug('Removing highlight touched by edit', {
                                start: deco.from,
                                end: deco.to,
                                reason: touch.reason,
                                stepIndex: touch.stepIndex,
                                highlightId,
                            })
                            continue
                        }
                        const mapped = (deco as any).map(tr.mapping, 0, 0)
                        if (mapped && mapped.type.valid(tr.doc, mapped)) kept.push(mapped)
                    }

                    if (removedIds.length) {
                        const unique = Array.from(new Set(removedIds))
                        this.invalidationCallback?.(unique)
                        this.debug('Reported highlight invalidation', { ids: unique })
                    }

                    if (!kept.length) {
                        this.debug('All highlights removed after change', { previousCount: decorations.length })
                    }

                    return kept.length ? DecorationSet.create(tr.doc, kept) : DecorationSet.empty
                },
            },
            props: {
                decorations: (state) => this.pluginKey.getState(state) || null,
            },
        })
        this.editor.registerPlugin(plugin)
        this.pluginRegistered = true
    }

    private findMathExpressions(text: string): Array<{ start: number; end: number; expression: string }> {
        const mathExpressions: Array<{ start: number; end: number; expression: string }> = []
        const inlineMathRegex = /\$([^$]+)\$/g
        let match
        while ((match = inlineMathRegex.exec(text)) !== null) {
            mathExpressions.push({ start: match.index, end: match.index + match[0].length, expression: match[0] })
        }
        return mathExpressions
    }

    private expandRangeForMath(text: string, from: number, to: number): { from: number; to: number } {
        const mathExpressions = this.findMathExpressions(text)
        let expandedFrom = from
        let expandedTo = to
        for (const math of mathExpressions) {
            if (from > math.start && from < math.end) expandedFrom = Math.min(expandedFrom, math.start)
            if (to > math.start && to < math.end) expandedTo = Math.max(expandedTo, math.end)
            if ((from >= math.start && from < math.end) || (to > math.start && to <= math.end)) {
                expandedFrom = Math.min(expandedFrom, math.start)
                expandedTo = Math.max(expandedTo, math.end)
            }
        }
        return { from: expandedFrom, to: expandedTo }
    }

    private convertHighlightToPositions(doc: ProseMirrorNode, spec: HighlightSpec): { from: number; to: number } | null {
        const paragraphs = this.findParagraphs(doc)
        const lineIndex = spec.line - 1
        if (lineIndex < 0 || lineIndex >= paragraphs.length) return null
        const paragraph = paragraphs[lineIndex]
        const textContent = paragraph.node.textContent || ''
        const from = Math.min(spec.from, textContent.length)
        const to = Math.min(spec.to, textContent.length)
        if (from >= to) return null
        const expandedRange = this.expandRangeForMath(textContent, from, to)
        const absoluteFrom = paragraph.pos + 1 + expandedRange.from
        const absoluteTo = paragraph.pos + 1 + expandedRange.to
        return { from: absoluteFrom, to: absoluteTo }
    }

    private findParagraphs(doc: ProseMirrorNode): Array<{ node: ProseMirrorNode; pos: number }> {
        const paragraphs: Array<{ node: ProseMirrorNode; pos: number }> = []
        doc.descendants((node, pos) => { if (node.type.name === 'paragraph') paragraphs.push({ node, pos }) })
        return paragraphs
    }

    setDebugCallback(callback?: (event: HighlightDebugEvent) => void) {
        this.debugCallback = callback
    }

    setInvalidationCallback(callback?: (ids: string[]) => void) {
        this.invalidationCallback = callback
    }

    private debug(message: string, data?: Record<string, unknown>) {
        if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.debug('[HighlightDebug]', message, data || '')
        }
        this.debugCallback?.({ timestamp: Date.now(), message, data })
    }

    private wasDecorationTouched(tr: any, from: number, to: number): { touched: boolean; reason?: string; stepIndex?: number } {
        if (!tr?.docChanged || typeof from !== 'number' || typeof to !== 'number') return { touched: false }
        if (from >= to) return { touched: false }

        let start = from
        let end = to

        for (let i = 0; i < tr.steps.length; i++) {
            const step = tr.steps[i]
            const map = tr.mapping.maps[i]
            if (!step || !map) continue

            const stepMap = step.getMap?.()
            if (!stepMap) continue

            let touched = false
            let reason: string | undefined
            stepMap.forEach((oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
                const deletes = oldEnd > oldStart
                const inserts = newEnd > newStart
                const overlapsDeletion = deletes && this.rangesOverlap(start, end, oldStart, oldEnd)
                const insertionPointInside = inserts && oldStart >= start && oldStart < end

                if (overlapsDeletion || insertionPointInside) {
                    touched = true
                    reason = overlapsDeletion ? 'deletion-overlap' : 'insertion-inside'
                }
            })
            if (touched) return { touched: true, reason, stepIndex: i }

            start = map.map(start, -1)
            end = map.map(end, 1)
        }

        return { touched: false }
    }

    private rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
        return aStart < bEnd && aEnd > bStart
    }

    applyHighlights(highlights: HighlightSpec[]): void {
        try {
            this.ensurePlugin()
            const { state } = this.editor
            const decos: Decoration[] = []
            const sorted = [...highlights].sort((a, b) => a.line !== b.line ? a.line - b.line : a.from - b.from)
            const doc = state.doc
            sorted.forEach((spec) => {
                const pos = this.convertHighlightToPositions(doc, spec)
                if (!pos) return
                if (pos.from < 0 || pos.to > doc.content.size || pos.from >= pos.to) return
                const highlightId = this.ensureHighlightId(spec)
                const attrs: Record<string, string> = {
                    class: `hl-${spec.type}`,
                    'data-hl': spec.type,
                    'data-hl-message': spec.message || '',
                    'data-hl-id': highlightId,
                }
                const decoSpec: HighlightDecorationSpec = { highlightId, highlightSpec: spec }
                decos.push(Decoration.inline(pos.from, pos.to, attrs, decoSpec))
            })
            const set = DecorationSet.create(doc, decos)
            const tr = state.tr.setMeta(this.pluginKey, set)
            this.editor.view.dispatch(tr)
        } catch {}
    }

    clearHighlights(): void {
        try {
            this.ensurePlugin()
            const { state } = this.editor
            const empty = DecorationSet.create(state.doc, [])
            const tr = state.tr.setMeta(this.pluginKey, empty)
            this.editor.view.dispatch(tr)
        } catch {}
    }

    private getDecorationId(deco: Decoration): string | undefined {
        const spec = deco.spec as HighlightDecorationSpec | undefined
        return spec?.highlightId || spec?.highlightSpec?.id
    }

    private ensureHighlightId(spec: HighlightSpec): string {
        if (spec.id && spec.id.trim().length > 0) return spec.id
        const fallback = `${spec.line}:${spec.from}-${spec.to}:${spec.type}`
        spec.id = fallback
        return fallback
    }
} 
