/**
 * Types and constants for text highlighting functionality
 */

export type HighlightKind = 'advice' | 'issue' | 'praise'

export interface HighlightSpec {
    /** Unique identifier for the highlight */
    id: string
    /** 1-based line number */
    line: number
    /** 0-based character offset from start of line */
    from: number
    /** 0-based character offset from start of line (exclusive) */
    to: number
    /** Type of highlight */
    type: HighlightKind
    /** Optional message to display in popover */
    message?: string
}

export interface HighlightEvent {
    highlightType: HighlightKind
    message: string
    position: { x: number; y: number }
}

export interface PopoverState {
    isVisible: boolean
    position: { x: number; y: number } | null
    highlightType: HighlightKind
    message: string
}

/**
 * Background colors for highlight decorations with consistent opacity
 * These colors match the popover badge colors for consistency
 */
export const HIGHLIGHT_COLOURS: Record<HighlightKind, string> = {
    advice: 'rgba(147, 128, 238, 0.3)',    // Purple (#9380EE at 30% opacity)
    issue: 'rgba(238, 128, 130, 0.3)',     // Red (#EE8082 at 30% opacity)
    praise: 'rgba(246, 187, 69, 0.3)',     // Yellow (#F6BB45 at 30% opacity)
} as const

/**
 * Hover colors for highlight decorations with slightly higher opacity
 */
export const HIGHLIGHT_HOVER_COLOURS: Record<HighlightKind, string> = {
    advice: 'rgba(147, 128, 238, 0.5)',    // Purple (#9380EE at 50% opacity)
    issue: 'rgba(238, 128, 130, 0.5)',     // Red (#EE8082 at 50% opacity)
    praise: 'rgba(246, 187, 69, 0.5)',     // Yellow (#F6BB45 at 50% opacity)
} as const

/**
 * Popover badge colors
 */
export const POPOVER_COLORS = {
    // Advice palette per spec: background #C6BCF3, border #9D8DE5, text #6956BC
    advice: { fill: '#C6BCF3', stroke: '#9D8DE5', text: '#6956BC' },
    // Issue palette tuned to match the same pattern (soft bg, medium border, darker text)
    issue: { fill: '#F3BCBD', stroke: '#E6888A', text: '#BD5A5C' },
    // Praise palette tuned similarly (soft bg, medium border, darker text)
    praise: { fill: '#F6D89E', stroke: '#EAC071', text: '#B48A39' },
} as const

/**
 * Default popover messages
 */
export const POPOVER_MESSAGES = {
    advice: 'There seems to be a little issue with your result...',
    issue: 'There seems to be an issue with your result...',
    praise: 'Great work on this part!',
} as const
