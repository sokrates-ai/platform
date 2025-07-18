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
}

const CourseClient = ({
  courseuuid,
  orgslug,
  course,
  selectedChapterId,
}: Props) => {
  return courseIsStarted(course) ? (
    <CourseStartedView
      courseuuid={courseuuid}
      orgslug={orgslug}
      course={course}
      selectedChapterId={selectedChapterId}
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
