'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { courseIsStarted } from '@components/Objects/Courses/CourseActions/CoursesActions'
import CourseIntroView   from './courseIntroView'
import PageLoading from '@components/Objects/Loaders/PageLoading'

const CourseStartedView = dynamic(() => import('./courseStartedView'), {
  loading: () => <PageLoading />,
})

type Props = {
  courseuuid: string
  orgslug: string
  course: any
  selectedChapterId: number | null
  selectedTabId: string | null
}

const CourseClient = ({
  courseuuid,
  orgslug,
  course,
  selectedChapterId,
  selectedTabId,
}: Props) => {
  return courseIsStarted(course) ? (
    <CourseStartedView
      courseuuid={courseuuid}
      orgslug={orgslug}
      course={course}
      selectedChapterId={selectedChapterId}
      selectedTabId={selectedTabId}
    />
  ) : (
    <CourseIntroView
      courseuuid={courseuuid}
      orgslug={orgslug}
      course={course}
    />
  )
}

export default CourseClient
