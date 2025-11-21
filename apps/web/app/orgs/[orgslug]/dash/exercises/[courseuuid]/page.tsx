'use client'
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
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
import CourseListing from '../courseListing'
import { useTranslations } from 'next-intl'

type ExerciseProps = {
  params: {
    orgslug: string
    courseuuid: string
  }
}

function ExerciseCourseHome(params: ExerciseProps) {
  const t = useTranslations('ExerciseCourseHome')
  const tasks_page = 1
  const tasks_limit = 100
  const TASKS_URL = `${getAPIUrl()}tasks/list/page/${tasks_page}/limit/${tasks_limit}`

  const course_page = 1
  const course_limit = 100
  const COURSES_URL = `${getAPIUrl()}courses/org_slug/${
    (params as any).params.orgslug
  }/page/${course_page}/limit/${course_limit}`

  const TAGS_URL = `${getAPIUrl()}tasks/tag`

  const searchParams = useSearchParams()
  const isCreatingExercise = searchParams.get('new') ? true : false
  const [newExerciseModal, setNewExerciseModal] =
    React.useState(isCreatingExercise)
  const [editTagsModalOpen, setEditTagsModalOpen] = React.useState(false)
  const isUserAdmin = useAdminStatus() as any

  async function closeNewCourseModal() {
    setNewExerciseModal(false)
  }

  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const org = useOrg() as any

  const { data: courses, isLoading: coursesLoading } = useSWR(
    COURSES_URL,
    (url: string) => swrFetcher(url, access_token)
  )

  // TODO: set limit?
  const { data: exercises, isLoading: exercisesLoading } = useSWR(
    TASKS_URL,
    (url: string) => swrFetcher(url, access_token)
  )

  const { data: tags, isLoading: tagsLoading } = useSWR(
    TAGS_URL,
    (url: string) => swrFetcher(url, access_token)
  )

  console.log(COURSES_URL)
  const courseIDString = params.params.courseuuid
  let course_id = 100000000
  if (courseIDString === 'unassigned') {
    course_id = -1
  } else {
    course_id = parseInt(courseIDString)
  }

  if (coursesLoading || exercisesLoading || tagsLoading) {
    return
  }

  const course = courses.find((c: any) => c.id === course_id)
  if (!course && course_id != -1) {
    return <span>{t('courseNotFound')}</span>
  }

  return (
    <div className="h-full w-full pl-10 pr-10">
      <div className="mb-6">
        <BreadCrumbs type="exercises" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">
            {course ? (
              <>
                {t('courseExercises')}: <q>{course.name}</q>
              </>
            ) : (
              <>{t('unassignedExercises')}</>
            )}
          </h1>
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={org.id}
          >
            <div className="flex gap-5">
              <Modal
                isDialogOpen={editTagsModalOpen}
                onOpenChange={setEditTagsModalOpen}
                minHeight="md"
                dialogContent={
                  <EditTagsModal
                    closeModal={() => setEditTagsModalOpen(false)}
                    orgslug={params.params.orgslug}
                    mutateURL={TAGS_URL}
                    tags={tags}
                  />
                }
                dialogTitle={t('editTags')}
                dialogDescription={t('editTaskTags')}
                dialogTrigger={
                  <button>
                    <button className="rounded-lg bg-black hover:scale-105 transition-all duration-100 ease-linear antialiased ring-offset-purple-800 p-2 px-5 my-auto font text-xs font-bold text-white drop-shadow-lg flex space-x-2 items-center">
                      <div>{t('editTags')}</div>
                    </button>
                  </button>
                }
              />

              <Modal
                isDialogOpen={newExerciseModal}
                onOpenChange={setNewExerciseModal}
                minHeight="md"
                dialogContent={
                  <CreateExerciseModal
                    closeModal={closeNewCourseModal}
                    orgslug={params.params.orgslug}
                    mutateURL={TASKS_URL}
                    courses={courses}
                    tags={tags}
                    courseID={course_id}
                  />
                }
                dialogTitle={t('createExercise')}
                dialogDescription={t('createNewExercise')}
                dialogTrigger={
                  <button>
                    <button className="rounded-lg bg-black hover:scale-105 transition-all duration-100 ease-linear antialiased ring-offset-purple-800 p-2 px-5 my-auto font text-xs font-bold text-white drop-shadow-lg flex space-x-2 items-center">
                      <div>{t('newExercise')}</div>
                      <div className="text-md bg-neutral-800 px-1 rounded-full">
                        +
                      </div>
                    </button>
                  </button>
                }
              />
            </div>
          </AuthenticatedClientElement>
        </div>
      </div>

      <CourseListing
        isUserAdmin={isUserAdmin}
        exercises={exercises}
        tags={tags}
        courses={courses}
        org={org}
        orgslug={params.params.orgslug}
        TASKS_URL={TASKS_URL}
        COURSES_URL={COURSES_URL}
        TAGS_URL={TAGS_URL}
        course_id={course_id}
      />
    </div>
  )
}

export default ExerciseCourseHome
