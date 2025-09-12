import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import React, { useEffect, useState } from 'react'
import useSWR from 'swr'
import Content from './Content'
import { ApiStudent, ApiExercise } from './shared'

type EditCourseAccessProps = {
  orgslug: string
  course_uuid?: string
}

function ManageCourseMembers(props: EditCourseAccessProps) {
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token
  const course = useCourse() as any
  const { isLoading, courseStructure } = course as any
  const dispatchCourse = useCourseDispatch() as any

  const tasks_page = 1
  const tasks_limit = 1000000000000 // Sloww ass code, fuck it
  const TASKS_URL = `${getAPIUrl()}tasks/list/page/${tasks_page}/limit/${tasks_limit}`
  const { data: tasks }: { data: ApiExercise[] } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))

  console.log('tasks', tasks)

  const { data: students }: { data: ApiStudent[] } = useSWR(
    courseStructure
      ? `${getAPIUrl()}courses/students/list?course_uuid=${courseStructure.course_uuid}`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>(
    undefined
  )

  useEffect(() => {
    if (!isLoading && courseStructure?.public !== undefined) {
      setIsClientPublic(courseStructure.public)
    }
  }, [isLoading, courseStructure])

  useEffect(() => {
    if (
      !isLoading &&
      courseStructure?.public !== undefined &&
      isClientPublic !== undefined
    ) {
      if (isClientPublic !== courseStructure.public) {
        dispatchCourse({ type: 'setIsNotSaved' })
        const updatedCourse = {
          ...courseStructure,
          public: isClientPublic,
        }
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
      }
    }
  }, [isLoading, isClientPublic, courseStructure, dispatchCourse])

  return (
    <div className="py-4 box-border overflow-hidden h-full bg-white">
        {
            courseStructure && students ? (<Content orgslug={props.orgslug} apiStudents={students} apiExercises={tasks}></Content>) : null
        }
    </div>
  )
}

export default ManageCourseMembers
