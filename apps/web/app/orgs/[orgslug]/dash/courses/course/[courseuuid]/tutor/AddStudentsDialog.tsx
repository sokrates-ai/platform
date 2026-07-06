'use client'

import React from 'react'
import useSWR from 'swr'
import { Loader2, Plus, Search, UserPlus } from 'lucide-react'

import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { getAPIUrl } from '@services/config/config'
import { addRoomStudents } from '@services/courses/rooms'
import { swrFetcher } from '@services/utils/ts/requests'
import { fuzzyFilter } from '@services/utils/ts/fuzzySearch'
import { cn } from '@/lib/utils'

type CandidateStudent = {
  id: number
  user_uuid: string
  username: string
  first_name?: string
  last_name?: string
  email?: string
}

type AddStudentsDialogProps = {
  courseUuid: string
  roomId: number
  accessToken?: string
  onStudentsAdded: () => void
}

const MAX_RESULTS = 10

function studentLabel(student: CandidateStudent): string {
  const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()
  return name || student.username
}

function studentHaystack(student: CandidateStudent): string {
  return [
    student.first_name,
    student.last_name,
    student.username,
    student.email,
  ]
    .filter(Boolean)
    .join(' ')
}

export default function AddStudentsDialog({
  courseUuid,
  roomId,
  accessToken,
  onStudentsAdded,
}: AddStudentsDialogProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const availableKey =
    isOpen && accessToken
      ? `${getAPIUrl()}courses/${courseUuid}/rooms/${roomId}/available-students`
      : null

  const {
    data: available,
    error: availableError,
    isLoading,
    mutate: mutateAvailable,
  } = useSWR<CandidateStudent[]>(availableKey, (url: string) =>
    swrFetcher(url, accessToken)
  )

  const candidates = React.useMemo(() => available ?? [], [available])
  const filtered = React.useMemo(
    () => fuzzyFilter(query, candidates, studentHaystack, MAX_RESULTS),
    [candidates, query]
  )

  const resetState = React.useCallback(() => {
    setQuery('')
    setSelectedIds(new Set())
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetState()
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

  const handleAdd = async () => {
    if (!accessToken || selectedIds.size === 0) return
    setIsSubmitting(true)
    try {
      const response = await addRoomStudents(
        courseUuid,
        roomId,
        Array.from(selectedIds),
        accessToken
      )
      if (response.success) {
        toast({
          title: 'Students added',
          description: `Added ${selectedIds.size} student${
            selectedIds.size === 1 ? '' : 's'
          } to the room.`,
        })
        onStudentsAdded()
        mutateAvailable()
        handleOpenChange(false)
      } else {
        toast({
          title: 'Could not add students',
          description: response.HTTPmessage || 'Please try again.',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Could not add students',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const dialogContent = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search students by name, username or email…"
          className="pl-9"
        />
      </div>

      <div className="min-h-[240px]">
        {isLoading ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading students…
          </div>
        ) : availableError ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-rose-600">
            Unable to load students. Please try again.
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-gray-500">
            <UserPlus className="h-6 w-6 text-gray-300" />
            No students available to add.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-gray-500">
            <Search className="h-6 w-6 text-gray-300" />
            No students match your search.
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
                        ? 'border-emerald-300 bg-emerald-50'
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
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-gray-300'
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
        <span className="text-xs text-gray-500">
          {selectedIds.size} selected
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add to room
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Modal
      isDialogOpen={isOpen}
      onOpenChange={handleOpenChange}
      minWidth="sm"
      dialogTitle="Add students to room"
      dialogDescription="Search for enrolled students and add them to this room."
      dialogTrigger={
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add students
        </button>
      }
      dialogContent={dialogContent}
    />
  )
}
