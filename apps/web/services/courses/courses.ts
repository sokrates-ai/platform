import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests'

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function getOrgCourses(
  org_slug: string,
  next: any,
  access_token?: any
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/org_slug/${org_slug}/page/1/limit/10`,
    RequestBodyWithAuthHeader('GET', null, next, access_token ?? undefined)
  )
  const res = await errorHandling(result)
  return res
}

/*
 * tabStore holds the map state for every tab and is by far the largest part of
 * a course payload. Views that render one tab at a time pass
 * includeTabStore: false and pull the tab they show from getCourseTabMap.
 * Editors, which need every tab's state to save it back, keep the default.
 */
export async function getCourseMetadata(
  course_uuid: any,
  next: any,
  access_token?: string | null,
  options?: { includeTabStore?: boolean }
) {
  const query =
    options?.includeTabStore === false ? '?include_tab_store=false' : ''
  const result = await fetch(
    `${getAPIUrl()}courses/course_${course_uuid}/meta${query}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token ?? undefined)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCourseTabMap(
  course_uuid: any,
  tab_uuid: string,
  next: any,
  access_token?: string | null
) {
  const result = await fetch(
    `${getAPIUrl()}courses/course_${course_uuid}/tabs/${encodeURIComponent(
      tab_uuid
    )}/map`,
    RequestBodyWithAuthHeader('GET', null, next, access_token ?? undefined)
  )
  const res = await errorHandling(result)
  return res
}

export async function updateCourse(
  course_uuid: any,
  data: any,
  access_token: any
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCourse(
  course_uuid: string,
  next: any,
  access_token: any,
  options?: { includeTabStore?: boolean }
) {
  const query =
    options?.includeTabStore === false ? '?include_tab_store=false' : ''
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}${query}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCourseById(
  course_id: string,
  next: any,
  access_token: any
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/id/${course_id}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function updateCourseThumbnail(
  course_uuid: any,
  thumbnail: any,
  access_token: any
) {
  const formData = new FormData()
  formData.append('thumbnail', thumbnail)
  const result: any = await fetch(
    `${getAPIUrl()}courses/thumbnail/${course_uuid}`,
    RequestBodyFormWithAuthHeader('PUT', formData, null,access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function createNewCourse(
  org_id: string,
  course_body: any,
  thumbnail: any,
  access_token: any
) {
  // Send file thumbnail as form data
  const formData = new FormData()
  formData.append('name', course_body.name)
  formData.append('description', course_body.description)
  formData.append('public', course_body.visibility)
  formData.append('learnings', course_body.tags)
  formData.append('tags', course_body.tags)
  formData.append('about', course_body.description)

  if (thumbnail) {
    formData.append('thumbnail', thumbnail)
  }

  const result = await fetch(
    `${getAPIUrl()}courses/?org_id=${org_id}`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function deleteCourseFromBackend(
  course_uuid: any,
  access_token: any
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  const res = await errorHandling(result)
  return res
}

interface CourseCanvasRead {
    course_id: number;
    user_id: number;
    selected_chapter_id: number | null;
    selected_tab_id: string | null;
}

export async function getCourseCanvasInteractionState({
  courseUuid,
  access_token,
}: {
  courseUuid: string
  access_token: any
}): Promise<CourseCanvasRead> {

    const result: any = await fetch(
      `${getAPIUrl()}courses/${courseUuid}/canvas`,
      RequestBodyWithAuthHeader('GET', null, null, access_token)
    )
    const res = await errorHandling(result)
    return res
}

export async function updateCourseCanvasInteractionState({
  selectedChapter,
  selectedTabId,
  courseUuid,
  access_token,
}: {
  selectedChapter: number | null,
  selectedTabId: string | null,
  courseUuid: string
  access_token: any
}) {

    const result: any = await fetch(
      `${getAPIUrl()}courses/${courseUuid}/canvas`,
      RequestBodyWithAuthHeader(
        'PUT',
        {
          selected_chapter_id: selectedChapter,
          selected_tab_id: selectedTabId,
        },
        null,
        access_token,
      )
    )
    const res = await errorHandling(result)
    return res
}
