'use client'

import React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { GraduationCap, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'

import { CourseProvider } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import { Button } from '@components/ui/button'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import {
  clearTutorRoomSelection,
  setTutorRoomSelection,
} from '@services/courses/rooms'
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
  user: {
    id: number
    username: string
    first_name?: string
    last_name?: string
    email?: string
  }
  role: 'student' | 'tutor'
}

type TutorRoomSelection = {
  room_id: number | null
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
    ? `${getAPIUrl()}courses/${courseUuid}/rooms/manageable`
    : null
  const selectionKey = accessToken
    ? `${getAPIUrl()}courses/${courseUuid}/tutor-room-selection`
    : null

  const {
    data: rooms,
    error: roomsError,
    isLoading: roomsLoading,
  } = useSWR(roomsKey, (url: string) => swrFetcher(url, accessToken))
  const {
    data: selection,
    error: selectionError,
    isLoading: selectionLoading,
    mutate: mutateSelection,
  } = useSWR(selectionKey, (url: string) => swrFetcher(url, accessToken))

  const [actionError, setActionError] = React.useState<string | null>(null)
  const [pendingRoomId, setPendingRoomId] = React.useState<number | null>(null)
  const [isSwitching, setIsSwitching] = React.useState(false)
  const [invalidSelectionNotice, setInvalidSelectionNotice] =
    React.useState<string | null>(null)
  const hasAttemptedInvalidClear = React.useRef(false)

  const isAuthenticated = session?.status === 'authenticated'
  const isAuthorized = isAuthenticated && isCourseStaff

  const selectionRoomId = (selection as TutorRoomSelection | undefined)?.room_id
  const selectedRoom = rooms?.find((room: Room) => room.id === selectionRoomId)
  const hasSelection = Boolean(selectionRoomId && selectedRoom)

  const membersKey =
    hasSelection && accessToken && selectedRoom
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${selectedRoom.id}/members`
      : null
  const {
    data: roomMembers,
    error: roomMembersError,
    isLoading: roomMembersLoading,
  } = useSWR(membersKey, (url: string) => swrFetcher(url, accessToken))

  React.useEffect(() => {
    if (hasSelection) {
      setInvalidSelectionNotice(null)
    }
  }, [hasSelection])

  React.useEffect(() => {
    if (!selectionRoomId || !rooms || selectedRoom || isSwitching) return
    if (!accessToken) return
    if (hasAttemptedInvalidClear.current) return

    setInvalidSelectionNotice(
      'Your previously selected room is no longer available. Please select a new room.'
    )
    setIsSwitching(true)
    hasAttemptedInvalidClear.current = true
    clearTutorRoomSelection(courseUuid, accessToken)
      .then((response) => {
        if (response.success) {
          mutateSelection({ room_id: null }, false)
        } else {
          setActionError(
            response.HTTPmessage || 'Unable to clear the invalid selection.'
          )
        }
      })
      .catch((error: any) => {
        setActionError(
          error?.message || 'Unable to clear the invalid selection.'
        )
      })
      .finally(() => {
        setIsSwitching(false)
      })
  }, [
    accessToken,
    courseUuid,
    isSwitching,
    mutateSelection,
    rooms,
    selectedRoom,
    selectionRoomId,
  ])

  const handleSelectRoom = async (roomId: number) => {
    if (!accessToken) return
    setActionError(null)
    setPendingRoomId(roomId)
    try {
      const response = await setTutorRoomSelection(
        courseUuid,
        roomId,
        accessToken
      )
      if (response.success) {
        mutateSelection({ room_id: roomId }, false)
      } else {
        setActionError(response.HTTPmessage || 'Unable to select room.')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Unable to select room.')
    } finally {
      setPendingRoomId(null)
    }
  }

  const handleSwitchRoom = async () => {
    if (!accessToken) return
    setActionError(null)
    setIsSwitching(true)
    try {
      const response = await clearTutorRoomSelection(courseUuid, accessToken)
      if (response.success) {
        mutateSelection({ room_id: null }, false)
      } else {
        setActionError(response.HTTPmessage || 'Unable to switch rooms.')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Unable to switch rooms.')
    } finally {
      setIsSwitching(false)
    }
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

  const overviewParams = {
    orgslug: params.orgslug,
    courseuuid: params.courseuuid,
    subpage: 'tutor',
  }

  const switchRoomAction = hasSelection ? (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSwitchRoom}
      disabled={isSwitching}
    >
      <RotateCcw className="h-4 w-4" />
      Switch room
    </Button>
  ) : null

  return (
    <>
      <div className="z-10 bg-SokratesWhite px-10 pt-[60px] text-sm tracking-tight shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
        <CourseOverviewTop params={overviewParams} actions={switchRoomAction} />
        <div className="flex space-x-3 font-black text-sm">
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/tutor`}
            active
            icon={<GraduationCap size={16} />}
            label="Overview"
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
        <div className="px-10 py-8">
          {roomsLoading || selectionLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-500">
              Loading rooms...
            </div>
          ) : null}

          {!roomsLoading && roomsError ? (
            <div className="rounded-xl bg-white p-6 text-sm text-red-600 shadow">
              Failed to load rooms. Please try again.
            </div>
          ) : null}

          {!selectionLoading && selectionError ? (
            <div className="rounded-xl bg-white p-6 text-sm text-red-600 shadow">
              Failed to load your current selection. Please try again.
            </div>
          ) : null}

          {invalidSelectionNotice ? (
            <div className="mb-6 rounded-xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
              {invalidSelectionNotice}
            </div>
          ) : null}

          {actionError ? (
            <div className="mb-6 rounded-xl bg-rose-50 px-5 py-3 text-sm text-rose-700">
              {actionError}
            </div>
          ) : null}

          {!roomsLoading && !selectionLoading && rooms && hasSelection && selectedRoom ? (
            <SelectedRoomPanel
              room={selectedRoom}
              members={(roomMembers as RoomMember[] | undefined) ?? []}
              isLoading={roomMembersLoading}
              hasError={Boolean(roomMembersError)}
            />
          ) : null}

          {!roomsLoading && !selectionLoading && rooms && !hasSelection && rooms.length > 0 ? (
            <RoomSelectionGrid
              rooms={rooms}
              pendingRoomId={pendingRoomId}
              onSelectRoom={handleSelectRoom}
            />
          ) : null}

          {!roomsLoading && !selectionLoading && rooms && rooms.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-gray-600 nice-shadow">
              You do not have any rooms assigned to you yet.
            </div>
          ) : null}
        </div>
      </motion.div>
    </>
  )
}

function RoomSelectionGrid({
  rooms,
  pendingRoomId,
  onSelectRoom,
}: {
  rooms: Room[]
  pendingRoomId: number | null
  onSelectRoom: (roomId: number) => void
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-6 flex w-full max-w-5xl flex-col gap-2">
        <div className="text-2xl font-semibold text-gray-900">
          Choose the room you want to manage
        </div>
        <div className="text-sm text-gray-500">
          You can switch rooms at any time from the top bar.
        </div>
      </div>
      <div className="grid w-full max-w-5xl justify-center gap-6 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <RoomSelectionCard
            key={room.id}
            room={room}
            isPending={pendingRoomId === room.id}
            onSelect={() => onSelectRoom(room.id)}
          />
        ))}
      </div>
    </div>
  )
}

function RoomSelectionCard({
  room,
  isPending,
  onSelect,
}: {
  room: Room
  isPending: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className="group relative flex min-h-[200px] flex-col justify-between rounded-2xl border border-gray-400 bg-white p-6 text-left shadow-[0_26px_60px_rgba(15,23,42,0.22)] transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-SokratesOrange/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
            Room
          </div>
          <div className="mt-2 text-lg font-semibold text-gray-900">
            {room.name}
          </div>
        </div>
        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {room.tutor_count ?? 0} Tutors
        </div>
      </div>
      <div className="mt-4 flex-1 text-sm text-gray-500">
        {room.description ? room.description : 'No description yet.'}
      </div>
      <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          {room.student_count ?? 0} Students
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
          {room.tutor_count ?? 0} Tutors
        </span>
        {isPending ? (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
            Selecting...
          </span>
        ) : null}
      </div>
      <div className="absolute right-6 top-6 h-2 w-2 rounded-full bg-SokratesOrange opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </button>
  )
}

function SelectedRoomPanel({
  room,
  members,
  isLoading,
  hasError,
}: {
  room: Room
  members: RoomMember[]
  isLoading: boolean
  hasError: boolean
}) {
  const students = React.useMemo(
    () => members.filter((member) => member.role === 'student'),
    [members]
  )

  return (
    <div className="min-h-[calc(100vh-200px)] rounded-2xl bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-2xl font-semibold text-gray-900">{room.name}</div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            {room.student_count ?? 0} Students
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
            {room.tutor_count ?? 0} Tutors
          </span>
        </div>
      </div>
      <div className="mt-6 flex-1">
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="grid grid-cols-[2fr_2fr_3fr] gap-0 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div>Name</div>
            <div>Username</div>
            <div>Email</div>
          </div>
          <div className="divide-y divide-gray-100 bg-white text-sm text-gray-700">
            {isLoading ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                Loading students...
              </div>
            ) : null}
            {hasError ? (
              <div className="px-4 py-6 text-sm text-rose-600">
                Unable to load students for this room.
              </div>
            ) : null}
            {!isLoading && !hasError && students.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                No students are assigned to this room yet.
              </div>
            ) : null}
            {!isLoading && !hasError
              ? students.map((member) => {
                  const name = `${member.user.first_name ?? ''} ${
                    member.user.last_name ?? ''
                  }`.trim()
                  return (
                    <div
                      key={member.user.id}
                      className="grid grid-cols-[2fr_2fr_3fr] gap-0 px-4 py-3"
                    >
                      <div className="font-medium text-gray-900">
                        {name || member.user.username}
                      </div>
                      <div className="text-gray-600">
                        {member.user.username}
                      </div>
                      <div className="text-gray-600">
                        {member.user.email || '—'}
                      </div>
                    </div>
                  )
                })
              : null}
          </div>
        </div>
      </div>
    </div>
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
