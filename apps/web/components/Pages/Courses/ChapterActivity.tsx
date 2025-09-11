'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Lock } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/button'
import { getUriWithOrg } from '@services/config/config'
import { stateConfig } from './stateConfig'
import { useSearchParams } from 'next/navigation'

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

interface Props {
  activity: any
  orgslug: string
  course: any
  state: ACTIVITY_STATE
  access_token: string
  selected?: boolean
  showTop?: boolean
  showBottom?: boolean
  topColour?: string
  bottomColour?: string
}

export default function ChapterActivity({
  activity,
  orgslug,
  course,
  state,
  selected = false,
  showTop = false,
  showBottom = false,
  topColour = '#DFDFDF',
  bottomColour = '#DFDFDF',
}: Props) {
  const isFreeSelect =
    activity.activity_type === 'TYPE_WORKSPACE' &&
    activity.content?.task_ids?.length > 1

  const courseUuid = course.course_uuid.replace('course_', '')
  const activityUuid = activity.activity_uuid.replace('activity_', '')

  const activityUrl =
    getUriWithOrg(orgslug, '') +
    `/course/${courseUuid}/activity/${activityUuid}${isFreeSelect ? '?task_id=TASK_ID_PLACEHOLDER' : ''
    }`

  const { buttonText = 'Review', buttonVariant: cfgButtonVariant } =
    stateConfig[state] ?? {}

  const bulletSizeClass = clsx(
    'h-6 w-6',
    'sm:h-9 sm:w-9'
  )

  const bullet =
    state === 'done' ? (
      <span
        className={clsx(
          'relative z-10 shrink-0 flex items-center justify-center rounded-full overflow-hidden',
          bulletSizeClass,
          'bg-[#9ABB46]'
        )}
      >
        <Image
          src="/checkmark-green.svg"
          alt="Completed"
          fill
          className="object-contain"
        />
      </span>
    ) : state === 'available' ? (
      <span
        className={clsx(
          'relative z-10 flex items-center justify-center rounded-full overflow-hidden',
          bulletSizeClass
        )}
        style={{
          backgroundColor: selected ? '#EBEBEB' : '#F1F1F1',
        }}
      >
        <Image
          src="/available-circle.svg"
          alt="Available"
          fill
          className="object-contain"
        />
      </span>
    ) : (
      <span
        className={clsx(
          'relative z-10 flex items-center justify-center rounded-full',
          bulletSizeClass,
          'bg-[#E4E4E4] border-2 border-[#DFDFDF]'
        )}
      >
        <Lock className={clsx('sm:h-4 sm:w-4 h-3 w-3 text-[#C5C5C5]')} />
      </span>
    )

  const buttonVariant =
    cfgButtonVariant ?? (state === 'done' ? 'secondary' : 'outline')
  const buttonClass = clsx(
    'flex items-center justify-center',
    'h-8 w-24 text-xs',
    'sm:h-10 sm:w-36 sm:text-sm'
  )

  const searchParams = useSearchParams()
  const selectedTaskId = searchParams.get('task_id') || ''
  const baseUrl =
    getUriWithOrg(orgslug, '') +
    `/course/${courseUuid}/activity/${activityUuid}`

  if (isFreeSelect) {
    const tasks: Array<{
      task_id: string
      title: string
      description: string
      state?: ACTIVITY_STATE
    }> = activity.content.tasks ?? []

    return (
      <div className="relative w-full h-[305px] bg-[#EBEBEB] rounded-lg font-inter text-[#3C3C3C]">
        {/* header */}
        <div className="absolute inset-x-6 top-6 flex justify-between">
          <h2 className="font-semibold text-base tracking-[0.02em] leading-[125%]">
            Select and exercise from the following
          </h2>
          <span className="font-semibold tracking-[0.02em] leading-[125%]">
            1/{tasks.length}
          </span>
        </div>

        {/* 2‑column grid of tasks */}
        <div className="absolute inset-x-6 top-20 grid grid-cols-2 gap-x-8 gap-y-4">
          {activity.content.task_ids.map((taskId: string) => {
            const task =
              tasks.find((t) => t.task_id === taskId) || {
                task_id: taskId,
                title: 'Untitled task',
                description: '',
                state: 'available' as ACTIVITY_STATE,
              }

            const taskState: ACTIVITY_STATE =
              (task.state as ACTIVITY_STATE) ?? 'locked'
            const isThisSelected = selectedTaskId === taskId
            const href = `${baseUrl}?task_id=${taskId}`

            return (
              <Link
                key={taskId}
                href={href}
                prefetch={false}
                className={clsx(
                  'flex items-center rounded-lg h-[58px] px-4 transition-colors',
                  isThisSelected ? 'bg-[#EBEBEB]' : 'bg-[#F1F1F1]'
                )}
              >
                {/* bullet */}
                <span
                  className={clsx(
                    'relative z-10 flex items-center justify-center rounded-full h-6 w-6 overflow-hidden',
                    taskState === 'done'
                      ? 'bg-[#9ABB46]'
                      : taskState === 'available'
                        ? isThisSelected
                          ? 'bg-[#EBEBEB]'
                          : 'bg-[#F1F1F1]'
                        : 'bg-[#E4E4E4] border-2 border-[#DFDFDF]'
                  )}
                >
                  {taskState === 'done' ? (
                    <Image
                      src="/checkmark-green.svg"
                      alt="Completed"
                      fill
                      className="object-contain"
                    />
                  ) : taskState === 'available' ? (
                    <Image
                      src="/available-circle.svg"
                      alt="Available"
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <Lock className="h-3 w-3 text-[#C5C5C5]" />
                  )}
                </span>

                {/* title + subtitle */}
                <div className="ml-3 flex-1">
                  <h4
                    className={clsx(
                      'font-semibold text-sm tracking-[0.02em] leading-[125%]',
                      isThisSelected ? 'text-[#3C3C3C]' : 'text-[#727272]'
                    )}
                  >
                    {task.title}
                  </h4>
                  <p className="mt-1 text-[11px] tracking-[0.02em] leading-[125%] truncate">
                    {task.description}
                  </p>
                </div>

                {/* arrow */}
                <ArrowRight strokeWidth={3} className="h-3 w-3" />
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex items-center rounded-lg w-full transition-all duration-200',
        'h-16 sm:h-24',
        selected ? 'bg-[#EBEBEB]' : ''
      )}
    >
      <div
        className={clsx(
          'relative flex flex-col items-center justify-center',
          'ml-6 sm:ml-[33px] h-full'
        )}
      >
        {showTop && (
          <span
            className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-[2px]"
            style={{ backgroundColor: topColour }}
          />
        )}

        {bullet}

        {showBottom && (
          <span
            className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-[2px]"
            style={{ backgroundColor: bottomColour }}
          />
        )}
      </div>

      <div className="flex-1 pl-3 pr-2 sm:pl-4 sm:pr-0">
        <h3
          className={clsx(
            'font-semibold tracking-[0.02em] leading-[125%]',
            'text-sm sm:text-base',
            selected ? 'text-[#3C3C3C]' : 'text-[#727272]'
          )}
        >
          {activity.title ?? activity.name ?? 'Untitled activity'}
        </h3>
        <p
          className={clsx(
            'mt-1 tracking-[0.02em] leading-[125%]',
            'text-[11px] sm:text-xs',
            'truncate sm:whitespace-normal'
          )}
        >
          {activity.description ??
            'Lorem Ipsum set dolor sit amet, nucti consentur…'}
        </p>
      </div>

      {state !== 'locked' && (
        <Link href={activityUrl} prefetch={false} className="pr-3 sm:pr-[33px]">
          <Button variant={buttonVariant} className={buttonClass}>
            <span className="flex-1 text-center">{buttonText}</span>
            <ArrowRight
              strokeWidth={3}
              className="sm:h-4 sm:w-4 h-3 w-3"
            />
          </Button>
        </Link>
      )}
    </div>
  )
}
