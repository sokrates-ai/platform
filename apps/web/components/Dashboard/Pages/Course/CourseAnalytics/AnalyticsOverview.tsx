'use client'

import React, { useMemo } from 'react'
import {
  Users,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Clock,
  Timer,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
  PieChart,
  Pie,
  Line,
  LineChart,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ApiStudent, ExerciseLog } from '@components/Dashboard/Pages/Course/ManageCourseMembers/shared'
import { AnalyticsActivity, ActivityStatusStep } from './useAnalyticsData'
import { SummaryCard } from './SummaryCard'
import { avgTaskDurationMs, avgTutorResponseMs, formatDuration } from './analyticsMetrics'

type AnalyticsOverviewProps = {
  students?: ApiStudent[]
  allActivities: AnalyticsActivity[]
  activitySteps: ActivityStatusStep[]
}

export default function AnalyticsOverview({
  students,
  allActivities,
  activitySteps,
}: AnalyticsOverviewProps) {
  const stats = useMemo(() => {
    const totalStudents = students?.length ?? 0
    const totalActivities = allActivities.length
    const totalPossible = totalStudents * totalActivities
    const completedSteps = activitySteps.filter((s) => s.complete).length
    const completionRate = totalPossible > 0 ? Math.round((completedSteps / totalPossible) * 100) : 0
    const verifiedCorrect = activitySteps.filter((s) => s.tutor_verified === 'CORRECT').length
    const verifiedIncorrect = activitySteps.filter((s) => s.tutor_verified === 'INCORRECT').length

    const avgExercises = totalStudents > 0
      ? Math.round((students?.reduce((sum, s) => sum + (s.log?.length ?? 0), 0) ?? 0) / totalStudents)
      : 0

    const avgTaskDuration = avgTaskDurationMs(activitySteps)
    const avgTutorResponse = avgTutorResponseMs(activitySteps)

    return { totalStudents, totalActivities, completionRate, completedSteps, totalPossible, verifiedCorrect, verifiedIncorrect, avgExercises, avgTaskDuration, avgTutorResponse }
  }, [students, allActivities, activitySteps])

  const tabCompletionData = useMemo(() => {
    const tabMap = new Map<string, { name: string; total: number; completed: number }>()

    allActivities.forEach((activity) => {
      const key = activity.tab_id
      if (!tabMap.has(key)) tabMap.set(key, { name: activity.tab_name, total: 0, completed: 0 })
      const entry = tabMap.get(key)!
      const studentCount = students?.length ?? 0
      entry.total += studentCount
      const completedForActivity = activitySteps.filter(
        (s) => s.activity_uuid === activity.activity_uuid && s.complete
      ).length
      entry.completed += completedForActivity
    })

    return Array.from(tabMap.values()).map((data) => ({
      name: data.name.length > 20 ? data.name.slice(0, 18) + '...' : data.name,
      fullName: data.name,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      completed: data.completed,
      total: data.total,
    }))
  }, [allActivities, activitySteps, students])

  const verificationData = useMemo(() => {
    const unverified = activitySteps.filter((s) => s.complete && s.tutor_verified === 'NONE').length
    return [
      { name: 'Correct', value: stats.verifiedCorrect, color: '#22c55e' },
      { name: 'Incorrect', value: stats.verifiedIncorrect, color: '#ef4444' },
      { name: 'Pending', value: unverified, color: '#f59e0b' },
    ].filter((d) => d.value > 0)
  }, [activitySteps, stats])

  const studentTableData = useMemo(() => {
    if (!students) return []
    return students.map((student) => {
      const studentSteps = activitySteps.filter((s) => s.user_id === student.id)
      const completed = studentSteps.filter((s) => s.complete).length
      const total = allActivities.length
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0
      const exerciseCount = student.log?.length ?? 0
      const exerciseSuccess = exerciseCount > 0
        ? Math.round((student.log.filter((l: ExerciseLog) => l.correct).length / exerciseCount) * 100)
        : 0
      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`.trim() || student.email,
        completed,
        total,
        rate,
        exerciseCount,
        exerciseSuccess,
        level: student.level,
        coins: student.coins,
      }
    }).sort((a, b) => b.rate - a.rate)
  }, [students, activitySteps, allActivities])

  const exerciseTimelineData = useMemo(() => {
    if (!students) return []
    const dayMap = new Map<string, { total: number; correct: number }>()
    students.forEach((student) => {
      (student.log ?? []).forEach((entry: ExerciseLog) => {
        const day = entry.date?.split('T')[0]
        if (!day) return
        if (!dayMap.has(day)) dayMap.set(day, { total: 0, correct: 0 })
        const d = dayMap.get(day)!
        d.total++
        if (entry.correct) d.correct++
      })
    })
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, data]) => ({
        date: date.slice(5),
        attempts: data.total,
        correct: data.correct,
      }))
  }, [students])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={<Users size={20} />}
          label="Enrolled Students"
          value={stats.totalStudents}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={<BookOpen size={20} />}
          label="Activities"
          value={stats.totalActivities}
          color="bg-purple-50 text-purple-600"
        />
        <SummaryCard
          icon={<CheckCircle2 size={20} />}
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          label="Avg. Exercises/Student"
          value={stats.avgExercises}
          color="bg-amber-50 text-amber-600"
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chapter Completion Bar Chart */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Completion by Tab</h3>
            {tabCompletionData.length > 0 ? (
              <div className="h-[280px]">
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

        {/* Verification Pie Chart */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Verification Status</h3>
            {verificationData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verificationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {verificationData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                            <p className="text-sm font-medium">{d.name}: {d.value}</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4">
                  {verificationData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">No verification data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exercise Timeline */}
      {exerciseTimelineData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Exercise Activity (Last 30 Days)</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exerciseTimelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                          <p className="text-xs font-medium text-gray-700">{label}</p>
                          <p className="text-xs text-gray-500">Attempts: {payload[0]?.value}</p>
                          <p className="text-xs text-green-600">Correct: {payload[1]?.value}</p>
                        </div>
                      )
                    }}
                  />
                  <Line type="monotone" dataKey="attempts" stroke="#EA8963" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="correct" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 rounded bg-[#EA8963]" />
                  <span className="text-xs text-gray-600">Attempts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 rounded bg-[#22c55e]" />
                  <span className="text-xs text-gray-600">Correct</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Progress Table */}
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
                    <TableHead className="text-center">Exercises</TableHead>
                    <TableHead className="text-center">Success Rate</TableHead>
                    <TableHead className="text-center">Level</TableHead>
                    <TableHead className="text-center">Coins</TableHead>
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
                      <TableCell className="text-center text-xs text-gray-600">
                        {student.exerciseCount}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-medium ${
                          student.exerciseSuccess >= 70 ? 'text-green-600' :
                          student.exerciseSuccess >= 40 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {student.exerciseCount > 0 ? `${student.exerciseSuccess}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-600">
                        {student.level}
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-600">
                        {student.coins}
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
    </div>
  )
}
