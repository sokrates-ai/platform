import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/utils/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-[inherit] transition-all outline-none shrink-0 " +
    "cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-100 " + // cursor behavior
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 " +
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "relative overflow-hidden border border-[#9F3812] bg-[#C94918] text-[#FFF8F4] font-semibold shadow-[0px_4px_0px_0px_#8F3110] hover:bg-[#B84215] active:rounded-[0.375rem] active:bg-[#AF3E14] active:shadow-[0px_2px_0px_0px_#8F3110] active:translate-y-[2px] active:[&>svg]:opacity-0",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "rounded-[0.375rem] border border-[#626262] bg-white text-[#1F1F1F] text-center text-[0.875rem] font-semibold leading-[1.5rem] hover:bg-[#F4F4F4]",
        secondary:
          "relative h-10 rounded-md border border-[#626262] bg-white text-[#1F1F1F] box-border text-[0.875rem] font-semibold leading-[1.5rem] shadow-[0px_4px_0px_#454545] hover:bg-[#F6F6F6] active:rounded-[0.375rem] active:border active:border-[#626262] active:bg-[#F0F0F0] active:shadow-[0px_2px_0px_0px_#454545] active:translate-y-[2px]",
        ghost:
          "text-[#2F2F2F] hover:bg-[#ECECEC] hover:text-[#1F1F1F] dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-8",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-8 has-[>svg]:px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  progress,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** 0..1 fill on disabled: diagonal gradient shows completed portion */
    progress?: number
  }) {
  const Comp = asChild ? Slot : "button"
  const resolvedVariant = variant ?? "default"

  const isDisabled = !!(props as React.ComponentProps<"button">).disabled
  const clamped = Math.max(0, Math.min(1, Number(progress ?? 0)))
  const pct = Math.round(clamped * 100)

  const disabledStyle: React.CSSProperties =
    resolvedVariant === "default"
      ? {
          background: `linear-gradient(90deg, #E7E7E7 0%, #E7E7E7 ${pct}%, #F4F4F4 ${pct}%, #F4F4F4 100%)`,
          border: "1px solid #8A8A8A",
          boxShadow: "0 2px 0 0 #676767",
          borderRadius: "0.375rem",
          color: "#303030",
          transform: "translateY(2px)",
        }
      : {
          background: `linear-gradient(90deg, #FFFFFF 0%, #FFFFFF ${pct}%, #EFEFEF ${pct}%, #EFEFEF 100%)`,
          border: "1px solid #8A8A8A",
          boxShadow: "0 2px 0 0 #676767",
          borderRadius: "0.375rem",
          color: "#303030",
          transform: "translateY(2px)",
        }

  const mergedStyle: React.CSSProperties | undefined = isDisabled
    ? { ...disabledStyle, ...(props as React.ComponentProps<"button">).style }
    : (props as React.ComponentProps<"button">).style

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        isDisabled && "text-[#303030]"
      )}
      style={mergedStyle}
      {...props}
    >
      {props.children}
      {resolvedVariant === "default" && !isDisabled && (
        <svg
          width="24"
          height="4"
          viewBox="0 0 24 4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute top-1.5 right-2 pointer-events-none transition-opacity"
          style={{
            width: `${Math.max(24, size === "sm" ? 20 : size === "lg" ? 28 : 24)}px`,
            height: `${Math.max(4, size === "sm" ? 3 : size === "lg" ? 5 : 4)}px`,
          }}
        >
          <rect x="6" width="18" height="4" rx="2" fill="#FFF3EC" />
          <rect width="4" height="4" rx="2" fill="#FFF3EC" />
        </svg>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
