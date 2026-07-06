'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { useCourse } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { ApiStudent } from '@components/Dashboard/Pages/Course/ManageCourseMembers/shared'
import { CourseTab } from '@components/Objects/Modals/Course/Create/CourseTabSelector'

export type ActivityStatusStep = {
  user_id: number
  activity_uuid: string
  complete: boolean
  tutor_verified: 'NONE' | 'CORRECT' | 'INCORRECT'
  creation_date?: string | null
  update_date?: string | null
  // Set when the student first marked the step complete.
  completed_date?: string | null
  // Set at the first tutor verification.
  verified_date?: string | null
}

export type Room = {
  id: number
  name: string
  student_count?: number
  tutor_count?: number
}

export type AnalyticsActivity = {
  activity_uuid: string
  name: string
  chapter_name: string
  tab_id: string
  tab_name: string
}

/**
 * Shared data-fetching for the course analytics sub-pages. Loads the students,
 * rooms and per-activity completion status once so every analytics view works
 * off the same source of truth.
 */
export function useAnalyticsData() {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const course = useCourse() as any
  const { courseStructure, isLoading: courseLoading } = course ?? {}

  const courseUuid = courseStructure?.course_uuid

  const tabs: CourseTab[] = useMemo(() => {
    const metadata =
      course?.courseTabMetadata ??
      courseStructure?.tabMetadata ??
      courseStructure?.tab_metadata ??
      []
    return Array.isArray(metadata) ? metadata : []
  }, [course?.courseTabMetadata, courseStructure])

  const { data: students } = useSWR<ApiStudent[]>(
    courseUuid
      ? `${getAPIUrl()}courses/students/list?course_uuid=${courseUuid}`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const { data: rooms } = useSWR<Room[]>(
    courseUuid ? `${getAPIUrl()}courses/${courseUuid}/rooms` : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const allActivities = useMemo<AnalyticsActivity[]>(() => {
    const store = courseStructure?.tabStore ?? courseStructure?.tab_store ?? {}
    const items: AnalyticsActivity[] = []
    const seen = new Set<string>()

    const tabMetadata = courseStructure?.tabMetadata ?? courseStructure?.tab_metadata ?? []

    Object.entries(store).forEach(([tabId, tabData]: [string, any]) => {
      const tabMeta = tabMetadata.find((t: any) => (t.id ?? t.tab_uuid) === tabId)
      const tabName = tabMeta?.name ?? tabId
      const chapters = tabData?.content?.chapters ?? []
      chapters.forEach((chapter: any) => {
        const chapterName = chapter?.name ?? 'Unnamed chapter'
        const activities = Array.isArray(chapter?.activities) ? chapter.activities : []
        activities.forEach((activity: any) => {
          const uuid = activity?.activity_uuid ?? activity?.activityUuid ?? activity?.uuid
          if (!uuid || seen.has(uuid)) return
          seen.add(uuid)
          items.push({
            activity_uuid: uuid.startsWith('activity_') ? uuid : `activity_${uuid}`,
            name: activity?.name ?? 'Unnamed',
            chapter_name: chapterName,
            tab_id: tabId,
            tab_name: tabName,
          })
        })
      })
    })
    return items
  }, [courseStructure])

  const firstRoomId = rooms?.[0]?.id
  const activityUuids = useMemo(
    () => allActivities.map((a) => a.activity_uuid),
    [allActivities]
  )

  const { data: activityStatusData } = useSWR(
    firstRoomId && activityUuids.length > 0
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${firstRoomId}/activity-status?activity_uuids=${encodeURIComponent(activityUuids.join(','))}`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const activitySteps: ActivityStatusStep[] = activityStatusData?.steps ?? []

  return {
    courseLoading: Boolean(courseLoading),
    courseUuid,
    tabs,
    students,
    rooms,
    allActivities,
    activitySteps,
  }
}
