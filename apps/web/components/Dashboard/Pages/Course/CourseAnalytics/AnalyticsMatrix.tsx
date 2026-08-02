'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Eye, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CourseAnalyticsData, AnalyticsActivity } from './useAnalyticsData'
import { formatDuration } from './analyticsMetrics'

type AnalyticsMatrixProps = {
  analytics: CourseAnalyticsData
}

type TaskState = 'started' | 'done' | 'verified' | 'correct' | 'pending' | 'incorrect'

const TASK_STATES: { id: TaskState; label: string }[] = [
  { id: 'started', label: 'Started' },
  { id: 'done', label: 'Done' },
  { id: 'verified', label: 'Verified' },
  { id: 'correct', label: 'Correct' },
  { id: 'pending', label: 'Pending' },
  { id: 'incorrect', label: 'Incorrect' },
]

const ALL_ROOMS = 'all'

export default function AnalyticsMatrix({ analytics }: AnalyticsMatrixProps) {
  const [selectedState, setSelectedState] = useState<TaskState>('done')
  const [selectedRoomId, setSelectedRoomId] = useState<number | typeof ALL_ROOMS>(ALL_ROOMS)
  const [selectedActivity, setSelectedActivity] = useState<AnalyticsActivity | null>(null)
  const selectedRoom =
    selectedRoomId === ALL_ROOMS
      ? null
      : analytics.rooms.find((room) => room.id === selectedRoomId) ?? null

  const studentCount =
    selectedRoomId === ALL_ROOMS
      ? analytics.summary.student_count
      : selectedRoom?.student_count ?? 0

  const activityMetrics = selectedRoom?.activities ?? analytics.activities
  const activityByUuid = useMemo(
    () => new Map(activityMetrics.map((activity) => [activity.activity_uuid, activity])),
    [activityMetrics],
  )

  const rows = useMemo(() => {
    return analytics.matrix.rows
      .map((row) => ({
        ...row,
        cells: row.cells.map((cell) => activityByUuid.get(cell.activity_uuid) ?? cell),
        average:
          row.cells.length > 0
            ? Math.round(
                row.cells.reduce((sum, cell) => {
                  const scopedCell = activityByUuid.get(cell.activity_uuid) ?? cell
                  return sum + valueForState(scopedCell, selectedState, studentCount).percent
                }, 0) /
                  row.cells.length,
              )
            : 0,
      }))
      .sort((a, b) => a.average - b.average)
  }, [activityByUuid, analytics.matrix.rows, selectedState, studentCount])

  const maxTasks = Math.max(0, ...rows.map((row) => row.cells.length))

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        No activities available for this course.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <FilterRow label="State">
          {TASK_STATES.map((state) => (
            <FilterPill
              key={state.id}
              label={state.label}
              active={selectedState === state.id}
              onClick={() => setSelectedState(state.id)}
            />
          ))}
        </FilterRow>
        <FilterRow label="Room">
          <FilterPill
            label="ALL"
            active={selectedRoomId === ALL_ROOMS}
            onClick={() => setSelectedRoomId(ALL_ROOMS)}
          />
          {analytics.rooms.map((room) => (
            <FilterPill
              key={room.id}
              label={room.name}
              active={selectedRoomId === room.id}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}
        </FilterRow>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>Worst tabs sort first</span>
        <LegendItem color="bg-gray-100" label="0%" />
        <LegendItem color="bg-orange-100" label="25%" />
        <LegendItem color="bg-orange-300" label="50%" />
        <LegendItem color="bg-orange-500" label="75%+" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="pt-6">
            {studentCount === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">
                No students found for this selection.
              </p>
            ) : (
              <div className="max-h-[calc(100vh-340px)] overflow-auto">
                <table className="border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-20 border-b border-r border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700">
                        Tab
                      </th>
                      {Array.from({ length: maxTasks }, (_, index) => (
                        <th
                          key={index}
                          className="sticky top-0 z-10 min-w-[64px] border-b border-gray-200 bg-white px-2 py-2 text-center font-semibold text-gray-700"
                        >
                          A{index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.tab_id}>
                        <td className="sticky left-0 z-10 max-w-[220px] border-b border-r border-gray-200 bg-white px-3 py-2 font-medium text-gray-800">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{row.name}</span>
                            <span className="ml-auto inline-block w-9 shrink-0 text-right text-[10px] tabular-nums text-gray-400">
                              {row.average}%
                            </span>
                          </div>
                        </td>
                        {Array.from({ length: maxTasks }, (_, index) => {
                          const cell = row.cells[index]
                          if (!cell) {
                            return (
                              <td
                                key={index}
                                className="border-b border-gray-100 px-2 py-2 text-center text-gray-300"
                              >
                                –
                              </td>
                            )
                          }
                          const value = valueForState(cell, selectedState, studentCount)
                          return (
                            <td key={cell.activity_uuid} className="border-b border-gray-100 p-1">
                              <button
                                type="button"
                                title={`${cell.name}\n${value.count}/${studentCount} students (${value.percent}%)`}
                                onClick={() => setSelectedActivity(cell)}
                                className="flex h-9 w-full items-center justify-center rounded text-xs font-semibold tabular-nums text-gray-900 transition hover:ring-2 hover:ring-[#EA8963]/40"
                                style={{ backgroundColor: heatColor(value.percent) }}
                              >
                                {value.percent}%
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {selectedActivity ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{selectedActivity.name}</h3>
                    <p className="text-xs text-gray-500">{selectedActivity.chapter_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close activity details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <DetailMetric icon={<Eye className="h-4 w-4" />} label="Started" value={`${selectedActivity.started_count}/${selectedActivity.student_count}`} />
                <DetailMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={`${selectedActivity.completed_count}/${selectedActivity.student_count}`} />
                <DetailMetric icon={<AlertTriangle className="h-4 w-4" />} label="Pending verification" value={selectedActivity.pending_verification_count} />
                <DetailMetric icon={<AlertTriangle className="h-4 w-4" />} label="Incorrect" value={selectedActivity.incorrect_count} />
                <DetailMetric icon={<Clock className="h-4 w-4" />} label="Avg. task duration" value={formatDuration(selectedActivity.avg_task_duration_ms)} />
                <DetailMetric icon={<Clock className="h-4 w-4" />} label="Avg. tutor response" value={formatDuration(selectedActivity.avg_tutor_response_ms)} />
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">
                Select a heatmap cell to inspect activity blockers.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function valueForState(activity: AnalyticsActivity, state: TaskState, studentCount: number) {
  const countByState: Record<TaskState, number> = {
    started: activity.started_count,
    done: activity.completed_count,
    verified: activity.verified_count,
    correct: activity.correct_count,
    pending: activity.pending_verification_count,
    incorrect: activity.incorrect_count,
  }
  const count = countByState[state]
  return {
    count,
    percent: studentCount > 0 ? Math.round((count / studentCount) * 100) : 0,
  }
}

function heatColor(percent: number) {
  const opacity = Math.max(0.08, Math.min(0.9, percent / 100))
  return `rgba(234, 137, 99, ${opacity})`
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      {children}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[#EA8963] bg-[#FFF3EB] text-[#A24E24]'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded ${color}`} />
      {label}
    </span>
  )
}

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}
