'use client'
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useSWR, { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import CreateExerciseModal from '@components/Objects/Modals/Exercise/Create/CreateExercise'
import ExerciseThumbnail from '@components/Objects/Thumbnails/ExerciseThumbnail'
//import { Divide } from 'lucide-react'

type ExerciseProps = {
  orgslug: string
  org_id: string
}

function ExerciseHome(params: ExerciseProps) {
  const searchParams = useSearchParams()
  const isCreatingExercise = searchParams.get('new') ? true : false
  // TODO: rename this in create-exercise!
  const [newExerciseModal, setNewExerciseModal] = React.useState(isCreatingExercise)
  // const orgslug = params.orgslug
  // const courses = params.courses
  const isUserAdmin = useAdminStatus() as any

  async function closeNewCourseModal() {
    setNewExerciseModal(false)
  }

  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  // const [exercises, setExercises] = React.useState<any[]>([])

  // TODO: set limit?
  const TASKS_URL = `${getAPIUrl()}tasks/list/page/1/limit/50`;
  const { data: exercises } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))

  // useEffect(() => {
  //   if (res.data)
  //     setExercises(res.data)
  // }, [res])

  return (
    <div className="h-full w-full bg-[#f8f8f8] pl-10 pr-10">
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
            <Modal
              isDialogOpen={newExerciseModal}
              onOpenChange={setNewExerciseModal}
              minHeight="md"
              dialogContent={
                <CreateExerciseModal
                  closeModal={closeNewCourseModal}
                  orgslug={params.orgslug}
                  mutateURL={TASKS_URL}
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
          </AuthenticatedClientElement>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {exercises ? exercises.map((exercise: any) => (
          <div key={exercise.id}>
            <ExerciseThumbnail
              // customLink={`/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`}
              // course={course}
              orgId={org.id}
              orgslug={params.orgslug}
              exercise={exercise} 
              mutateURL={TASKS_URL}
            />
          </div>
        )) : <div></div>}
        {(!exercises || exercises.length === 0) && (
          <div className="col-span-full flex justify-center items-center py-8">
            <div className="text-center">
              <div className="mb-4">
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 295 295"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto"
                >
                  {/* ... SVG content ... */}
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-600 mb-2">
                No exercises yet
              </h2>
              <p className="text-lg text-gray-400">
                {isUserAdmin ? (
                  "Create an exercise to add content"
                ) : (
                  "No exercise available yet"
                )}
              </p>
              {isUserAdmin && (
                <div className="mt-6">
                  <AuthenticatedClientElement
                    action="create"
                    ressourceType="courses"
                    checkMethod="roles"
                    orgId={params.org_id}
                  >
                    <Modal
                      isDialogOpen={newExerciseModal}
                      onOpenChange={setNewExerciseModal}
                      minHeight="md"
                      dialogContent={
                        <CreateExerciseModal
                          closeModal={closeNewCourseModal}
                          orgslug={params.orgslug}
                          mutateURL={TASKS_URL}
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
                  </AuthenticatedClientElement>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExerciseHome