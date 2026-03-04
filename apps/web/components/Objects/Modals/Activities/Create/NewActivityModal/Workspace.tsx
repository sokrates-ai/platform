import React, { useEffect } from 'react'
import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { BarLoader } from 'react-spinners'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
import useSWR, { mutate } from 'swr'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { createWorkspace } from '@services/courses/workspaces'
import { swrFetcher } from '@services/utils/ts/requests'
import { X } from 'lucide-react'

interface Exercise {
  title: string
  description: string
  task: string
  solution: string
  id: number
  course_id: number
  tags: string[]
}

function NewWorkspace({
  submitActivity,
  chapterId,
  course,
  closeModal,
  access_token,
  multi,
}: any) {
  const org = useOrg() as any
  const session = useSokratesSession() as any;
  const [activityName, setActivityName] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [activityTaskIDs, setActivityTaskIDs] = React.useState<number[]>([])

  // Fetch exercise library here.
  const TASKS_URL = `${getAPIUrl()}tasks/list/page/1/limit/50`
  const { data } = useSWR(TASKS_URL, (url: string) =>
    swrFetcher(url, access_token)
  )
  const exercises = data as Exercise[]

  const handleNameChange = (e: any) => {
    setActivityName(e.target.value)
  }

  const updateWorkspaceTitle = () => {
    // Only set name if new length is 1
    if (activityTaskIDs.length === 1) {
      const targetExercise = exercises.find((e: any) => {
        return e.id === activityTaskIDs[0]
      })

      const title = targetExercise ? targetExercise.title : ''
      setActivityName(title)
    } else {
      setActivityName(`Any Order - ${activityTaskIDs.length} Tasks`)
    }
  }

  useEffect(updateWorkspaceTitle, [exercises, activityTaskIDs])

  const handleActivityTaskIDChange = (e: any) => {
    const id = parseInt(e.target.value)
    if (id === -1) {
      return
    }

    if (activityTaskIDs.includes(id)) {
      return
    }

    setActivityTaskIDs([...activityTaskIDs, id])
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setIsSubmitting(true)
    const activity = {
      name: activityName,
      chapter_id: chapterId,
      activity_type: 'TYPE_WORKSPACE',
      activity_sub_type: 'SUBTYPE_WORKSPACE_ANY',
      published: false,
      course_id: course?.courseStructure.id,
    }

    const res = await createWorkspace(
      activity,
      Array.from(activityTaskIDs),
      chapterId,
      org?.id,
      session.data?.tokens?.access_token
    )

    const toast_loading = toast.loading('Creating workspace...')

    if (res.success || res.success === undefined) {
      toast.dismiss(toast_loading)
      toast.success('Workspace created successfully')
    } else {
      toast.error(res.data.detail)
    }

    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    setIsSubmitting(false)
    closeModal()
  }

  return (
    <FormLayout onSubmit={handleSubmit}>
      {/* Name */}
      <FormField name="assignment-activity-title">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>Workspace Title</FormLabel>
          <FormMessage match="valueMissing">
            Please provide a name for your workspace session.
            <span color="red"></span>
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            value={activityName}
            onChange={handleNameChange}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      {/* Choose Exercise */}
      <FormField name="assignment-activity-grading-type">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>Select Exercise</FormLabel>
          <FormMessage match="valueMissing">
            Please select an exercise from the exercise library.
          </FormMessage>
        </Flex>
        {exercises ? (
          <Form.Control asChild>
            <select
              className="bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100"
              onChange={handleActivityTaskIDChange}
              required
              defaultValue={''}
            >
              <option value={-1}>-Select Task-</option>

              {exercises
                .filter((ex) => !activityTaskIDs.includes(ex.id))
                .map((ex) => {
                  return (
                    <option key={ex.id} value={ex.id}>
                      <span>{ex.title}</span>
                      <span> | </span>
                      <span className="text-xs">{ex.description}</span>
                      <span> | </span>
                      <span className="text-xs">({ex.id})</span>
                    </option>
                  )
                })}
            </select>
          </Form.Control>
        ) : (
          <span>loading...</span>
        )}
      </FormField>

      <div className="flex gap-1 min-h-40 border-gray-200 border-2 border-dashed rounded-md px-2 py-4 flex-wrap">
        {activityTaskIDs.length > 0 ? (
          activityTaskIDs.map((i) => {
            let ex = exercises.find((e) => {
              return e.id === i
            })

            if (!ex) {
              throw 'Exercise not found.'
            }

            return (
              <div
                className="grow flex justify-between gap-4 items-center text-black rounded-md bg-gray-200 px-2 py-2 min-w-50%"
                key={i}
              >
                <div>
                  <span className="bold text-l">{ex.title}</span>
                  <br />
                  <span className="bold text-gray-500 text-xs">
                    {ex.description}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setActivityTaskIDs(activityTaskIDs.filter((e) => e !== i))
                  }}
                  className="p-1 px-2 sm:px-3 bg-red-600 rounded-md flex items-center space-x-1 shadow-md transition-colors duration-200 hover:bg-red-700"
                  rel="noopener noreferrer"
                >
                  <X size={15} className="text-rose-200 font-bold" />
                </button>
              </div>
            )
          })
        ) : (
          <div className="flex items-center justify-center w-full">
            <div className="flex flex-col items-center">
              <span className="text-gray-800 text-xl">No tasks yet.</span>
              <span className="text-gray-500 text-s">Use the menu to add a task.</span>
            </div>
          </div>
        )}
      </div>

      <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
        <Form.Submit asChild>
          <ButtonBlack
            type="submit"
            css={{ marginTop: 10 }}
            disabled={Array.from(activityTaskIDs.entries()).length === 0}
          >
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Create workspace'
            )}
          </ButtonBlack>
        </Form.Submit>
      </Flex>
    </FormLayout>
  )
}

export default NewWorkspace
