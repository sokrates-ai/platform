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
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { UploadCloud, Image as ImageIcon } from 'lucide-react'
import UnsplashImagePicker from "@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker"
import { Button } from '@components/ui/button'
import { useTranslations } from 'next-intl'

function CreateCourseModal({ closeModal, orgslug }: any) {
  const t = useTranslations('CreateCourseModal')
  const router = useRouter()
  const session = useSokratesSession() as any;
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const validationSchema = React.useMemo(() =>
    Yup.object().shape({
      name: Yup.string()
        .required(t('errors.nameRequired'))
        .max(100, t('errors.max100')),
      description: Yup.string()
        .max(1000, t('errors.max1000')),
      learnings: Yup.string(),
      tags: Yup.string(),
      visibility: Yup.boolean(),
      thumbnail: Yup.mixed().nullable()
    }), [t]
  )

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
      const toast_loading = toast.loading(t('toast.creating'))
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
          toast.success(t('toast.created'))
          if (res.data.org_id === orgId) {
            closeModal()
            router.refresh()
            await revalidateTags(['courses'], orgslug)
          }
        } else {
          toast.error(res.data.detail)
        }
      } catch {
        toast.error(t('toast.failed'))
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
    } catch {
      toast.error(t('toast.unsplashFailed'))
    }
    setIsUploading(false)
  }

  return (
    <FormLayout onSubmit={formik.handleSubmit} >
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
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.description}
          />
        </Form.Control>
      </FormField>

      <FormField name="thumbnail">
        <FormLabelAndMessage
          label={t('labels.thumbnail')}
          message={formik.errors.thumbnail as any}
        />
        <div className="w-auto bg-gray-50 rounded-xl outline outline-1 outline-gray-200 h-[200px] shadow">
          <div className="flex flex-col justify-center items-center h-full">
            <div className="flex flex-col justify-center items-center">
              {formik.values.thumbnail ? (
                <img
                  src={URL.createObjectURL(formik.values.thumbnail)}
                  className={`${isUploading ? 'animate-pulse' : ''} shadow w-[200px] h-[100px] rounded-md`}
                />
              ) : (
                <img
                  src="/empty_thumbnail.png"
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
                  variant="outline"
                  type="button"
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <UploadCloud size={16} className="mr-2" />
                  <span>{t('buttons.uploadImage')}</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  onClick={() => setShowUnsplashPicker(true)}
                >
                  <ImageIcon size={16} className="mr-2" />
                  <span>{t('buttons.chooseFromGallery')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FormField>

      <FormField name="tags">
        <FormLabelAndMessage
          label={t('labels.tags')}
          message={formik.errors.tags}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.tags}
            placeholder={t('placeholders.tagsInput')}
          />
        </Form.Control>
      </FormField>

      <FormField name="visibility">
        <FormLabelAndMessage
          label={t('labels.visibility')}
          message={formik.errors.visibility as any}
        />
        <Select
          value={formik.values.visibility.toString()}
          onValueChange={(value) => formik.setFieldValue('visibility', value === 'true')}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('placeholders.selectVisibility')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t('visibility.public')}</SelectItem>
            <SelectItem value="false">{t('visibility.private')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex justify-end mt-6">
        <Button
          type="submit"
          variant="secondary"
          disabled={formik.isSubmitting}
          className="px-4 py-2 text-black text-sm font-bold rounded-md"
        >
          {formik.isSubmitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            t('buttons.create')
          )}
        </Button>
      </div>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </FormLayout>
  )
}

export default CreateCourseModal
