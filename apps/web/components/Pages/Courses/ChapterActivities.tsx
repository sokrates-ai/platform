import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { getUriWithOrg } from '@services/config/config'
import Link from 'next/link'
import React from 'react'
import ChapterActivity from './ChapterActivity'
import { isActivityDone, isActivityLocked, isChapterLocked } from './utils'

interface Props {
  course: any
  chapterID: number,
  orgslug: string
  courseId: string
  current_activity?: any
}

function ChapterActivities(props: Props) {
  const course = props.course
  const chapterID = props.chapterID
  const orgslug = props.orgslug
  const courseid = props.courseId

  const chapter = course.chapters.find(((c: any) => c.id === chapterID))

  return (<div className='flex flex-col gap-5'>
    {chapter.activities.map((activity: any) => {
      const activityLocked = isActivityLocked(course, chapter, activity.id)
      const activityDone = !activityLocked && isActivityDone(course, activity.id)
      const activityState = (activityLocked ? 'locked' : (activityDone ? 'done' : 'available'))

      return (
        <ChapterActivity
          activity={activity}
          courseId={courseid}
          orgslug={orgslug}
          state={activityState}
        >

        </ChapterActivity>
      )
    })}
  </div>)
}

export default ChapterActivities
