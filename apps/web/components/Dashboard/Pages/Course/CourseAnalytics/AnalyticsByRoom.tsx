'use client'

import React, { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
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
import { Users, GraduationCap, CheckCircle2, Eye, Clock, Timer } from 'lucide-react'
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
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import {
  AnalyticsActivity,
  ActivityStatusStep,
  Room,
} from './useAnalyticsData'
import { SummaryCard } from './SummaryCard'
import { avgTaskDurationMs, avgTutorResponseMs, formatDuration } from './analyticsMetrics'

type RoomMember = {
  user: {
    id: number
    first_name?: string
    last_name?: string
    username?: string
    email?: string
  }
  role: 'student' | 'tutor'
}

type AnalyticsByRoomProps = {
  rooms?: Room[]
  courseUuid?: string
  allActivities: AnalyticsActivity[]
}

export default function AnalyticsByRoom({
  rooms,
  courseUuid,
  allActivities,
}: AnalyticsByRoomProps) {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token

  const roomList = useMemo(() => rooms ?? [], [rooms])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
    roomList[0]?.id ?? null
  )

  // Keep the selection valid as rooms load / change.
  useEffect(() => {
    if (roomList.length === 0) {
      setSelectedRoomId(null)
      return
    }
    if (!roomList.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(roomList[0].id)
    }
  }, [roomList, selectedRoomId])

  const selectedRoom = roomList.find((r) => r.id === selectedRoomId)

  const activityUuids = useMemo(
    () => allActivities.map((a) => a.activity_uuid),
    [allActivities]
  )

  const { data: members } = useSWR<RoomMember[]>(
    courseUuid && selectedRoomId != null
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${selectedRoomId}/members`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const { data: activityStatusData } = useSWR(
    courseUuid && selectedRoomId != null && activityUuids.length > 0
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${selectedRoomId}/activity-status?activity_uuids=${encodeURIComponent(activityUuids.join(','))}`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const roomSteps: ActivityStatusStep[] = activityStatusData?.steps ?? []

  const roomStudents = useMemo(
    () => (members ?? []).filter((m) => m.role === 'student'),
    [members]
  )

  const stats = useMemo(() => {
    const studentCount = selectedRoom?.student_count ?? roomStudents.length
    const tutorCount = selectedRoom?.tutor_count ?? 0
    const totalActivities = allActivities.length
    const completedSteps = roomSteps.filter((s) => s.complete).length
    const totalPossible = studentCount * totalActivities
    const completionRate = totalPossible > 0 ? Math.round((completedSteps / totalPossible) * 100) : 0
    const engagedStudents = new Set(roomSteps.map((s) => s.user_id)).size
    const avgTaskDuration = avgTaskDurationMs(roomSteps)
    const avgTutorResponse = avgTutorResponseMs(roomSteps)

    return { studentCount, tutorCount, completionRate, engagedStudents, avgTaskDuration, avgTutorResponse }
  }, [selectedRoom, roomStudents, allActivities, roomSteps])

  const tabCompletionData = useMemo(() => {
    const tabMap = new Map<string, { name: string; total: number; completed: number }>()
    const studentCount = stats.studentCount
    allActivities.forEach((activity) => {
      const key = activity.tab_id
      if (!tabMap.has(key)) tabMap.set(key, { name: activity.tab_name, total: 0, completed: 0 })
      const entry = tabMap.get(key)!
      entry.total += studentCount
      entry.completed += roomSteps.filter(
        (s) => s.activity_uuid === activity.activity_uuid && s.complete
      ).length
    })
    return Array.from(tabMap.values()).map((data) => ({
      name: data.name.length > 20 ? data.name.slice(0, 18) + '...' : data.name,
      fullName: data.name,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      completed: data.completed,
      total: data.total,
    }))
  }, [allActivities, roomSteps, stats.studentCount])

  const studentTableData = useMemo(() => {
    const total = allActivities.length
    return roomStudents.map((member) => {
      const user = member.user
      const studentSteps = roomSteps.filter((s) => s.user_id === user.id)
      const completed = studentSteps.filter((s) => s.complete).length
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.username ||
        user.email ||
        `User ${user.id}`
      return { id: user.id, name, completed, total, rate }
    }).sort((a, b) => b.rate - a.rate)
  }, [roomStudents, roomSteps, allActivities])

  return (
    <div className="flex h-full gap-6">
      {/* Left room navigation */}
      <Card className="h-full w-80 shrink-0">
        <CardContent className="h-full overflow-y-auto px-3 py-4">
          {roomList.length > 0 ? (
            <div className="flex flex-col gap-2">
              {roomList.map((room) => {
                const active = room.id === selectedRoomId
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[#EA8963] bg-[#EA8963]/5 ring-1 ring-[#EA8963]/30'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{room.name}</span>
                    <span className="mt-0.5 text-xs text-gray-500">
                      {room.student_count ?? 0} students · {room.tutor_count ?? 0} tutors
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No rooms available</p>
          )}
        </CardContent>
      </Card>

      {/* Per-room analytics */}
      <div className="flex-1 space-y-6 overflow-y-auto">
        {selectedRoom ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedRoom.name}</h2>
              <p className="text-sm text-gray-500">
                Engagement and completion for students in this room.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                icon={<Users size={20} />}
                label="Students"
                value={stats.studentCount}
                color="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                icon={<GraduationCap size={20} />}
                label="Tutors"
                value={stats.tutorCount}
                color="bg-indigo-50 text-indigo-600"
              />
              <SummaryCard
                icon={<Eye size={20} />}
                label="Students Engaged"
                value={`${stats.engagedStudents}/${stats.studentCount}`}
                color="bg-amber-50 text-amber-600"
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

            {/* Completion by tab (within this room) */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Completion by Tab</h3>
                {tabCompletionData.length > 0 ? (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tabCompletionData} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
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
                          {tabCompletionData.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? '#EA8963' : '#F4A77D'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-gray-400">No tab data available</p>
                )}
              </CardContent>
            </Card>

            {/* Per-student table */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Student Progress</h3>
                {studentTableData.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead className="text-center">Activities</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentTableData.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={student.rate} className="h-2 w-20" />
                                <span className="text-xs text-gray-500">{student.rate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs text-gray-600">
                              {student.completed}/{student.total}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">No students in this room</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-gray-400">
            Select a room to view its analytics.
          </p>
        )}
      </div>
    </div>
  )
}
