"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/shared/utils/utils"
import "@/shared/ui/styles/popover.css"

export function Popover(
  props: React.ComponentProps<typeof PopoverPrimitive.Root>
) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

export function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

export function PopoverAnchor(
  props: React.ComponentProps<typeof PopoverPrimitive.Anchor>
) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

interface PopoverContentProps
  extends React.ComponentProps<typeof PopoverPrimitive.Content> {
  width?: number | string
  height?: number | string
}

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(function PopoverContent(
  {
    className,
    align = "center",
    sideOffset = 8,
    width = 300,
    height,
    ...props
  },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        style={{ width, height }}
        className={cn(
          "relative z-50 origin-[--radix-popover-content-transform-origin] " +
          "rounded-lg border bg-popover p-4 shadow-md " +
          "text-popover-foreground outline-none " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 " +
          "data-[side=bottom]:slide-in-from-top-2 " +
          "data-[side=left]:slide-in-from-right-2 " +
          "data-[side=right]:slide-in-from-left-2 " +
          "data-[side=top]:slide-in-from-bottom-2 " +
          "popover-bubble",
          className
        )}
        {...props}
      >
        {props.children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})
