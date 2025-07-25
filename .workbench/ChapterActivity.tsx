'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Lock } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/button'
import { getUriWithOrg } from '@services/config/config'
import { stateConfig } from './stateConfig'

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

interface Props {
  activity: any
  orgslug: string
  course: any
  state: ACTIVITY_STATE
  access_token: string
  /* new --------------------------------------------------------------- */
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
  // const bulletSize = selected ? 'h-11 w-11' : 'h-9 w-9'

  /* ------------------------------------------------------------------ */
  /* url / button config                                                */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* bullet size + lines                                                */
  /* ------------------------------------------------------------------ */
  const bulletSizeClass = 'h-9 w-9' // selected ?'h-11 w-11' : 'h-9 w-9'
  const bulletStyles = {
    done: 'bg-[#9ABB46] text-white', // not visible – checkmark SVG
    available: '',                     // handled by custom SVG
    locked: 'bg-[#E4E4E4] border-2 border-[#DFDFDF] text-[#3C3C3C]',
  }[state]

  const bullet =
    state === 'done' ? (
      <Image
        src="/checkmark-green.svg"
        alt="Completed"
        width={selected ? 36 : 36} // 44 : 36
        height={selected ? 36 : 36} // 44 : 36
        className="relative z-10 shrink-0"
      />
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
          width={selected ? 36 : 36} // 44 : 36
          height={selected ? 36 : 36}
          className="block"
        />
      </span>
    ) : (
      <span
        className={clsx(
          'relative z-10 flex items-center justify-center rounded-full',
          bulletSizeClass,
          bulletStyles
        )}
      >
        <Lock className="h-4 w-4 text-[#C5C5C5]" />
      </span>
    )

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */
  const buttonVariant =
    cfgButtonVariant ?? (state === 'done' ? 'secondary' : 'outline')

  return (
    <div
      className={clsx(
        'flex items-center rounded-lg w-full transition-all duration-200 h-24',
        selected ? 'bg-[#EBEBEB]' : ''
      )}
    >
      {/* bullet + vertical timeline */}
      <div className="relative flex flex-col items-center justify-center ml-[33px] h-full">
        {showTop && (
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 w-[2px]"
            style={{ backgroundColor: topColour }}
          />
        )}

        {bullet}

        {showBottom && (
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1/2 w-[2px]"
            style={{ backgroundColor: bottomColour }}
          />
        )}
      </div>

      {/* title + description */}
      <div className="flex-1 pl-4">
        <h3
          className={clsx(
            'text-base font-semibold tracking-[0.02em] leading-[125%]',
            selected ? 'text-[#3C3C3C]' : 'text-[#727272]'
          )}
        >
          {activity.name ?? 'Untitled activity'}
        </h3>
        <p
          className={clsx(
            'mt-1 text-xs tracking-[0.02em] leading-[125%]',
            selected ? 'text-[#3C3C3C]' : 'text-[#727272]'
          )}
        >
          {activity.description ??
            'Lorem Ipsum set dolor sit amet, nucti consentur…'}
        </p>
      </div>

      {/* action button */}
      {state !== 'locked' && (
        <Link
          href={activityUrl}
          prefetch={false}
          className="pr-[33px]"
        >
          <Button
            variant={buttonVariant}
            className="h-10 w-36 flex items-center justify-center"
          >
            {buttonText} <ArrowRight strokeWidth={3} className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  )
}
