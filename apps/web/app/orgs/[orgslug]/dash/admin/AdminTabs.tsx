"use client"

import React from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import OrgUsers from '@components/Dashboard/Pages/Users/OrgUsers/OrgUsers'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

type DebugItem = {
  label: string
  value: string
}

type AdminTabsProps = {
  debugItems: DebugItem[]
}

type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

const notificationLevels: NotificationLevel[] = [
  'info',
  'success',
  'warning',
  'error',
]

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
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="hosting">Hosting</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
    </Tabs>
  )
}

export default AdminTabs
