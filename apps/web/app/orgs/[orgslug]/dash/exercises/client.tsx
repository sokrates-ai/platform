'use client'
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSearchParams } from 'next/navigation'
import React from 'react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useSWR from 'swr'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import CreateExerciseModal from '@components/Objects/Modals/Exercise/Create/CreateExercise'
import EditTagsModal from '@components/Objects/Modals/Exercise/Create/EditTags'
import { Plus } from 'lucide-react'
import CourseCard from './courseCard'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import type { ApiExercise } from './types'
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs'

type ExerciseProps = {
  orgslug: string
  org_id: string,
}

function ExerciseHome(params: ExerciseProps) {
  const tasks_page = 1;
  const tasks_limit = 100;
  const TASKS_URL = `${getAPIUrl()}tasks/list/page/${tasks_page}/limit/${tasks_limit}`;

  const course_page = 1;
  const course_limit = 100;
  const COURSES_URL = `${getAPIUrl()}courses/org_slug/${params.orgslug}/page/${course_page}/limit/${course_limit}`

  const TAGS_URL = `${getAPIUrl()}tasks/tag`

  const searchParams = useSearchParams()
  const isCreatingExercise = searchParams.get('new') ? true : false
  const [newExerciseModal, setNewExerciseModal] = React.useState(isCreatingExercise)
  const [editTagsModalOpen, setEditTagsModalOpen] = React.useState(false)
  const isUserAdmin = useAdminStatus() as any

  async function closeNewCourseModal() {
    setNewExerciseModal(false)
  }

  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;

  const { data: courses, isLoading: coursesLoading } = useSWR(COURSES_URL, (url: string) => swrFetcher(url, access_token))

  // TODO: set limit?
  const { data: exercises, isLoading: exercisesLoading }: { data: ApiExercise[], isLoading: boolean } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))

  const { data: tags, isLoading: tagsLoading } = useSWR(TAGS_URL, (url: string) => swrFetcher(url, access_token))

  const [selectedTaskType, setSelectedTaskType] = React.useState<'ai' | 'multiple_choice'>('ai')

  if (coursesLoading || exercisesLoading || tagsLoading) {
    return;
  }

  return (
    <div className="h-full w-full pl-10 pr-10">
      <div className="mb-6">
        <BreadCrumbs type="exercises" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">Exercise Library</h1>
          <div className="flex items-center gap-4">
            <Tabs value={selectedTaskType} onValueChange={(v: any) => setSelectedTaskType(v)}>
              <TabsList>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="multiple_choice">Multiple Choice</TabsTrigger>
              </TabsList>
            </Tabs>
            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="courses"
              orgId={params.org_id}
            >
              <div className="flex gap-5">
                <Dialog open={editTagsModalOpen} onOpenChange={setEditTagsModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="lg">Edit Tags</Button>
                  </DialogTrigger>
                  <DialogContent className="min-h-[500px] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Tags</DialogTitle>
                      <DialogDescription>Edit task tags</DialogDescription>
                    </DialogHeader>
                    <EditTagsModal
                      closeModal={() => setEditTagsModalOpen(false)}
                      orgslug={params.orgslug}
                      mutateURL={TAGS_URL}
                      tags={tags}
                    />
                  </DialogContent>
                </Dialog>

                <Dialog open={newExerciseModal} onOpenChange={setNewExerciseModal}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="lg" className="space-x-2">
                      <span>New Exercise</span>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="min-h-[500px] overflow-auto max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Exercise</DialogTitle>
                      <DialogDescription>Create a new exercise</DialogDescription>
                    </DialogHeader>
                    <CreateExerciseModal
                      closeModal={closeNewCourseModal}
                      orgslug={params.orgslug}
                      mutateURL={TASKS_URL}
                      courses={courses}
                      tags={tags}
                      courseID={null}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </AuthenticatedClientElement>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {courses.map((course: any) => {
          const thumbnailImage = course.thumbnail_image
            ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
            : '../empty_thumbnail.png'

          return (<div key={course.course_uuid}>
            <CourseCard
              title={course.name}
              description={course.description}
              imageUrl={thumbnailImage}
              onClick={() => { window.location.href = `/dash/exercises/${course.id}?type=${selectedTaskType}` }}
            >
            </CourseCard>
          </div>
          )
        })}

          <div key={'unassigned'}>
            <CourseCard
              title={"Unassigned"}
              description={"Exercises without a course"}
              imageUrl={undefined}
              onClick={() => { window.location.href = `/dash/exercises/unassigned?type=${selectedTaskType}` }}
            >
            </CourseCard>
          </div>
      </div>
    </div>
  )
}

export default ExerciseHome
