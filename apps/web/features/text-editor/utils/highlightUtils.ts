/**
 * Utility functions for highlight popover functionality
 */

/**
 * Check if text content overflows in a container with given constraints
 */
export function checkTextOverflow(
    text: string,
    containerWidth: number,
    maxHeight: number,
    options?: { fontSizePx?: number; lineHeightPx?: number }
): boolean {
    const fontSizePx = options?.fontSizePx ?? 16
    const lineHeightPx = options?.lineHeightPx ?? 24
    const tempDiv = document.createElement('div')
    Object.assign(tempDiv.style, {
        position: 'absolute',
        visibility: 'hidden',
        width: `${containerWidth}px`,
        fontSize: `${fontSizePx}px`,
        lineHeight: `${lineHeightPx}px`,
        maxHeight: `${maxHeight}px`,
        overflow: 'hidden',
    })
    
    tempDiv.textContent = text
    document.body.appendChild(tempDiv)
    
    const isOverflowing = tempDiv.scrollHeight > tempDiv.clientHeight
    document.body.removeChild(tempDiv)
    
    return isOverflowing
}

/**
 * Configuration constants for popover behavior
 */
export const POPOVER_CONFIG = {
    HOVER_DELAY: 500, // ms
    HOVER_GRACE_PERIOD: 300, // ms
    POPOVER_HIDE_DELAY: 100, // ms
    COLLAPSED_WIDTH: 280, // px
    EXPANDED_WIDTH: 400, // px
    MAX_HEIGHT: 90, // px
} as const 