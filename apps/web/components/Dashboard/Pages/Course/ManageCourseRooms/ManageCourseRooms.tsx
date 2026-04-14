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
import { Check, Pencil, Plus, Users, X } from 'lucide-react'
import React from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { Button } from '@components/ui/button'
import { useFormik } from 'formik'

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
                        minHeight="lg"
                        minWidth="lg"
                        onOpenChange={() => {}}
                        dialogTitle={`Manage ${room.name}`}
                        dialogDescription="Add students and tutors to this room."
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

  const memberMap = React.useMemo(() => {
    const map = new Map<number, string>()
    members?.forEach((member: any) => {
      map.set(member.user.id, member.role)
    })
    return map
  }, [members])

  const studentUsers = React.useMemo(
    () =>
      orgUsers?.filter((entry: any) =>
        isStudentRole(entry?.role)
      ) ?? [],
    [orgUsers]
  )

  const tutorUsers = React.useMemo(
    () =>
      orgUsers?.filter((entry: any) =>
        isTutorRole(entry?.role)
      ) ?? [],
    [orgUsers]
  )

  const handleAdd = async (userId: number, role: 'student' | 'tutor') => {
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
        mutate(membersKey)
      }
      if (roomsKey) {
        mutate(roomsKey)
      }
    } else {
      toast.error(`Error ${res.status}: ${res.data.detail}`)
    }
  }

  const handleRemove = async (userId: number) => {
    const res = await removeCourseRoomMembers(
      courseUuid,
      room.id,
      userId,
      access_token
    )
    if (res.status === 200) {
      toast.success('User removed from room')
      if (membersKey) {
        mutate(membersKey)
      }
      if (roomsKey) {
        mutate(roomsKey)
      }
    } else {
      toast.error(`Error ${res.status}: ${res.data.detail}`)
    }
  }

  return (
    <div className="space-y-6">
      <RoleMembersTable
        title="Students"
        users={studentUsers}
        role="student"
        memberMap={memberMap}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />
      <RoleMembersTable
        title="Tutors"
        users={tutorUsers}
        role="tutor"
        memberMap={memberMap}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />
    </div>
  )
}

function RoleMembersTable({
  title,
  users,
  role,
  memberMap,
  onAdd,
  onRemove,
}: {
  title: string
  users: any[]
  role: 'student' | 'tutor'
  memberMap: Map<number, string>
  onAdd: (userId: number, role: 'student' | 'tutor') => void
  onRemove: (userId: number) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">
          {users.length} available
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
          <thead className="bg-gray-50 text-gray-500 rounded-xl uppercase">
            <tr className="font-bolder text-xs">
              <th className="py-2 px-3">User</th>
              <th className="py-2 px-3">Linked</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody className="mt-3 bg-white rounded-md">
            {users.map((entry: any) => {
              const user = entry.user
              const isLinked = memberMap.has(user.id)
              return (
                <tr
                  key={user.id}
                  className="border-b border-gray-200 border-dashed text-sm"
                >
                  <td className="py-3 px-4 flex space-x-2 items-center">
                    <span>{user.first_name + ' ' + user.last_name}</span>
                    <span className="text-xs bg-neutral-100 p-1 px-2 rounded-full text-neutral-400 font-semibold">
                      @{user.username}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {isLinked ? (
                      <div className="space-x-1 flex w-fit px-4 py-1 bg-cyan-100 rounded-full items-center text-cyan-800">
                        <Check size={16} />
                        <span>Linked</span>
                      </div>
                    ) : (
                      <div className="space-x-1 flex w-fit px-4 py-1 bg-gray-100 rounded-full items-center text-gray-800">
                        <X size={16} />
                        <span>Not linked</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => onAdd(user.id, role)}
                      className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-cyan-700 rounded-md font-bold items-center text-xs text-cyan-100"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                    <button
                      onClick={() => onRemove(user.id)}
                      className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-gray-700 rounded-md font-bold items-center text-xs text-gray-100"
                    >
                      <X className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function isStudentRole(role: any) {
  return role?.role_uuid === 'role_global_student' || role?.id === 3
}

function isTutorRole(role: any) {
  return role?.role_uuid === 'role_global_tutor' || role?.id === 4
}

export default ManageCourseRooms
