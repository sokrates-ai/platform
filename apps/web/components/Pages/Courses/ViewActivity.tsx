'use client'

import { useEffect, useState } from 'react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'

interface ViewActivityProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgslug: string
  courseuuid: string
  activityid: string
}

export default function ViewActivity({
  open,
  onOpenChange,
  orgslug,
  courseuuid,
  activityid,
}: ViewActivityProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(t)
  }, [open])

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={onOpenChange}
      customWidth="w-[95vw] max-w-[70rem]"
      customHeight="h-[80vh]"
      dialogContent={
        loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-sm text-[#727272]">Loading…</span>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto p-6">
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-[#3C3C3C]">
                View Activity (Read-only Test)
              </h1>
              <p className="text-sm text-[#727272]">
                This is placeholder content for testing the read-only activity modal.
              </p>
              <div className="rounded-lg border border-[#DFDFDF] bg-white p-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[#727272]">Org</dt>
                    <dd className="font-medium text-[#3C3C3C]">{orgslug}</dd>
                  </div>
                  <div>
                    <dt className="text-[#727272]">Course</dt>
                    <dd className="font-medium text-[#3C3C3C]">{courseuuid}</dd>
                  </div>
                  <div>
                    <dt className="text-[#727272]">Activity</dt>
                    <dd className="font-medium text-[#3C3C3C]">{activityid}</dd>
                  </div>
                  <div>
                    <dt className="text-[#727272]">Mode</dt>
                    <dd className="font-medium text-[#3C3C3C]">Read-only</dd>
                  </div>
                </dl>
              </div>
              <p className="text-xs text-[#727272]">
                Click outside the dialog (map area) to close.
              </p>
            </div>
          </div>
        )
      }
    />
  )
}