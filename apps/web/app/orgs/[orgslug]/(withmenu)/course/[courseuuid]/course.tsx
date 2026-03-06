'use client'

import React from 'react'
import { courseIsStarted } from '@components/Objects/Courses/CourseActions/CoursesActions'
import CourseStartedView from './courseStartedView'
import CourseIntroView   from './courseIntroView'

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
