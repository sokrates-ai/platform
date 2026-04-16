'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ChevronLeft, GraduationCap, Lock, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'

import { CourseProvider, useCourse } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import TabSwitch from '@components/Objects/StyledElements/TabSwitch/TabSwitch'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { Button } from '@components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getAPIUrl, getUriWithOrg, getWebSocketUrl } from '@services/config/config'
import { verifyTrailStep } from '@services/courses/activity'
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
    user_uuid: string
    username: string
    first_name?: string
    last_name?: string
    email?: string
  }
  role: 'student' | 'tutor'
}

type TutorRoomSelection = {
  room_id: number | null
  selected_tab_id?: string | null
}

type TabOption = {
  value: string
  label: string
}

type ActivityItem = {
  activity_uuid: string
  name: string
  chapter_name?: string
}

type ActivityStatusStep = {
  user_id: number
  activity_uuid: string
  complete: boolean
  tutor_verified: 'NONE' | 'CORRECT' | 'INCORRECT'
}

type ActivityStatusResponse = {
  steps: ActivityStatusStep[]
}

type ActivityState = {
  activity_uuid: string
  status: 'locked' | 'not_started' | 'in_progress' | 'done'
  step?: ActivityStatusStep
}

const normalizeActivityUuid = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const raw = String(value)
    if (!raw) return null
    return raw.startsWith('activity_') ? raw : `activity_${raw}`
  }
  return null
}

const buildCourseRoomNotificationUuid = (roomId: number): string =>
  `course_room_${roomId}`

const extractActivityUuid = (activity: any): string | null => {
  if (activity === null || activity === undefined) return null
  if (typeof activity === 'string' || typeof activity === 'number') {
    return normalizeActivityUuid(activity)
  }
  if (typeof activity !== 'object') return null
  return normalizeActivityUuid(
    activity.activity_uuid ??
      activity.activityUuid ??
      activity.activityUUID ??
      activity.uuid ??
      activity.id
  )
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
  const course = useCourse() as any
  const session = useSokratesSession() as any
  const { isCourseStaff, loading: courseStaffLoading } =
    useCourseStaffStatus() as any
  const accessToken = session?.data?.tokens?.access_token
  const { toast } = useToast()

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
  const selectionTabId = (selection as TutorRoomSelection | undefined)?.selected_tab_id
  const selectedRoom = rooms?.find((room: Room) => room.id === selectionRoomId)
  const hasSelection = Boolean(selectionRoomId && selectedRoom)

  const courseTabs = React.useMemo(() => {
    const rawTabs =
      course?.courseTabMetadata ?? course?.courseStructure?.tabMetadata ?? []
    if (!Array.isArray(rawTabs)) return []
    return [...rawTabs].sort(
      (a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0)
    )
  }, [course?.courseStructure?.tabMetadata, course?.courseTabMetadata])

  const tabOptions = React.useMemo<TabOption[]>(() => {
    if (!courseTabs.length) return []
    return courseTabs.map((tab: any, index: number) => ({
      value: tab?.id ?? tab?.tab_uuid ?? `tab-${index + 1}`,
      label: tab?.name ?? `Tab ${index + 1}`,
    }))
  }, [courseTabs])

  const defaultTabId = tabOptions[0]?.value ?? ''
  const [activeTabId, setActiveTabId] = React.useState<string>(defaultTabId)
  const [isUpdatingTab, setIsUpdatingTab] = React.useState(false)
  const lastSyncedTabRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    lastSyncedTabRef.current = null
  }, [selectionRoomId])

  React.useEffect(() => {
    if (!tabOptions.length) return
    const resolvedTabId =
      tabOptions.find((tab) => tab.value === selectionTabId)?.value ??
      tabOptions[0]?.value
    if (resolvedTabId) {
      setActiveTabId((prev) => (prev === resolvedTabId ? prev : resolvedTabId))
    }

    if (
      hasSelection &&
      accessToken &&
      selectedRoom &&
      resolvedTabId &&
      selectionTabId !== resolvedTabId &&
      lastSyncedTabRef.current !== resolvedTabId
    ) {
      lastSyncedTabRef.current = resolvedTabId
      setTutorRoomSelection(
        courseUuid,
        selectedRoom.id,
        accessToken,
        resolvedTabId
      )
        .then((response) => {
          if (response.success) {
            mutateSelection(
              { room_id: selectedRoom.id, selected_tab_id: resolvedTabId },
              false
            )
          } else {
            setActionError(
              response.HTTPmessage || 'Unable to update the selected tab.'
            )
          }
        })
        .catch((error: any) => {
          setActionError(
            error?.message || 'Unable to update the selected tab.'
          )
        })
    }
  }, [
    accessToken,
    courseUuid,
    hasSelection,
    mutateSelection,
    selectedRoom,
    selectionTabId,
    tabOptions,
  ])

  const membersKey =
    hasSelection && accessToken && selectedRoom
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${selectedRoom.id}/members`
      : null
  const {
    data: roomMembers,
    error: roomMembersError,
    isLoading: roomMembersLoading,
  } = useSWR(membersKey, (url: string) => swrFetcher(url, accessToken))

  const resolvedTabId = activeTabId || defaultTabId
  const activeTabChapters = React.useMemo(() => {
    const store =
      course?.courseTabsStore ??
      course?.courseStructure?.tabStore ??
      course?.courseStructure?.tab_store ??
      {}
    const chapters = store?.[resolvedTabId]?.content?.chapters
    return Array.isArray(chapters) ? chapters : []
  }, [
    course?.courseTabsStore,
    course?.courseStructure?.tabStore,
    course?.courseStructure?.tab_store,
    resolvedTabId,
  ])

  const activities = React.useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []
    const seen = new Set<string>()
    activeTabChapters.forEach((chapter: any) => {
      const chapterName = chapter?.name ?? ''
      const chapterActivities = Array.isArray(chapter?.activities)
        ? chapter.activities
        : []
      chapterActivities.forEach((activity: any, index: number) => {
        const uuid = extractActivityUuid(activity)
        if (!uuid || seen.has(uuid)) return
        seen.add(uuid)
        items.push({
          activity_uuid: uuid,
          name: activity?.name ?? `Activity ${index + 1}`,
          chapter_name: chapterName,
        })
      })
    })
    return items
  }, [activeTabChapters])

  const activityUuids = React.useMemo(
    () => activities.map((activity) => activity.activity_uuid),
    [activities]
  )

  const activityStatusKey =
    hasSelection &&
    accessToken &&
    selectedRoom &&
    activityUuids.length > 0
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${
          selectedRoom.id
        }/activity-status?activity_uuids=${encodeURIComponent(
          activityUuids.join(',')
        )}`
      : null

  const {
    data: activityStatusData,
    error: activityStatusError,
    isLoading: activityStatusLoading,
    mutate: mutateActivityStatus,
  } = useSWR(
    activityStatusKey,
    (url: string) => swrFetcher(url, accessToken)
  )

  const [verifyingCells, setVerifyingCells] = React.useState<
    Record<string, boolean>
  >({})

  const notificationSocketRef = React.useRef<WebSocket | null>(null)
  const notificationReconnectRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const notificationRetryRef = React.useRef(0)

  const tutorUserId =
    typeof session?.data?.user?.id === 'number' ? session.data.user.id : null
  const activityNotificationTopics = React.useMemo(() => {
    if (!tutorUserId || !selectedRoom) return []
    const roomUuid = buildCourseRoomNotificationUuid(selectedRoom.id)
    const base = `user/${tutorUserId}/courses/${courseUuid}/students/+/rooms/${roomUuid}`
    return [`${base}/activity-completed`, `${base}/activity-started`]
  }, [courseUuid, selectedRoom, tutorUserId])

  React.useEffect(() => {
    if (!hasSelection || !accessToken || activityNotificationTopics.length === 0) {
      if (notificationReconnectRef.current) {
        clearTimeout(notificationReconnectRef.current)
        notificationReconnectRef.current = null
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close()
        notificationSocketRef.current = null
      }
      return
    }

    const baseUrl = getWebSocketUrl()
    if (!baseUrl) {
      return
    }

    let active = true

    const cleanup = () => {
      if (notificationReconnectRef.current) {
        clearTimeout(notificationReconnectRef.current)
        notificationReconnectRef.current = null
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.onopen = null
        notificationSocketRef.current.onmessage = null
        notificationSocketRef.current.onclose = null
        notificationSocketRef.current.onerror = null
        notificationSocketRef.current.close()
        notificationSocketRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (!active) return
      const delay = Math.min(1000 * 2 ** notificationRetryRef.current, 30000)
      const jitter = Math.floor(Math.random() * 300)
      notificationRetryRef.current += 1
      notificationReconnectRef.current = setTimeout(() => {
        connect()
      }, delay + jitter)
    }

    const connect = () => {
      cleanup()
      const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
      const url = new URL(`${normalized}notifications/ws`)
      url.searchParams.set('topics', activityNotificationTopics.join(','))
      url.searchParams.set('token', accessToken)
      const socket = new WebSocket(url.toString())
      notificationSocketRef.current = socket

      socket.onopen = () => {
        notificationRetryRef.current = 0
        socket.send(
          JSON.stringify({
            type: 'set_subscriptions',
            topics: activityNotificationTopics,
          })
        )
      }

      socket.onmessage = (event) => {
        let payload: any = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        if (!payload || payload.type !== 'notification') return
        const notification = payload.notification || {}
        const topic = notification?.topic ?? ''
        const isCompleted = topic.endsWith('activity-completed')
        const isStarted = topic.endsWith('activity-started')
        if (!isCompleted && !isStarted) return
        const data = notification.data || {}
        if (data.course_uuid && data.course_uuid !== courseUuid) return
        if (selectedRoom) {
          const expectedRoomUuid = buildCourseRoomNotificationUuid(selectedRoom.id)
          if (data.room_uuid && data.room_uuid !== expectedRoomUuid) return
          if (data.room_id && data.room_id !== selectedRoom.id) return
        }
        if (data.activity_uuid && activityUuids.length > 0) {
          const normalized = normalizeActivityUuid(data.activity_uuid)
          if (normalized && !activityUuids.includes(normalized)) {
            return
          }
        }
        if (isCompleted) {
          toast({
            title: notification.title || 'Student completed activity',
            description: notification.body || '',
          })
        }
        if (typeof mutateActivityStatus === 'function') {
          mutateActivityStatus()
        }
      }

      socket.onerror = () => {
        socket.close()
      }

      socket.onclose = () => {
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      active = false
      cleanup()
    }
  }, [
    accessToken,
    activityNotificationTopics,
    activityUuids,
    courseUuid,
    hasSelection,
    mutateActivityStatus,
    selectedRoom,
    toast,
  ])

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
          mutateSelection({ room_id: null, selected_tab_id: null }, false)
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
        accessToken,
        activeTabId || defaultTabId || null
      )
      if (response.success) {
        mutateSelection(
          { room_id: roomId, selected_tab_id: activeTabId || defaultTabId || null },
          false
        )
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
        mutateSelection({ room_id: null, selected_tab_id: null }, false)
      } else {
        setActionError(response.HTTPmessage || 'Unable to switch rooms.')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Unable to switch rooms.')
    } finally {
      setIsSwitching(false)
    }
  }

  const handleTabChange = async (tabId: string) => {
    if (tabId === activeTabId) return
    setActiveTabId(tabId)
    if (!accessToken || !selectedRoom) return
    setIsUpdatingTab(true)
    try {
      const response = await setTutorRoomSelection(
        courseUuid,
        selectedRoom.id,
        accessToken,
        tabId
      )
      if (response.success) {
        mutateSelection(
          { room_id: selectedRoom.id, selected_tab_id: tabId },
          false
        )
      } else {
        setActionError(response.HTTPmessage || 'Unable to update selected tab.')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Unable to update selected tab.')
    } finally {
      setIsUpdatingTab(false)
    }
  }

  const handleVerifyStep = async (
    student: RoomMember['user'],
    activityUuid: string,
    nextStatus: ActivityStatusStep['tutor_verified']
  ) => {
    if (!accessToken) return
    const normalizedUuid = normalizeActivityUuid(activityUuid)
    if (!normalizedUuid) return
    if (!student.user_uuid) {
      setActionError('Unable to verify activity for this student.')
      return
    }
    const cellKey = `${student.id}:${normalizedUuid}`
    setActionError(null)
    setVerifyingCells((prev) => ({ ...prev, [cellKey]: true }))
    try {
      const response = await verifyTrailStep(
        normalizedUuid,
        student.user_uuid,
        nextStatus,
        accessToken
      )
      if (response.success) {
        let updated = false
        mutateActivityStatus((current) => {
          if (!current) return current
          const steps = Array.isArray(current.steps) ? current.steps : []
          const nextSteps = steps.map((step) => {
            const stepUuid = normalizeActivityUuid(step.activity_uuid)
            if (
              step.user_id === student.id &&
              stepUuid === normalizedUuid
            ) {
              updated = true
              return { ...step, tutor_verified: nextStatus }
            }
            return step
          })
          return { ...current, steps: nextSteps }
        }, false)
        if (!updated) {
          mutateActivityStatus()
        }
      } else {
        setActionError(response.HTTPmessage || 'Unable to verify activity.')
      }
    } catch (error: any) {
      setActionError(error?.message || 'Unable to verify activity.')
    } finally {
      setVerifyingCells((prev) => {
        const next = { ...prev }
        delete next[cellKey]
        return next
      })
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
  const tutorBasePath = `${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/tutor`

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
            href={tutorBasePath}
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
              tabs={tabOptions}
              activeTabId={activeTabId}
              isUpdatingTab={isUpdatingTab}
              onTabChange={handleTabChange}
              activities={activities}
              activityStatus={
                (activityStatusData as ActivityStatusResponse | undefined) ??
                undefined
              }
              activityStatusLoading={activityStatusLoading}
              activityStatusError={Boolean(activityStatusError)}
              onVerifyStep={handleVerifyStep}
              verifyingCells={verifyingCells}
              basePath={tutorBasePath}
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
  tabs,
  activeTabId,
  isUpdatingTab,
  onTabChange,
  activities,
  activityStatus,
  activityStatusLoading,
  activityStatusError,
  onVerifyStep,
  verifyingCells,
  basePath,
}: {
  room: Room
  members: RoomMember[]
  isLoading: boolean
  hasError: boolean
  tabs: TabOption[]
  activeTabId: string
  isUpdatingTab: boolean
  onTabChange: (tabId: string) => void
  activities: ActivityItem[]
  activityStatus?: ActivityStatusResponse
  activityStatusLoading: boolean
  activityStatusError: boolean
  onVerifyStep: (
    student: RoomMember['user'],
    activityUuid: string,
    status: ActivityStatusStep['tutor_verified']
  ) => void
  verifyingCells: Record<string, boolean>
  basePath: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const students = React.useMemo(
    () => members.filter((member) => member.role === 'student'),
    [members]
  )
  const activityStatusMap = React.useMemo(() => {
    const steps = activityStatus?.steps ?? []
    const map = new Map<string, ActivityStatusStep>()
    steps.forEach((step) => {
      const normalized = normalizeActivityUuid(step.activity_uuid)
      if (!normalized) return
      map.set(`${step.user_id}:${normalized}`, {
        ...step,
        activity_uuid: normalized,
      })
    })
    return map
  }, [activityStatus?.steps])

  const selectedStudentUuid = searchParams?.get('student') ?? null
  const activityParamUuid = normalizeActivityUuid(searchParams?.get('activity'))
  const [optimisticActivityUuid, setOptimisticActivityUuid] = React.useState<
    string | null
  >(null)
  const selectedActivityUuid = optimisticActivityUuid ?? activityParamUuid
  const [, startActivityTransition] = React.useTransition()
  const selectedStudent = students.find(
    (student) => student.user.user_uuid === selectedStudentUuid
  )

  React.useEffect(() => {
    setOptimisticActivityUuid(null)
  }, [selectedStudentUuid])

  React.useEffect(() => {
    if (!activityParamUuid) {
      if (optimisticActivityUuid) {
        setOptimisticActivityUuid(null)
      }
      return
    }
    if (optimisticActivityUuid && optimisticActivityUuid === activityParamUuid) {
      setOptimisticActivityUuid(null)
    }
  }, [activityParamUuid, optimisticActivityUuid])
  const isDrilldown = Boolean(selectedStudent)

  const buildUrl = (studentUuid?: string | null, activityUuid?: string | null) => {
    const params = new URLSearchParams()
    if (studentUuid) params.set('student', studentUuid)
    if (activityUuid) params.set('activity', activityUuid)
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  const buildActivityStates = React.useCallback(
    (studentId: number): ActivityState[] => {
      let hasIncomplete = false
      return activities.map((activity) => {
        const key = `${studentId}:${activity.activity_uuid}`
        const step = activityStatusMap.get(key)
        if (step) {
          if (!step.complete) {
            hasIncomplete = true
          }
          return {
            activity_uuid: activity.activity_uuid,
            status: step.complete ? 'done' : 'in_progress',
            step,
          }
        }
        const status = hasIncomplete ? 'locked' : 'not_started'
        if (!hasIncomplete) {
          hasIncomplete = true
        }
        return {
          activity_uuid: activity.activity_uuid,
          status,
        }
      })
    },
    [activities, activityStatusMap]
  )

  const activityMetaByUuid = React.useMemo(() => {
    const map = new Map<string, ActivityItem>()
    activities.forEach((activity) => {
      map.set(activity.activity_uuid, activity)
    })
    return map
  }, [activities])
  const selectedStates = React.useMemo(() => {
    if (!selectedStudent) return []
      return buildActivityStates(selectedStudent.user.id)
    }, [buildActivityStates, selectedStudent])

  const getStatusLabel = React.useCallback(
    (status: ActivityState['status']) => {
      if (status === 'done') return 'Done'
      if (status === 'in_progress') return 'In progress'
      if (status === 'locked') return 'Locked'
      return 'Not started'
    },
    []
  )
  const buildTooltipContent = React.useCallback(
    (meta: ActivityItem | undefined, status: ActivityState['status']) => (
      <div className="flex max-w-[220px] flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {meta?.chapter_name ?? 'Chapter'}
        </span>
        <span className="text-xs font-semibold text-gray-900">
          {meta?.name ?? 'Activity'}
        </span>
        <span className="text-[10px] text-gray-600">
          {getStatusLabel(status)}
        </span>
      </div>
    ),
    [getStatusLabel]
  )

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] flex-col rounded-2xl bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {isDrilldown ? (
          <div className="flex w-full items-center justify-between text-sm text-gray-500">
            <button
              type="button"
              onClick={() => router.push(basePath, { scroll: false })}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:text-gray-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <nav className="flex flex-wrap items-center justify-end gap-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-400">{room.name}</span>
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-800">
                {`${selectedStudent?.user.first_name ?? ''} ${
                  selectedStudent?.user.last_name ?? ''
                }`.trim() || selectedStudent?.user.username}
              </span>
            </nav>
          </div>
        ) : null}
        {!isDrilldown ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              {room.student_count ?? 0} Students
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
              {room.tutor_count ?? 0} Tutors
            </span>
          </div>
        ) : null}
      </div>
      {!isDrilldown && tabs.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <TabSwitch
            value={activeTabId}
            onValueChange={onTabChange}
            options={tabs}
            className="flex-wrap"
          />
          {isUpdatingTab ? (
            <div className="text-xs text-gray-500">Saving tab…</div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        {activityStatusLoading ? (
          <div>Loading activity status...</div>
        ) : (
          <div />
        )}
        {activityStatusError ? (
          <div className="text-rose-600">
            Unable to load activity status for this room.
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex-1">
        {!selectedStudent ? (
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200">
          <div className="flex-1 overflow-auto bg-white pb-24">
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
              {!isLoading && !hasError && students.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {students.map((member) => {
                    const name = `${member.user.first_name ?? ''} ${
                      member.user.last_name ?? ''
                    }`.trim()
                    const states = buildActivityStates(member.user.id)
                    return (
                      <button
                        key={member.user.id}
                        type="button"
                        onClick={() => {
                          router.push(
                            buildUrl(member.user.user_uuid, null),
                            { scroll: false }
                          )
                        }}
                        className="group grid min-h-[64px] w-full grid-cols-[240px_1fr] items-center gap-4 bg-white px-4 py-3 text-left transition hover:bg-gray-50"
                      >
                        <div className="grid grid-cols-[1fr_auto_16px] items-center gap-3">
                          <span className="truncate font-medium text-gray-900">
                            {name || member.user.username}
                          </span>
                          <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Offline
                          </span>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full border border-gray-300 bg-gray-300" />
                        </div>
                        <div className="w-full overflow-x-auto">
                          <div
                            className="grid w-full items-center"
                            style={{
                              gridTemplateColumns: `repeat(${states.length}, minmax(52px, 1fr))`,
                              minWidth: `${states.length * 52}px`,
                            }}
                          >
                            {states.map((state, index) => (
                              <div
                                key={`${member.user.id}:${state.activity_uuid}`}
                                className={`flex items-center justify-center py-3 ${
                                  index === 0 ? '' : 'border-l border-gray-100'
                                }`}
                              >
                                <ActivityDot
                                  status={state.status}
                                  selected={false}
                                  tooltip={buildTooltipContent(
                                    activityMetaByUuid.get(state.activity_uuid),
                                    state.status
                                  )}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    router.push(
                                      buildUrl(
                                        member.user.user_uuid,
                                        state.activity_uuid
                                      ),
                                      { scroll: false }
                                    )
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-2" />
            <div className="flex-1 overflow-auto p-4 pb-20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Click an activity dot to focus.
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {selectedStates.map((state, index) => {
                  const isSelected =
                    selectedActivityUuid === state.activity_uuid
                  const meta = activityMetaByUuid.get(state.activity_uuid)
                  const chapterLabel = meta?.chapter_name ?? 'Chapter'
                  const activityLabel = meta?.name ?? `Activity ${index + 1}`
                  const statusLabel = getStatusLabel(state.status)
                  const isVerifying = Boolean(
                    verifyingCells[
                      `${selectedStudent.user.id}:${state.activity_uuid}`
                    ]
                  )
                  return (
                    <div
                      key={state.activity_uuid}
                      className={`rounded-xl border-2 px-3 py-2 transition ${
                        isSelected
                          ? 'border-SokratesOrange bg-white shadow-[0_8px_18px_rgba(233,116,0,0.18)]'
                          : 'border-gray-200 bg-white shadow-[0_10px_22px_rgba(15,23,42,0.08)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          (() => {
                            const nextUrl = buildUrl(
                              selectedStudent.user.user_uuid,
                              state.activity_uuid
                            )
                            setOptimisticActivityUuid(state.activity_uuid)
                            startActivityTransition(() => {
                              router.replace(nextUrl, { scroll: false })
                            })
                          })()
                        }
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <ActivityDot
                            status={state.status}
                            selected={isSelected}
                            tooltip={buildTooltipContent(meta, state.status)}
                          />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {chapterLabel}
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {activityLabel}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          {statusLabel}
                        </span>
                      </button>
                      {isSelected ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>Verification</span>
                          <select
                            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100/60"
                            value={state.step?.tutor_verified ?? 'NONE'}
                            onChange={(event) =>
                              onVerifyStep(
                                selectedStudent.user,
                                state.activity_uuid,
                                event.target
                                  .value as ActivityStatusStep['tutor_verified']
                              )
                            }
                            disabled={
                              !state.step ||
                              isVerifying ||
                              state.status === 'locked'
                            }
                          >
                            <option value="NONE">Unverified</option>
                            <option value="CORRECT">Correct</option>
                            <option value="INCORRECT">Incorrect</option>
                          </select>
                          {isVerifying ? (
                            <span className="text-[10px] text-gray-400">
                              Saving...
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-6 right-6">
        <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-xs text-gray-600 shadow-sm backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Legend
          </div>
          <div className="flex items-center gap-2">
            <ActivityDot status="not_started" selected={false} />
            <span>Not started</span>
          </div>
          <div className="flex items-center gap-2">
            <ActivityDot status="locked" selected={false} />
            <span>Locked</span>
          </div>
          <div className="flex items-center gap-2">
            <ActivityDot status="in_progress" selected={false} />
            <span>In progress</span>
          </div>
          <div className="flex items-center gap-2">
            <ActivityDot status="done" selected={false} />
            <span>Done</span>
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

function ActivityDot({
  status,
  selected,
  onClick,
  tooltip,
}: {
  status: ActivityState['status']
  selected: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  tooltip?: React.ReactNode
}) {
  const borderClass =
    status === 'done'
      ? 'border-emerald-600'
      : status === 'in_progress'
      ? 'border-amber-500'
      : status === 'locked'
      ? 'border-gray-400'
      : 'border-gray-300'
  const ringClass =
    status === 'done'
      ? 'ring-emerald-200/80'
      : status === 'in_progress'
      ? 'ring-amber-200/80'
      : status === 'locked'
      ? 'ring-gray-200/70'
      : 'ring-gray-200/60'
  const content =
    status === 'locked' ? <Lock className="h-3.5 w-3.5 text-gray-500" /> : null

  const dot = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-full border-[3px] bg-white transition ${borderClass} ring-2 ${ringClass} hover:scale-110 hover:shadow-[0_6px_14px_rgba(15,23,42,0.18)] active:scale-95 ${
        selected ? 'ring-4 ring-gray-900/20' : ''
      }`}
    >
      {content}
    </button>
  ) : (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full border-[3px] bg-white ${borderClass} ring-2 ${ringClass} ${
        selected ? 'ring-4 ring-gray-900/20' : ''
      }`}
    >
      {content}
    </span>
  )

  if (tooltip) {
    return (
      <ToolTip content={tooltip} side="top" sideOffset={6}>
        {dot}
      </ToolTip>
    )
  }

  return dot
}
