'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'
import { deleteCourseFromBackend } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { revalidateTags } from '@services/utils/ts/requests'
import { BookMinus, FilePenLine, Settings2, MoreVertical, Pencil } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import toast from 'react-hot-toast'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { deleteExerciseFromBE } from '@services/courses/workspaces'
import { mutate } from 'swr'
import CreateExerciseModal from '../Modals/Exercise/Create/CreateExercise'
import ModifyExerciseModal from '../Modals/Exercise/Create/ModifyExercise'

export type Exercise = {
  id: number
  title: string
  description: string
  task: string
  solution: string
  tags?: string[] // Optional array of tags
}

type PropsType = {
  exercise: Exercise
  orgslug: string
  orgId: string
  mutateURL: string
  tags: any[],
  courses: any[],
  // customLink?: string
}

// export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '')

function ExerciseThumbnail(props: PropsType) {
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any

  const deleteExercise = async () => {
    // TODO: not implemented!
    const toastId = toast.loading('Deleting exercise...')
    try {
      await deleteExerciseFromBE(props.exercise.id, session.data?.tokens?.access_token)
      await revalidateTags(['tasks'], props.orgslug)
      toast.success('Exercise deleted successfully')
      // router.refresh()
      mutate(props.mutateURL)
    } catch (error) {
      toast.error('Failed to delete exercise')
    } finally {
      toast.dismiss(toastId)
    }
  }

  // const thumbnailImage = course.thumbnail_image
  //   ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
  //   : '../empty_thumbnail.png'

  return (
    <div className="relative bg-gray-200 p-2 rounded-l">
      <AdminEditOptions
        exercise={props.exercise}
        orgSlug={props.orgslug}
        orgId={props.orgId}
        mutateURL={props.mutateURL}
        deleteExercise={deleteExercise}
        tags={props.tags}
        courses={props.courses}
      />
      <div className='flex flex-col w-full pt-3 space-y-2'>
        <h2 className="font-bold text-gray-800 line-clamp-2 leading-tight text-lg capitalize">{props.exercise.title}</h2>
        <p className='text-sm text-gray-700 leading-normal line-clamp-3'>{props.exercise.description}</p>
        {props.exercise.tags && props.exercise.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {props.tags.map((tag: any) => {
              const color = `#${tag.color?.toString(16).padStart(6, '0')}`;
              return (<span
                key={tag.value}
                className="px-2 py-0.5 rounded-full text-xs text-gray-600"
                style={{
                  backgroundColor: color
                }}
              >
                {tag.value}
              </span>)
            })}
          </div>
        )}
      </div>
    </div >
  )
}

const AdminEditOptions = ({ exercise, orgId, orgSlug, mutateURL, deleteExercise, tags, courses }: {
  exercise: Exercise,
  orgId: string,
  orgSlug: string,
  mutateURL: string,
  tags: any[],
  courses: any[],
  deleteExercise: () => Promise<void>
}) => {
  const [modifyExerciseModal, setModifyExerciseModal] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={orgId}
    >
      <div className="absolute top-2 right-2 z-20">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button className="p-1 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-md">
              <MoreVertical size={20} className="text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* <DropdownMenuItem asChild>
              <Link prefetch href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`)}>
                <FilePenLine className="mr-2 h-4 w-4" /> Edit Content
              </Link>
            </DropdownMenuItem> */}
            {/* <DropdownMenuItem asChild>
              <Link prefetch href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`)}>
                <Settings2 className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem> */}


            <DropdownMenuItem asChild>
              <Modal
                isDialogOpen={modifyExerciseModal}
                onOpenChange={setModifyExerciseModal}
                minHeight="md"
                dialogContent={
                  <ModifyExerciseModal
                    orgslug={orgSlug}
                    mutateURL={mutateURL}
                    exercise={exercise}
                    closeModal={() => { setModifyExerciseModal(false); setDropdownOpen(false) }}
                    tags={tags}
                    courses={courses}
                  >
                  </ModifyExerciseModal>

                  // <CreateExerciseModal
                  //   // closeModal={closeNewCourseModal}
                  //   orgslug={orgSlug}
                  //   mutateURL={mutateURL}
                  // />
                }
                dialogTitle="Modify Exercise"
                dialogDescription="Modify this exercise"
                dialogTrigger={
                  // <button>
                  // <button className="rounded-lg bg-black hover:scale-105 transition-all duration-100 ease-linear antialiased ring-offset-purple-800 p-2 px-5 my-auto font text-xs font-bold text-white drop-shadow-lg flex space-x-2 items-center">
                  //   Modify Exercise
                  //   {/* <div className="text-md bg-neutral-800 px-1 rounded-full">+</div> */}
                  // </button>
                  <button className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-gray-500/10 hover:bg-gray-500/20 transition-colors text-white-600">
                    <Pencil className="mr-4 h-4 w-4" /> Modify Exercise
                  </button>
                  // </button>
                }
              />
            </DropdownMenuItem>


            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText="Delete Exercise"
                confirmationMessage="Are you sure you want to delete this exercise?"
                dialogTitle={`Delete ${exercise.title}?`}
                dialogTrigger={
                  <button className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-red-600">
                    <BookMinus className="mr-4 h-4 w-4" /> Delete Exercise
                  </button>
                }
                functionToExecute={deleteExercise}
                status="warning"
              />
            </DropdownMenuItem>



          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AuthenticatedClientElement>
  )
}

export default ExerciseThumbnail