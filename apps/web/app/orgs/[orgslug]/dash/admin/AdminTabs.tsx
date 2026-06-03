"use client"

import React from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, swrFetcher } from '@services/utils/ts/requests'

type DebugItem = {
  label: string
  value: string
}

type AdminTabsProps = {
  debugItems: DebugItem[]
}

type NotificationLevel = 'info' | 'success' | 'warning' | 'error'
type FeatureAudienceRole = 'student' | 'tutor' | 'maintainer' | 'admin'
type FeatureAudience = {
  type: 'all' | 'roles'
  roles: FeatureAudienceRole[]
}
type FeatureFlag = {
  key: string
  label: string
  description: string
  category: string
  enabled: boolean
  audience: FeatureAudience
  default_enabled: boolean
  default_audience: FeatureAudience
  updated_at?: string | null
}

const notificationLevels: NotificationLevel[] = [
  'info',
  'success',
  'warning',
  'error',
]

const featureRoleOptions: Array<{ value: FeatureAudienceRole; label: string }> = [
  { value: 'student', label: 'Students' },
  { value: 'tutor', label: 'Tutors' },
  { value: 'maintainer', label: 'Maintainers' },
  { value: 'admin', label: 'Admins' },
]

function defaultRoleAudience(flag: FeatureFlag): FeatureAudience {
  if (flag.audience.type === 'roles' && flag.audience.roles.length > 0) {
    return flag.audience
  }
  if (flag.default_audience.type === 'roles' && flag.default_audience.roles.length > 0) {
    return flag.default_audience
  }
  return { type: 'roles', roles: ['student'] }
}

function FeaturesTab() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const accessToken = session?.tokens?.access_token
  const [savingKey, setSavingKey] = React.useState<string | null>(null)
  const featuresUrl = accessToken ? `${getAPIUrl()}features/admin` : null
  const {
    data: flags,
    error,
    isLoading,
    mutate,
  } = useSWR<FeatureFlag[]>(
    featuresUrl,
    (url: string) => swrFetcher(url, accessToken),
  )

  const updateFeature = async (flag: FeatureFlag, update: { enabled: boolean; audience: FeatureAudience }) => {
    if (!accessToken) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in as an admin to update feature flags.',
        variant: 'destructive',
      })
      return
    }

    setSavingKey(flag.key)
    try {
      const response = await fetch(
        `${getAPIUrl()}features/admin/${flag.key}`,
        RequestBodyWithAuthHeader('PUT', update, null, accessToken),
      )

      if (!response.ok) {
        const text = await response.text()
        toast({
          title: 'Feature update failed',
          description: text || 'Unable to update feature flag.',
          variant: 'destructive',
        })
        return
      }

      await mutate()
      toast({
        title: 'Feature updated',
        description: `${flag.label} rollout settings were saved.`,
      })
    } catch {
      toast({
        title: 'Feature update failed',
        description: 'Network error while updating feature flag.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(null)
    }
  }

  const setAudienceType = (flag: FeatureFlag, audienceType: FeatureAudience['type']) => {
    const nextAudience =
      audienceType === 'all'
        ? { type: 'all' as const, roles: [] }
        : defaultRoleAudience(flag)
    updateFeature(flag, { enabled: flag.enabled, audience: nextAudience })
  }

  const toggleRole = (flag: FeatureFlag, role: FeatureAudienceRole) => {
    const currentRoles = flag.audience.type === 'roles'
      ? flag.audience.roles
      : defaultRoleAudience(flag).roles
    const roles = currentRoles.includes(role)
      ? currentRoles.filter((currentRole) => currentRole !== role)
      : [...currentRoles, role]

    if (roles.length === 0) {
      toast({
        title: 'Choose at least one role',
        description: 'Role-based rollout needs one or more selected roles.',
        variant: 'destructive',
      })
      return
    }

    updateFeature(flag, {
      enabled: flag.enabled,
      audience: { type: 'roles', roles },
    })
  }

  if (isLoading) {
    return (
      <div className="bg-white nice-shadow rounded-xl p-6 text-sm text-gray-500">
        Loading feature flags...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white nice-shadow rounded-xl p-6 text-sm text-red-600">
        Unable to load feature flags.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(flags ?? []).map((flag) => {
        const isSaving = savingKey === flag.key
        const roleAudience = defaultRoleAudience(flag)

        return (
          <div key={flag.key} className="bg-white nice-shadow rounded-xl p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {flag.category}
                </div>
                <h3 className="mt-1 text-lg font-bold text-gray-900">{flag.label}</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {flag.description}
                </p>
                <div className="mt-2 font-mono text-xs text-gray-400">
                  {flag.key}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                  checked={flag.enabled}
                  disabled={isSaving}
                  onCheckedChange={(checked) => {
                    updateFeature(flag, {
                      enabled: checked,
                      audience: flag.audience,
                    })
                  }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold text-gray-700">Rollout audience</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setAudienceType(flag, 'all')}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    flag.audience.type === 'all'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All roles
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setAudienceType(flag, 'roles')}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    flag.audience.type === 'roles'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Selected roles
                </button>
              </div>

              {flag.audience.type === 'roles' ? (
                <div className="flex flex-wrap gap-2">
                  {featureRoleOptions.map((role) => {
                    const selected = roleAudience.roles.includes(role.value)
                    return (
                      <button
                        type="button"
                        key={role.value}
                        disabled={isSaving}
                        onClick={() => toggleRole(flag, role.value)}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          selected
                            ? 'border-[#E25A26] bg-[#E25A26] text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {role.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NotificationsTab() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [title, setTitle] = React.useState('')
  const [topic, setTopic] = React.useState('broadcast')
  const [body, setBody] = React.useState('')
  const [level, setLevel] = React.useState('info' as NotificationLevel)
  const [data, setData] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Title and message are required.',
        variant: 'destructive',
      })
      return
    }

    const accessToken = session?.tokens?.access_token
    if (!accessToken) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in as an admin to broadcast.',
        variant: 'destructive',
      })
      return
    }

    let parsedData: Record<string, unknown> | undefined
    if (data.trim().length > 0) {
      try {
        parsedData = JSON.parse(data)
      } catch {
        toast({
          title: 'Invalid JSON',
          description: 'Additional data must be valid JSON.',
          variant: 'destructive',
        })
        return
      }
    }

    const payload = {
      topic: topic.trim() || 'broadcast',
      title: title.trim(),
      body: body.trim(),
      level,
      data: parsedData,
    }

    setIsSending(true)
    try {
      const response = await fetch(
        `${getAPIUrl()}notifications/broadcast`,
        RequestBodyWithAuthHeader('POST', payload, null, accessToken)
      )

      if (!response.ok) {
        const text = await response.text()
        toast({
          title: 'Broadcast failed',
          description: text || 'Unable to send notification.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Notification sent',
        description: 'Broadcast delivered to connected users.',
      })
      setTitle('')
      setTopic('broadcast')
      setBody('')
      setData('')
      setLevel('info')
    } catch {
      toast({
        title: 'Broadcast failed',
        description: 'Network error while sending notification.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-white nice-shadow rounded-xl p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-gray-500">
          Sends a notification to all connected users subscribed to the topic.
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-700" htmlFor="notif-title">
            Title
          </label>
          <input
            id="notif-title"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-700" htmlFor="notif-body">
            Message
          </label>
          <textarea
            id="notif-body"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-700" htmlFor="notif-topic">
            Topic
          </label>
          <input
            id="notif-topic"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="broadcast"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-700" htmlFor="notif-level">
            Level
          </label>
          <select
            id="notif-level"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            value={level}
            onChange={(event) => setLevel(event.target.value as NotificationLevel)}
          >
            {notificationLevels.map((levelOption) => (
              <option key={levelOption} value={levelOption}>
                {levelOption}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-700" htmlFor="notif-data">
            Extra data (JSON, optional)
          </label>
          <textarea
            id="notif-data"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm font-mono"
            rows={3}
            value={data}
            onChange={(event) => setData(event.target.value)}
            placeholder={'{"key":"value"}'}
          />
        </div>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Broadcast notification'}
        </button>
      </form>
    </div>
  )
}

function AdminTabs({ debugItems }: AdminTabsProps) {
  return (
    <Tabs defaultValue="hosting" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="hosting">Hosting</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
      </TabsList>
      <TabsContent value="hosting">
        <div className="bg-white nice-shadow rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Key</th>
                <th className="px-4 py-3 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {debugItems.map((item) => (
                <tr key={item.label} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                    {item.label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 break-all">
                    {item.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="users">
        <OrgUsers />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>
      <TabsContent value="features">
        <FeaturesTab />
      </TabsContent>
    </Tabs>
  )
}

export default AdminTabs
