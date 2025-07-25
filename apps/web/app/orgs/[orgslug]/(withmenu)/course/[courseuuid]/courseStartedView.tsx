'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import { DoorOpen } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import {
  isActivityDone,
  isChapterLocked,
} from '@components/Pages/Courses/utils'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { updateCourseCanvasInteractionState } from '@services/courses/courses'
import CourseChapter from '@components/Pages/Courses/CourseChapter'

type Props = {
  courseuuid: string
  orgslug: string
  course: any
  selectedChapterId: number | null
}

const CourseStartedView = ({
  courseuuid,
  orgslug,
  course,
  selectedChapterId,
}: Props) => {
  const courseIdWithoutPrefix = courseuuid.replace('course_', '')

  const chapterStates = useMemo(() => {
    const result: Record<number, 'locked' | 'unlocked' | 'finished'> = {}
    if (course?.chapters) {
      course.chapters.forEach((chapter: any) => {
        if (isChapterLocked(chapter.id, course)) {
          result[chapter.id] = 'locked'
        } else {
          const allDone =
            chapter.activities.length > 0 &&
            chapter.activities.every((act: any) =>
              isActivityDone(course, act.id),
            )
          result[chapter.id] = allDone ? 'finished' : 'unlocked'
        }
      })
    }
    return result
  }, [course])

  const layout: LayoutState = useMemo(
    () => ({
      layout: course?.map_state?.objects || [],
      boundaries: course?.map_state?.boundaries ?? {
        left: -1000,
        right: 1000,
        top: -1000,
        bottom: 1000,
      },
      updateOriginator: 'initial',
    }),
    [course],
  )

  const [chapterDialogOpen, setChapterDialogOpen] = useState(
    selectedChapterId != null,
  )
  const [selectedChapter, setSelectedChapter] = useState(
    selectedChapterId ?? 0,
  )

  const session = useSokratesSession() as any
  const access_token: string | undefined = session?.data?.tokens?.access_token

  useEffect(() => {
    updateCourseCanvasInteractionState({
      courseUuid: `course_${courseuuid}`, // TODO: verify naming scheme
      selectedChapter: chapterDialogOpen ? selectedChapter : null,
      access_token,
    })
  }, [
    selectedChapter,
    chapterDialogOpen,
    access_token,
    courseuuid,
  ])

  if (!course) return <PageLoading />

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Modal
        isDialogOpen={chapterDialogOpen}
        onOpenChange={setChapterDialogOpen}
        customWidth="w-[95vw] max-w-[62.4375rem]"
        customHeight="h-[60vh] max-h-[35rem]" 
        dialogContent={<CourseChapter
          course={course}
          courseId={courseIdWithoutPrefix}
          orgslug={orgslug}
          chapterID={selectedChapter}
          access_token={access_token ?? ''}
        />
        }
      />

      <Link href={getUriWithOrg(orgslug, '/')}>
        <Button
          variant="secondary"
          size="default"
          className="
            absolute bottom-8
            left-1/2 transform -translate-x-1/2
            md:left-8 md:translate-x-0
            z-10 h-10 w-18
          "
        >
          <DoorOpen className="size-6" style={{ color: '#454545' }} />
        </Button>
      </Link>

      <div className="relative flex-1 overflow-hidden">
        <Canvas
          layout={layout}
          readOnly
          chapterStates={chapterStates}
          setLayout={() => {
            throw new Error(
              'BUG: Canvas layout mutation should not be called from read-only view.',
            )
          }}
          onChapterClick={(chapterId: number) => {
            setSelectedChapter(chapterId)
            setChapterDialogOpen(true)
          }}
        />
      </div>
    </div>
  )
}

export default CourseStartedView
