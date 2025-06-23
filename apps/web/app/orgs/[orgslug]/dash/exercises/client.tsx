'use client'
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { useSearchParams } from 'next/navigation'
import React from 'react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useSWR, { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import CreateExerciseModal from '@components/Objects/Modals/Exercise/Create/CreateExercise'
import ExerciseThumbnail from '@components/Objects/Thumbnails/ExerciseThumbnail'
import EditTagsModal from '@components/Objects/Modals/Exercise/Create/EditTags'
import { Divide } from 'lucide-react'
import CourseCard from './courseCard'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'

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

  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;

  const { data: courses, isLoading: coursesLoading } = useSWR(COURSES_URL, (url: string) => swrFetcher(url, access_token))

  // TODO: set limit?
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
  // }

  return (
    <div className="h-full w-full pl-10 pr-10">
      <div className="mb-6">
        <BreadCrumbs type="exercises" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">Exercise Library</h1>
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={params.org_id}
          >
            <div className="flex gap-5">
              <Modal
                isDialogOpen={editTagsModalOpen}
                onOpenChange={setEditTagsModalOpen}
                minHeight="md"
                dialogContent={
                  <EditTagsModal
                    closeModal={() => setEditTagsModalOpen(false)}
                    orgslug={params.orgslug}
                    mutateURL={TAGS_URL}
                    tags={tags}
                  />
                }
                dialogTitle="Edit Tags"
                dialogDescription="Edit task tags"
                dialogTrigger={
                  <button>
                    <button className="rounded-lg bg-black hover:scale-105 transition-all duration-100 ease-linear antialiased ring-offset-purple-800 p-2 px-5 my-auto font text-xs font-bold text-white drop-shadow-lg flex space-x-2 items-center">
                      <div>Edit Tags</div>
                      {/* <div className="text-md bg-neutral-800 px-1 rounded-full">+</div> */}
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
                    orgslug={params.orgslug}
                    mutateURL={TASKS_URL}
                    courses={courses}
                    tags={tags}
                    courseID={null}
                  />
                }
                dialogTitle="Create Exercise"
                dialogDescription="Create a new exercise"
                dialogTrigger={
                  <button>
                    <button className="rounded-lg bg-black hover:scale-105 transition-all duration-100 ease-linear antialiased ring-offset-purple-800 p-2 px-5 my-auto font text-xs font-bold text-white drop-shadow-lg flex space-x-2 items-center">
                      <div>New Exercise</div>
                      <div className="text-md bg-neutral-800 px-1 rounded-full">+</div>
                    </button>
                  </button>
                }
              />
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
              title={"Unassigned"}
              description={"Exercises without a course"}
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