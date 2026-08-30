import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

export async function resetCourseProgress(
  course_uuid: string,
  user_ids: number[],
  access_token: string
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/progress/reset`,
    RequestBodyWithAuthHeader('POST', { user_ids }, null, access_token)
  )
  return await getResponseMetadata(result)
}
