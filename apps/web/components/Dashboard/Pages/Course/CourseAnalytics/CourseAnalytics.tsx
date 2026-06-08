'use client'

import { BarChart3 } from 'lucide-react'

export default function CourseAnalytics() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center space-y-3 text-gray-400">
        <BarChart3 size={48} />
        <p className="text-lg font-medium">Analytics coming soon</p>
      </div>
    </div>
  )
}
