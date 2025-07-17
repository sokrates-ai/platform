"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  /**
   * Show the arrow pointer?
   * @default true
   */
  showArrow?: boolean
  /**
   * Arrow size in px.
   * @default 8
   */
  arrowSize?: number
  /**
   * Arrow offset from the edge in px.
   * @default 4
   */
  arrowOffset?: number
  /**
   * Popover width (e.g. "16rem" or 256)
   * @default "18rem"
   */
  width?: string | number
  /**
   * Popover height.
   */
  height?: string | number
}

const DEFAULT_ARROW_SIZE = 8
const DEFAULT_ARROW_OFFSET = 4
const DEFAULT_WIDTH = "18rem"

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
  {
    className,
    align = "center",
    sideOffset = 4,
    showArrow = true,
    arrowSize = DEFAULT_ARROW_SIZE,
    arrowOffset = DEFAULT_ARROW_OFFSET,
    width = DEFAULT_WIDTH,
    height,
    children,
    ...props
  },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        style={{ width, height }}
        className={cn(
          "relative z-50 origin-[--radix-popover-content-transform-origin]",
          "rounded-lg border bg-popover p-4 shadow-md",
          "text-popover-foreground outline-none",
          // animations
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          // slide-in from each side
          "data-[side=top]:slide-in-from-bottom-2",
          "data-[side=right]:slide-in-from-left-2",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=left]:slide-in-from-right-2",
          className
        )}
        {...props}
      >
        {children}
        {showArrow && (
          <PopoverPrimitive.Arrow
            width={arrowSize}
            height={arrowSize}
            offset={arrowOffset}
            className="fill-popover border-popover-foreground stroke-popover-foreground"
          />
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})

PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
