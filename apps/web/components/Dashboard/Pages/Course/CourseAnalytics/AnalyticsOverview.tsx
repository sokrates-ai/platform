'use client'

import React from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Timer,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

type AnalyticsOverviewProps = {
  analytics: CourseAnalyticsData
}

export default function AnalyticsOverview({ analytics }: AnalyticsOverviewProps) {
  const summary = analytics.summary
  const topAttention = analytics.attention.slice(0, 6)
  const tabCompletionData = analytics.tabs
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((tab) => ({
      name: tab.name.length > 20 ? `${tab.name.slice(0, 18)}...` : tab.name,
      fullName: tab.name,
      rate: tab.completion_rate,
      completed: tab.completed_count,
      total: tab.student_count * tab.activity_count,
    }))
  const students = analytics.students
    .slice()
    .sort((a, b) => a.completion_rate - b.completion_rate)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={<Users size={20} />}
          label="Enrolled Students"
          value={summary.student_count}
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={<BookOpen size={20} />}
          label="Activities"
          value={summary.activity_count}
          color="bg-purple-50 text-purple-600"
        />
        <SummaryCard
          icon={<CheckCircle2 size={20} />}
          label="Completion Rate"
          value={`${summary.completion_rate}%`}
          color="bg-green-50 text-green-600"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} />}
          label="Pending Verification"
          value={summary.pending_verification_count}
          color="bg-amber-50 text-amber-600"
        />
        <SummaryCard
          icon={<Clock size={20} />}
          label="Avg. Task Duration"
          value={formatDuration(summary.avg_task_duration_ms)}
          color="bg-teal-50 text-teal-600"
        />
        <SummaryCard
          icon={<Timer size={20} />}
          label="Avg. Tutor Response"
          value={formatDuration(summary.avg_tutor_response_ms)}
          color="bg-rose-50 text-rose-600"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Needs Attention</h3>
            <span className="text-xs text-gray-400">{analytics.attention.length} findings</span>
          </div>
          {topAttention.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {topAttention.map((item) => (
                <div
                  key={`${item.kind}-${item.scope}-${item.ref_id}`}
                  className="rounded-md border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.message}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        item.severity === 'high'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {item.scope}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No blockers detected.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
                            <p className="text-sm font-medium">{row.fullName}</p>
                            <p className="text-xs text-gray-500">
                              {row.completed}/{row.total} completions ({row.rate}%)
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {tabCompletionData.map((_, index) => (
                        <Cell key={index} fill={index % 2 === 0 ? '#EA8963' : '#F4A77D'} />
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

        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Verification Queue</h3>
            <div className="space-y-4">
              <MetricLine label="Pending" value={summary.pending_verification_count} color="bg-amber-500" />
              <MetricLine label="Incorrect" value={summary.incorrect_count} color="bg-red-500" />
              <MetricLine label="Correct" value={summary.correct_count} color="bg-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Students Needing Review</h3>
          {students.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead className="text-center">Activities</TableHead>
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
                      <TableCell className="text-center text-xs text-gray-600">
                        {student.completed_count}/{student.activity_count}
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
    </div>
  )
}

function MetricLine({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: value > 0 ? '100%' : '0%' }} />
      </div>
    </div>
  )
}
