'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts'
import { BookOpen, Layers, Eye, CheckCircle2, Clock, Timer } from 'lucide-react'
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
import { CourseTab, CourseTabSelector } from '@components/Objects/Modals/Course/Create/CourseTabSelector'
import { ApiStudent } from '@components/Dashboard/Pages/Course/ManageCourseMembers/shared'
import { AnalyticsActivity, ActivityStatusStep } from './useAnalyticsData'
import { SummaryCard } from './SummaryCard'
import { avgTaskDurationMs, avgTutorResponseMs, formatDuration } from './analyticsMetrics'

type AnalyticsByTabProps = {
  tabs: CourseTab[]
  students?: ApiStudent[]
  allActivities: AnalyticsActivity[]
  activitySteps: ActivityStatusStep[]
}

export default function AnalyticsByTab({
  tabs,
  students,
  allActivities,
  activitySteps,
}: AnalyticsByTabProps) {
  const [selectedTabId, setSelectedTabId] = useState<string>(tabs[0]?.id ?? '')

  // Keep the selection valid as tabs load / change.
  useEffect(() => {
    if (tabs.length === 0) return
    if (!tabs.some((t) => t.id === selectedTabId)) {
      setSelectedTabId(tabs[0].id)
    }
  }, [tabs, selectedTabId])

  const selectedTab = tabs.find((t) => t.id === selectedTabId)

  const tabActivities = useMemo(
    () => allActivities.filter((a) => a.tab_id === selectedTabId),
    [allActivities, selectedTabId]
  )

  const tabActivityUuids = useMemo(
    () => new Set(tabActivities.map((a) => a.activity_uuid)),
    [tabActivities]
  )

  const tabSteps = useMemo(
    () => activitySteps.filter((s) => tabActivityUuids.has(s.activity_uuid)),
    [activitySteps, tabActivityUuids]
  )

  const stats = useMemo(() => {
    const totalStudents = students?.length ?? 0
    const activityCount = tabActivities.length
    const chapterCount = new Set(tabActivities.map((a) => a.chapter_name)).size

    // A student has "looked into" the tab if they have any status record for one
    // of its activities.
    const engagedStudents = new Set(tabSteps.map((s) => s.user_id)).size

    const completedSteps = tabSteps.filter((s) => s.complete).length
    const totalPossible = totalStudents * activityCount
    const completionRate = totalPossible > 0 ? Math.round((completedSteps / totalPossible) * 100) : 0

    const avgTaskDuration = avgTaskDurationMs(tabSteps)
    const avgTutorResponse = avgTutorResponseMs(tabSteps)

    return { totalStudents, activityCount, chapterCount, engagedStudents, completionRate, completedSteps, totalPossible, avgTaskDuration, avgTutorResponse }
  }, [students, tabActivities, tabSteps])

  const activityTableData = useMemo(() => {
    const totalStudents = students?.length ?? 0
    return tabActivities.map((activity) => {
      const steps = tabSteps.filter((s) => s.activity_uuid === activity.activity_uuid)
      const viewers = new Set(steps.map((s) => s.user_id)).size
      const completed = steps.filter((s) => s.complete).length
      const rate = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0
      return {
        activity_uuid: activity.activity_uuid,
        name: activity.name,
        chapter_name: activity.chapter_name,
        viewers,
        completed,
        totalStudents,
        rate,
      }
    })
  }, [tabActivities, tabSteps, students])

  const chapterCompletionData = useMemo(() => {
    const chapterMap = new Map<string, { total: number; completed: number }>()
    const studentCount = students?.length ?? 0
    tabActivities.forEach((activity) => {
      const key = activity.chapter_name
      if (!chapterMap.has(key)) chapterMap.set(key, { total: 0, completed: 0 })
      const entry = chapterMap.get(key)!
      entry.total += studentCount
      entry.completed += tabSteps.filter(
        (s) => s.activity_uuid === activity.activity_uuid && s.complete
      ).length
    })
    return Array.from(chapterMap.entries()).map(([name, data]) => ({
      name: name.length > 20 ? name.slice(0, 18) + '...' : name,
      fullName: name,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      completed: data.completed,
      total: data.total,
    }))
  }, [tabActivities, tabSteps, students])

  return (
    <div className="flex h-full gap-6">
      {/* Left tab navigation */}
      <Card className="h-full w-80 shrink-0">
        <CardContent className="h-full overflow-hidden px-4 py-6">
          {tabs.length > 0 ? (
            <CourseTabSelector
              className="h-full overflow-y-auto"
              tabs={tabs}
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

      {/* Per-tab analytics */}
      <div className="flex-1 space-y-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedTab?.name ?? 'Tab analytics'}
          </h2>
          <p className="text-sm text-gray-500">
            Engagement and completion for activities in this tab.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            icon={<BookOpen size={20} />}
            label="Activities"
            value={stats.activityCount}
            color="bg-purple-50 text-purple-600"
          />
          <SummaryCard
            icon={<Layers size={20} />}
            label="Chapters"
            value={stats.chapterCount}
            color="bg-indigo-50 text-indigo-600"
          />
          <SummaryCard
            icon={<Eye size={20} />}
            label="Students Engaged"
            value={`${stats.engagedStudents}/${stats.totalStudents}`}
            color="bg-blue-50 text-blue-600"
          />
          <SummaryCard
            icon={<CheckCircle2 size={20} />}
            label="Completion Rate"
            value={`${stats.completionRate}%`}
            color="bg-green-50 text-green-600"
          />
          <SummaryCard
            icon={<Clock size={20} />}
            label="Avg. Task Duration"
            value={formatDuration(stats.avgTaskDuration)}
            color="bg-teal-50 text-teal-600"
          />
          <SummaryCard
            icon={<Timer size={20} />}
            label="Avg. Tutor Response"
            value={formatDuration(stats.avgTutorResponse)}
            color="bg-rose-50 text-rose-600"
          />
        </div>

        {/* Completion by chapter (within this tab) */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Completion by Chapter</h3>
            {chapterCompletionData.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chapterCompletionData} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                            <p className="text-sm font-medium">{d.fullName}</p>
                            <p className="text-xs text-gray-500">{d.completed}/{d.total} completions ({d.rate}%)</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {chapterCompletionData.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? '#EA8963' : '#F4A77D'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">No activities in this tab</p>
            )}
          </CardContent>
        </Card>

        {/* Per-activity table */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Activities</h3>
            {activityTableData.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>Chapter</TableHead>
                      <TableHead className="text-center">Students Looked In</TableHead>
                      <TableHead className="text-center">Completed</TableHead>
                      <TableHead>Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityTableData.map((activity) => (
                      <TableRow key={activity.activity_uuid}>
                        <TableCell className="font-medium">{activity.name}</TableCell>
                        <TableCell className="text-xs text-gray-600">{activity.chapter_name}</TableCell>
                        <TableCell className="text-center text-xs text-gray-600">
                          {activity.viewers}/{activity.totalStudents}
                        </TableCell>
                        <TableCell className="text-center text-xs text-gray-600">
                          {activity.completed}/{activity.totalStudents}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={activity.rate} className="h-2 w-20" />
                            <span className="text-xs text-gray-500">{activity.rate}%</span>
                          </div>
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
      </div>
    </div>
  )
}
