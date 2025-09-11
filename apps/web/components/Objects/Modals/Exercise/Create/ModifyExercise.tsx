'use client'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
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
import { X } from 'lucide-react'
import { modifyExercise } from '@services/courses/workspaces'
import { mutate } from 'swr'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs'
import { Separator } from '@components/ui/separator'
import { Button } from '@components/ui/button'

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string().max(1000, 'Must be 1000 characters or less'),
})

function ModifyExerciseModal({
  closeModal,
  orgslug,
  mutateURL,
  courses,
  tags,
  exercise,
}: any) {
  const session = useSokratesSession() as any;
  const [tagInput, setTagInput] = React.useState('')
  const [internalTags, setInternalTags] = React.useState<string[]>(exercise.tags || [])

  // task type and type-specific state
  const [taskType, setTaskType] = React.useState<'ai' | 'multiple_choice'>(exercise.task_type || 'ai')

  // AI state
  const [aiInstruction, setAiInstruction] = React.useState('')
  const [aiProposedSolution, setAiProposedSolution] = React.useState('')
  const [aiGradingCriteriaText, setAiGradingCriteriaText] = React.useState('')

  // Multiple choice state
  type Choice = { id: string; text: string; correct: boolean }
  const [choices, setChoices] = React.useState<Choice[]>([])

  // Hydrate type-specific state from incoming exercise
  React.useEffect(() => {
    if (exercise?.task_type === 'ai') {
      const ai = exercise.ai_instruction || {}
      setAiInstruction(ai.task_instruction || '')
      setAiProposedSolution(ai.proposed_solution || '')
      setAiGradingCriteriaText(
        ai.grading_criteria ? JSON.stringify(ai.grading_criteria, null, 2) : ''
      )
    } else if (exercise?.task_type === 'multiple_choice') {
      const answers = exercise.multiple_choice_data?.answers || []
      const mapped = answers.map((a: any) => ({ id: crypto.randomUUID(), text: a.text || '', correct: !!a.is_correct }))
      setChoices(
        mapped.length >= 2
          ? mapped
          : [
              { id: crypto.randomUUID(), text: mapped[0]?.text || '', correct: mapped[0]?.correct || false },
              { id: crypto.randomUUID(), text: mapped[1]?.text || '', correct: mapped[1]?.correct || false },
            ]
      )
    } else {
      // default for safety
      setChoices([
        { id: crypto.randomUUID(), text: '', correct: false },
        { id: crypto.randomUUID(), text: '', correct: false },
      ])
    }
  }, [exercise])

  const formik = useFormik({
    initialValues: {
      title: exercise.title || '',
      description: exercise.description || '',
      course_id: exercise.course_id ?? '',
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Modifying exercise...')

      try {
        // Validate type-specific fields
        if (taskType === 'ai') {
          if (!aiInstruction.trim()) {
            toast.error('Task instruction is required for AI tasks')
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
        } else if (taskType === 'multiple_choice') {
          const nonEmpty = choices.filter(c => c.text.trim() !== '')
          const hasCorrect = nonEmpty.some(c => c.correct)
          if (nonEmpty.length < 2) {
            toast.error('Provide at least two answer options')
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
          if (!hasCorrect) {
            toast.error('Select at least one correct answer')
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
        }

        let payload: any = {
          id: exercise.id,
          title: values.title,
          description: values.description,
          tags: internalTags,
          task_type: taskType,
          course_id: values.course_id !== '' ? values.course_id : null,
        }

        if (taskType === 'ai') {
          let gradingCriteria: any = {}
          if (aiGradingCriteriaText.trim()) {
            try {
              gradingCriteria = JSON.parse(aiGradingCriteriaText)
            } catch (e) {
              toast.error('Grading criteria must be valid JSON')
              toast.dismiss(toast_loading)
              setSubmitting(false)
              return
            }
          }
          payload.ai_instruction = {
            task_instruction: aiInstruction,
            proposed_solution: aiProposedSolution,
            grading_criteria: gradingCriteria,
          }
        } else {
          payload.multiple_choice_data = {
            answers: choices
              .filter(c => c.text.trim() !== '')
              .map(c => ({ text: c.text.trim(), is_correct: c.correct })),
          }
        }

        const res = await modifyExercise(
          payload,
          session.data?.tokens?.access_token
        )

        if (res.success || res.success === undefined) {
          toast.dismiss(toast_loading)
          toast.success('Exercise modified successfully')
          closeModal()
          mutate(mutateURL)
        } else {
          toast.dismiss(toast_loading)
          toast.error(res.data?.detail || 'Failed to modify exercise')
        }
      } catch (error) {
        toast.dismiss(toast_loading)
        toast.error('Failed to modify exercise')
      } finally {
        setSubmitting(false)
      }
    },
  })

  function handleAddTag() {
    const newInput = tags.find((t: any) => t.value == tagInput)
    if (!newInput) {
      throw `${newInput} not found in tags`
    }

    const newInputVal = newInput.value

    if (!internalTags.find((t: any) => t.value === newInputVal)) {
      setInternalTags([...internalTags, newInputVal])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setInternalTags(internalTags.filter((tag: string) => tag !== tagToRemove))
  }

  const availableTags = tags.filter((t: any) => {
    const foundItem = internalTags.find((t2: any) => {
      return t2 === t.value
    })
    const found = foundItem !== undefined
    return !found
  })

  const addButtonDisabled = tagInput.trim() === '' || availableTags.length === 0

  function updateChoiceText(id: string, text: string) {
    setChoices(prev => prev.map(c => (c.id === id ? { ...c, text } : c)))
  }
  function toggleChoiceCorrect(id: string) {
    setChoices(prev => prev.map(c => (c.id === id ? { ...c, correct: !c.correct } : c)))
  }
  function addChoice() {
    setChoices(prev => [...prev, { id: crypto.randomUUID(), text: '', correct: false }])
  }
  function removeChoice(id: string) {
    setChoices(prev => (prev.length <= 2 ? prev : prev.filter(c => c.id !== id)))
  }

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <div className="flex flex-col min-h-[560px]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start flex-1">
          <div>
            {courses && (
              <FormField name="course_id">
                <FormLabelAndMessage label="Move to Course" message="" />
                <Form.Control asChild>
                  <select
                    className="bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100"
                    onChange={formik.handleChange}
                    value={formik.values.course_id || ''}
                    name="course_id"
                  >
                    <option value="">- None -</option>
                    {courses.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Form.Control>
              </FormField>
            )}

            <Separator className="my-10" />

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
                  name="title"
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
                  name="description"
                />
              </Form.Control>
            </FormField>

            <FormField name="tags">
              <FormLabelAndMessage label="Tags" message="" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Form.Control asChild>
                    <select
                      className="bg-gray-100/40 rounded-lg px-1 py-2 outline outline-1 outline-gray-100"
                      onChange={(e) => {
                        setTagInput(e.target.value)
                      }}
                      value={tagInput}
                      defaultValue={''}
                    >
                      <option value="">- None -</option>
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

                  <Button
                    onClick={handleAddTag}
                    disabled={addButtonDisabled}
                    type="button"
                  >
                    Add Tag
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {internalTags.map((tag: any) => {
                    const tagObj = tags.find((t: any) => t.value === tag)
                    const color = `#${tagObj.color?.toString(16).padStart(6, '0')}`

                    return (
                      <div
                        key={tag}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: color,
                        }}
                      >
                        <span>{tag}</span>
                        <Button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </FormField>
          </div>

          <div className="hidden md:flex h-full items-stretch">
            <Separator orientation="vertical" className="mx-2" />
          </div>

          <div className="w-full">
            <div className="mt-2 min-h-[320px]">
              <Tabs value={taskType} onValueChange={(v: any) => setTaskType(v)}>
                <TabsList>
                  <TabsTrigger value="ai">AI Task</TabsTrigger>
                  <TabsTrigger value="multiple_choice">Multiple Choice</TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                  <div className="space-y-4 mt-2">
                    <FormField name="ai_instruction">
                      <FormLabelAndMessage
                        label="Task Instruction"
                        message={''}
                      />
                      <Form.Control asChild>
                        <Textarea
                          value={aiInstruction}
                          onChange={(e) => setAiInstruction(e.target.value)}
                        />
                      </Form.Control>
                    </FormField>

                    <FormField name="ai_proposed_solution">
                      <FormLabelAndMessage
                        label="Proposed Solution"
                        message={''}
                      />
                      <Form.Control asChild>
                        <Textarea
                          value={aiProposedSolution}
                          onChange={(e) => setAiProposedSolution(e.target.value)}
                        />
                      </Form.Control>
                    </FormField>

                    <FormField name="ai_grading_criteria">
                      <FormLabelAndMessage
                        label="Grading Criteria (JSON)"
                        message={''}
                      />
                      <Form.Control asChild>
                        <Textarea
                          placeholder='{"criteria": [{"name": "Correctness", "weight": 0.7}]}'
                          value={aiGradingCriteriaText}
                          onChange={(e) => setAiGradingCriteriaText(e.target.value)}
                        />
                      </Form.Control>
                    </FormField>
                  </div>
                </TabsContent>

                <TabsContent value="multiple_choice">
                  <div className="space-y-3 mt-2">
                    {choices.map((choice, idx) => (
                      <div key={choice.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={choice.correct}
                          onChange={() => toggleChoiceCorrect(choice.id)}
                          className="h-4 w-4"
                        />
                        <Input
                          value={choice.text}
                          placeholder={`Answer ${idx + 1}`}
                          onChange={(e) => updateChoiceText(choice.id, e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={choices.length <= 2}
                          onClick={() => removeChoice(choice.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addChoice}
                      >
                        Add Answer
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Modify Exercise'
            )}
          </Button>
        </div>
      </div>
    </FormLayout>
  )
}

export default ModifyExerciseModal
