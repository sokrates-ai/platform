import React from 'react'
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
import { createAssignment } from '@services/courses/assignments'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createActivity, deleteActivity } from '@services/courses/activities'
import toast from 'react-hot-toast'
import { createWorkspace } from '@services/courses/workspaces'
// import { TASKS_URL } from '@/app/orgs/[orgslug]/dash/exercises/client'
import { swrFetcher } from '@services/utils/ts/requests'
import { Button } from "@components/ui/button";

function NewWorkspace({ submitActivity, chapterId, course, closeModal, access_token }: any) {
    const org = useOrg() as any;
    const session = useLHSession() as any
    const [activityName, setActivityName] = React.useState('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [activityTaskID, setActivityTaskID] = React.useState(-1)

    // Fetch exercise library here.
    const TASKS_URL = `${getAPIUrl()}tasks/list/page/1/limit/50`;
    const { data: exercises } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))
    console.log(exercises)

    const handleNameChange = (e: any) => {
        setActivityName(e.target.value)
    }

    const handleActivityTaskIDChange = (e: any) => {
        const id = e.target.value
        setActivityTaskID(id)
        console.log(id)
        const targetExercise = exercises.find((e: any) => {
            console.log(e.id, id)
            return e.id == id
        })
        console.log(targetExercise)
        const title = targetExercise.title
        setActivityName(title)
        console.log('set title:', title)
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
            activityTaskID,
            chapterId,
            org?.id,
            session.data?.tokens?.access_token,
        )
        console.log("activity res:", res)

        const toast_loading = toast.loading('Creating workspace...')

        if (res.success || res.success === undefined) {
            toast.dismiss(toast_loading)
            toast.success('Workspace created successfully')
        } else {
            console.error(res)
            toast.error(res.data.detail)
            // await deleteActivity(res.activity_uuid, session.data?.tokens?.access_token)
        }

        mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
        setIsSubmitting(false)
        closeModal()
    }


    return (
        <FormLayout onSubmit={handleSubmit}>
            <span style={{color: 'green'}}> Habt einen Tollen Tag! :P </span>
            
            {/* Name */}
            <FormField name="assignment-activity-title">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>Workspace Title</FormLabel>
                    <FormMessage match="valueMissing">
                        Please provide a name for your workspace session.
                        <span color='red'></span>
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <Input value={activityName} onChange={handleNameChange} type="text" required />
                </Form.Control>
            </FormField>

            {/* Description  */}
            {/* <FormField name="assignment-activity-description">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>Workspace Description</FormLabel>
                    <FormMessage match="valueMissing">
                        Please provide a description for your workspace
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <Input onChange={handleDescriptionChange} type="text" required />
                </Form.Control>
            </FormField> */}

            {/* Choose Excercise */}
            <FormField name="assignment-activity-grading-type">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>Select Excercise</FormLabel>
                    <FormMessage match="valueMissing">
                        Please select an excercise from the excercise library.
                    </FormMessage>
                </Flex>
                {exercises ? (
                <Form.Control asChild>
                    <select className='bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100' onChange={handleActivityTaskIDChange} required>
                        {exercises.map((ex: any) => {
                            return (
                            <option
                                key={ex.id}
                                value={ex.id}
                            >
                                <span>{ex.title}</span>
                                <span> | </span>
                                <span className='text-xs'>{ex.description}</span>
                                <span> | </span>
                                <span className='text-xs'>({ex.id})</span>
                            </option>)
                        })}
                    </select>
                </Form.Control>
                ) : <span>loading...</span>}
            </FormField>

            <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
                <Form.Submit asChild>
                    <Button type="submit">
                        {isSubmitting ? (
                            <BarLoader
                                cssOverride={{ borderRadius: 60 }}
                                width={60}
                                color="#ffffff"
                            />
                        ) : (
                            'Create workspace'
                        )}
                    </Button>
                </Form.Submit>
            </Flex>
        </FormLayout>
    )
}

export default NewWorkspace