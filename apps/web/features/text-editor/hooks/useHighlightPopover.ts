"use client"

import { useState, useEffect, useRef } from 'react'
import type { HighlightEvent, PopoverState } from '@/features/text-editor/types/highlightTypes'
import { POPOVER_MESSAGES } from '@/features/text-editor/types/highlightTypes'
import { checkTextOverflow, POPOVER_CONFIG } from '@/features/text-editor/utils/highlightUtils'

/**
 * Hook for managing highlight popover state and interactions
 */
export function useHighlightPopover() {
    const [popoverState, setPopoverState] = useState<PopoverState>({
        isVisible: false,
        position: null,
        highlightType: 'advice',
        message: '',
    })
    const [isPinned, setIsPinned] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [showEllipsis, setShowEllipsis] = useState(false)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const clearHoverTimeout = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
        }
    }

    const handleHighlightHover = (event: HighlightEvent) => {
        if (isPinned) return
        clearHoverTimeout()
        hoverTimeoutRef.current = setTimeout(() => {
            setPopoverState({
                isVisible: true,
                position: event.position,
                highlightType: event.highlightType,
                message: event.message,
            })
        }, POPOVER_CONFIG.HOVER_DELAY)
    }

    const handleHighlightClick = (event: HighlightEvent) => {
        if (popoverState.isVisible && isPinned) {
            return
        }
        clearHoverTimeout()
        setPopoverState({
            isVisible: true,
            position: event.position,
            highlightType: event.highlightType,
            message: event.message,
        })
        setIsPinned(true)
    }

    const handleHighlightLeave = () => {
        clearHoverTimeout()
        if (!isPinned) {
            hoverTimeoutRef.current = setTimeout(() => {
                setPopoverState(prev => ({ ...prev, isVisible: false }))
            }, POPOVER_CONFIG.HOVER_GRACE_PERIOD)
        }
    }

    const handlePopoverMouseEnter = () => {
        clearHoverTimeout()
    }

    const handlePopoverMouseLeave = () => {
        if (!isPinned) {
            setTimeout(() => {
                setPopoverState(prev => ({ ...prev, isVisible: false }))
            }, POPOVER_CONFIG.POPOVER_HIDE_DELAY)
        }
    }

    const handlePopoverClose = () => {
        setPopoverState(prev => ({ ...prev, isVisible: false }))
        setIsPinned(false)
        setIsExpanded(false)
    }

    const toggleExpansion = () => {
        setIsExpanded(!isExpanded)
    }

    useEffect(() => {
        if (!isExpanded) {
            const message = popoverState.message || POPOVER_MESSAGES[popoverState.highlightType]
            const isOverflowing = checkTextOverflow(
                message,
                POPOVER_CONFIG.COLLAPSED_WIDTH - 32,
                POPOVER_CONFIG.MAX_HEIGHT,
                { fontSizePx: 14, lineHeightPx: 20 }
            )
            setShowEllipsis(isOverflowing)
        }
    }, [popoverState.message, popoverState.highlightType, isExpanded])

    // Hide popover only on page scroll (window). Scrolling inside the popover should not close it.
    useEffect(() => {
        if (!popoverState.isVisible) return
        const onScroll = () => handlePopoverClose()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
        }
    }, [popoverState.isVisible])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            // Allow clicks within popover, dialog content, popover trigger, or on a highlight itself
            const isInside = !!target.closest('[data-slot="popover-content"], [data-slot="dialog-content"], [data-slot="popover-trigger"], [data-hl]')
            if (!isInside) {
                handlePopoverClose()
            }
        }

        if (popoverState.isVisible) {
            document.addEventListener('click', handleClickOutside, true)
        }

        return () => {
            document.removeEventListener('click', handleClickOutside, true)
        }
    }, [popoverState.isVisible])

    useEffect(() => {
        return () => clearHoverTimeout()
    }, [])

    return {
        popoverState,
        isPinned,
        isExpanded,
        showEllipsis,
        handlers: {
            onHighlightHover: handleHighlightHover,
            onHighlightClick: handleHighlightClick,
            onHighlightLeave: handleHighlightLeave,
            onPopoverMouseEnter: handlePopoverMouseEnter,
            onPopoverMouseLeave: handlePopoverMouseLeave,
            onPopoverClose: handlePopoverClose,
            onToggleExpansion: toggleExpansion,
        },
    }
} 