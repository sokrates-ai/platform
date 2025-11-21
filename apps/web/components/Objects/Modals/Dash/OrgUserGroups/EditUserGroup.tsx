'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useOrg } from '@components/Contexts/OrgContext'
import React from 'react'
import { updateUserGroup } from '@services/usergroups/usergroups'
import { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useFormik } from 'formik'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

type EditUserGroupProps = {
  usergroup: {
    id: number
    name: string
    description: string
  }
}

function EditUserGroup(props: EditUserGroupProps) {
  const t = useTranslations('EditUserGroup')
  const org = useOrg() as any
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const validate = (values: any) => {
    const errors: any = {}
    if (!values.name) {
      errors.name = t('errors.nameRequired')
    }
    return errors
  }

  const formik = useFormik({
    initialValues: {
      name: props.usergroup.name,
      description: props.usergroup.description,
    },
    validate,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      const res = await updateUserGroup(props.usergroup.id, access_token, values)
      if (res.status == 200) {
        setIsSubmitting(false)
        toast.success(t('toast.saved'))
        mutate(`${getAPIUrl()}usergroups/org/${org.id}`)
      } else {
        toast.error(t('toast.saveError'))
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
            {isSubmitting ? t('buttons.saving') : t('buttons.save')}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
  )
}

export default EditUserGroup