'use client'

import React from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import { AlertTriangle, Loader2, RotateCcw, Search, Users } from 'lucide-react'

import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { resetCourseProgress } from '@services/courses/progress'
import { swrFetcher } from '@services/utils/ts/requests'
import { fuzzyFilter } from '@services/utils/ts/fuzzySearch'
import { cn } from '@/lib/utils'

type CourseStudent = {
  id: number
  user_uuid: string
  username: string
  first_name?: string
  last_name?: string
  email?: string
}

type ResetCourseProgressProps = {
  courseUuid: string
}

const MAX_RESULTS = 50

function studentLabel(student: CourseStudent): string {
  const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()
  return name || student.username
}

function studentHaystack(student: CourseStudent): string {
  return [student.first_name, student.last_name, student.username, student.email]
    .filter(Boolean)
    .join(' ')
}

function ResetCourseProgress(props: ResetCourseProgressProps) {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token

  const [isOpen, setIsOpen] = React.useState(false)
  const [isConfirming, setIsConfirming] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())

  const studentsKey = props.courseUuid
    ? `${getAPIUrl()}courses/students/list?course_uuid=${props.courseUuid}`
    : null

  const {
    data: students,
    error: studentsError,
    isLoading,
  } = useSWR<CourseStudent[]>(isOpen && access_token ? studentsKey : null, (url: string) =>
    swrFetcher(url, access_token)
  )

  const candidates = React.useMemo(() => students ?? [], [students])
  const filtered = React.useMemo(
    () => fuzzyFilter(query, candidates, studentHaystack, MAX_RESULTS),
    [candidates, query]
  )
  const selectedStudents = React.useMemo(
    () => candidates.filter((student) => selectedIds.has(student.id)),
    [candidates, selectedIds]
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setQuery('')
      setSelectedIds(new Set())
      setIsConfirming(false)
    }
  }

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleReset = async () => {
    if (!access_token || selectedIds.size === 0) return
    setIsSubmitting(true)
    try {
      const response = await resetCourseProgress(
        props.courseUuid,
        Array.from(selectedIds),
        access_token
      )
      if (response.success) {
        toast.success(
          `Progress reset for ${selectedIds.size} user${selectedIds.size === 1 ? '' : 's'}`
        )
        if (studentsKey) {
          mutate(studentsKey)
        }
        handleOpenChange(false)
      } else {
        toast.error(
          `Error ${response.status}: ${response.data?.detail || 'Could not reset progress'}`
        )
      }
    } catch (error: any) {
      toast.error(error?.message || 'An error occurred while resetting progress.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectionContent = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users by name, username or email…"
          className="pl-9"
        />
      </div>

      <div className="min-h-[240px] max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading users…
          </div>
        ) : studentsError ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-rose-600">
            Unable to load users. Please try again.
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-gray-500">
            <Users className="h-6 w-6 text-gray-300" />
            Nobody has started this course yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-gray-500">
            <Search className="h-6 w-6 text-gray-300" />
            No users match your search.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((student) => {
              const isSelected = selectedIds.has(student.id)
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => toggleSelected(student.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-transparent hover:bg-gray-50'
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-gray-800">
                        {studentLabel(student)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {student.email || student.username}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border text-white',
                        isSelected ? 'border-rose-500 bg-rose-500' : 'border-gray-300'
                      )}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsConfirming(true)}
            disabled={selectedIds.size === 0}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset progress
          </Button>
        </div>
      </div>
    </div>
  )

  const confirmContent = (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-md bg-red-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="text-sm text-red-700">
          <p className="font-bold">This cannot be undone.</p>
          <p>
            All completed and begun activities, task results and the course enrollment
            of the users below will be deleted. They will be removed from the course
            participant list until they open the course again.
          </p>
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto rounded-md border border-gray-100">
        <ul className="divide-y divide-gray-100">
          {selectedStudents.map((student) => (
            <li key={student.id} className="flex flex-col px-3 py-2">
              <span className="text-sm font-semibold text-gray-800">
                {studentLabel(student)}
              </span>
              <span className="text-xs text-gray-400">
                {student.email || student.username}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">
          {selectedStudents.length} user{selectedStudents.length === 1 ? '' : 's'} affected
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsConfirming(false)}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReset}
            disabled={isSubmitting || selectedStudents.length === 0}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Yes, reset progress
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="mx-4 sm:mx-10 mb-4 bg-white rounded-xl shadow-sm px-4 py-4">
      <div className="flex flex-col bg-gray-50 -space-y-1 px-3 sm:px-5 py-3 rounded-md mb-3">
        <h1 className="font-bold text-lg sm:text-xl text-gray-800">
          Reset student progress
        </h1>
        <h2 className="text-gray-500 text-xs sm:text-sm">
          Undo completed and begun tasks for selected users of this course. Their
          progress is deleted permanently and they start from scratch.
        </h2>
      </div>
      <div className="flex flex-row-reverse mt-3 mr-2">
        <Modal
          isDialogOpen={isOpen}
          onOpenChange={handleOpenChange}
          minHeight="no-min"
          minWidth="sm"
          dialogTitle={isConfirming ? 'Reset progress?' : 'Reset progress of users'}
          dialogDescription={
            isConfirming
              ? 'Please confirm that you want to delete the progress of these users.'
              : 'Select the users whose progress in this course should be reset.'
          }
          dialogContent={isConfirming ? confirmContent : selectionContent}
          dialogTrigger={
            <Button
              variant="destructive"
              className="flex space-x-2 hover:cursor-pointer p-1 px-3 rounded-md font-bold items-center text-xs sm:text-sm"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Reset progress of users</span>
            </Button>
          }
        />
      </div>
    </div>
  )
}

export default ResetCourseProgress
