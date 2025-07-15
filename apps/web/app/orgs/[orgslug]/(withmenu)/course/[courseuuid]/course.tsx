'use client'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { getUriWithOrg } from '@services/config/config'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { revalidateTags } from '@services/utils/ts/requests'
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators'
import { useRouter } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import {
  getCourseThumbnailMediaDirectory,
  getUserAvatarMediaDirectory,
} from '@services/media/media'
import {
  ArrowRight,
  Backpack,
  Check,
  File,
  Sparkles,
  Video,
} from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import CourseUpdates from '@components/Objects/Courses/CourseUpdates/CourseUpdates'
import { CourseProvider } from '@components/Contexts/CourseContext'
import { useMediaQuery } from 'usehooks-ts'
import CoursesActions, {
  courseIsStarted,
} from '@components/Objects/Courses/CourseActions/CoursesActions'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import ChapterActivities from '@components/Pages/Courses/ChapterActivities'
import CourseChapter from '@components/Pages/Courses/CourseChapter'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { AssetData } from '@components/Objects/ContentMap/Asset'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { isChapterLocked, isActivityDone } from '@components/Pages/Courses/utils'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateCourseCanvasInteractionState } from '@services/courses/courses'

const CourseClient = (props: any) => {
	const [learnings, setLearnings] = useState<string[]>([])
	const courseuuid = props.courseuuid
	const courseid = courseuuid.replace('course_', '')
	const orgslug = props.orgslug
	const course = props.course
	const selectedChapterId = props.selectedChapterId;
	const org = useOrg() as any
	const router = useRouter()
	const isMobile = useMediaQuery('(max-width: 768px)');

  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  function getLearningTags() {
    const learningItems = course?.learnings ? course?.learnings.split(',') : []
    setLearnings(learningItems)
  }

  useEffect(() => {
    getLearningTags()
  }, [org, course])

	const [chapterDialogOpen, setChapterDialogOpen] = useState(selectedChapterId != null)
	const [selectedChapter, setSelectedChapter] = useState(selectedChapterId != null ? selectedChapterId : 0)
   	useEffect(() => {
		updateCourseCanvasInteractionState({
			selectedChapter: chapterDialogOpen ? selectedChapter : null,
			courseUuid: 
			// TODO: Find out why we normally remove "course" from the course uuid.
			`course_${courseuuid}`,
			access_token,
		})
    },[selectedChapter, chapterDialogOpen, access_token, courseuuid]) 
  const isStarted = courseIsStarted(course)

  const layout: LayoutState = {
    layout: course?.map_state?.objects || [],
    updateOriginator: 'initial',
    boundaries: course?.map_state?.boundaries || {
      left: -1000,
      right: 1000,
      top: -1000,
      bottom: 1000,
    },
  }

  if (!course || !org) {
    return <PageLoading />
  }

  if (isStarted) {
    // Compute chapter states
    const chapterStates: Record<number, 'locked' | 'unlocked' | 'finished'> = {}
    if (course && course.chapters) {
      for (const chapter of course.chapters) {
        const locked = isChapterLocked(chapter.id, course)
        if (locked) {
          chapterStates[chapter.id] = 'locked'
        } else {
          const allDone =
            chapter.activities.length > 0 &&
            chapter.activities.every((act: any) =>
              isActivityDone(course, act.id)
            )
          chapterStates[chapter.id] = allDone ? 'finished' : 'unlocked'
        }
      }
    }
    return (
      <div className="w-full h-[calc(100vh-60px)] max-w-full overflow-hidden">
        <Modal
          isDialogOpen={chapterDialogOpen}
          onOpenChange={setChapterDialogOpen}
          minHeight="md"
          minWidth="md"
          dialogContent={
            <CourseChapter
              course={course}
              courseId={courseid}
              orgslug={orgslug}
              chapterID={selectedChapter}
              access_token={access_token}
            />
          }
        />

        <Canvas
          layout={layout}
          setLayout={() => {
            throw 'BUG: This cannot be called from here.'
          }}
          readOnly={true}
          onChapterClick={(chapter: number) => {
            setSelectedChapter(chapter)
            setChapterDialogOpen(true)
          }}
          chapterStates={chapterStates}
        />
      </div>
    )
  }

	return (
		<GeneralWrapperStyled>
			<div className="pb-3 flex flex-col md:flex-row justify-between items-start md:items-center">
				<div>
					<Badge variant="secondary" className="mb-2">Course</Badge>
					<h1 className="text-2xl md:text-3xl font-bold">{course.name}</h1>
				</div>
				<div className="mt-4 md:mt-0 w-full md:w-auto">
					<CourseProvider courseuuid={course.course_uuid}>
						<CourseUpdates />
					</CourseProvider>
				</div>
			</div>

      <Card className="mb-6 overflow-hidden border-none">
        {course?.thumbnail_image && org ? (
          <div
            className="w-full h-[200px] md:h-[400px] bg-cover bg-center rounded-lg shadow-md"
            style={{
              backgroundImage: `url(${getCourseThumbnailMediaDirectory(
                org?.org_uuid,
                course?.course_uuid,
                course?.thumbnail_image
              )})`,
            }}
          />
        ) : (
          <div
            className="w-full h-[200px] md:h-[400px] bg-cover bg-center rounded-lg shadow-md"
            style={{
              backgroundImage: `url('../empty_thumbnail.png')`,
              backgroundSize: 'auto',
            }}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
        <div className="col-span-1 md:col-span-3 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">About</h2>
              <p className="whitespace-pre-wrap text-gray-700">
                {course.about}
              </p>
            </CardContent>
          </Card>

          {learnings.length > 0 && learnings[0] !== 'null' && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-3">What you will learn</h2>
                <div className="space-y-2">
                  {learnings.map((learning: string, index: number) => (
                    <div key={index} className="flex space-x-3 items-start">
                      <div className="mt-0.5 bg-primary/10 p-1.5 rounded-full">
                        <Check className="text-primary" size={14} />
                      </div>
                      <p className="text-gray-700">{learning}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="col-span-1">
          <CoursesActions
            courseuuid={courseuuid}
            orgslug={orgslug}
            course={course}
          />
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

export default CourseClient
