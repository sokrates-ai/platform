'use client'

import React from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import { Check, ChevronDown, LogOut, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import {
  acceptCourseMemberGroupInvite,
  CourseMemberGroupMe,
  CourseMemberGroupRosterStudent,
  createCourseMemberGroupInvites,
  declineCourseMemberGroupInvite,
  leaveCourseMemberGroup,
} from '@services/courses/member-groups'

function displayName(user: {
  first_name?: string
  last_name?: string
  username: string
  email: string
}) {
  const first = user.first_name?.trim()
  const lastInitial = user.last_name?.trim()?.[0]
  if (first && lastInitial) return `${first} ${lastInitial}.`
  if (first) return first
  return user.username || user.email
}

function shortName(user: {
  first_name?: string
  username: string
  email: string
}) {
  return user.first_name?.trim() || user.username || user.email
}

export default function CourseGroupPill({
  courseUuid,
  className,
  onOpenChange,
}: {
  courseUuid: string
  className?: string
  onOpenChange?: (open: boolean) => void
}) {
  const session = useSokratesSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isCourseStaff, loading } = useCourseStaffStatus()
  const [selectedRecipientIds, setSelectedRecipientIds] = React.useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const meUrl = accessToken
    ? `${getAPIUrl()}courses/${courseUuid}/member-groups/me`
    : null
  const rosterUrl = accessToken
    ? `${getAPIUrl()}courses/${courseUuid}/member-groups/roster`
    : null

  const { data: me } = useSWR<CourseMemberGroupMe>(
    !loading && !isCourseStaff ? meUrl : null,
    (url: string) => swrFetcher(url, accessToken),
  )
  const { data: roster } = useSWR<CourseMemberGroupRosterStudent[]>(
    !loading && !isCourseStaff ? rosterUrl : null,
    (url: string) => swrFetcher(url, accessToken),
  )

  const refresh = React.useCallback(async () => {
    if (meUrl) {
      await mutate(meUrl)
    }
    if (rosterUrl) {
      await mutate(rosterUrl)
    }
  }, [meUrl, rosterUrl])

  const inviteableStudents = React.useMemo(() => {
    return (roster || []).filter((student) => {
      if (student.group_id && student.group_id === me?.group?.id) {
        return false
      }
      return !student.has_pending_invite_from_me
    })
  }, [me?.group?.id, roster])

  const label = me?.group
    ? `GROUP - ${me.group.member_count} ${me.group.member_count === 1 ? 'Person' : 'People'}`
    : 'NO GROUP'

  const toggleRecipient = (userId: number) => {
    setSelectedRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  const submitInvites = async () => {
    if (!accessToken || selectedRecipientIds.length === 0 || isSubmitting) {
      return
    }
    setIsSubmitting(true)
    const result = await createCourseMemberGroupInvites(
      courseUuid,
      selectedRecipientIds,
      accessToken,
    )
    setIsSubmitting(false)
    if (!result.success) {
      toast.error('Unable to send group invites.')
      return
    }
    setSelectedRecipientIds([])
    toast.success('Group invites sent.')
    await refresh()
  }

  const handleInviteAction = async (
    action: 'accept' | 'decline',
    inviteId: number,
  ) => {
    if (!accessToken) return
    const result =
      action === 'accept'
        ? await acceptCourseMemberGroupInvite(courseUuid, inviteId, accessToken)
        : await declineCourseMemberGroupInvite(courseUuid, inviteId, accessToken)
    if (!result.success) {
      toast.error(`Unable to ${action} invite.`)
      return
    }
    toast.success(action === 'accept' ? 'Invite accepted.' : 'Invite declined.')
    await refresh()
  }

  const handleLeave = async () => {
    if (!accessToken) return
    const result = await leaveCourseMemberGroup(courseUuid, accessToken)
    if (!result.success) {
      toast.error('Unable to leave group.')
      return
    }
    toast.success('Left group.')
    setSelectedRecipientIds([])
    await refresh()
  }

  React.useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])

  React.useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ courseUuid?: string }>
      const targetCourseUuid = customEvent.detail?.courseUuid
      if (!targetCourseUuid || targetCourseUuid !== courseUuid) {
        return
      }
      setOpen(true)
    }

    window.addEventListener('course-group-pill:open', handleOpenEvent)
    return () => {
      window.removeEventListener('course-group-pill:open', handleOpenEvent)
    }
  }, [courseUuid])

  React.useEffect(() => {
    const handleRefreshEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        courseUuid?: string
        kind?: string
        topic?: string
      }>
      const targetCourseUuid = customEvent.detail?.courseUuid
      if (!targetCourseUuid || targetCourseUuid !== courseUuid) {
        return
      }

      const kind = customEvent.detail?.kind
      const topic = customEvent.detail?.topic
      const isRelevantTopic =
        typeof topic === 'string' && topic.startsWith('user/')
      const isRelevantKind =
        typeof kind === 'string' &&
        [
          'group_invite_received',
          'group_invite_accepted',
          'group_invite_declined',
          'group_member_left',
        ].includes(kind)

      if (!isRelevantTopic && !isRelevantKind) {
        return
      }

      void refresh()
    }

    window.addEventListener('course-group-pill:refresh', handleRefreshEvent)
    return () => {
      window.removeEventListener('course-group-pill:refresh', handleRefreshEvent)
    }
  }, [courseUuid, refresh])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  if (loading || !accessToken || isCourseStaff) {
    return null
  }

  return (
    <div ref={rootRef} className="relative z-[220] pointer-events-auto">
      <div>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'rounded-full border-slate-300 bg-white/95 px-4 text-xs font-semibold tracking-wide text-slate-700 shadow-sm backdrop-blur',
            className,
          )}
          onClick={() => setOpen((current) => !current)}
        >
          <Users className="mr-2 h-4 w-4" />
          {label}
          <ChevronDown
            className={cn('ml-2 h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </div>
      {open ? (
        <div
          className="absolute right-0 top-full z-[140] mt-2 w-[22rem] overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-xl"
        >
        <ScrollArea className="max-h-[28rem]">
          <div className="space-y-4 px-4 py-4">
            <section className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Current Status</span>
                {me?.group ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm normal-case tracking-normal">
                    Group #{me.group.id}
                  </span>
                ) : null}
              </div>
              {me?.group ? (
                <div className="rounded-md border border-gray-200 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Members
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 shadow-sm">
                      {me.group.member_count} members
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {me.group.members.map((member) => (
                      <span
                        key={member.user.id}
                        className="rounded-full bg-SokratesOrange px-3 py-1 text-xs font-semibold text-white shadow-[0px_3px_0px_0px_var(--color-SokratesOrangeShadow)]"
                      >
                        {shortName(member.user)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 bg-slate-50/70 px-3 py-4 text-sm text-slate-500">
                  You are not in a group yet.
                </div>
              )}
            </section>

            {me?.received_invites?.length ? (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pending Invites
                </div>
                <div className="space-y-2">
                  {me.received_invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-md border border-amber-200 bg-amber-50 p-3"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {displayName(invite.sender)} invited you
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-SokratesOrange px-3 text-xs font-semibold text-white shadow-[0px_3px_0px_0px_var(--color-SokratesOrangeShadow)] transition hover:bg-SokratesOrangeShadow/90"
                          onClick={() => handleInviteAction('accept', invite.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 shadow-[0px_3px_0px_0px_#D1D5DB] transition hover:border-gray-400 hover:bg-gray-50"
                          onClick={() => handleInviteAction('decline', invite.id)}
                        >
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invite Students
                </div>
                <span className="text-xs text-slate-400">
                  {selectedRecipientIds.length} selected
                </span>
              </div>
              <div className="space-y-2">
                {inviteableStudents.length ? (
                  inviteableStudents.map((student) => {
                    const selected = selectedRecipientIds.includes(student.user.id)
                    return (
                      <button
                        key={student.user.id}
                        type="button"
                        onClick={() => toggleRecipient(student.user.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-left text-sm shadow-sm transition-all',
                          selected
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-gray-200 bg-white hover:border-gray-300',
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="truncate font-medium text-gray-900">
                            {displayName(student.user)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">
                            Free
                          </span>
                          {student.room_ids.length ? (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-900">
                              Room {student.room_ids.join(', ')}
                            </span>
                          ) : null}
                        </div>
                        {selected ? <Check className="h-4 w-4 text-[#FF6934]" /> : null}
                      </button>
                    )
                  })
                ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    No students are currently available for new invites.
                  </div>
                )}
              </div>
              <Button
                type="button"
                className="w-full rounded-md"
                disabled={selectedRecipientIds.length === 0 || isSubmitting}
                onClick={submitInvites}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Send Invites'}
              </Button>
            </section>

            {me?.sent_invites?.length ? (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sent Invites
                </div>
                <div className="flex flex-wrap gap-2">
                  {me.sent_invites.map((invite) => (
                    <Badge
                      key={invite.id}
                      variant="outline"
                      className="rounded-full border-slate-300 bg-slate-50 px-3 py-1 text-xs"
                    >
                      {displayName(invite.recipient)}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {me?.group ? (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleLeave}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave Group
              </Button>
            ) : null}
          </div>
        </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
