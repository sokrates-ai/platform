'use client'

import React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { GraduationCap } from 'lucide-react'
import { motion } from 'framer-motion'

import { CourseProvider } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { getCourseRoomMembers } from '@services/courses/rooms'
import { swrFetcher } from '@services/utils/ts/requests'

type TutorCoursePageProps = {
  params: {
    orgslug: string
    courseuuid: string
  }
}

type Room = {
  id: number
  name: string
  description?: string
  student_count?: number
  tutor_count?: number
}

type RoomMember = {
  user: any
  role: 'student' | 'tutor'
}

function TutorCoursePage({ params }: TutorCoursePageProps) {
  const courseUuid = `course_${params.courseuuid}`

  return (
    <div className="grid h-screen w-full grid-rows-[auto,1fr] overscroll-x-none bg-SokratesLightGray">
      <CourseProvider courseuuid={courseUuid}>
        <TutorCourseLayout params={params} courseUuid={courseUuid} />
      </CourseProvider>
    </div>
  )
}

export default TutorCoursePage

function TutorCourseLayout({
  params,
  courseUuid,
}: {
  params: TutorCoursePageProps['params']
  courseUuid: string
}) {
  const session = useSokratesSession() as any
  const { isCourseStaff, loading: courseStaffLoading } =
    useCourseStaffStatus() as any
  const accessToken = session?.data?.tokens?.access_token

  const roomsKey = accessToken
    ? `${getAPIUrl()}courses/${courseUuid}/rooms`
    : null
  const {
    data: rooms,
    error: roomsError,
    isLoading: roomsLoading,
  } = useSWR(roomsKey, (url: string) => swrFetcher(url, accessToken))

  const [membersByRoomId, setMembersByRoomId] = React.useState<
    Record<number, RoomMember[]>
  >({})
  const [membersErrors, setMembersErrors] = React.useState<
    Record<number, string>
  >({})
  const [membersLoading, setMembersLoading] = React.useState(false)

  React.useEffect(() => {
    if (!rooms || !accessToken) {
      setMembersByRoomId({})
      setMembersErrors({})
      setMembersLoading(false)
      return
    }

    let cancelled = false
    setMembersLoading(true)
    setMembersErrors({})

    Promise.all(
      rooms.map(async (room: Room) => {
        try {
          const response = await getCourseRoomMembers(
            courseUuid,
            room.id,
            accessToken,
          )
          if (!response.success) {
            return {
              roomId: room.id,
              members: [] as RoomMember[],
              error: response.HTTPmessage || 'Request failed',
            }
          }
          return { roomId: room.id, members: response.data as RoomMember[] }
        } catch (error: any) {
          return {
            roomId: room.id,
            members: [] as RoomMember[],
            error: error?.message ?? 'Request failed',
          }
        }
      }),
    )
      .then((results) => {
        if (cancelled) return
        const nextMembers: Record<number, RoomMember[]> = {}
        const nextErrors: Record<number, string> = {}
        results.forEach((result) => {
          nextMembers[result.roomId] = result.members
          if (result.error) {
            nextErrors[result.roomId] = result.error
          }
        })
        setMembersByRoomId(nextMembers)
        setMembersErrors(nextErrors)
      })
      .finally(() => {
        if (!cancelled) {
          setMembersLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [rooms, accessToken, courseUuid])

  const isAuthenticated = session?.status === 'authenticated'
  const isAuthorized = isAuthenticated && isCourseStaff

  const overviewParams = {
    orgslug: params.orgslug,
    courseuuid: params.courseuuid,
    subpage: 'tutor',
  }

  const roomMappings = React.useMemo(() => {
    if (!rooms) return []
    return rooms.map((room: Room) => {
      const members = membersByRoomId[room.id] ?? []
      return {
        room: {
          id: room.id,
          name: room.name,
          description: room.description ?? '',
        },
        tutors: members
          .filter((member) => member.role === 'tutor')
          .map((member) => member.user),
        students: members
          .filter((member) => member.role === 'student')
          .map((member) => member.user),
      }
    })
  }, [rooms, membersByRoomId])

  const debugPayload = {
    course_uuid: courseUuid,
    rooms: rooms ?? [],
    room_members: membersByRoomId,
    room_members_errors: membersErrors,
    room_mappings: roomMappings,
  }

  if (session?.status === 'loading' || courseStaffLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <PageLoading />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-md bg-white px-6 py-4 text-sm text-gray-700 shadow">
          You are not authorized to access this page.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="z-10 bg-SokratesWhite px-10 pt-[60px] text-sm tracking-tight shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
        <CourseOverviewTop params={overviewParams} />
        <div className="flex space-x-3 font-black text-sm">
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/tutor`}
            active
            icon={<GraduationCap size={16} />}
            label="Tutor"
          />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="h-full overflow-auto"
      >
        <div className="px-10 py-6">
          <div className="mb-4 rounded-md border border-dashed bg-white px-4 py-3 text-xs text-gray-600">
            {roomsLoading ? 'Loading rooms...' : null}
            {roomsError ? 'Failed to load rooms.' : null}
            {!roomsLoading && !roomsError && membersLoading
              ? 'Loading room members...'
              : null}
          </div>
          <div className="rounded-md border border-dashed bg-white p-4 font-mono text-xs text-gray-800">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(debugPayload, null, 2)}
            </pre>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function NavigationLink({
  href,
  active,
  icon,
  label,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link href={href}>
      <div
        className={`flex w-fit cursor-pointer space-x-4 border-SokratesBlackBoxShadow py-2 text-center transition-all ease-linear ${
          active ? 'border-b-4' : 'opacity-50'
        }`}
      >
        <div className="mx-2 flex items-center space-x-2.5">
          {icon}
          <div>{label}</div>
        </div>
      </div>
    </Link>
  )
}
