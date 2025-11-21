'use client'
import { Input } from '@components/ui/input'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import React from 'react'
import { BarLoader } from 'react-spinners'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { createTag, deleteTag, modifyTag } from '@services/courses/workspaces'
import { mutate } from 'swr'
import { useTranslations } from 'next-intl'

function EditTagsModal({ closeModal, orgslug, mutateURL, tags }: any) {
  const t = useTranslations('EditTagsModal')
  const session = useSokratesSession() as any;

  const validationSchema = React.useMemo(
    () =>
      Yup.object().shape({
        value: Yup.string()
          .required(t('errors.nameRequired'))
          .max(20, t('errors.max20')),
      }),
    [t]
  )

  async function handleDelete(value: string) {
    const toast_loading = toast.loading(t('toast.deleting'))
    try {
      const res = await deleteTag(value, session.data?.tokens?.access_token)
      if (res === null) {
        toast.dismiss(toast_loading)
        toast.success(t('toast.deleted'))
        mutate(mutateURL)
      } else {
        toast.error(res.data.detail)
      }
    } catch {
      toast.error(t('toast.deleteFailed'))
    }
  }

  const formik = useFormik({
    initialValues: { value: '' },
    validationSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const toast_loading = toast.loading(t('toast.creating'))
      try {
        const res = await createTag(
          values.value,
          0x11ff00,
          session.data?.tokens?.access_token
        )
        if (res === null) {
          toast.dismiss(toast_loading)
          toast.success(t('toast.created'))
          mutate(mutateURL)
          resetForm()
        } else {
          toast.error(res.data.detail)
        }
      } catch {
        toast.error(t('toast.createFailed'))
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div>
      <FormLayout onSubmit={formik.handleSubmit}>
        <FormField name="value">
          <FormLabelAndMessage
            label={t('labels.newTag')}
            message={formik.errors.value}
          />
          <Form.Control asChild>
            <Input
              onChange={formik.handleChange}
              value={formik.values.value}
              type="text"
              required
            />
          </Form.Control>
        </FormField>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="px-4 py-2 bg-black text-white text-sm font-bold rounded-md"
          >
            {formik.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('labels.createTag')
            )}
          </button>
        </div>
      </FormLayout>

      <div className="mt-10 rounded-2xl border border-muted p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{t('labels.existingTags')}</h3>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('labels.noTags')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">
                    {t('table.tagName')}
                  </th>
                  <th className="px-4 py-2 font-medium">{t('table.color')}</th>
                  <th className="px-4 py-2 font-medium">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tags.map((tag: { value: string; color: number }) => {
                  const color = `#${tag.color?.toString(16).padStart(6, '0')}`
                  return (
                    <tr key={tag.value} className="hover:bg-muted/40">
                      <td className="px-4 py-2">{tag.value}</td>
                      <td className="px-4 py-2">
                        <label className="color-label">
                          <div
                            className="w-10 h-6 rounded-full border-0 p-0 cursor-pointer bg-transparent"
                            style={{ backgroundColor: color }}
                            title={t('actions.pickColor')}
                          ></div>
                          <input
                            type="color"
                            value={color}
                            onChange={(e) =>
                              modifyTag(
                                tag.value,
                                parseInt(
                                  e.target.value.replaceAll('#', ''),
                                  16
                                ),
                                session.data?.tokens?.access_token
                              )
                            }
                            style={{ display: 'none' }}
                            title={t('actions.pickColor')}
                          />
                        </label>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(tag.value)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          {t('actions.delete')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EditTagsModal
