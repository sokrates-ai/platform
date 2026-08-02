'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle2, Clock, Eye, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CourseTabSelector } from '@components/Objects/Modals/Course/Create/CourseTabSelector'
import { SummaryCard } from './SummaryCard'
import { CourseAnalyticsData } from './useAnalyticsData'
import { formatDuration } from './analyticsMetrics'

type AnalyticsByTabProps = {
  analytics: CourseAnalyticsData
}

export default function AnalyticsByTab({ analytics }: AnalyticsByTabProps) {
  const sortedTabs = useMemo(
    () => analytics.tabs.slice().sort((a, b) => a.position - b.position),
    [analytics.tabs],
  )
  const [selectedTabId, setSelectedTabId] = useState<string>(sortedTabs[0]?.tab_id ?? '')

  useEffect(() => {
    if (!sortedTabs.length) return
    if (!sortedTabs.some((tab) => tab.tab_id === selectedTabId)) {
      setSelectedTabId(sortedTabs[0].tab_id)
    }
  }, [selectedTabId, sortedTabs])

  const selectedTab = sortedTabs.find((tab) => tab.tab_id === selectedTabId)
  const tabActivities = analytics.activities
    .filter((activity) => activity.tab_id === selectedTabId)
    .sort((a, b) => a.chapter_position - b.chapter_position || a.activity_position - b.activity_position)
  const attention = analytics.attention.filter(
    (item) =>
      (item.scope === 'tab' && item.ref_id === selectedTabId) ||
      tabActivities.some((activity) => activity.activity_uuid === item.ref_id),
  )

  return (
    <div className="flex h-full gap-6">
      <Card className="h-full w-80 shrink-0">
        <CardContent className="h-full overflow-hidden px-4 py-6">
          {sortedTabs.length > 0 ? (
            <CourseTabSelector
              className="h-full overflow-y-auto"
              tabs={sortedTabs.map((tab) => ({
                id: tab.tab_id,
                name: tab.name,
                position: tab.position,
              }))}
              activeTab={selectedTabId}
              onActiveTabChange={setSelectedTabId}
              orientation="vertical"
              allowTabEditing={false}
              renderTabContent={() => null}
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No tabs available</p>
          )}
        </CardContent>
      </Card>

      <div className="flex-1 space-y-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedTab?.name ?? 'Tab analytics'}
          </h2>
          <p className="text-sm text-gray-500">
            Completion, engagement, and review blockers for this tab.
          </p>
        </div>

        {selectedTab ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                icon={<BookOpen size={20} />}
                label="Activities"
                value={selectedTab.activity_count}
                color="bg-purple-50 text-purple-600"
              />
              <SummaryCard
                icon={<Eye size={20} />}
                label="Students Engaged"
                value={`${selectedTab.engaged_student_count}/${selectedTab.student_count}`}
                color="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                icon={<CheckCircle2 size={20} />}
                label="Completion Rate"
                value={`${selectedTab.completion_rate}%`}
                color="bg-green-50 text-green-600"
              />
              <SummaryCard
                icon={<AlertTriangle size={20} />}
                label="Pending / Incorrect"
                value={`${selectedTab.pending_verification_count}/${selectedTab.incorrect_count}`}
                color="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                icon={<Clock size={20} />}
                label="Avg. Task Duration"
                value={formatDuration(selectedTab.avg_task_duration_ms)}
                color="bg-teal-50 text-teal-600"
              />
              <SummaryCard
                icon={<Timer size={20} />}
                label="Avg. Tutor Response"
                value={formatDuration(selectedTab.avg_tutor_response_ms)}
                color="bg-rose-50 text-rose-600"
              />
            </div>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Tab Attention</h3>
                {attention.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {attention.slice(0, 6).map((item) => (
                      <div
                        key={`${item.kind}-${item.scope}-${item.ref_id}`}
                        className="rounded-md border border-gray-200 p-3"
                      >
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">No tab blockers detected.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Activities</h3>
                {tabActivities.length > 0 ? (
                  <div className="max-h-[460px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Activity</TableHead>
                          <TableHead>Chapter</TableHead>
                          <TableHead>Completion</TableHead>
                          <TableHead className="text-center">Started</TableHead>
                          <TableHead className="text-center">Pending</TableHead>
                          <TableHead className="text-center">Incorrect</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tabActivities.map((activity) => (
                          <TableRow key={activity.activity_uuid}>
                            <TableCell className="font-medium">{activity.name}</TableCell>
                            <TableCell className="text-xs text-gray-600">{activity.chapter_name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={activity.completion_rate} className="h-2 w-24" />
                                <span className="text-xs text-gray-500">{activity.completion_rate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs text-gray-600">
                              {activity.started_count}/{activity.student_count}
                            </TableCell>
                            <TableCell className="text-center text-xs text-amber-600">
                              {activity.pending_verification_count}
                            </TableCell>
                            <TableCell className="text-center text-xs text-red-500">
                              {activity.incorrect_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">No activities in this tab</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-gray-400">Select a tab to view analytics.</p>
        )}
      </div>
    </div>
  )
}
