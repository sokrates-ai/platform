import { Lock } from 'lucide-react'
import React from 'react'
import ChapterActivities from './ChapterActivities'
import { isChapterLocked } from './utils'

interface Props {
  course: any
  chapterID: number
  orgslug: string
  courseId: string
}

function CourseChapter(props: Props) {
  const course = props.course
  const orgslug = props.orgslug
  const courseID = props.courseId

  const chapter = course.chapters.find((c: any) => c.id === props.chapterID)
  const chapterLocked = isChapterLocked(chapter.id, course)

  return (
    <div className='bg-red-200 px-20 py-10'>
      <div className='mb-5'>
        <h1 className='text-xl font-bold'>{chapter.name}</h1>
        <h5 className='text-l text-gray-600'>{chapter.description}</h5>
      </div>

      {chapterLocked ? (
        <div className='flex flex-col items-center text-gray-600 gap-3'>
          <h1 className='text-xl'>
            This chapter is locked.
          </h1>

          <Lock size={60}></Lock>

          <span className='text-s'>
            Please complete the previous chapter before coming back.
          </span>
        </div>
      ) : (
        <ChapterActivities
          course={course}
          chapterID={chapter.id}
          orgslug={orgslug}
          courseId={courseID}
        >
        </ChapterActivities>
      )}
    </div>
  )
}

export default CourseChapter
