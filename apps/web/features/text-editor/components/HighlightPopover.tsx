import React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import type { PopoverState } from '@/features/text-editor/types/highlightTypes'
import { POPOVER_COLORS } from '@/features/text-editor/types/highlightTypes'
import { POPOVER_CONFIG } from '@/features/text-editor/utils/highlightUtils'

interface HighlightPopoverProps {
    popoverState: PopoverState
    isExpanded: boolean
    showEllipsis: boolean
    onMouseEnter: () => void
    onMouseLeave: () => void
    onToggleExpansion: () => void
    onClose: () => void
}

/**
 * Component that renders the highlight popover with type badge and expandable content
 */
export const HighlightPopover: React.FC<HighlightPopoverProps> = ({
    popoverState,
    isExpanded,
    showEllipsis,
    onMouseEnter,
    onMouseLeave,
    onToggleExpansion,
    onClose,
}) => {
    // Detect mobile viewport
    const [isMobile, setIsMobile] = React.useState(false)
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)')
        const handleChange = () => setIsMobile(mq.matches)
        handleChange()
        mq.addEventListener('change', handleChange)
        return () => mq.removeEventListener('change', handleChange)
    }, [])

    if (!popoverState.isVisible || !popoverState.position) {
        return null
    }

    const colors = POPOVER_COLORS[popoverState.highlightType]
    const displayMessage = popoverState.message

    const commonBody = (
        <div
            className="p-4 cursor-pointer"
            style={{
                width: POPOVER_CONFIG.COLLAPSED_WIDTH,
            }}
            onClick={onToggleExpansion}
        >
            {/* Type badge */}
            <div className="flex justify-start mb-3">
                <div
                    className="px-5 py-3 h-6 rounded-md text-xs font-semibold border box-border flex items-center justify-center"
                    style={{
                        backgroundColor: colors.fill,
                        borderColor: colors.stroke,
                        color: colors.text,
                    }}
                >
                    {popoverState.highlightType.charAt(0).toUpperCase() + popoverState.highlightType.slice(1)}
                </div>
            </div>

            {/* Message */}
            <div
                className="leading-6 mb-1 text-left"
                style={{
                    color: '#454545',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '0.875rem',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: '1.25rem',
                    maxHeight: isExpanded ? '240px' : POPOVER_CONFIG.MAX_HEIGHT,
                    overflow: isExpanded ? 'auto' : 'hidden',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                }}
            >
                {!isExpanded && showEllipsis ? (
                    <div className="line-clamp-3">
                        {displayMessage}
                    </div>
                ) : (
                    displayMessage
                )}
            </div>
        </div>
    )

    if (isMobile) {
        const mobileBody = (
            <div className="p-4" style={{ width: '100%' }}>
                {/* Pill */}
                <div className="flex justify-start mb-3">
                    <div
                        className="px-5 py-3 h-6 rounded-md text-xs font-semibold border box-border flex items-center justify-center"
                        style={{ backgroundColor: colors.fill, borderColor: colors.stroke, color: colors.text }}
                    >
                        {popoverState.highlightType.charAt(0).toUpperCase() + popoverState.highlightType.slice(1)}
                    </div>
                </div>
                {/* Message */}
                <div
                    className="leading-6 text-left"
                    style={{
                        color: '#454545',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '0.875rem',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: '1.25rem',
                        maxHeight: '60vh',
                        overflow: 'auto',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                    }}
                >
                    {displayMessage}
                </div>
            </div>
        )
        return (
            <Dialog open={popoverState.isVisible} onOpenChange={(open) => { if (!open) onClose() }}>
                <DialogContent className="p-0 bg-white bg-none" showCloseButton>
                    {/* Hidden title for a11y */}
                    <DialogTitle className="sr-only">{popoverState.highlightType} detail</DialogTitle>
                    {mobileBody}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Popover open={popoverState.isVisible}>
            <PopoverTrigger asChild>
                <div
                    className="fixed pointer-events-none"
                    style={{
                        left: popoverState.position.x,
                        top: popoverState.position.y,
                        width: 1,
                        height: 1,
                        zIndex: 9999,
                    }}
                />
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 border-2 border-[#626262]"
                side="right"
                align="center"
                sideOffset={8}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {commonBody}
            </PopoverContent>
        </Popover>
    )
} 