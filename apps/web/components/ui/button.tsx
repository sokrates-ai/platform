import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#E25A26] text-white shadow-[0_4px_0_0_#C94918] rounded-[6px] relative",
        destructive:
          "border border-[#E03131] bg-[#E03131] text-white shadow-[0_4px_0_0_#B71C1C] rounded-[6px] hover:bg-[#B71C1C] hover:shadow-[0_4px_0_0_#8A1A1A]", 
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-[#626262] bg-[#F4F4F4] text-black shadow-[0_4px_0_0_#454545] rounded-[6px] hover:bg-[#EDEDED] hover:shadow-[0_4px_0_0_#3A3A3A]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      <>
        {props.children}
        {variant === "default" && (
          <svg
            className="absolute top-0 right-2 w-6 h-1"
            viewBox="0 0 24 4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="6" width="18" height="4" rx="2" fill="#F1F1F1" />
            <rect width="4" height="4" rx="2" fill="#F1F1F1" />
          </svg>
        )}
      </>
    </Comp>
    )

  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
