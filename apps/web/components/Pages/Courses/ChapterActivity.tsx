import { getUriWithOrg } from '@services/config/config'
import { Check, Lock, Rocket } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

interface Props {
  activity: any
  // chapterID: number,
  orgslug: string
  courseId: string
  // current_activity?: any

  state: ACTIVITY_STATE
}

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

function ChapterActivity(props: Props) {
  const activity = props.activity
  const orgslug = props.orgslug
  const courseid = props.courseId
  const state = props.state

  const styleMapping = {
    'available': {
      link: 'bg-black hover:bg-gray-700',
      text: 'Available',
      textStyle: 'text-white',
      icon: (<Rocket size={20} color={'gray'}></Rocket>)
    },
    'locked': {
      link: 'bg-gray-900 pointer-events-none',
      text: 'Locked',
      textStyle: 'text-gray-200',
      icon: (<Lock size={20} color={'gray'}></Lock>)
    },
    'done': {
      link: 'bg-teal-900 hover:bg-teal-700',
      text: 'Completed',
      textStyle: 'text-gray-200',
      icon: (<Check size={20} color={'gray'}></Check>)
    }
  }

  return (
    <Link
      href={
        getUriWithOrg(orgslug, '') +
        `/course/${courseid}/activity/${activity.activity_uuid.replace(
          'activity_',
          ''
        )}`
      }
      className={styleMapping[state].link}
    >
      <div
        className={`h-[70px] w-auto flex justify-between px-10 py-2 items-center ${styleMapping[state]} rounded-lg shadow-md`}
      >
        <span className={'text-xl ' + styleMapping[state].textStyle}>{activity.name}</span>
        <div className='flex items-center gap-2'>
          <span className='text-gray-200 text-xs'>
            {styleMapping[state].text}
          </span>
          {styleMapping[state].icon}
        </div>
      </div>
    </Link>
  )
}

export default ChapterActivity
