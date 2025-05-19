import { Lock } from 'lucide-react'
import React from 'react'
import ChapterActivities from './ChapterActivities'
import { isChapterLocked } from './utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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

  // Get chapter index in course
  const chapterIndex =
    course.chapters.findIndex((c: any) => c.id === props.chapterID) + 1
  const totalChapters = course.chapters.length

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-none border-none">
      <CardHeader className="pb-2 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-bold">{chapter.name}</CardTitle>
          </div>
          {chapterLocked && (
            <Lock className="text-muted-foreground mt-1 sm:mt-0" />
          )}
        </div>
        <CardDescription>{chapter.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 px-4 sm:px-6">
        {chapterLocked ? (
          <div className="flex flex-col items-center text-muted-foreground gap-3 py-8 sm:py-12">
            <Lock size={42} strokeWidth={1.5} />
            <h3 className="text-lg font-medium mt-2">This chapter is locked</h3>
            <p className="text-sm text-center max-w-md">
              Complete the previous chapter to unlock this content.
            </p>
          </div>
        ) : (
          <ChapterActivities
            course={course}
            chapterID={chapter.id}
            orgslug={orgslug}
            courseId={courseID}
          />
        )}
      </CardContent>
    </Card>
  )
}

export default CourseChapter
