'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { revalidateTags } from '@services/utils/ts/requests'
import { BookMinus, MoreVertical, Pencil } from 'lucide-react'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
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
import ModifyExerciseModal from '../Modals/Exercise/Create/ModifyExercise'
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from '@components/ui/button'

export type Exercise = {
  id: number
  title: string
  description: string
  task: string
  solution: string
  tags: string[]
}

type PropsType = {
  exercise: Exercise
  orgslug: string
  orgId: string
  mutateURL: string
  tags: any[],
  courses: any[],
}

function ExerciseThumbnail(props: PropsType) {
  const router = useRouter()
  const org = useOrg() as any
  const session = useSokratesSession() as any;

  const deleteExercise = async () => {
    const toastId = toast.loading('Deleting exercise...')
    try {
      await deleteExerciseFromBE(props.exercise.id, session.data?.tokens?.access_token)
      await revalidateTags(['tasks'], props.orgslug)
      toast.success('Exercise deleted successfully')
      mutate(props.mutateURL)
    } catch (error) {
      toast.error('Failed to delete exercise')
    } finally {
      toast.dismiss(toastId)
    }
  }

  return (
    <Card className="relative bg-gray-200 p-2 rounded-l overflow-hidden">
      <CardContent>
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
              {props.exercise.tags.map((tag: string) => {
                const tagObj = props.tags.find((t: any) => t.value === tag)
                const color = `#${tagObj.color?.toString(16).padStart(6, '0')}`;
                return (
                  <span
                    key={tagObj.value}
                    className="px-2 py-0.5 rounded-full text-xs text-gray-600"
                    style={{ backgroundColor: color }}
                  >
                    {tagObj.value}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
            <DropdownMenuItem onSelect={() => setModifyExerciseModal(true)}>
              <Pencil className="mr-4 h-4 w-4" /> Modify Exercise
            </DropdownMenuItem>

            <div className="my-2"></div>

            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText="Delete Exercise"
                confirmationMessage="Are you sure you want to delete this exercise?"
                dialogTitle={`Delete ${exercise.title}?`}
                dialogTrigger={
                  <button className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-red-600">
                    <BookMinus className="mr-4 h-6 w-4" /> Delete Exercise
                  </button>
                }
                functionToExecute={deleteExercise}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modify Exercise Modal */}
      <Modal
        isDialogOpen={modifyExerciseModal}
        onOpenChange={setModifyExerciseModal}
        minHeight="md"
        dialogContent={
          <ModifyExerciseModal
            orgslug={orgSlug}
            mutateURL={mutateURL}
            exercise={exercise}
            closeModal={() => {
              setModifyExerciseModal(false)
              setDropdownOpen(false)
            }}
            tags={tags}
            courses={courses}
          />
        }
        dialogTitle="Modify Exercise"
        dialogDescription="Modify this exercise"
      />
    </AuthenticatedClientElement>
  )
}

export default ExerciseThumbnail
