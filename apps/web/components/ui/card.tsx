import * as React from "react"
import { cn } from "@/lib/utils"
import { secureHeapUsed } from "crypto"
import { setupConnectErrorHandler } from "@sentry/nextjs"

const cardVariants = {
  default: "rounded-[12px] border-[1px] border-[#707070] bg-[#FFF] shadow-[0_4px_0_0_#454545]",
  defaultgradient: "rounded-[12px] border-[1px] border-[#707070] shadow-[0_4px_0_0_#454545] bg-[linear-gradient(242deg,_#FFF_69.88%,_#E8E8E8_116.14%)]",
  secondary: "rounded-[12px] border-2 border-[#707070] bg-[#F4F4F4]",
  secondarygradient: "rounded-[12px] border-2 border-[#707070] bg-[linear-gradient(238deg,_#F4F4F4_71.2%,_#DBDBDB_124.63%)]",
}

type CardVariant = keyof typeof cardVariants

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ variant = "default", className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants[variant as CardVariant], className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
