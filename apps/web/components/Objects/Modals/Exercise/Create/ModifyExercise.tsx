'use client'
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import FormLayout, {
  FormField,
  FormLabelAndMessage,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { createNewCourse } from '@services/courses/courses'
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs'
import React, { useEffect } from 'react'
import { BarLoader } from 'react-spinners'
import { revalidateTags } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react'
import UnsplashImagePicker from "@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker"
import { createExercise, modifyExercise } from "@services/courses/workspaces"
import { mutate } from "swr"
import { Exercise } from "@components/Objects/Thumbnails/ExerciseThumbnail"

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string()
    .max(1000, 'Must be 1000 characters or less'),
  task: Yup.string(),
  solution: Yup.string(),
  tags: Yup.array().of(Yup.string())
})

function ModifyExerciseModal({ closeModal, orgslug, mutateURL, exercise }: { closeModal: any, orgslug: string, mutateURL: string, exercise: Exercise }) {
  const router = useRouter()
  const session = useLHSession() as any
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [tagInput, setTagInput] = React.useState('')

  const formik = useFormik({
    initialValues: {
      title: exercise.title,
      description: exercise.description,
      task: exercise.task,
      solution: exercise.solution,
      tags: exercise.tags || [],
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Modifying exercise...')

      try {
        const res = await modifyExercise(
          {
            id: exercise.id,
            title: values.title,
            description: values.description,
            task: values.task,
            solution: values.solution,
            tags: values.tags,
          },
          session.data?.tokens?.access_token
        )

        if (res.success || res.success === undefined) {
          toast.dismiss(toast_loading)
          toast.success('Exercise modified successfully')
          closeModal()
          mutate(mutateURL)
        } else {
          console.log(res)
          toast.error(res.data.detail)
        }
      } catch (error) {
        toast.error('Failed to modify exercise')
        console.error(error)
      } finally {
        setSubmitting(false)
      }
    }
  })

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!formik.values.tags.includes(tagInput.trim())) {
        formik.setFieldValue('tags', [...formik.values.tags, tagInput.trim()])
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    formik.setFieldValue(
      'tags',
      formik.values.tags.filter((tag: string) => tag !== tagToRemove)
    )
  }

  const getOrgMetadata = async () => {
    const org = await getOrganizationContextInfoWithoutCredentials(orgslug, {
      revalidate: 360,
      tags: ['organizations'],
    })
    setOrgId(org.id)
  }

  useEffect(() => {
    if (orgslug) {
      getOrgMetadata()
    }
  }, [orgslug])

  // const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0]
  //   if (file) {
  //     formik.setFieldValue('thumbnail', file)
  //   }
  // }

  // const handleUnsplashSelect = async (imageUrl: string) => {
  //   setIsUploading(true)
  //   try {
  //     const response = await fetch(imageUrl)
  //     const blob = await response.blob()
  //     const file = new File([blob], 'unsplash_image.jpg', { type: 'image/jpeg' })
  //     formik.setFieldValue('thumbnail', file)
  //   } catch (error) {
  //     toast.error('Failed to load image from Unsplash')
  //   }
  //   setIsUploading(false)
  // }

  return (
    <FormLayout onSubmit={formik.handleSubmit} >
      <FormField name="title">
        <FormLabelAndMessage
          label="Exercise Title"
          message={formik.errors.title}
        />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.title}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="description">
        <FormLabelAndMessage
          label="Exercise Description"
          message={formik.errors.description}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.description}
          />
        </Form.Control>
      </FormField>

      <FormField name="tags">
        <FormLabelAndMessage
          label="Tags"
          message="Press Enter to add a tag"
        />
        <div className="space-y-2">
          <Form.Control asChild>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              type="text"
              placeholder="Add tags..."
            />
          </Form.Control>
          <div className="flex flex-wrap gap-2">
            {formik.values.tags.map((tag: string) => (
              <div
                key={tag}
                className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-sm"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </FormField>

      <FormField name="task">
        <FormLabelAndMessage
          label="Exercise Task"
          message={formik.errors.task}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.task}
          />
        </Form.Control>
      </FormField>

      <FormField name="solution">
        <FormLabelAndMessage
          label="Exercise Solution"
          message={formik.errors.solution}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.solution}
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
            'Modify Exercise'
          )}
        </button>
      </div>

      {/* {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )} */}
    </FormLayout>
  )
}

export default ModifyExerciseModal