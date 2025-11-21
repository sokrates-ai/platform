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
import { useTranslations } from 'next-intl'

type ExerciseProps = {
  orgslug: string
  org_id: string,
}

function ExerciseHome(params: ExerciseProps) {
  const t = useTranslations('ExerciseHome')
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
  const { data: exercises, isLoading: exercisesLoading } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))
  const { data: tags, isLoading: tagsLoading } = useSWR(TAGS_URL, (url: string) => swrFetcher(url, access_token))

  if (coursesLoading || exercisesLoading || tagsLoading) {
    return;
  }

  // {(!!exercises && !!tags) ?
  //   (<div>
  //     {courses.map((course: any) => (
  //       <div>
  //         {course.name}
  //       </div>
  //     ))}
  //   </div>)
  //   : (<span>LOADING...</span>)
  //   }

  return (
    <div className="h-full w-full pl-10 pr-10">
      <div className="mb-6">
        <BreadCrumbs type="exercises" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">{t('exerciseLibrary')}</h1>
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={params.org_id}
          >
            <div className="flex gap-5">
              <Dialog open={editTagsModalOpen} onOpenChange={setEditTagsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">{t('editTags')}</Button>
                </DialogTrigger>
                <DialogContent className="min-h-[500px] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>{t('editTags')}</DialogTitle>
                    <DialogDescription>{t('editTaskTags')}</DialogDescription>
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
                  <Button variant="default" className="space-x-2">
                    <span>{t('newExercise')}</span>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="min-h-[500px] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>{t('createExercise')}</DialogTitle>
                    <DialogDescription>{t('createNewExercise')}</DialogDescription>
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
              onClick={() => { window.location.href = `/dash/exercises/${course.id}` }}
            >
            </CourseCard>
          </div>
          )
        })}

        <div key={'unassigned'}>
          <CourseCard
            title={t('unassigned')}
            description={t('exercisesWithoutCourse')}
            imageUrl={undefined}
            onClick={() => { window.location.href = `/dash/exercises/unassigned` }}
          >
          </CourseCard>
        </div>
      </div>
    </div>
  )
}

export default ExerciseHome