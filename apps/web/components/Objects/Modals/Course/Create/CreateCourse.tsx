'use client'
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { createNewCourse } from '@services/courses/courses'
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs'
import React, { useEffect } from 'react'
import { BarLoader } from 'react-spinners'
import { revalidateTags } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Info, UploadCloud, Image as ImageIcon } from 'lucide-react'
import UnsplashImagePicker from "@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker"
import { Button } from '@components/ui/button'

const validationSchema = Yup.object().shape({
  name: Yup.string()
    .required('Course name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string()
    .max(1000, 'Must be 1000 characters or less'),
  learnings: Yup.string(),
  tags: Yup.string(),
  visibility: Yup.boolean(),
  thumbnail: Yup.mixed().nullable()
})

function CreateCourseModal({ closeModal, orgslug }: any) {
  const router = useRouter()
  const session = useSokratesSession() as any;
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      learnings: '',
      visibility: true,
      tags: '',
      thumbnail: null
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Creating course...')
      
      try {
        const res = await createNewCourse(
          orgId,
          { 
            name: values.name, 
            description: values.description, 
            tags: values.tags, 
            visibility: values.visibility 
          },
          values.thumbnail,
          session.data?.tokens?.access_token
        )

        if (res.success) {
          await revalidateTags(['courses'], orgslug)
          toast.dismiss(toast_loading)
          toast.success('Course created successfully')

          if (res.data.org_id === orgId) {
            closeModal()
            router.refresh()
            await revalidateTags(['courses'], orgslug)
          }
        } else {
          toast.error(res.data.detail)
        }
      } catch (error) {
        toast.error('Failed to create course')
      } finally {
        setSubmitting(false)
      }
    }
  })

  const getOrgMetadata = React.useCallback(async () => {
    const org = await getOrganizationContextInfoWithoutCredentials(orgslug, {
      revalidate: 360,
      tags: ['organizations'],
    })
    setOrgId(org.id)
  }, [orgslug])

  useEffect(() => {
    if (orgslug) {
      getOrgMetadata()
    }
  }, [getOrgMetadata, orgslug])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      formik.setFieldValue('thumbnail', file)
    }
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    setIsUploading(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'unsplash_image.jpg', { type: 'image/jpeg' })
      formik.setFieldValue('thumbnail', file)
    } catch (error) {
      toast.error('Failed to load image from Unsplash')
    }
    setIsUploading(false)
  }

  return (
    <form onSubmit={formik.handleSubmit} className="h-fit">
      <div className="grid mb-2">
        <div className="flex items-center space-x-3">
          <label htmlFor="name" className="grow text-sm font-medium leading-[35px] text-black">
            Course Name
          </label>
          {formik.errors.name && (
            <div className="text-red-700 text-sm items-center rounded-md flex space-x-1">
              <Info size={10} />
              <div>{formik.errors.name}</div>
            </div>
          )}
        </div>
        <Input
          id="name"
          name="name"
          onChange={formik.handleChange}
          value={formik.values.name}
          type="text"
          required
        />
      </div>

      <div className="grid mb-2">
        <div className="flex items-center space-x-3">
          <label htmlFor="description" className="grow text-sm font-medium leading-[35px] text-black">
            Description
          </label>
          {formik.errors.description && (
            <div className="text-red-700 text-sm items-center rounded-md flex space-x-1">
              <Info size={10} />
              <div>{formik.errors.description}</div>
            </div>
          )}
        </div>
        <Textarea
          id="description"
          name="description"
          onChange={formik.handleChange}
          value={formik.values.description}
        />
      </div>

      <div className="grid mb-2">
        <div className="flex items-center space-x-3">
          <label htmlFor="fileInput" className="grow text-sm font-medium leading-[35px] text-black">
            Course Thumbnail
          </label>
          {formik.errors.thumbnail && (
            <div className="text-red-700 text-sm items-center rounded-md flex space-x-1">
              <Info size={10} />
              <div>{formik.errors.thumbnail}</div>
            </div>
          )}
        </div>
        <div className="w-auto bg-gray-50 rounded-xl outline outline-1 outline-gray-200 h-[200px] shadow">
          <div className="flex flex-col justify-center items-center h-full">
            <div className="flex flex-col justify-center items-center">
              {formik.values.thumbnail ? (
                <img
                  src={URL.createObjectURL(formik.values.thumbnail)}
                  alt="Selected course thumbnail preview"
                  className={`${isUploading ? 'animate-pulse' : ''} shadow w-[200px] h-[100px] rounded-md`}
                />
              ) : (
                <img
                  src="/empty_thumbnail.webp"
                  alt="Default course thumbnail"
                  className="shadow w-[200px] h-[100px] rounded-md bg-gray-200"
                />
              )}
              <div className="flex justify-center items-center space-x-2">
                <input
                  type="file"
                  id="fileInput"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept="image/*"
                />
                <Button
                  variant={"outline"}
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  type="button"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <UploadCloud size={16} className="mr-2" />
                  <span>Upload Image</span>
                </Button>
                <Button 
                  variant={"outline"}
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  type="button"
                  onClick={() => setShowUnsplashPicker(true)}
                >
                  <ImageIcon size={16} className="mr-2" />
                  <span>Choose from Gallery</span>
                </  Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid mb-2">
        <div className="flex items-center space-x-3">
          <label htmlFor="tags" className="grow text-sm font-medium leading-[35px] text-black">
            Course Tags
          </label>
          {formik.errors.tags && (
            <div className="text-red-700 text-sm items-center rounded-md flex space-x-1">
              <Info size={10} />
              <div>{formik.errors.tags}</div>
            </div>
          )}
        </div>
        <Textarea
          id="tags"
          name="tags"
          onChange={formik.handleChange}
          value={formik.values.tags}
          placeholder="Enter tags separated by commas"
        />
      </div>

      <div className="flex justify-end mt-6">
        <Button
          variant={"secondary"}
          disabled={formik.isSubmitting}
          className="px-4 py-2 text-black text-sm font-bold rounded-md"
          type="submit"
        >
          {formik.isSubmitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            'Create Course'
          )}
        </Button>
      </div>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </form>
  )
}

export default CreateCourseModal
