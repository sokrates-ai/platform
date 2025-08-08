import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-SokratesOrange text-white shadow hover:bg-SokratesOrangeShadow",
        secondary:
          "border border-SokratesGrayBorder bg-SokratesWhite text-black shadow-[0_4px_0_0_var(--color-SokratesBlackBoxShadow)] rounded-[6px] hover:bg-SokratesLightGray hover:shadow-[0_4px_0_0_#3A3A3A]",
        destructive:
          "border border-SokratesRed bg-SokratesRed text-white shadow-[0_4px_0_0_var(--color-SokratesRedShadow)] rounded-[6px] hover:bg-SokratesRedShadow hover:shadow-[0_4px_0_0_#8A1A1A]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
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
