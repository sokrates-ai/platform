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

const validationSchema = Yup.object().shape({
  value: Yup.string()
    .required('Tag name is required')
    .max(20, 'Less than 20 characters'),
})

function EditTagsModal({ closeModal, orgslug, mutateURL, tags }: any) {
  // const router = useRouter()
  const session = useSokratesSession() as any;
  // const [orgId, setOrgId] = React.useState(null) as any
  // const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  // const [isUploading, setIsUploading] = React.useState(false)
  // const [tagInput, setTagInput] = React.useState('')

  async function handleDelete(value: string) {
    const toast_loading = toast.loading('Deleting tag...')

    try {
      const res = await deleteTag(value, session.data?.tokens?.access_token)

      if (res === null) {
        toast.dismiss(toast_loading)
        toast.success('Tag deleted successfully')
        mutate(mutateURL)
      } else {
        toast.error(res.data.detail)
      }
    } catch (error) {
      toast.error('Failed to delete tag')
    }
  }

  const formik = useFormik({
    initialValues: {
      value: '',
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Creating tag...')

      try {
        const res = await createTag(
          values.value,
          0x11ff00, // TODO: other color
          session.data?.tokens?.access_token
        )

        if (res === null) {
          toast.dismiss(toast_loading)
          toast.success('Tag created successfully')
          mutate(mutateURL)
        } else {
          toast.error(res.data.detail)
        }
      } catch (error) {
        toast.error('Failed to create tag')
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div>
      <FormLayout onSubmit={formik.handleSubmit}>
        <FormField name="value">
          <FormLabelAndMessage label="New Tag" message={formik.errors.value} />
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
              'Create Tag'
            )}
          </button>
        </div>
      </FormLayout>

      <div className="mt-10 rounded-2xl border border-muted p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Existing Tags</h3>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tags available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Tag Name</th>
                  <th className="px-4 py-2 font-medium">Color</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
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
                            style={{
                              display: 'none',
                            }}
                            title="Pick a color"
                          />
                        </label>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(tag.value)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
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
