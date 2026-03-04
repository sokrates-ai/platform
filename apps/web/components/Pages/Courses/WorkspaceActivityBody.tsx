// components/course/WorkspaceActivityBody.tsx
import { getAPIUrl } from '@services/config/config'
import Link from 'next/link'
import React, { useEffect } from 'react'
import Image from 'next/image'
import clsx from 'clsx'

import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { stateConfig } from './stateConfig'

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

interface Props {
  activity: any
  orgslug: string
  course: any
  state: ACTIVITY_STATE        // state of the *parent* activity
  access_token: string
  baseUrl: string
}

/* ------------------------------------------------------------------ */
/* -------------------- helpers / data fetching ---------------------- */
/* ------------------------------------------------------------------ */

export interface Task {
  title: string
  description: string
  task: string
  solution: string
  id: number
}

async function fetchTasks(
  task_ids: number[],
  access_token: string
): Promise<Task[]> {
  const tasks: Task[] = []

  for (const id of task_ids) {
    const res = await fetch(
      `${getAPIUrl()}tasks/id/${id}`,
      RequestBodyWithAuthHeader('GET', null, null, access_token)
    )
    tasks.push(await res.json())
  }

  return tasks
}

/* ------------------------------------------------------------------ */
/* --------------------------- component ----------------------------- */
/* ------------------------------------------------------------------ */

export default function WorkspaceActivityBody(props: Props) {
  const { activity, course, state: parentState, access_token, baseUrl } = props
  const stepRun = course.trail?.runs.find(
    (run: any) => run.course_id === course.id
  )
  const stepData = stepRun?.steps?.find(
    (s: any) => s.activity_id === activity.id
  )

  /** IDs of the tasks that belong to this workspace activity */
  const ids: number[] = React.useMemo(
    () => activity?.content?.task_ids ?? [],
    [activity?.content?.task_ids]
  )

  const [tasks, setTasks] = React.useState<Task[]>([])
  useEffect(() => {
    if (ids.length) {
      fetchTasks(ids, access_token).then(setTasks)
    }
  }, [ids, access_token])

  /* -------------------------------------------------------------- */
  /* helpers to decide *per task* state (available / done)           */
  /* -------------------------------------------------------------- */
  function atomicState(id: number): 'available' | 'done' {
    const part = stepData?.data?.parts?.find((p: any) => p.task_id === id)
    return part?.complete ? 'done' : 'available'
  }

  const tasksDone = tasks.filter((t) => atomicState(t.id) === 'done').length

  /* -------------------------------------------------------------- */
  /* --------------------------- render ---------------------------- */
  /* -------------------------------------------------------------- */
  return (
    <div className={clsx(parentState === 'locked' && 'opacity-60 blur-sm')}>
      {/* header line */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm sm:text-base font-medium">
          Select an exercise from the following: {activity.name}
        </span>
        <span className="text-xs font-semibold">
          {tasksDone}/{tasks.length}
        </span>
      </div>

      {/* grid of task cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tasks.map((t) => {
          const aState = atomicState(t.id)
          const {
            borderColor,     // comes from your stateConfig ('available' | 'done')
          } = stateConfig[aState]

          const url = baseUrl.replaceAll('TASK_ID_PLACEHOLDER', `${t.id}`)
          const locked = parentState === 'locked'

          return (
            <Link
              key={t.id}
              href={locked ? '#' : url}
              className={clsx(
                'relative flex flex-col justify-between rounded-lg bg-white shadow-sm border border-transparent p-4 min-h-[5.5rem] hover:border-gray-300 transition',
                locked && 'cursor-not-allowed'
              )}
            >
              {/* title & (optional) description */}
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-tight">{t.title}</p>
                {t.description && (
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>

              {/* indicator dot (top-right) */}
              <span className="absolute top-2 right-2">
                {aState === 'done' ? (
                  <Image
                    src="/checkmark-green.svg"
                    alt="completed"
                    width={20}
                    height={20}
                    priority
                  />
                ) : (
                  <span
                    className="block w-5 h-5 rounded-full border"
                    style={{ borderColor }}
                  />
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
