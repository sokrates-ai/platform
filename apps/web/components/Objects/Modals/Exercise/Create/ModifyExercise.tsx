'use client'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import FormLayout, {
  FormField,
  FormLabel,
  FormLabelAndMessage,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import React from 'react'
import { BarLoader } from 'react-spinners'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { X, Wand2 } from 'lucide-react'
import { modifyExercise } from '@services/courses/workspaces'
import { mutate } from 'swr'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs'
import { Separator } from '@components/ui/separator'
import { Button } from '@components/ui/button'
import { Switch } from '@components/ui/switch'
import { generateGradingCriteria } from './types'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog'

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string().max(1000, 'Must be 1000 characters or less'),
})

type TaskGradingCriteria = {
  id_slug: string,
  short: string,
  detail: string,
  must_fix: boolean,
  weight: number,
}

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
  const [criteria, setCriteria] = React.useState<TaskGradingCriteria[]>([{
    id_slug: '', short: '', detail: '', must_fix: false, weight: 1,
  }])
  const [currentCriterionIndex, setCurrentCriterionIndex] = React.useState(0)
  const [showCriterionFlash, setShowCriterionFlash] = React.useState(false)

  // Multiple choice state
  type Choice = { id: string; text: string; correct: boolean }
  const [choices, setChoices] = React.useState<Choice[]>([])
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false)
  const [generateExtraInput, setGenerateExtraInput] = React.useState('')
  const [mcQuestion, setMcQuestion] = React.useState('')

  // Hydrate type-specific state from incoming exercise
  React.useEffect(() => {
    if (exercise?.task_type === 'ai') {
      const ai = exercise.ai_instruction || {}
      setAiInstruction(ai.task_instruction || '')
      setAiProposedSolution(ai.proposed_solution || '')
      const incoming = ai.grading_criteria?.criteria
      if (Array.isArray(incoming)) {
        const mapped = incoming.map((c: any) => ({
          id_slug: c?.id_slug || '',
          short: c?.short || '',
          detail: c?.detail || '',
          must_fix: !!c?.must_fix,
          weight: typeof c?.weight === 'number' ? c.weight : 1,
        }))
        setCriteria(mapped.length > 0 ? mapped : [{ id_slug: '', short: '', detail: '', must_fix: false, weight: 1 }])
        setCurrentCriterionIndex(0)
      }
    } else if (exercise?.task_type === 'multiple_choice') {
      const answers = exercise.multiple_choice_data?.answers || []
      const mapped = answers.map((a: any) => ({ id: crypto.randomUUID(), text: a.text || '', correct: !!a.is_correct }))
      setMcQuestion(exercise.multiple_choice_data?.user_question || '')
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

  React.useEffect(() => {
    if (currentCriterionIndex > criteria.length - 1) {
      setCurrentCriterionIndex(Math.max(0, criteria.length - 1))
    }
  }, [criteria.length])

  React.useEffect(() => {
    setShowCriterionFlash(true)
    const t = setTimeout(() => setShowCriterionFlash(false), 900)
    return () => clearTimeout(t)
  }, [currentCriterionIndex])

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
      setSubmitError(null)

      try {
        // Validate type-specific fields
        if (taskType === 'ai') {
          if (!aiInstruction.trim()) {
            toast.error('Task instruction is required for AI tasks')
            setSubmitError('Task instruction is required for AI tasks')
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
          // Validate grading criteria
          const slugs = new Set<string>()
          let hasError = false
          for (const c of criteria) {
            const id = (c.id_slug || '').trim()
            const short = (c.short || '').trim()
            const detail = (c.detail || '').trim()
            if (!id || !short || !detail) {
              hasError = true
              break
            }
            if (slugs.has(id)) {
              hasError = true
              break
            }
            slugs.add(id)
          }
          if (hasError) {
            const err = 'All criteria must have a unique id slug, and non-empty short and detail.'
            toast.error(err)
            setSubmitError(err)
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
        } else if (taskType === 'multiple_choice') {
          const nonEmpty = choices.filter(c => c.text.trim() !== '')
          const hasCorrect = nonEmpty.some(c => c.correct)
          if (nonEmpty.length < 2) {
            toast.error('Provide at least two answer options')
            setSubmitError('Provide at least two answer options')
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
          if (!hasCorrect) {
            toast.error('Select at least one correct answer')
            setSubmitError('Select at least one correct answer')
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
          const gradingCriteria = { criteria }
          payload.ai_instruction = {
            task_instruction: aiInstruction,
            proposed_solution: aiProposedSolution,
            grading_criteria: gradingCriteria,
          }
        } else {
          payload.multiple_choice_data = {
            user_question: mcQuestion,
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
          const errMsg = res.data?.detail || 'Failed to modify exercise'
          toast.error(errMsg)
          setSubmitError(errMsg)
        }
      } catch (error) {
        toast.dismiss(toast_loading)
        const errMsg = 'Failed to modify exercise'
        toast.error(errMsg)
        setSubmitError(errMsg)
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

  async function handleGenerate(extra: string) {
    setSubmitError(null)
    setIsGenerating(true)
    try {
      const combinedUserInput = [formik.values.description || '', (extra || '').trim()].filter(Boolean).join('\n\n')
      const data: any = {
        title: formik.values.title,
        description: formik.values.description,
        task_type: 'ai',
        ai_instruction: {
          task_instruction: aiInstruction,
          proposed_solution: aiProposedSolution,
        },
        multiple_choice_data: {},
        xp_reward: 0,
        coin_reward: 0,
        user_input: combinedUserInput,
      }
      const res = await generateGradingCriteria(data, (session as any).data?.tokens?.access_token)
      const list = Array.isArray(res?.list)
        ? res.list : alert("AI error")
      if (!Array.isArray(list) || list.length === 0) {
        toast.error('No criteria generated')
      } else {
        const mapped = list.map((c: any) => ({
          id_slug: c?.id_slug || '',
          short: c?.short || '',
          detail: c?.detail || '',
          must_fix: !!c?.must_fix,
          weight: typeof c?.weight === 'number' ? c.weight : 1,
        }))
        setCriteria(prev => [...prev, ...mapped])
        toast.success('Generated criteria added')
      }
    } catch (e) {
      toast.error('Failed to generate criteria')
    } finally {
      setIsGenerating(false)
      setIsGenerateDialogOpen(false)
      setGenerateExtraInput('')
    }
  }

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <div className="flex flex-col min-h-[560px]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start flex-1">
          <div>
            {courses && (
              <FormField name="course_id" className='border-orange-400 border-2 bg-gray-200 p-4 rounded-lg'>
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
                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex flex-col h-full w-full">
                      <FormField name="ai_instruction" className='h-1/2 w-full'>
                        <div className='flex flex-col justify-start h-full w-full'>
                        <span className="text-sm">{'Task Instruction'}</span>
                        <Form.Control asChild>
                          <Textarea
                            className='h-full w-full'
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                          />
                        </Form.Control>
                        </div>
                      </FormField>

                      <FormField name="ai_proposed_solution" className='h-1/2'>
                        <div className='flex flex-col justify-start h-full'>
                            <span className="text-sm">{'Sample Solution'}</span>
                            <Form.Control asChild>
                            <Textarea
                                className='h-full w-full'
                                value={aiProposedSolution}
                                onChange={(e) => setAiProposedSolution(e.target.value)}
                            />
                            </Form.Control>
                        </div>
                      </FormField>
                    </div>

                    <div className={`h-1/2 ${isGenerating ? 'pointer-events-none opacity-50' : ''}`}>
                      <FormField name="ai_grading_criteria">
                        <FormLabelAndMessage
                          label="Grading Criteria"
                          message={''}
                        />
                        <div className="flex items-center justify-between mb-3">
                          <div />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isGenerating}
                            onClick={() => {
                              setSubmitError(null)
                              setIsGenerateDialogOpen(true)
                            }}
                          >
                            {isGenerating ? (
                              <div className="flex items-center gap-2"><BarLoader width={40} color="#000000" /><span className="text-xs">Generating…</span></div>
                            ) : (
                              <div className="flex items-center gap-2"><Wand2 size={14} /> <span>Generate</span></div>
                            )}
                          </Button>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              Criterion {criteria.length === 0 ? 0 : currentCriterionIndex + 1} of {criteria.length}
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={currentCriterionIndex <= 0} onClick={() => setCurrentCriterionIndex((i) => Math.max(0, i - 1))}>Previous</Button>
                              <Button type="button" variant="outline" size="sm" disabled={currentCriterionIndex >= criteria.length - 1} onClick={() => setCurrentCriterionIndex((i) => Math.min(criteria.length - 1, i + 1))}>Next</Button>
                            </div>
                          </div>

                          {criteria.length > 0 && (<>
                            <div className="relative rounded-md border p-3 space-y-3">
                              <div className={`pointer-events-none absolute -top-3 right-2 select-none rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow transition-all duration-300 ${showCriterionFlash ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                                {`#${currentCriterionIndex + 1} / ${criteria.length}`}
                              </div>
                              {(() => { const idx = currentCriterionIndex; const c = criteria[idx]; return (<>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-muted-foreground">ID Slug</label>
                                    <Input value={c.id_slug} onChange={(e) => { const v = e.target.value; setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, id_slug: v } : pc)) }} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Weight</label>
                                    <Input type="number" value={c.weight} onChange={(e) => { const v = Number(e.target.value); setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, weight: v } : pc)) }} />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Short</label>
                                  <Input value={c.short} onChange={(e) => { const v = e.target.value; setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, short: v } : pc)) }} />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Detail</label>
                                  <Textarea value={c.detail} onChange={(e) => { const v = e.target.value; setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, detail: v } : pc)) }} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch checked={c.must_fix} onCheckedChange={(checked) => { setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, must_fix: !!checked } : pc)) }} />
                                  <span className="text-sm">Essential for Task</span>
                                </div>

                                <Separator className='my-10'/>

                                <div className="flex justify-between">
                                  <Button type="button" variant="secondary" size="sm" onClick={() => { const blank = { id_slug: '', short: '', detail: '', must_fix: false, weight: 1 }; setCriteria(prev => { const next = [...prev]; next.splice(idx + 1, 0, blank); return next }); setCurrentCriterionIndex(idx + 1) }}>Add After</Button>
                                  <Button type="button" variant="secondary" size="sm" onClick={() => { setCriteria(prev => prev.length > 0 ? prev.filter((_, i) => i !== idx) : prev); setCurrentCriterionIndex((i) => Math.max(0, Math.min(i, criteria.length - 2))) }} disabled={criteria.length === 0}>Remove Criterion</Button>
                                </div>
                              </>) })()}
                            </div>
                          </>)}

                          {criteria.length === 0 ? (
                            <div className="flex items-center justify-between">
                              <div />
                              <Button type="button" variant="secondary" size="sm" onClick={() => { const blank = { id_slug: '', short: '', detail: '', must_fix: false, weight: 1 }; setCriteria(prev => ([...prev, blank])); setCurrentCriterionIndex(criteria.length); }}>Add Criterion</Button>
                            </div>) : (<></>)}
                        </div>
                      </FormField>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="multiple_choice">
                  <div className="space-y-3 mt-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">User question</label>
                      <Input
                        value={mcQuestion}
                        placeholder="Enter the question shown to the user"
                        onChange={(e) => setMcQuestion(e.target.value)}
                      />
                    </div>
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
          {submitError && (
            <div className="mr-auto rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {submitError}
            </div>
          )}
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

      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Additional details for generation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Add any extra context for the LLM (optional)"
              value={generateExtraInput}
              onChange={(e) => setGenerateExtraInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsGenerateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleGenerate(generateExtraInput)}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormLayout>
  )
}

export default ModifyExerciseModal
