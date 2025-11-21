'use client'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import FormLayout, {
  Flex,
  FormField,
  FormLabel,
  FormLabelAndMessage,
  FormMessage,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import React from 'react'
import { BarLoader } from 'react-spinners'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { X } from 'lucide-react'
import { modifyExercise } from '@services/courses/workspaces'
import { mutate } from 'swr'
import { useTranslations } from 'next-intl'

function ModifyExerciseModal({
  closeModal,
  orgslug,
  mutateURL,
  courses,
  tags,
  exercise,
}: any) {
  const t = useTranslations('ModifyExerciseModal')
  const session = useSokratesSession() as any;
  const [tagInput, setTagInput] = React.useState('')
  const [internalTags, setInternalTags] = React.useState<string[]>(exercise.tags)

  const validationSchema = React.useMemo(
    () =>
      Yup.object().shape({
        title: Yup.string()
          .required(t('errors.titleRequired'))
          .max(100, t('errors.max100')),
        description: Yup.string().max(1000, t('errors.max1000')),
        task: Yup.string(),
        solution: Yup.string(),
        course_id: Yup.mixed().nullable(),
        tags: Yup.array().of(
          Yup.object().shape({
            value: Yup.string(),
            color: Yup.number(),
          })
        ),
      }),
    [t]
  )

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
      const toast_loading = toast.loading(t('toast.modifying'))
      try {
        const res = await modifyExercise(
          {
            id: exercise.id,
            title: values.title,
            description: values.description,
            task: values.task,
            solution: values.solution,
            tags: internalTags,
            course_id: values.course_id !== '' ? values.course_id : null,
          },
          session.data?.tokens?.access_token
        )
        if (res.success || res.success === undefined) {
          toast.dismiss(toast_loading)
            toast.success(t('toast.modified'))
          closeModal()
          mutate(mutateURL)
        } else {
          toast.error(res.data.detail)
        }
      } catch {
        toast.error(t('toast.failed'))
      } finally {
        setSubmitting(false)
      }
    },
  })

  function handleAddTag() {
    const newInput = tags.find((t: any) => t.value == tagInput)
    if (!newInput) {
      toast.error(t('tags.notFound'))
      return
    }
    const newInputVal = newInput.value
    if (!internalTags.find((tag: any) => tag === newInputVal)) {
      setInternalTags([...internalTags, newInputVal])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setInternalTags(internalTags.filter((tag: string) => tag !== tagToRemove))
  }

  const availableTags = tags.filter((t: any) => !internalTags.includes(t.value))
  const addButtonDisabled = tagInput.trim() === '' || availableTags.length === 0

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <FormField name="course_id">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>{t('labels.moveToCourse')}</FormLabel>
          <FormMessage match="valueMissing">
            {t('messages.selectOptionalCourse')}
          </FormMessage>
        </Flex>
        {courses ? (
          <Form.Control asChild>
            <select
              className="bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100"
              onChange={formik.handleChange}
              value={formik.values.course_id || ''}
            >
              <option value="">{t('labels.none')}</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Form.Control>
        ) : (
          <span>{t('loading')}</span>
        )}
      </FormField>

      <FormField name="title">
        <FormLabelAndMessage
          label={t('labels.exerciseTitle')}
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
          label={t('labels.exerciseDescription')}
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
        <FormLabelAndMessage label={t('labels.tags')} message="" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Form.Control asChild>
              <select
                className="bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100"
                onChange={(e) => setTagInput(e.target.value)}
                value={tagInput}
                defaultValue=""
              >
                <option value="">{t('labels.none')}</option>
                {availableTags.map((c: any) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </Form.Control>
            <button
              className={`px-4 py-2 ${
                !addButtonDisabled ? 'bg-black' : 'bg-gray-600'
              } text-white text-sm font-bold rounded-md`}
              onClick={handleAddTag}
              disabled={addButtonDisabled}
              type="button"
            >
              {t('labels.addTag')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {internalTags.map((tag: any) => {
              const tagObj = tags.find((t: any) => t.value === tag)
              const color = `#${tagObj?.color?.toString(16).padStart(6, '0')}`
              return (
                <div
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                  style={{ backgroundColor: color }}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label={t('tags.remove', { tag })}
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
          label={t('labels.exerciseTask')}
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
          label={t('labels.exerciseSolution')}
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
            <BarLoader cssOverride={{ borderRadius: 60 }} width={60} color="#ffffff" />
          ) : (
            t('labels.submit')
          )}
        </button>
      </div>
    </FormLayout>
  )
}

export default ModifyExerciseModal
