import { getAPIUrl } from '@services/config/config'
import {
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
  data: any,
  access_token: string,
) {
  const url = `${getAPIUrl()}tasks`
  console.log('create exercise url, ', url)

  const result = await fetch(
    url,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  const res = await result.json()
  return res
}

export async function deleteExerciseFromBE(exercise_id: number, access_token:any) {
  const result: any = await fetch(
    `${getAPIUrl()}tasks/id/${exercise_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null,access_token)
  )
  const res = await result.json()
  return res
}