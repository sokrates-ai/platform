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
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { createActivity, deleteActivity } from '@services/courses/activities'
import toast from 'react-hot-toast'
import { swrFetcher } from '@services/utils/ts/requests'
import { useTranslations } from 'next-intl' // added

function NewAssignment({ submitActivity, chapterId, course, closeModal, access_token }: any) {
    const t = useTranslations('AssignmentActivityModal') // added
    const TASKS_URL = `${getAPIUrl()}tasks/list/page/1/limit/50`;

    const org = useOrg() as any;
    const session = useSokratesSession() as any;
    const [activityName, setActivityName] = React.useState('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [activityDescription, setActivityDescription] = React.useState('')
    const [dueDate, setDueDate] = React.useState('')
    const [gradingType, setGradingType] = React.useState('ALPHABET')

    // Fetch exercise library here (unused for now but kept for context).
    const { data: exercises } = useSWR(TASKS_URL, (url: string) => swrFetcher(url, access_token))

    const handleNameChange = (e: any) => setActivityName(e.target.value)
    const handleDescriptionChange = (e: any) => setActivityDescription(e.target.value)
    const handleDueDateChange = (e: any) => setDueDate(e.target.value)
    const handleGradingTypeChange = (e: any) => setGradingType(e.target.value)

    const handleSubmit = async (e: any) => {
        e.preventDefault()
        setIsSubmitting(true)
        const activity = {
            name: activityName,
            chapter_id: chapterId,
            activity_type: 'TYPE_ASSIGNMENT',
            activity_sub_type: 'SUBTYPE_ASSIGNMENT_ANY',
            published: false,
            course_id: course?.courseStructure.id,
        }

        const toast_loading = toast.loading(t('toast.creating'))

        const activity_res = await createActivity(
            activity,
            chapterId,
            org?.id,
            session.data?.tokens?.access_token
        )

        const res = await createAssignment({
            title: activityName,
            description: activityDescription,
            due_date: dueDate,
            grading_type: gradingType,
            course_id: course?.courseStructure.id,
            org_id: org?.id,
            chapter_id: chapterId,
            activity_id: activity_res?.id,
        }, session.data?.tokens?.access_token)

        if (res.success) {
            toast.dismiss(toast_loading)
            toast.success(t('toast.created'))
        } else {
            toast.dismiss(toast_loading)
            toast.error(res.data.detail || t('toast.failed'))
            await deleteActivity(activity_res.activity_uuid, session.data?.tokens?.access_token)
        }

        mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
        setIsSubmitting(false)
        closeModal()
    }

    return (
        <FormLayout onSubmit={handleSubmit}>
            <FormField name="assignment-activity-title">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>{t('labels.title')}</FormLabel>
                    <FormMessage match="valueMissing">
                        {t('messages.titleRequired')}
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <Input onChange={handleNameChange} type="text" required aria-label={t('labels.title')} />
                </Form.Control>
            </FormField>

            <FormField name="assignment-activity-description">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>{t('labels.description')}</FormLabel>
                    <FormMessage match="valueMissing">
                        {t('messages.descriptionRequired')}
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <Input onChange={handleDescriptionChange} type="text" required aria-label={t('labels.description')} />
                </Form.Control>
            </FormField>

            <FormField name="assignment-activity-due-date">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>{t('labels.dueDate')}</FormLabel>
                    <FormMessage match="valueMissing">
                        {t('messages.dueDateRequired')}
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <Input onChange={handleDueDateChange} type="date" required aria-label={t('labels.dueDate')} />
                </Form.Control>
            </FormField>

            <FormField name="assignment-activity-grading-type">
                <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <FormLabel>{t('labels.gradingType')}</FormLabel>
                    <FormMessage match="valueMissing">
                        {t('messages.gradingTypeRequired')}
                    </FormMessage>
                </Flex>
                <Form.Control asChild>
                    <select
                        className='bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100'
                        onChange={handleGradingTypeChange}
                        required
                        aria-label={t('labels.gradingType')}
                        defaultValue={gradingType}
                    >
                        <option value="ALPHABET">{t('grading.alphabet')}</option>
                        <option value="NUMERIC">{t('grading.numeric')}</option>
                        <option value="PERCENTAGE">{t('grading.percentage')}</option>
                    </select>
                </Form.Control>
            </FormField>

            <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
                <Form.Submit asChild>
                    <ButtonBlack type="submit" css={{ marginTop: 10 }} aria-label={t('buttons.create')}>
                        {isSubmitting ? (
                            <BarLoader
                                cssOverride={{ borderRadius: 60 }}
                                width={60}
                                color="#ffffff"
                            />
                        ) : (
                            t('buttons.create')
                        )}
                    </ButtonBlack>
                </Form.Submit>
            </Flex>
        </FormLayout>
    )
}

export default NewAssignment