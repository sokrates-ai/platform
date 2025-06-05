import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { CheckCircle, LockIcon, Rocket, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { stateConfig } from './stateConfig'

interface Props {
  activity: any
  orgslug: string
  course: any
  state: ACTIVITY_STATE
  access_token: string
  baseUrl: string
}

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

export interface Task {
  title: string
  description: string
  task: string
  solution: string
  id: number
}

//   const task = fetchTask(activity.k)
async function fetchTasks(
  task_ids: number[],
  access_token: string
): Promise<Task[]> {
  let tasks: Task[] = []

  for (let id of task_ids) {
    const result = await fetch(
      `${getAPIUrl()}tasks/id/${id}`,
      RequestBodyWithAuthHeader('GET', null, null, access_token)
    )
    const res = await result.json()
    // if (res.statusCode !== 200) {
    //   throw `Could not fetch: ${res}`
    // }
    tasks.push(res)
  }

  return tasks
}

function ChapterActivityBody(props: Props) {
  const activity = props.activity
  const orgslug = props.orgslug
  const course = props.course
  const state = props.state

  const steps = course.trail?.runs.find(
    (run: any) => run.course_id == course.id
  ).steps
  const step = steps.find((step: any) => step.activity_id == activity.id)

  let parts: any[] = []
  if (!step) {
    // throw new Error('Activity step not found in the course run.')
    console.log('No step found for activity:', activity.id)
  } else {
    parts = step.data.parts

    if (!parts) {
      throw new Error('Activity content does not contain parts.')
    }
  }

  console.log('parts', parts)

  let ids = activity.content.task_ids

  const [tasks, setTasks] = React.useState<Task[]>([])

  useEffect(() => {
    if (ids) {
      fetchTasks(ids, props.access_token).then((t) => setTasks(t))
    }
  }, [ids, props.access_token])

  return (
    <div className="flex gap-1 min-h-40 py-4 flex-wrap w-full">
      {tasks.map((t) => {
        const task_step = parts.find((part: any) => part.task_id === t.id)
        let atomic_state: 'available' | 'done' = 'available'
        if (task_step) {
          console.log('task_step FOUND: ', task_step)
          if (task_step.complete) {
            atomic_state = 'done'
          }
        } else {
          console.log('task_step NOT FOUND for task: ', t.id)
        }

        const {
          icon,
          badge,
          buttonText,
          mobileButtonText,
          buttonVariant,
          buttonIcon,
          borderColor,
        } = stateConfig[atomic_state]

        const taskUrl = props.baseUrl.replaceAll(
          'TASK_ID_PLACEHOLDER',
          `${t.id}`
        )

        return (
          <Link
            key={t.id}
            href={state === 'locked' ? '#' : taskUrl}
            className="grow flex flex-col text-black rounded-md bg-gray-200 hover:border-gray-500 hover:bg-gray-300 border-transparent"
            style={{
              minWidth: '10rem',
              cursor: state === 'locked' ? 'not-allowed' : 'pointer',
              filter: state === 'locked' ? 'blur(5px)' : 'none',
            }}
          >
            <div className="flex flex-row-reverse items-center pt-2 px-2">
              <div
                className="w-2 h-2 rounded-xl transition-all duration-200 mb-3"
                style={{ backgroundColor: borderColor }}
              ></div>
            </div>

            <div
              className="flex items-center justify-between mb-8 px-6 mt-auto"
              style={{ transform: 'translateY(-1.25rem)' }}
            >
              <span
                style={{ color: buttonText }}
                className="text-l font-medium"
              >
                {t.title}
              </span>

              <div className="hidden sm:block">{badge}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default ChapterActivityBody
