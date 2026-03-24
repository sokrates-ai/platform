'use client'

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@components/ui/dialog"
import { ButtonBlack } from '../Form/Form'
import { cn } from "@/lib/utils"

type ModalParams = {
  dialogTitle?: string
  dialogDescription?: string
  dialogContent: React.ReactNode
  dialogClose?: React.ReactNode | null
  dialogTrigger?: React.ReactNode
  addDefCloseButton?: boolean
  onOpenChange: (open: boolean) => void
  isDialogOpen?: boolean
  minHeight?: 'sm' | 'md' | 'lg' | 'xl' | 'no-min'
  minWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'no-min'
  customHeight?: string
  customWidth?: string
}

const Modal = (params: ModalParams) => {
  const getMinHeight = () => {
    switch (params.minHeight) {
      // Only start enforcing these minima once the viewport
      // is large enough for them.
      case 'sm': return 'sm:min-h-[300px]'
      case 'md': return 'md:min-h-[500px]'
      case 'lg': return 'lg:min-h-[700px]'
      case 'xl': return 'xl:min-h-[900px]'
      default: return ''
    }
  }

  const getMinWidth = () => {
    switch (params.minWidth) {
      case 'sm': return 'sm:min-w-[600px]'
      case 'md': return 'md:min-w-[800px]'
      case 'lg': return 'lg:min-w-[1000px]'
      case 'xl': return 'xl:min-w-[1200px]'
      default: return ''
    }
  }

  const hasDescription = Boolean(params.dialogDescription)
  const dialogHeader = params.dialogTitle ? (
    <DialogHeader className="text-center flex flex-col space-y-0.5 w-full">
      <DialogTitle>{params.dialogTitle}</DialogTitle>
      {params.dialogDescription && (
        <DialogDescription>{params.dialogDescription}</DialogDescription>
      )}
    </DialogHeader>
  ) : null

  return (
    <Dialog open={params.isDialogOpen} onOpenChange={params.onOpenChange}>
      {params.dialogTrigger && (
        <DialogTrigger asChild>{params.dialogTrigger}</DialogTrigger>
      )}
      <DialogContent pattern={false} className={cn(
        "overflow-auto",
        getMinHeight(),
        getMinWidth(),
        params.customHeight,
        params.customWidth
      )} {...(!hasDescription ? { "aria-describedby": undefined } : {})}>
        {dialogHeader}
        <div className="overflow-auto">
          {params.dialogContent}
        </div>
        {(params.dialogClose || params.addDefCloseButton) && (
          <DialogFooter>
            {params.dialogClose}
            {params.addDefCloseButton && (
              <ButtonBlack type="submit">
                Close
              </ButtonBlack>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
