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
          props.variant === 'destructive' ? 'bg-destructive' : 'bg-foreground'
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {toastDuration > 0 && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded bg-muted">
                <div
                  className={`h-full w-full origin-left ${progressClass}`}
                  style={{
                    animation: `toast-progress ${toastDuration}ms linear forwards`,
                  }}
                />
              </div>
            )}
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
