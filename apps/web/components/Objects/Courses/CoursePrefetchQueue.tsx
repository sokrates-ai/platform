'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  canPrefetchFullCourse,
  prefetchCourseExperience,
  scheduleIdleTask,
} from '@services/performance/coursePrefetch'

type CoursePrefetchQueueProps = {
  courses: any[]
  orgslug: string
  accessToken?: string
}

const CoursePrefetchQueue = ({
  courses,
  orgslug,
  accessToken,
}: CoursePrefetchQueueProps) => {
  const router = useRouter()
  const session = useSokratesSession() as any
  const sessionAccessToken = session?.data?.tokens?.access_token
  const effectiveAccessToken = accessToken ?? sessionAccessToken

  useEffect(() => {
    if (!canPrefetchFullCourse() || courses.length === 0) return

    let cancelled = false
    let releaseIdleTask: () => void = () => undefined

    const runQueue = async () => {
      for (const course of courses) {
        if (cancelled) return

        const courseUuid = course?.course_uuid
        if (typeof courseUuid !== 'string') continue

        const coursePath = `/course/${courseUuid.replace('course_', '')}`
        router.prefetch(getUriWithOrg(orgslug, coursePath))
        await prefetchCourseExperience(courseUuid, effectiveAccessToken, true)
      }
    }

    releaseIdleTask = scheduleIdleTask(() => {
      void runQueue()
    })

    return () => {
      cancelled = true
      releaseIdleTask()
    }
  }, [courses, effectiveAccessToken, orgslug, router])

  return null
}

export default CoursePrefetchQueue
