'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Eye, GraduationCap, Timer, Users } from 'lucide-react'
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
import { SummaryCard } from './SummaryCard'
import { CourseAnalyticsData } from './useAnalyticsData'
import { formatDuration } from './analyticsMetrics'

type AnalyticsByRoomProps = {
  analytics: CourseAnalyticsData
}

export default function AnalyticsByRoom({ analytics }: AnalyticsByRoomProps) {
  const roomList = useMemo(() => analytics.rooms, [analytics.rooms])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(roomList[0]?.id ?? null)

  useEffect(() => {
    if (!roomList.length) {
      setSelectedRoomId(null)
      return
    }
    if (!roomList.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(roomList[0].id)
    }
  }, [roomList, selectedRoomId])

  const selectedRoom = roomList.find((room) => room.id === selectedRoomId)
  const roomAttention = analytics.attention.filter(
    (item) => item.scope === 'room' && item.ref_id === String(selectedRoomId),
  )
  const students = analytics.students
    .filter((student) => selectedRoom?.student_ids.includes(student.id))
    .sort((a, b) => a.completion_rate - b.completion_rate)

  return (
    <div className="flex h-full gap-6">
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
                      {room.student_count} students · {room.tutor_count} tutors · {room.completion_rate}%
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

      <div className="flex-1 space-y-6 overflow-y-auto">
        {selectedRoom ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedRoom.name}</h2>
              <p className="text-sm text-gray-500">
                Room-level completion and review blockers.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                icon={<Users size={20} />}
                label="Students"
                value={selectedRoom.student_count}
                color="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                icon={<GraduationCap size={20} />}
                label="Tutors"
                value={selectedRoom.tutor_count}
                color="bg-indigo-50 text-indigo-600"
              />
              <SummaryCard
                icon={<Eye size={20} />}
                label="Students Engaged"
                value={`${selectedRoom.engaged_student_count}/${selectedRoom.student_count}`}
                color="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                icon={<CheckCircle2 size={20} />}
                label="Completion Rate"
                value={`${selectedRoom.completion_rate}%`}
                color="bg-green-50 text-green-600"
              />
              <SummaryCard
                icon={<Clock size={20} />}
                label="Avg. Task Duration"
                value={formatDuration(selectedRoom.avg_task_duration_ms)}
                color="bg-teal-50 text-teal-600"
              />
              <SummaryCard
                icon={<Timer size={20} />}
                label="Avg. Tutor Response"
                value={formatDuration(selectedRoom.avg_tutor_response_ms)}
                color="bg-rose-50 text-rose-600"
              />
            </div>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Room Attention</h3>
                {roomAttention.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {roomAttention.map((item) => (
                      <div
                        key={`${item.kind}-${item.ref_id}`}
                        className="rounded-md border border-gray-200 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">No room blockers detected.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Room Students</h3>
                {students.length > 0 ? (
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Completion</TableHead>
                          <TableHead className="text-center">Pending</TableHead>
                          <TableHead className="text-center">Incorrect</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-xs text-gray-400">{student.email}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={student.completion_rate} className="h-2 w-24" />
                                <span className="text-xs text-gray-500">{student.completion_rate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs text-amber-600">
                              {student.pending_verification_count}
                            </TableCell>
                            <TableCell className="text-center text-xs text-red-500">
                              {student.incorrect_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">No student data available</p>
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
