"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/shared/utils/utils"

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorColor?: string
}
  

function Progress({
  className,
  value,
  indicatorColor = "#E25A26",
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-[#F1F1F1]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{
          background: indicatorColor,
          transform: `translateX(-${100 - (value || 0)}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
