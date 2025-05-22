import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#E25A26] text-white shadow hover:bg-[#C94918]",
        secondary:
        "border border-[#626262] bg-[#F4F4F4] text-black shadow-[0_4px_0_0_#454545] rounded-[6px] hover:bg-[#EDEDED] hover:shadow-[0_4px_0_0_#3A3A3A]",
         destructive:
          "border border-[#E03131] bg-[#E03131] text-white shadow-[0_4px_0_0_#B71C1C] rounded-[6px] hover:bg-[#B71C1C] hover:shadow-[0_4px_0_0_#8A1A1A]",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",

      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
