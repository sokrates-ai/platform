// CourseChapter.tsx
import { Lock } from 'lucide-react'
import React from 'react'
import ChapterActivities from './ChapterActivities'
import { isChapterLocked } from './utils'

interface Props {
  course: any
  chapterID: number
  orgslug: string
  courseId: string
  access_token: string
  selectedTabId: string | null
}

function CourseChapter(props: Props) {
  const course = props.course
  const chapter = course?.chapters?.find((c: any) => c.id === props.chapterID)

  if (!chapter) {
    return null
  }

  const chapterLocked = isChapterLocked(chapter.id, course, {
    activeTabId: props.selectedTabId ?? undefined,
  })

  return (
    <div className="flex flex-col h-full">

      {!chapterLocked ? (
        <div className="z-10 flex justify-between items-center px-5 sm:px-8 lg:px-10 xl:px-16 py-4 sm:py-6 border-b-[#707070] border-b-4 bg-[#EBEBEB]">
          <div>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#3C3C3C]">
              {chapter.name}
            </h2>
            {chapter.description && (
              <p className="mt-1 text-xs sm:text-sm md:text-base text-[#3C3C3C]">
                {chapter.description}
              </p>
            )}
          </div>
        </div>
      ) : <></>}

      <div className="flex-1 overflow-auto z-10">
        {chapterLocked ? (
          <div className="flex flex-col items-center justify-center px-4 text-center text-[#3c3c3c] w-full h-full">
            <Lock
              size={88}
              strokeWidth={1.5}
              className="text-[#3C3C3C] mb-2 sm:mb-2"
            />
            <h3 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-[0.02em] leading-[1.25] mb-2 text-[#3C3C3C]">
              Chapter "{chapter.name}" is locked
            </h3>
            <p className="text-xs sm:text-sm md:text-base tracking-[0.02em] leading-[1.25] max-w-[280px] sm:max-w-[350px] mx-auto text-[#3C3C3C]">
              Complete the previous chapters
            </p>
          </div>
        ) : (
          <ChapterActivities
            course={course}
            chapterID={chapter.id}
            orgslug={props.orgslug}
            courseId={props.courseId}
            access_token={props.access_token}
            selectedTabId={props.selectedTabId ?? null}
          />
        )}
      </div>
    </div>
  )
}

export default CourseChapter
