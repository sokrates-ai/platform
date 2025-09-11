'use client'
import React from 'react'
import FormLayout, { FormField, FormLabelAndMessage } from '@components/Objects/StyledElements/Form/Form'
import { Separator } from '@components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs'

function FieldRow({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value || '-'}</div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 mr-1">{children}</span>
  )
}

function ViewExerciseModal({ closeModal, tags, courses, exercise }: any) {
  const taskType: 'ai' | 'multiple_choice' = exercise?.task_type || 'ai'
  const internalTags: string[] = exercise?.tags || []

  const tagBadges = (
    <div className="flex flex-wrap gap-1.5">
      {internalTags.length === 0 ? (
        <span className="text-sm text-muted-foreground">No tags</span>
      ) : (
        internalTags.map((tag: string) => {
          const tagObj = tags?.find((t: any) => t.value === tag) || { value: tag, color: 0xeeeeee }
          const color = `#${(tagObj.color ?? 0xeeeeee).toString(16).padStart(6, '0')}`
          return (
            <span key={tag} className="px-2 py-0.5 rounded-full text-xs text-gray-700" style={{ backgroundColor: color }}>
              {tagObj.value}
            </span>
          )
        })
      )}
    </div>
  )

  return (
    <FormLayout onSubmit={(e: any) => e.preventDefault()}>
      <div className="flex flex-col min-h-[560px]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start flex-1">
          <div>
            <FieldRow label="Exercise Title" value={exercise?.title} />
            <FieldRow label="Exercise Description" value={exercise?.description} />
            <FormField name="tags">
              <FormLabelAndMessage label="Tags" message="" />
              <div className="mt-1">{tagBadges}</div>
            </FormField>
            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-1">Course</div>
              <div className="text-sm">
                {(() => {
                  const courseId = exercise?.course_id
                  if (!courseId) return '-'
                  const c = courses?.find((cc: any) => cc.id === courseId)
                  return c?.name || '-'
                })()}
              </div>
            </div>
          </div>

          <div className="hidden md:flex h-full items-stretch">
            <Separator orientation="vertical" className="mx-2" />
          </div>

          <div className="w-full">
            <div className="mt-2 min-h-[320px]">
              <Tabs value={taskType}>
                <TabsList>
                  <TabsTrigger value="ai">AI Task</TabsTrigger>
                  <TabsTrigger value="multiple_choice">Multiple Choice</TabsTrigger>
                </TabsList>

                <TabsContent value="ai">
                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <FieldRow label="Task Instruction" value={exercise?.ai_instruction?.task_instruction || ''} />
                      <FieldRow label="Sample Solution" value={exercise?.ai_instruction?.proposed_solution || ''} />
                    </div>

                    <div>
                      <FormField name="ai_grading_criteria">
                        <FormLabelAndMessage label="Grading Criteria" message="" />
                        <div className="space-y-3">
                          {Array.isArray(exercise?.ai_instruction?.grading_criteria?.criteria) && exercise.ai_instruction.grading_criteria.criteria.length > 0 ? (
                            exercise.ai_instruction.grading_criteria.criteria.map((c: any, idx: number) => (
                              <div key={idx} className="rounded-md border p-3 space-y-1">
                                <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <FieldRow label="ID Slug" value={c?.id_slug || ''} />
                                  <FieldRow label="Weight" value={(typeof c?.weight === 'number' ? c.weight : 1).toString()} />
                                </div>
                                <FieldRow label="Short" value={c?.short || ''} />
                                <FieldRow label="Detail" value={c?.detail || ''} />
                                <div className="text-sm">{c?.must_fix ? <Pill>Essential for Task</Pill> : <Pill>Optional</Pill>}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">No criteria</div>
                          )}
                        </div>
                      </FormField>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="multiple_choice">
                  <div className="space-y-3 mt-2">
                    {Array.isArray(exercise?.multiple_choice_data?.answers) && exercise.multiple_choice_data.answers.length > 0 ? (
                      exercise.multiple_choice_data.answers.map((a: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className={`h-4 w-4 rounded border ${a?.is_correct ? 'bg-green-500 border-green-600' : 'bg-transparent'}`} />
                          <div className="text-sm">{a?.text || ''}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No answers</div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="button" className="px-3 py-2 rounded-md bg-gray-900 text-white" onClick={closeModal}>Close</button>
        </div>
      </div>
    </FormLayout>
  )
}

export default ViewExerciseModal 