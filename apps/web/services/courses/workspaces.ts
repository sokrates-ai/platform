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
  let urlComplete = `${getAPIUrl()}tasks`
  // TODO: use relative URL if not in localhost!!!

  // const newURL = new URL(urlComplete)
  // const url = newURL.pathname

  console.log('create exercise url, ', urlComplete)

  const result = await fetch(
    urlComplete,
    RequestBodyWithAuthHeader('POST', data, { revalidate: 0, tags: ['tasks'] }, access_token)
  )
  const res = await result.json()
  return res
}

export async function modifyExercise(
  data: any,
  access_token: string,
) {
  let urlComplete = `${getAPIUrl()}tasks`
  // TODO: use relative URL if not in localhost!!!

  // const newURL = new URL(urlComplete)
  // const url = newURL.pathname

  console.log('create exercise url, ', urlComplete)

  const result = await fetch(
    urlComplete,
    RequestBodyWithAuthHeader('PUT', data, { revalidate: 0, tags: ['tasks'] }, access_token)
  )

  if (result.status !== 200) {
    throw(`Illegal response: ${await result.text()}`)
  }

  const res = await result.json()
  return res
}

export async function deleteExerciseFromBE(exercise_id: number, access_token: any) {
  const result: any = await fetch(
    `${getAPIUrl()}tasks/id/${exercise_id}`,
    RequestBodyWithAuthHeader('DELETE', null, { revalidate: 0, tags: ['ex'] }, access_token)
  )
  const res = await result.json()
  return res
}