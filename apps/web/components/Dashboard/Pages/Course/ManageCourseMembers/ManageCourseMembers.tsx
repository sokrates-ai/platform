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
import GroupsContent from './GroupsContent'
import { ApiStudent, ApiExercise } from './shared'
import {
  CourseMemberGroup,
} from '@services/courses/member-groups'
import { CourseRoomRead } from '@services/courses/rooms'

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


  const { data: students }: { data: ApiStudent[] } = useSWR(
    courseStructure
      ? `${getAPIUrl()}courses/students/list?course_uuid=${courseStructure.course_uuid}`
      : null,
    (url: string) => swrFetcher(url, access_token)
  )
  const groupsUrl = courseStructure
    ? `${getAPIUrl()}courses/${courseStructure.course_uuid}/member-groups`
    : null
  const roomsUrl = courseStructure
    ? `${getAPIUrl()}courses/${courseStructure.course_uuid}/rooms`
    : null
  const { data: groups, mutate: mutateGroups }: { data: CourseMemberGroup[], mutate: () => Promise<CourseMemberGroup[] | undefined> } = useSWR(
    groupsUrl,
    (url: string) => swrFetcher(url, access_token)
  )
  const { data: rooms, mutate: mutateRooms }: { data: CourseRoomRead[], mutate: () => Promise<CourseRoomRead[] | undefined> } = useSWR(
    roomsUrl,
    (url: string) => swrFetcher(url, access_token)
  )
  const [activeView, setActiveView] = useState<'students' | 'groups'>('students')

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
      <div className="px-6 pb-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveView('students')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeView === 'students'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Students
          </button>
          <button
            type="button"
            onClick={() => setActiveView('groups')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeView === 'groups'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Groups
          </button>
        </div>
      </div>
      {activeView === 'students' && courseStructure && students ? (
        <Content
          orgslug={props.orgslug}
          apiStudents={students}
          apiExercises={tasks}
        ></Content>
      ) : null}
      {activeView === 'groups' && courseStructure && groups && rooms ? (
        <GroupsContent
          courseUuid={courseStructure.course_uuid}
          groups={groups}
          rooms={rooms}
          accessToken={access_token}
          onRefresh={async () => {
            await mutateGroups()
            await mutateRooms()
          }}
        />
      ) : null}
    </div>
  )
}

export default ManageCourseMembers
