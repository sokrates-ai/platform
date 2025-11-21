'use client'
import FormLayout, {
    FormField,
    FormLabelAndMessage,
    Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useOrg } from '@components/Contexts/OrgContext'
import React from 'react'
import { createUserGroup } from '@services/usergroups/usergroups'
import { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useFormik } from 'formik'
import { useTranslations } from 'next-intl' // added

type AddUserGroupProps = {
    setCreateUserGroupModal: any
}

function AddUserGroup(props: AddUserGroupProps) {
    const t = useTranslations('AddUserGroup') // added
    const org = useOrg() as any;
    const session = useSokratesSession() as any;
    const access_token = session?.data?.tokens?.access_token;
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const validate = (values: any) => { // moved inside to use t
        const errors: any = {}
        if (!values.name) {
            errors.name = t('errors.nameRequired')
        }
        return errors
    }

    const formik = useFormik({
        initialValues: {
            name: '',
            description: '',
            org_id: org.id
        },
        validate,
        onSubmit: async (values) => {
            setIsSubmitting(true)
            const res = await createUserGroup(values, access_token)
            if (res.status == 200) {
                setIsSubmitting(false)
                mutate(`${getAPIUrl()}usergroups/org/${org.id}`)
                props.setCreateUserGroupModal(false)
            } else {
                setIsSubmitting(false)
            }
        },
    })

    return (
        <FormLayout onSubmit={formik.handleSubmit}>
            <FormField name="name">
                <FormLabelAndMessage
                    label={t('labels.name')}
                    message={formik.errors.name}
                />
                <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        value={formik.values.name}
                        type="text"
                        required
                    />
                </Form.Control>
            </FormField>
            <FormField name="description">
                <FormLabelAndMessage
                    label={t('labels.description')}
                    message={formik.errors.description}
                />
                <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        value={formik.values.description}
                        type="text"
                    />
                </Form.Control>
            </FormField>
            <div className="flex py-4">
                <Form.Submit asChild>
                    <button className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer">
                        {isSubmitting ? t('buttons.creating') : t('buttons.create')}
                    </button>
                </Form.Submit>
            </div>
        </FormLayout>
    )
}

export default AddUserGroup