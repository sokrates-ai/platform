'use client'

import React, { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CourseTab } from '@components/Objects/Modals/Course/Create/CourseTabSelector'
import { ApiStudent } from '@components/Dashboard/Pages/Course/ManageCourseMembers/shared'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { AnalyticsActivity, ActivityStatusStep, Room } from './useAnalyticsData'

type AnalyticsMatrixProps = {
  courseUuid?: string
  tabs: CourseTab[]
  rooms?: Room[]
  students?: ApiStudent[]
  allActivities: AnalyticsActivity[]
}

type TaskState = 'seen' | 'done' | 'verified' | 'correct'

const TASK_STATES: { id: TaskState; label: string }[] = [
  { id: 'seen', label: 'Seen' },
  { id: 'done', label: 'Done' },
  { id: 'verified', label: 'Verified' },
  { id: 'correct', label: 'Correct' },
]

// Cumulative predicates: each state counts students who reached *at least* it.
const STATE_PREDICATES: Record<TaskState, (step: ActivityStatusStep) => boolean> = {
  seen: () => true,
  done: (step) => step.complete,
  verified: (step) => step.tutor_verified !== 'NONE',
  correct: (step) => step.tutor_verified === 'CORRECT',
}

const ALL_ROOMS = 'all'

const normalizeUuid = (uuid: string) =>
  uuid.startsWith('activity_') ? uuid : `activity_${uuid}`

export default function AnalyticsMatrix({
  courseUuid,
  tabs,
  rooms,
  students,
  allActivities,
}: AnalyticsMatrixProps) {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token

  const [selectedState, setSelectedState] = useState<TaskState>('done')
  const [selectedRoomId, setSelectedRoomId] = useState<number | typeof ALL_ROOMS>(
    ALL_ROOMS
  )

  const roomList = useMemo(() => rooms ?? [], [rooms])

  // Keep the room selection valid as rooms load / change.
  useEffect(() => {
    if (
      selectedRoomId !== ALL_ROOMS &&
      !roomList.some((r) => r.id === selectedRoomId)
    ) {
      setSelectedRoomId(ALL_ROOMS)
    }
  }, [roomList, selectedRoomId])

  const activityUuids = useMemo(
    () => allActivities.map((a) => a.activity_uuid),
    [allActivities]
  )

  const statusKey =
    courseUuid && activityUuids.length > 0
      ? selectedRoomId === ALL_ROOMS
        ? `${getAPIUrl()}courses/${courseUuid}/activity-status?activity_uuids=${encodeURIComponent(activityUuids.join(','))}`
        : `${getAPIUrl()}courses/${courseUuid}/rooms/${selectedRoomId}/activity-status?activity_uuids=${encodeURIComponent(activityUuids.join(','))}`
      : null

  const { data: statusData, isLoading: statusLoading } = useSWR(
    statusKey,
    (url: string) => swrFetcher(url, access_token)
  )

  const steps: ActivityStatusStep[] = statusData?.steps ?? []

  const studentCount = useMemo(() => {
    if (selectedRoomId === ALL_ROOMS) return students?.length ?? 0
    return roomList.find((r) => r.id === selectedRoomId)?.student_count ?? 0
  }, [selectedRoomId, students, roomList])

  const sortedTabs = useMemo(
    () => [...tabs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [tabs]
  )

  const activitiesByTab = useMemo(() => {
    const map = new Map<string, AnalyticsActivity[]>()
    allActivities.forEach((activity) => {
      const list = map.get(activity.tab_id) ?? []
      list.push(activity)
      map.set(activity.tab_id, list)
    })
    return map
  }, [allActivities])

  const maxTasks = useMemo(
    () =>
      sortedTabs.reduce(
        (max, tab) => Math.max(max, activitiesByTab.get(tab.id)?.length ?? 0),
        0
      ),
    [sortedTabs, activitiesByTab]
  )

  const stepsByActivity = useMemo(() => {
    const map = new Map<string, ActivityStatusStep[]>()
    steps.forEach((step) => {
      const uuid = normalizeUuid(step.activity_uuid)
      const list = map.get(uuid) ?? []
      list.push(step)
      map.set(uuid, list)
    })
    return map
  }, [steps])

  const matrix = useMemo(() => {
    const predicate = STATE_PREDICATES[selectedState]
    return sortedTabs.map((tab) => {
      const tabActivities = activitiesByTab.get(tab.id) ?? []
      const cells = tabActivities.map((activity) => {
        const activitySteps = stepsByActivity.get(activity.activity_uuid) ?? []
        const matching = new Set(
          activitySteps.filter(predicate).map((s) => s.user_id)
        ).size
        const percent =
          studentCount > 0 ? Math.round((matching / studentCount) * 100) : 0
        return {
          activity,
          matching,
          percent,
        }
      })
      return { tab, cells }
    })
  }, [sortedTabs, activitiesByTab, stepsByActivity, selectedState, studentCount])

  if (sortedTabs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        No tabs available for this course.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter rows */}
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
          {roomList.map((room) => (
            <FilterPill
              key={room.id}
              label={room.name}
              active={selectedRoomId === room.id}
              onClick={() => setSelectedRoomId(room.id)}
            />
          ))}
        </FilterRow>
      </div>

      {/* Matrix */}
      <Card>
        <CardContent className="pt-6">
          {statusLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : studentCount === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No students found for this selection.
            </p>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <table className="border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 border-b border-r border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700">
                      Tab
                    </th>
                    {Array.from({ length: maxTasks }, (_, i) => (
                      <th
                        key={i}
                        className="sticky top-0 z-10 min-w-[52px] border-b border-gray-200 bg-white px-2 py-2 text-center font-semibold text-gray-700"
                      >
                        A{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(({ tab, cells }) => (
                    <tr key={tab.id}>
                      <td className="sticky left-0 z-10 max-w-[220px] truncate border-b border-r border-gray-200 bg-white px-3 py-2 font-medium text-gray-800">
                        {tab.name}
                      </td>
                      {Array.from({ length: maxTasks }, (_, i) => {
                        const cell = cells[i]
                        if (!cell) {
                          return (
                            <td
                              key={i}
                              className="border-b border-gray-100 px-2 py-2 text-center text-gray-300"
                            >
                              –
                            </td>
                          )
                        }
                        return (
                          <td
                            key={i}
                            title={`${cell.activity.name}\n${cell.matching}/${studentCount} students`}
                            className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-800"
                            style={{
                              backgroundColor: `rgba(234, 137, 99, ${(cell.percent / 100) * 0.85})`,
                            }}
                          >
                            {cell.percent}%
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
    </div>
  )
}

function FilterRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
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
