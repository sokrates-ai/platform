'use client'

import React from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  deleteAllCourseMemberGroups,
  deleteCourseMemberGroupsByRooms,
  CourseMemberGroup,
  removeCourseMemberFromGroup,
} from '@services/courses/member-groups'
import { CourseRoomRead } from '@services/courses/rooms'

function displayName(user: {
  first_name?: string
  last_name?: string
  username: string
  email: string
}) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return fullName || user.username || user.email
}

export default function GroupsContent({
  courseUuid,
  groups,
  rooms,
  accessToken,
  onRefresh,
}: {
  courseUuid: string
  groups: CourseMemberGroup[]
  rooms: CourseRoomRead[]
  accessToken: string
  onRefresh: () => Promise<void>
}) {
  const [selectedRoomIds, setSelectedRoomIds] = React.useState<number[]>([])
  const [isDeletingAll, setIsDeletingAll] = React.useState(false)
  const [isDeletingRooms, setIsDeletingRooms] = React.useState(false)
  const [removingMemberKey, setRemovingMemberKey] = React.useState<string | null>(null)

  const toggleRoom = (roomId: number) => {
    setSelectedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId],
    )
  }

  const deleteAll = async () => {
    if (isDeletingAll) return
    setIsDeletingAll(true)
    const result = await deleteAllCourseMemberGroups(courseUuid, accessToken)
    setIsDeletingAll(false)
    if (!result.success) {
      toast.error('Unable to remove all course groups.')
      return
    }
    toast.success('All course groups removed.')
    await onRefresh()
  }

  const deleteByRooms = async () => {
    if (isDeletingRooms || selectedRoomIds.length === 0) return
    setIsDeletingRooms(true)
    const result = await deleteCourseMemberGroupsByRooms(
      courseUuid,
      selectedRoomIds,
      accessToken,
    )
    setIsDeletingRooms(false)
    if (!result.success) {
      toast.error('Unable to remove groups for the selected rooms.')
      return
    }
    toast.success('Matching groups removed.')
    setSelectedRoomIds([])
    await onRefresh()
  }

  const removeMember = async (groupId: number, userId: number) => {
    const key = `${groupId}:${userId}`
    if (removingMemberKey === key) return
    setRemovingMemberKey(key)
    const result = await removeCourseMemberFromGroup(
      courseUuid,
      groupId,
      userId,
      accessToken,
    )
    setRemovingMemberKey(null)
    if (!result.success) {
      toast.error('Unable to remove member from group.')
      return
    }
    toast.success('Member removed from group.')
    await onRefresh()
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border-slate-200">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Groups
          </CardTitle>
          <div className="text-sm text-slate-500">
            Review accepted student groups and remove all groups or only groups
            touching selected rooms.
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {rooms.map((room) => {
              const selected = selectedRoomIds.includes(room.id)
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? 'border-[#FF6934] bg-[#FFF2EC] text-[#B9471B]'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {room.name}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={deleteAll}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? 'Removing...' : 'Remove All Groups'}
            </Button>
            <Button
              type="button"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
              onClick={deleteByRooms}
              disabled={selectedRoomIds.length === 0 || isDeletingRooms}
            >
              {isDeletingRooms ? 'Removing...' : 'Remove Groups In Selected Rooms'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {groups.length ? (
          groups.map((group) => (
            <Card key={group.id} className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Group #{group.id}
                  </CardTitle>
                  <Badge variant="secondary">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {group.members.map((member) => (
                  <div
                    key={member.user.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-start gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {displayName(member.user)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {member.room_ids.length
                            ? `Rooms: ${member.room_ids.join(', ')}`
                            : 'No room assigned'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto rounded-full border-red-200 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeMember(group.id, member.user.id)}
                        disabled={removingMemberKey === `${group.id}:${member.user.id}`}
                      >
                        {removingMemberKey === `${group.id}:${member.user.id}`
                          ? 'Removing...'
                          : 'Kick'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-10 text-center text-sm text-slate-500">
              No groups exist for this course yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
