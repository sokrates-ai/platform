import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-[inherit] transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default:
          "relative bg-SokratesOrangeShadow text-white font-semibold shadow-[0px_4px_0px_0px_var(--color-SokratesOrangeShadow)] hover:bg-SokratesOrangeShadow/90 overflow-hidden active:rounded-[0.375rem] active:bg-SokratesOrangeShadow active:shadow-[0px_2px_0px_0px_var(--color-SokratesOrangeShadow)] active:translate-y-[2px] active:[&>svg]:opacity-0",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "rounded-[0.375rem] border border-SokratesGrayBorder text-SokratesBlackBoxShadow text-center text-[0.875rem] font-semibold leading-[1.5rem] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "relative h-10 rounded-md bg-SokratesLightGray border border-SokratesGrayBorder text-SokratesBlackBoxShadow text-center text-[0.875rem] font-semibold leading-[1.5rem] shadow-[0px_4px_0px_var(--color-SokratesBlackBoxShadow)] hover:bg-SokratesWhite active:rounded-[0.375rem] active:border-SokratesGrayBorder active:bg-SokratesLightGray active:shadow-[0px_2px_0px_0px_var(--color-SokratesBlackBoxShadow)] active:translate-y-[2px]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-8",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-8 has-[>svg]:px-4",
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
  (
    { className, variant, size, asChild = false, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    const svgSize = React.useMemo(() => {
      switch (size) {
        case "sm":
          return { width: 20, height: 3 }
        case "lg":
          return { width: 28, height: 5 }
        default:
          return { width: 24, height: 4 }
      }
    }, [size])

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
        {variant === "default" && (
          <svg
            width={svgSize.width}
            height={svgSize.height}
            viewBox="0 0 24 4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-1.5 right-2 pointer-events-none transition-opacity"
          >
            <rect x="6" width="18" height="4" rx="2" fill="#F1F1F1" />
            <rect width="4" height="4" rx="2" fill="#F1F1F1" />
          </svg>
        )}
      </Comp>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
