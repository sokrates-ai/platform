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
import { useRouter } from 'next/navigation'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { createExercise } from '@services/courses/workspaces'
import { mutate } from 'swr'
import { X, Wand2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs'
import { Separator } from '@components/ui/separator'
import { Button } from '@components/ui/button'
import { Switch } from '@components/ui/switch'
import { generateGradingCriteria } from './types'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog'

export interface TaskGradingCriteria {
    id_slug: string,
    short: string,
    detail: string,
    must_fix: boolean,
    weight: number,

}

const validationSchema = Yup.object().shape({
  title: Yup.string()
    .required('Exercise name is required')
    .max(100, 'Must be 100 characters or less'),
  description: Yup.string().max(1000, 'Must be 1000 characters or less'),
})

function CreateExerciseModal({
  closeModal,
  orgslug,
  mutateURL,
  courseID,
  tags,
}: any) {
  const router = useRouter()
  const session = useSokratesSession() as any;
  const [tagInput, setTagInput] = React.useState('')
  const [internalTags, setInternalTags] = React.useState<string[]>([])

  // task type: 'ai' | 'multiple_choice'
  const [taskType, setTaskType] = React.useState<'ai' | 'multiple_choice'>('ai')

  // Rewards
  const [xpReward, setXpReward] = React.useState<number>(0)
  const [coinReward, setCoinReward] = React.useState<number>(0)

  // AI fields
  const [aiInstruction, setAiInstruction] = React.useState('')
  const [aiProposedSolution, setAiProposedSolution] = React.useState('')
  const [criteria, setCriteria] = React.useState<TaskGradingCriteria[]>([]) // No criteria initially
  const [currentCriterionIndex, setCurrentCriterionIndex] = React.useState(0)
  const [showCriterionFlash, setShowCriterionFlash] = React.useState(false)
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

  // Multiple choice fields
  type Choice = { id: string; text: string; correct: boolean }
  type McQuestion = { id: string; user_question: string; choices: Choice[] }
  const [questions, setQuestions] = React.useState<McQuestion[]>([
    {
      id: crypto.randomUUID(),
      user_question: '',
      choices: [
        { id: crypto.randomUUID(), text: '', correct: false },
        { id: crypto.randomUUID(), text: '', correct: false },
      ],
    },
  ])
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false)
  const [generateExtraInput, setGenerateExtraInput] = React.useState('')
  

  const formik = useFormik({
    initialValues: {
      title: '',
      description: '',
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading('Creating exercise...')
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
          // Validate all questions
          if (questions.length === 0) {
            const err = 'Add at least one question'
            toast.error(err)
            setSubmitError(err)
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
          let invalid = false
          for (const q of questions) {
            const nonEmpty = q.choices.filter(c => c.text.trim() !== '')
            const hasCorrect = nonEmpty.some(c => c.correct)
            if (!q.user_question.trim() || nonEmpty.length < 2 || !hasCorrect) {
              invalid = true
              break
            }
          }
          if (invalid) {
            const err = 'Each question must have text, ≥2 options, and ≥1 correct'
            toast.error(err)
            setSubmitError(err)
            toast.dismiss(toast_loading)
            setSubmitting(false)
            return
          }
        }

        // Build payload
        let payload: any = {
          title: values.title,
          description: values.description,
          course_id: courseID,
          tags: internalTags,
          task_type: taskType,
          xp_reward: xpReward,
          coin_reward: coinReward,
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
            questions: questions.map(q => ({
              user_question: q.user_question,
              answers: q.choices
                .filter(c => c.text.trim() !== '')
                .map(c => ({ text: c.text.trim(), is_correct: c.correct })),
            })),
          }
        }

        const res = await createExercise(
          payload,
          session.data?.tokens?.access_token
        )

        if (res.success || res.success === undefined) {
          toast.dismiss(toast_loading)
          toast.success('Exercise created successfully')
          closeModal()
          mutate(mutateURL)
        } else {
          toast.dismiss(toast_loading)
          const errMsg = res.data?.detail || 'Failed to create exercise'
          toast.error(errMsg)
          setSubmitError(errMsg)
        }
      } catch (error) {
        toast.dismiss(toast_loading)
        const errMsg = 'Failed to create exercise'
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
      const list = Array.isArray(res.list) ? res.list : alert("An error occurred")

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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.5fr] gap-4 items-start flex-1">
          <div>
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
                  name="title"
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
                  required
                  name="description"
                  className='h-[10rem]'
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

            <FormField name="rewards">
              <FormLabelAndMessage label="Rewards" message="" />
              <div className="flex items-center space-x-6 pr-4">
                <div className="flex flex-col items-start space-y-1">
                  <span className="text-xs text-neutral-500">XP: {xpReward}</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={xpReward}
                    onChange={(e) => setXpReward(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col items-start space-y-1">
                  <span className="text-xs text-neutral-500">Coins: {coinReward}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={coinReward}
                    onChange={(e) => setCoinReward(Number(e.target.value))}
                  />
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
                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                    <div className="space-y-4 h-full">
                      <FormField name="ai_instruction" className='h-1/2'>
                        <div className='flex flex-col justify-start h-full w-full'>
                        <span className='text-sm'>Task Instruction</span>
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
                        <div className='flex flex-col justify-start h-full w-full'>
                        <span className='text-sm'>Proposed Solution</span>
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

                    <div className={isGenerating ? 'pointer-events-none opacity-50' : ''}>
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
                          {/* Pagination controls */}
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              Criterion {criteria.length === 0 ? 0 : currentCriterionIndex + 1} of {criteria.length}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={currentCriterionIndex <= 0}
                                onClick={() => setCurrentCriterionIndex((i) => Math.max(0, i - 1))}
                              >
                                Previous
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={currentCriterionIndex >= criteria.length - 1}
                                onClick={() => setCurrentCriterionIndex((i) => Math.min(criteria.length - 1, i + 1))}
                              >
                                Next
                              </Button>
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
                                    <Input
                                      value={c.id_slug}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, id_slug: v } : pc))
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-muted-foreground">Short</label>
                                    <Input
                                      value={c.short}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, short: v } : pc))
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Weight</label>
                                    <Input
                                      type="number"
                                      value={c.weight}
                                      onChange={(e) => {
                                        const v = Number(e.target.value)
                                        setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, weight: v } : pc))
                                      }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Detail</label>
                                  <Textarea
                                    value={c.detail}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, detail: v } : pc))
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={c.must_fix}
                                    onCheckedChange={(checked) => {
                                      setCriteria(prev => prev.map((pc, i) => i === idx ? { ...pc, must_fix: !!checked } : pc))
                                    }}
                                  />
                                  <span className="text-sm">Must fix</span>
                                </div>
 
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                </div>
 
                                <div className="flex justify-between">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      const blank = { id_slug: '', type: '', short: '', detail: '', must_fix: false, weight: 1, prereqs: [], evidence: { targets: [], methods: [], forms: [] } }
                                      setCriteria(prev => { const next = [...prev]; next.splice(idx + 1, 0, blank); return next })
                                      setCurrentCriterionIndex(idx + 1)
                                    }}
                                  >
                                    Add After
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCriteria(prev => prev.length > 0 ? prev.filter((_, i) => i !== idx) : prev)
                                      setCurrentCriterionIndex((i) => Math.max(0, Math.min(i, criteria.length - 2)))
                                    }}
                                    disabled={criteria.length === 0}
                                  >
                                    Remove Criterion
                                  </Button>
                                </div>
                              </>
                              ) })()}
                            </div>
                            </>
                          )}
 
                          {criteria.length === 0 ? (
                          <div className="flex items-center justify-between">
                            <div />
                            <Button type="button" variant="secondary" size="sm" onClick={() => { const blank = { id_slug: '', type: '', short: '', detail: '', must_fix: false, weight: 1, prereqs: [], evidence: { targets: [], methods: [], forms: [] } }; setCriteria(prev => ([...prev, blank])); setCurrentCriterionIndex(criteria.length); }}>
                              Add Criterion
                            </Button>
                          </div>)
                          : (<></>)}
                        </div>
                      </FormField>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="multiple_choice">
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Question {questions.length === 0 ? 0 : currentQuestionIndex + 1} of {questions.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={currentQuestionIndex <= 0}
                          onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={currentQuestionIndex >= questions.length - 1}
                          onClick={() => setCurrentQuestionIndex(i => Math.min(questions.length - 1, i + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>

                    {questions.length > 0 && (() => { const idx = currentQuestionIndex; const q = questions[idx]; return (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">User question</label>
                          <Input
                            value={q.user_question}
                            placeholder="Enter the question shown to the user"
                            onChange={(e) => {
                              const v = e.target.value
                              setQuestions(prev => prev.map((pq, i) => i === idx ? { ...pq, user_question: v } : pq))
                            }}
                          />
                        </div>
                        {q.choices.map((choice, cidx) => (
                          <div key={choice.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={choice.correct}
                              onChange={() => setQuestions(prev => prev.map((pq, i) => i === idx ? { ...pq, choices: pq.choices.map(ch => ch.id === choice.id ? { ...ch, correct: !ch.correct } : ch) } : pq))}
                              className="h-4 w-4"
                            />
                            <Input
                              value={choice.text}
                              placeholder={`Answer ${cidx + 1}`}
                              onChange={(e) => {
                                const v = e.target.value
                                setQuestions(prev => prev.map((pq, i) => i === idx ? { ...pq, choices: pq.choices.map(ch => ch.id === choice.id ? { ...ch, text: v } : ch) } : pq))
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={q.choices.length <= 2}
                              onClick={() => setQuestions(prev => prev.map((pq, i) => i === idx ? { ...pq, choices: pq.choices.length <= 2 ? pq.choices : pq.choices.filter(ch => ch.id !== choice.id) } : pq))}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <div className="flex justify-between">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setQuestions(prev => prev.map((pq, i) => i === idx ? { ...pq, choices: [...pq.choices, { id: crypto.randomUUID(), text: '', correct: false }] } : pq))}
                          >
                            Add Answer
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const blank: McQuestion = { id: crypto.randomUUID(), user_question: '', choices: [ { id: crypto.randomUUID(), text: '', correct: false }, { id: crypto.randomUUID(), text: '', correct: false } ] }
                                setQuestions(prev => { const next = [...prev]; next.splice(idx + 1, 0, blank); return next })
                                setCurrentQuestionIndex(idx + 1)
                              }}
                            >
                              Add After
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => { setQuestions(prev => prev.length > 0 ? prev.filter((_, i) => i !== idx) : prev); setCurrentQuestionIndex(i => Math.max(0, Math.min(i, questions.length - 2))) }}
                              disabled={questions.length === 0}
                            >
                              Remove Question
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) })()}

                    {questions.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <div />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => { const blank: McQuestion = { id: crypto.randomUUID(), user_question: '', choices: [ { id: crypto.randomUUID(), text: '', correct: false }, { id: crypto.randomUUID(), text: '', correct: false } ] }; setQuestions(prev => ([...prev, blank])); setCurrentQuestionIndex(questions.length); }}
                        >
                          Add Question
                        </Button>
                      </div>
                    ) : (<></>)}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        {submitError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {submitError}
          </div>
        )}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Create Exercise'
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

export default CreateExerciseModal
