'use client'

import useSWR from 'swr'
import { useCourse } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'

export type AnalyticsMetricSummary = {
  student_count: number
  activity_count: number
  started_count: number
  completed_count: number
  verified_count: number
  correct_count: number
  incorrect_count: number
  pending_verification_count: number
  engaged_student_count: number
  completion_rate: number
  engagement_rate: number
  avg_task_duration_ms: number | null
  avg_tutor_response_ms: number | null
}

export type AnalyticsActivity = AnalyticsMetricSummary & {
  activity_uuid: string
  name: string
  chapter_name: string
  tab_id: string
  tab_name: string
  tab_position: number
  chapter_position: number
  activity_position: number
  last_activity_at: string | null
}

export type AnalyticsTab = AnalyticsMetricSummary & {
  tab_id: string
  name: string
  position: number
}

export type AnalyticsRoom = AnalyticsMetricSummary & {
  id: number
  name: string
  tutor_count: number
  student_ids: number[]
  activities: AnalyticsActivity[]
}

export type AnalyticsStudent = AnalyticsMetricSummary & {
  id: number
  name: string
  email: string
  last_activity_at: string | null
}

export type AnalyticsAttentionItem = {
  kind: string
  scope: 'activity' | 'tab' | 'room' | string
  ref_id: string
  label: string
  severity: 'high' | 'medium' | 'low' | string
  metric: number
  message: string
}

export type CourseAnalyticsData = {
  course_uuid: string
  summary: AnalyticsMetricSummary
  tabs: AnalyticsTab[]
  rooms: AnalyticsRoom[]
  activities: AnalyticsActivity[]
  students: AnalyticsStudent[]
  matrix: { rows: Array<{ tab_id: string; name: string; cells: AnalyticsActivity[] }> }
  attention: AnalyticsAttentionItem[]
  thresholds: {
    low_completion_rate: number
    slow_task_ms: number
    slow_response_ms: number
  }
}

export function useAnalyticsData() {
  const session = useSokratesSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const course = useCourse() as any
  const courseUuid = course?.courseStructure?.course_uuid

  const { data, error, isLoading } = useSWR<CourseAnalyticsData>(
    courseUuid ? `${getAPIUrl()}courses/${courseUuid}/analytics` : null,
    (url: string) => swrFetcher(url, accessToken),
  )

  return {
    courseLoading: Boolean(course?.isLoading),
    isLoading,
    error,
    data,
  }
}
