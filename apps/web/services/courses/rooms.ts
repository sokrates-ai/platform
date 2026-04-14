import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests'

export async function getCourseRooms(course_uuid: string, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function createCourseRoom(course_uuid: string, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function updateCourseRoom(course_uuid: string, room_id: number, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms/${room_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function deleteCourseRoom(course_uuid: string, room_id: number, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms/${room_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function getCourseRoomMembers(course_uuid: string, room_id: number, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms/${room_id}/members`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function addCourseRoomMembers(
  course_uuid: string,
  room_id: number,
  user_ids: number | string,
  role: 'student' | 'tutor',
  access_token: string
) {
  const userIdsParam = Array.isArray(user_ids) ? user_ids.join(',') : user_ids
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms/${room_id}/members/add?user_ids=${userIdsParam}&role=${role}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  return await getResponseMetadata(result)
}

export async function removeCourseRoomMembers(
  course_uuid: string,
  room_id: number,
  user_ids: number | string,
  access_token: string
) {
  const userIdsParam = Array.isArray(user_ids) ? user_ids.join(',') : user_ids
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rooms/${room_id}/members/remove?user_ids=${userIdsParam}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return await getResponseMetadata(result)
}
