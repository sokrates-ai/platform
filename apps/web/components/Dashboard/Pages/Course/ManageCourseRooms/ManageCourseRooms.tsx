'use client'

import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useCourse } from '@components/Contexts/CourseContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import {
  addCourseRoomMembers,
  createCourseRoom,
  deleteCourseRoom,
  removeCourseRoomMembers,
  updateCourseRoom,
} from '@services/courses/rooms'
import { swrFetcher } from '@services/utils/ts/requests'
import { GripVertical, Pencil, Plus, Users, X } from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { Button } from '@components/ui/button'
import { useFormik } from 'formik'
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd'

const validateRoom = (values: any) => {
  const errors: any = {}
  if (!values.name) {
    errors.name = 'Name is Required'
  }
  return errors
}

function ManageCourseRooms() {
  const course = useCourse() as any
  const courseStructure = course?.courseStructure
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token

  const roomsKey = courseStructure
    ? `${getAPIUrl()}courses/${courseStructure.course_uuid}/rooms`
    : null

  const { data: rooms } = useSWR(
    roomsKey,
    (url: string) => swrFetcher(url, access_token)
  )

  const [createRoomModal, setCreateRoomModal] = React.useState(false)
  const [editRoomModal, setEditRoomModal] = React.useState(false)
  const [selectedRoom, setSelectedRoom] = React.useState<any>(null)

  const handleEditRoomModal = (room: any) => {
    setSelectedRoom(room)
    setEditRoomModal(true)
  }

  if (!courseStructure) {
    return null
  }

  return (
    <div className="py-4">
      <div className="mx-4 sm:mx-10 bg-white rounded-xl shadow-sm px-4 py-4">
        <div className="flex flex-col bg-gray-50 -space-y-1 px-3 sm:px-5 py-3 rounded-md mb-3">
          <h1 className="font-bold text-lg sm:text-xl text-gray-800">Rooms</h1>
          <h2 className="text-gray-500 text-xs sm:text-sm">
            Organize students and tutors into rooms for this course.
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
            <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
              <tr className="font-bolder text-sm">
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="mt-5 bg-white rounded-md">
              {rooms ? (
                rooms.length ? (
                  rooms.map((room: any) => (
                  <tr key={room.id} className="border-b border-gray-100 text-sm">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {room.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {room.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                          {room.student_count ?? 0} Students
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">
                          {room.tutor_count ?? 0} Tutors
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 flex flex-wrap gap-2">
                      <Modal
                        minHeight="no-min"
                        minWidth="xl"
                        customWidth="w-[95vw] max-w-[1200px]"
                        customHeight="h-[80vh]"
                        onOpenChange={() => {}}
                        dialogContent={
                          <RoomMembersManager
                            room={room}
                            courseUuid={courseStructure.course_uuid}
                            roomsKey={roomsKey}
                          />
                        }
                        dialogTrigger={
                          <Button className="flex space-x-2" variant="secondary">
                            <Users className="h-4 w-4" />
                            <span>Manage</span>
                          </Button>
                        }
                      />
                      <Modal
                        isDialogOpen={editRoomModal && selectedRoom?.id === room.id}
                        onOpenChange={(open) => {
                          setEditRoomModal(open)
                          if (!open) {
                            setSelectedRoom(null)
                          }
                        }}
                        minHeight="sm"
                        minWidth="sm"
                        dialogTitle="Rename Room"
                        dialogDescription="Update the room name or description."
                        dialogContent={
                          <EditRoomForm
                            room={room}
                            courseUuid={courseStructure.course_uuid}
                            onClose={() => setEditRoomModal(false)}
                            roomsKey={roomsKey}
                          />
                        }
                        dialogTrigger={
                          <Button
                            className="flex space-x-2"
                            variant="outline"
                            onClick={() => handleEditRoomModal(room)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                        }
                      />
                      <ConfirmationModal
                        confirmationButtonText="Delete Room"
                        confirmationMessage="This will remove the room and all its members."
                        dialogTitle="Delete Room?"
                        dialogTrigger={
                          <Button className="flex space-x-2" variant="destructive">
                            <X className="h-4 w-4" />
                            <span>Delete</span>
                          </Button>
                        }
                        functionToExecute={() =>
                          handleDeleteRoom(
                            courseStructure.course_uuid,
                            room.id,
                            access_token,
                            roomsKey
                          )
                        }
                        status="warning"
                      />
                    </td>
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="py-6 px-4 text-center text-gray-500"
                      colSpan={4}
                    >
                      No rooms yet. Create one to get started.
                    </td>
                  </tr>
                )
              ) : (
                <tr>
                  <td
                    className="py-6 px-4 text-center text-gray-500"
                    colSpan={4}
                  >
                    Loading rooms...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-3 mr-2">
          <Modal
            isDialogOpen={createRoomModal}
            onOpenChange={setCreateRoomModal}
            minHeight="no-min"
            minWidth="sm"
            dialogTitle="Create Room"
            dialogDescription="Add a new room to organize participants."
            dialogContent={
              <AddRoomForm
                courseUuid={courseStructure.course_uuid}
                onClose={() => setCreateRoomModal(false)}
                roomsKey={roomsKey}
              />
            }
            dialogTrigger={
              <Button className="flex space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create Room</span>
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}

async function handleDeleteRoom(
  courseUuid: string,
  roomId: number,
  accessToken: string,
  roomsKey: string | null
) {
  const res = await deleteCourseRoom(courseUuid, roomId, accessToken)
  if (res.status === 200) {
    toast.success('Room deleted')
    if (roomsKey) {
      mutate(roomsKey)
    }
  } else {
    toast.error(`Error ${res.status}: ${res.data.detail}`)
  }
}

function AddRoomForm({
  courseUuid,
  onClose,
  roomsKey,
}: {
  courseUuid: string
  onClose: () => void
  roomsKey: string | null
}) {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
    },
    validate: validateRoom,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      const res = await createCourseRoom(courseUuid, values, access_token)
      if (res.status === 200) {
        toast.success('Room created')
        if (roomsKey) {
          mutate(roomsKey)
        }
        onClose()
      } else {
        toast.error(`Error ${res.status}: ${res.data.detail}`)
      }
      setIsSubmitting(false)
    },
  })

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <FormField name="name">
        <FormLabelAndMessage label="Name" message={formik.errors.name} />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.name}
            type="text"
            required
          />
        </Form.Control>
      </FormField>
      <FormField name="description">
        <FormLabelAndMessage label="Description" message={formik.errors.description} />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.description}
            type="text"
          />
        </Form.Control>
      </FormField>
      <div className="flex py-4">
        <Form.Submit asChild>
          <button className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer">
            {isSubmitting ? 'Loading...' : 'Create Room'}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
  )
}

function EditRoomForm({
  room,
  courseUuid,
  onClose,
  roomsKey,
}: {
  room: any
  courseUuid: string
  onClose: () => void
  roomsKey: string | null
}) {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      name: room?.name ?? '',
      description: room?.description ?? '',
    },
    enableReinitialize: true,
    validate: validateRoom,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      const res = await updateCourseRoom(courseUuid, room.id, values, access_token)
      if (res.status === 200) {
        toast.success('Room updated')
        if (roomsKey) {
          mutate(roomsKey)
        }
        onClose()
      } else {
        toast.error(`Error ${res.status}: ${res.data.detail}`)
      }
      setIsSubmitting(false)
    },
  })

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <FormField name="name">
        <FormLabelAndMessage label="Name" message={formik.errors.name} />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.name}
            type="text"
            required
          />
        </Form.Control>
      </FormField>
      <FormField name="description">
        <FormLabelAndMessage label="Description" message={formik.errors.description} />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.description}
            type="text"
          />
        </Form.Control>
      </FormField>
      <div className="flex py-4">
        <Form.Submit asChild>
          <button className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer">
            {isSubmitting ? 'Loading...' : 'Save Room'}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
  )
}

function RoomMembersManager({
  room,
  courseUuid,
  roomsKey,
}: {
  room: any
  courseUuid: string
  roomsKey: string | null
}) {
  const org = useOrg() as any
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [studentSearch, setStudentSearch] = React.useState('')
  const [tutorSearch, setTutorSearch] = React.useState('')
  const [membersOverride, setMembersOverride] = React.useState<any[] | null>(null)
  const [activeRole, setActiveRole] = React.useState<'student' | 'tutor'>('student')

  const membersKey = room
    ? `${getAPIUrl()}courses/${courseUuid}/rooms/${room.id}/members`
    : null

  const { data: members } = useSWR(
    membersKey,
    (url: string) => swrFetcher(url, access_token)
  )

  const { data: orgUsers } = useSWR(
    org ? `${getAPIUrl()}orgs/${org.id}/users` : null,
    (url: string) => swrFetcher(url, access_token)
  )

  const membersData = membersOverride ?? members ?? []
  const userById = React.useMemo(() => {
    const map = new Map<number, any>()
    orgUsers?.forEach((entry: any) => {
      if (entry?.user?.id) {
        map.set(entry.user.id, entry.user)
      }
    })
    return map
  }, [orgUsers])

  const memberRoleMap = React.useMemo(() => {
    const map = new Map<number, 'student' | 'tutor'>()
    membersData.forEach((member: any) => {
      map.set(member.user.id, member.role)
    })
    return map
  }, [membersData])

  const studentsInRoom = React.useMemo(
    () => membersData.filter((member: any) => member.role === 'student'),
    [membersData]
  )
  const tutorsInRoom = React.useMemo(
    () => membersData.filter((member: any) => member.role === 'tutor'),
    [membersData]
  )

  const studentsAvailable = React.useMemo(
    () =>
      orgUsers?.filter(
        (entry: any) =>
          isStudentRole(entry?.role) && !memberRoleMap.has(entry.user.id)
      ) ?? [],
    [memberRoleMap, orgUsers]
  )
  const tutorsAvailable = React.useMemo(
    () =>
      orgUsers?.filter(
        (entry: any) =>
          isTutorRole(entry?.role) && !memberRoleMap.has(entry.user.id)
      ) ?? [],
    [memberRoleMap, orgUsers]
  )

  const handleAdd = async (userId: number, role: 'student' | 'tutor') => {
    const user = userById.get(userId)
    if (!user) {
      toast.error('User not available')
      return
    }
    const baseMembers = membersOverride ?? members ?? []
    const nextMembers = [
      ...baseMembers.filter((member: any) => member.user.id !== userId),
      { user, role },
    ]
    setMembersOverride(nextMembers)
    const res = await addCourseRoomMembers(
      courseUuid,
      room.id,
      userId,
      role,
      access_token
    )
    if (res.status === 200) {
      toast.success('User added to room')
      if (membersKey) {
        await mutate(membersKey)
      }
      if (roomsKey) {
        mutate(roomsKey)
      }
      setMembersOverride(null)
    } else {
      toast.error(`Error ${res.status}: ${res.data.detail}`)
      setMembersOverride(null)
    }
  }

  const handleRemove = async (userId: number) => {
    const baseMembers = membersOverride ?? members ?? []
    const nextMembers = baseMembers.filter(
      (member: any) => member.user.id !== userId
    )
    setMembersOverride(nextMembers)
    const res = await removeCourseRoomMembers(
      courseUuid,
      room.id,
      userId,
      access_token
    )
    if (res.status === 200) {
      toast.success('User removed from room')
      if (membersKey) {
        await mutate(membersKey)
      }
      if (roomsKey) {
        mutate(roomsKey)
      }
      setMembersOverride(null)
    } else {
      toast.error(`Error ${res.status}: ${res.data.detail}`)
      setMembersOverride(null)
    }
  }

  const isLoading = !orgUsers || (!members && !membersOverride)
  const filteredStudentsAvailable = filterUsers(studentsAvailable, studentSearch)
  const filteredStudentsInRoom = filterUsers(studentsInRoom, studentSearch)
  const filteredTutorsAvailable = filterUsers(tutorsAvailable, tutorSearch)
  const filteredTutorsInRoom = filterUsers(tutorsInRoom, tutorSearch)

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{room.name}</h2>
          <p className="text-xs text-gray-500">
            Add students and tutors to this room.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-2 rounded-full border-2 border-SokratesGrayBorder bg-SokratesLightGray/60 p-1 shadow-[0_2px_0_0_var(--color-SokratesBlackBoxShadow)]">
            <button
              className={`rounded-full px-5 py-1 text-sm font-semibold transition ${
                activeRole === 'student'
                  ? 'bg-orange-500 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.2)]'
                  : 'text-SokratesGrayText hover:text-SokratesBlack'
              }`}
              onClick={() => setActiveRole('student')}
            >
              Students
            </button>
            <button
              className={`rounded-full px-5 py-1 text-sm font-semibold transition ${
                activeRole === 'tutor'
                  ? 'bg-orange-500 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.2)]'
                  : 'text-SokratesGrayText hover:text-SokratesBlack'
              }`}
              onClick={() => setActiveRole('tutor')}
            >
              Tutors
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {activeRole === 'student' ? (
          <RoleDragBoard
            title="Students"
            role="student"
            availableUsers={filteredStudentsAvailable}
            roomUsers={filteredStudentsInRoom}
            searchValue={studentSearch}
            onSearchChange={setStudentSearch}
            onAdd={handleAdd}
            onRemove={handleRemove}
            isLoading={isLoading}
          />
        ) : (
          <RoleDragBoard
            title="Tutors"
            role="tutor"
            availableUsers={filteredTutorsAvailable}
            roomUsers={filteredTutorsInRoom}
            searchValue={tutorSearch}
            onSearchChange={setTutorSearch}
            onAdd={handleAdd}
            onRemove={handleRemove}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}

function RoleDragBoard({
  title,
  role,
  availableUsers,
  roomUsers,
  searchValue,
  onSearchChange,
  onAdd,
  onRemove,
  isLoading,
}: {
  title: string
  role: 'student' | 'tutor'
  availableUsers: any[]
  roomUsers: any[]
  searchValue: string
  onSearchChange: (value: string) => void
  onAdd: (userId: number, role: 'student' | 'tutor') => void
  onRemove: (userId: number) => void
  isLoading: boolean
}) {
  const availableId = `${role}-available`
  const roomId = `${role}-room`

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.droppableId === result.source.droppableId) return
    const [, userIdRaw] = result.draggableId.split(':')
    const userId = Number(userIdRaw)
    if (!userId) return

    if (
      result.destination.droppableId === roomId &&
      result.source.droppableId === availableId
    ) {
      void onAdd(userId, role)
      return
    }
    if (
      result.destination.droppableId === availableId &&
      result.source.droppableId === roomId
    ) {
      void onRemove(userId)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <p className="text-xs text-gray-400">
            Move users by dragging cards between columns.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <input
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">
          {roomUsers.length} in room
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">
          {availableUsers.length} available
        </span>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <UserDropColumn
            title="Available"
            droppableId={availableId}
            items={availableUsers}
            role={role}
            emptyText={`No ${title.toLowerCase()} available`}
            isLoading={isLoading}
          />
          <UserDropColumn
            title="In room"
            droppableId={roomId}
            items={roomUsers}
            role={role}
            emptyText={`Drag ${title.toLowerCase()} here`}
            isLoading={isLoading}
          />
        </div>
      </DragDropContext>
    </div>
  )
}

function UserDropColumn({
  title,
  droppableId,
  items,
  role,
  emptyText,
  isLoading,
}: {
  title: string
  droppableId: string
  items: any[]
  role: 'student' | 'tutor'
  emptyText: string
  isLoading: boolean
}) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex h-full min-h-[260px] flex-col rounded-lg border p-3 transition-colors ${
            snapshot.isDraggingOver
              ? 'border-sky-400 bg-sky-50'
              : 'border-dashed border-gray-300 bg-slate-50/70'
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>{title}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 shadow-sm">
              {items.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-auto pr-1">
            {isLoading ? (
              <div className="text-xs text-gray-400 italic">Loading...</div>
            ) : items.length ? (
              items.map((entry: any, index: number) => (
                <UserCard
                  key={`${role}-${entry.user.id}`}
                  user={entry.user}
                  role={role}
                  index={index}
                />
              ))
            ) : (
              <div className="text-xs text-gray-400 italic">{emptyText}</div>
            )}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}

function UserCard({
  user,
  role,
  index,
}: {
  user: any
  role: 'student' | 'tutor'
  index: number
}) {
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    'Unknown user'
  const draggableId = `${role}:${user.id}`

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-all ${
            snapshot.isDragging
              ? 'border-sky-300 shadow-md cursor-grabbing'
              : 'border-gray-200 hover:border-gray-300 hover:bg-white cursor-grab'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              <GripVertical className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-gray-900">{displayName}</div>
              {user.username && (
                <div className="text-xs text-gray-400">@{user.username}</div>
              )}
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              role === 'student'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {role}
          </span>
        </div>
      )}
    </Draggable>
  )
}

function filterUsers(list: any[], searchValue: string) {
  if (!searchValue) return list
  const term = searchValue.toLowerCase()
  return list.filter((entry: any) => {
    const user = entry.user ?? {}
    const haystack = [
      user.first_name,
      user.last_name,
      user.username,
      user.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
}

function isStudentRole(role: any) {
  return role?.role_uuid === 'role_global_student' || role?.id === 3
}

function isTutorRole(role: any) {
  return role?.role_uuid === 'role_global_tutor' || role?.id === 4
}

export default ManageCourseRooms
