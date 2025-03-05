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
import { mutate } from 'swr'
import { createAssignment } from '@services/courses/assignments'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createActivity, deleteActivity } from '@services/courses/activities'
import toast from 'react-hot-toast'
import { createWorkspace } from '@services/courses/workspaces'

function NewWorkspace({ submitActivity, chapterId, course, closeModal }: any) {
    const org = useOrg() as any;
    const session = useLHSession() as any
    const [activityName, setActivityName] = React.useState('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [activityTaskID, setActivityTaskID] = React.useState(-1)

    const handleNameChange = (e: any) => {
        setActivityName(e.target.value)
    }

    const handleActivityTaskIDChange = (e: any) => {
        setActivityTaskID(e.target.value)
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
                    <Input onChange={handleNameChange} type="text" required />
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

            <span style={{color: 'red'}}>TODO: @Albert / Tyron: RESKIN</span>

            {/* Choose Excercise */}
            <FormField name="assignment-activity-grading-type">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>Select Excercise</FormLabel>
                    <FormMessage match="valueMissing">
                        Please select an excercise from the excercise library.
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <select className='bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100' onChange={handleActivityTaskIDChange} required>
                        <option value={1}>Task-Foo</option>
                        <option value={2}>Task-Bar</option>
                        <option value={3}>Task-Baz</option>
                    </select>
                </Form.Control>
            </FormField>

            <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
                <Form.Submit asChild>
                    <ButtonBlack type="submit" css={{ marginTop: 10 }}>
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