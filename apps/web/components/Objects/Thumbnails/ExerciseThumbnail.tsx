'use client'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { revalidateTags } from '@services/utils/ts/requests'
import { BookMinus, MoreVertical, Pencil, Eye } from 'lucide-react'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
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
import ViewExerciseModal from '../Modals/Exercise/Create/ViewExercise'
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
  const session = useSokratesSession() as any;
  const [viewExerciseModal, setViewExerciseModal] = React.useState(false)
  const [modifyExerciseModal, setModifyExerciseModal] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

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
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
          <AuthenticatedClientElement
            action="read"
            ressourceType="activities"
            checkMethod="roles"
            orgId={props.orgId}
          >
            <button
              className="p-1 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-md"
              aria-label="View exercise"
              onClick={(e) => { e.stopPropagation(); setViewExerciseModal(true); }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Eye size={20} className="text-gray-700" />
            </button>
          </AuthenticatedClientElement>
          <AuthenticatedClientElement
            action="update"
            ressourceType="activities"
            checkMethod="roles"
            orgId={props.orgId}
          >
            <DropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-md"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="More options"
                >
                  <MoreVertical size={20} className="text-gray-700" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onSelect={() => setModifyExerciseModal(true)}>
                  <Pencil className="mr-4 h-4 w-4" /> Modify Exercise
                </DropdownMenuItem>

                <div className="my-2"></div>

                <DropdownMenuItem asChild>
                  <ConfirmationModal
                    confirmationButtonText="Delete Exercise"
                    confirmationMessage="Are you sure you want to delete this exercise?"
                    dialogTitle={`Delete ${props.exercise.title}?`}
                    dialogTrigger={
                      <button
                        className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-red-600"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <BookMinus className="mr-4 h-6 w-4" /> Delete Exercise
                      </button>
                    }
                    functionToExecute={deleteExercise}
                    status="warning"
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </AuthenticatedClientElement>
        </div>
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
      <Modal
        isDialogOpen={viewExerciseModal}
        onOpenChange={setViewExerciseModal}
        minHeight="lg"
        minWidth="xl"
        dialogContent={
          <ViewExerciseModal
            exercise={props.exercise}
            tags={props.tags}
            courses={props.courses}
            closeModal={() => setViewExerciseModal(false)}
          />
        }
        dialogTitle="Exercise Details"
        dialogDescription="View exercise details"
      />

      <Modal
        isDialogOpen={modifyExerciseModal}
        onOpenChange={setModifyExerciseModal}
        minHeight="lg"
        minWidth="xl"
        dialogContent={
          <ModifyExerciseModal
            orgslug={props.orgslug}
            mutateURL={props.mutateURL}
            exercise={props.exercise}
            closeModal={() => {
              setModifyExerciseModal(false)
              setDropdownOpen(false)
            }}
            tags={props.tags}
            courses={props.courses}
          />
        }
        dialogTitle="Modify Exercise"
        dialogDescription="Modify this exercise"
      />
    </Card>
  )
}
export default ExerciseThumbnail
