import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

export type CourseGroupUser = {
  id: number
  user_uuid: string
  username: string
  first_name: string
  last_name: string
  email: string
  avatar_image?: string
}

export type CourseMemberGroupMember = {
  user: CourseGroupUser
  room_ids: number[]
}

export type CourseMemberGroupInvite = {
  id: number
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  sender: CourseGroupUser
  recipient: CourseGroupUser
  creation_date: string
  update_date: string
}

export type CourseMemberGroup = {
  id: number
  member_count: number
  members: CourseMemberGroupMember[]
  creation_date: string
  update_date: string
}

export type CourseMemberGroupMe = {
  group: CourseMemberGroup | null
  sent_invites: CourseMemberGroupInvite[]
  received_invites: CourseMemberGroupInvite[]
}

export type CourseMemberGroupRosterStudent = {
  user: CourseGroupUser
  room_ids: number[]
  group_id: number | null
  has_pending_invite_from_me: boolean
  has_pending_invite_to_me: boolean
}

export async function createCourseMemberGroupInvites(
  courseUuid: string,
  recipientUserIds: number[],
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups/invites`,
    RequestBodyWithAuthHeader(
      'POST',
      { recipient_user_ids: recipientUserIds },
      null,
      accessToken,
    ),
  )
  return await getResponseMetadata(result)
}

export async function acceptCourseMemberGroupInvite(
  courseUuid: string,
  inviteId: number,
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups/invites/${inviteId}/accept`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}

export async function declineCourseMemberGroupInvite(
  courseUuid: string,
  inviteId: number,
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups/invites/${inviteId}/decline`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}

export async function leaveCourseMemberGroup(
  courseUuid: string,
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups/me`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}

export async function deleteAllCourseMemberGroups(
  courseUuid: string,
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups?mode=all`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}

export async function deleteCourseMemberGroupsByRooms(
  courseUuid: string,
  roomIds: number[],
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups?mode=rooms&room_ids=${roomIds.join(',')}`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}

export async function removeCourseMemberFromGroup(
  courseUuid: string,
  groupId: number,
  userId: number,
  accessToken: string,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${courseUuid}/member-groups/${groupId}/members/${userId}`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken),
  )
  return await getResponseMetadata(result)
}
