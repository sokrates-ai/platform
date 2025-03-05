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
import {  UploadCloud, Image as ImageIcon } from 'lucide-react'
import UnsplashImagePicker from "@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker"
import { createExercise } from "@services/courses/workspaces"

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string()
    .max(1000, 'Must be 1000 characters or less'),
  task: Yup.string(),
  solution: Yup.string(),
})

function CreateExerciseModal({ closeModal, orgslug }: any) {
  const router = useRouter()
  const session = useLHSession() as any
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      title: '',
      description: '',
      task: '',
      solution: '',
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Creating exercise...')
      
      try {
        const res = await createExercise(
          // orgId,
          { 
            title: values.title, 
            description: values.description, 
            task: values.task, 
            solution: values.solution 
          },
          session.data?.tokens?.access_token
        )

        if (res.success || res.success === undefined) {
          // await revalidateTags(['courses'], orgslug)
          toast.dismiss(toast_loading)
          toast.success('Exercise created successfully')

          // if (res.data.org_id === orgId) {
            closeModal()
            router.refresh()
            // TODO: what is `revalidateTags?`
            // await revalidateTags(['courses'], orgslug)
          // }
        } else {
          console.log(res)
          toast.error(res.data.detail)
        }
      } catch (error) {
        toast.error('Failed to create exercise')
        console.error(error)
      } finally {
        setSubmitting(false)
      }
    }
  })

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
            'Create Exercise'
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

export default CreateExerciseModal
