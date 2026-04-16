import { RequestBodyWithAuthHeader, errorHandling, getResponseMetadata } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function startCourse(course_uuid: string, org_slug: string,access_token:any) {
  const result: any = await fetch(
    `${getAPIUrl()}trail/add_course/${course_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null,access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function removeCourse(course_uuid: string, org_slug: string,access_token:any) {
  const result: any = await fetch(
    `${getAPIUrl()}trail/remove_course/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null,access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function markActivityAsComplete(
  org_slug: string,
  course_uuid: string,
  activity_uuid: string,
  access_token: any,
) {
  const result: any = await fetch(
    `${getAPIUrl()}trail/add_activity/${activity_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null,access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function startActivity(
  activity_uuid: string,
  access_token: any,
) {
  const result: any = await fetch(
    `${getAPIUrl()}trail/start_activity/${activity_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function verifyTrailStep(
  activity_uuid: string,
  student_uuid: string,
  status: 'NONE' | 'CORRECT' | 'INCORRECT',
  access_token: any,
) {
  const result: any = await fetch(
    `${getAPIUrl()}trail/verify_step`,
    RequestBodyWithAuthHeader(
      'POST',
      { activity_uuid, student_uuid, status },
      null,
      access_token
    )
  )
  return await getResponseMetadata(result)
}
