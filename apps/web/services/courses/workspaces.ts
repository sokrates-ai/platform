import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
} from '@services/utils/ts/requests'

export async function createWorkspace(
  data: any,
  taskID: number,
  chapter_id: any,
  org_id: any,
  access_token: string,
) {
  data.content = {
    task_id: taskID,
  }
  // remove chapter_id from data
  delete data.chapterId

  const result = await fetch(
    `${getAPIUrl()}activities/?coursechapter_id=${chapter_id}&org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  const res = await result.json()
  return res
}

export async function createExercise(
  // org_id: any,
  data: any,
  access_token: string,
) {
  const result = await fetch(
    `${getAPIUrl()}tasks`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  const res = await result.json()
  return res
}