'use client'

import React, { useState } from 'react'
import { LayoutDashboard, Layers, DoorOpen, Grid3x3, Loader2 } from 'lucide-react'
import { useAnalyticsData } from './useAnalyticsData'
import AnalyticsOverview from './AnalyticsOverview'
import AnalyticsByTab from './AnalyticsByTab'
import AnalyticsByRoom from './AnalyticsByRoom'
import AnalyticsMatrix from './AnalyticsMatrix'

type AnalyticsSubPage = 'overview' | 'by-tab' | 'by-room' | 'matrix'

const SUB_PAGES: { id: AnalyticsSubPage; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'by-tab', label: 'By Tab', icon: <Layers size={16} /> },
  { id: 'by-room', label: 'By Room', icon: <DoorOpen size={16} /> },
  { id: 'matrix', label: 'Matrix', icon: <Grid3x3 size={16} /> },
]

export default function CourseAnalytics() {
  const [subPage, setSubPage] = useState<AnalyticsSubPage>('overview')
  const {
    courseLoading,
    courseUuid,
    tabs,
    rooms,
    students,
    allActivities,
    activitySteps,
  } = useAnalyticsData()

  if (courseLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Sub-navbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-6 pt-4">
        {SUB_PAGES.map((page) => {
          const active = subPage === page.id
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => setSubPage(page.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-[#EA8963] text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {page.icon}
              {page.label}
            </button>
          )
        })}
      </div>

      {/* Sub-page content */}
      <div className="flex-1 overflow-y-auto p-6">
        {subPage === 'overview' && (
          <AnalyticsOverview
            students={students}
            allActivities={allActivities}
            activitySteps={activitySteps}
          />
        )}
        {subPage === 'by-tab' && (
          <AnalyticsByTab
            tabs={tabs}
            students={students}
            allActivities={allActivities}
            activitySteps={activitySteps}
          />
        )}
        {subPage === 'matrix' && (
          <AnalyticsMatrix
            courseUuid={courseUuid}
            tabs={tabs}
            rooms={rooms}
            students={students}
            allActivities={allActivities}
          />
        )}
        {subPage === 'by-room' && (
          <AnalyticsByRoom
            rooms={rooms}
            courseUuid={courseUuid}
            allActivities={allActivities}
          />
        )}
      </div>
    </div>
  )
}
