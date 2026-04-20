"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, ...props }) {
        const toastDuration =
          typeof duration === 'number' ? duration : 5000
        const progressClass =
          props.variant === 'destructive'
            ? 'bg-gradient-to-r from-destructive/90 via-destructive to-destructive/70'
            : 'bg-gradient-to-r from-foreground/80 via-foreground to-foreground/60'
        return (
          <Toast key={id} {...props}>
            {toastDuration > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-border/70">
                <div
                  className={`h-full w-full origin-left rounded-t-md ${progressClass}`}
                  style={{
                    animation: `toast-progress ${toastDuration}ms linear forwards`,
                  }}
                />
              </div>
            )}
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
