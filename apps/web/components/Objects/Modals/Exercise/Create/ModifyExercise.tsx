'use client'
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import FormLayout, {
  Flex,
  FormField,
  FormLabel,
  FormLabelAndMessage,
  FormMessage,
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

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string()
    .max(1000, 'Must be 1000 characters or less'),
  task: Yup.string(),
  solution: Yup.string(),
  course_id: Yup.mixed().nullable(),
  tags: Yup.array().of(Yup.object().shape({
    value: Yup.string(),
    color: Yup.number(),
  }))
})

function ModifyExerciseModal({ closeModal, orgslug, mutateURL, courses, tags, exercise }: any) {
  console.log(exercise)
  const router = useRouter()
  const session = useLHSession() as any
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [tagInput, setTagInput] = React.useState('')
  const [internalTags, setInternalTags] = React.useState<string[]>(exercise.tags)

  console.log('internalTags', internalTags, 'tags', tags)

  const formik = useFormik({
    initialValues: {
      title: exercise.title,
      description: exercise.description,
      task: exercise.task,
      solution: exercise.solution,
      course_id: exercise.course_id,
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
            tags: internalTags,
            course_id: values.course_id,
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

  function handleAddTag() {
    const newInput = tags.find((t: any) => t.value == tagInput)
    if (!newInput) {
      throw (`${newInput} not found in tags`)
    }

    const newInputVal = newInput.value

    if (!internalTags.find((t: any) => t.value === newInputVal)) {
      setInternalTags([...internalTags, newInputVal])
    }

    // setTagInput("")
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setInternalTags(
      internalTags.filter((tag: string) => tag !== tagToRemove)
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
  const availableTags = tags.filter((t: any) => {
    const foundItem = internalTags.find((t2: any) => {
      return t2 === t.value
    })
    const found = foundItem !== undefined
    return !found
  })

  const addButtonDisabled = tagInput.trim() === "" || availableTags.length === 0
  // if (availableTags.length === 0) {
  //   setTagInput("")
  // }

  return (
    <FormLayout onSubmit={formik.handleSubmit} >
      <FormField name="course_id">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>Select Course</FormLabel>
          <FormMessage match="valueMissing">
            Select optional course from the courses list.
          </FormMessage>
        </Flex>
        {courses ? (
          <Form.Control asChild>
            <select className='bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100'
              onChange={formik.handleChange}
              value={formik.values.course_id || ""}
              // defaultValue={undefined}
            >
              <option value="">
                - None -
              </option>

              {courses.map((c: any) => {
                return (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>)
              })}
            </select>
          </Form.Control>
        ) : <span>loading...</span>}
      </FormField>

      <FormField name="title">
        <FormLabelAndMessage
          label="Exercise Title"
          message={formik.errors.title as any}
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
          message={formik.errors.description as any}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.description}
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="tags">
        <FormLabelAndMessage
          label="Tags"
          message=""
        />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Form.Control asChild>
              <select className='bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100'
                onChange={(e) => { setTagInput(e.target.value); }}
                value={tagInput}
                defaultValue={""}
              >
                <option value="">
                  - None -
                </option>
                {availableTags.map((c: any) => {
                  return (
                    <option
                      key={c.value}
                      value={c.value}
                      className="w-10 h-6 rounded-full border-0 p-0 cursor-pointer bg-transparent"
                    >
                      {c.value}
                    </option>
                  )
                })}
              </select>
            </Form.Control>

            <button
              className={`px-4 py-2 ${!addButtonDisabled ? 'bg-black' : 'bg-gray-600'} text-white text-sm font-bold rounded-md`}
              onClick={handleAddTag}
              disabled={addButtonDisabled}
              type="button"
            >
              Add Tag
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {internalTags.map((tag: any) => {
              const tagObj = tags.find((t: any) => t.value === tag)
              const color = `#${tagObj.color?.toString(16).padStart(6, '0')}`;

              return (
                <div
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                  style={{
                    backgroundColor: color
                  }}
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
              )
            })}
          </div>
        </div>
      </FormField>

      <FormField name="task">
        <FormLabelAndMessage
          label="Exercise Task"
          message={formik.errors.task as any}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.task}
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="solution">
        <FormLabelAndMessage
          label="Exercise Solution"
          message={formik.errors.solution as any}
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
    </FormLayout >
  )
}

export default ModifyExerciseModal

