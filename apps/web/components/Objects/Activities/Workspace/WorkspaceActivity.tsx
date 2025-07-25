import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
// import { getActivityMediaDirectory } from '@services/media/media'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import React, { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useSearchParams } from 'next/navigation'

async function createSession(
  activity_uuid: string,
  task_id: number | null,
  access_token: string
): Promise<{ token: string; workspace_url: string }> {
  // const ACTIVATE_SESSION_URL = `${getAPIUrl()}ex/session`;
  const result = await fetch(
    `${getAPIUrl()}tasks/session`,
    RequestBodyWithAuthHeader(
      'POST',
      {
        activity_uuid,
        task_id,
      },
      null,
      access_token
    )
  )
  const res = await result.json()
  return res
}

function WorkspaceActivity({
  activity,
  course,
  access_token,
  backlink,
}: {
  activity: any
  course: any
  access_token: string
  backlink: string
}) {
  const org = useOrg() as any
  const [url, setURL] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {}, [activity, org])

  const searchParams = useSearchParams()
  const taskIDParam = searchParams.get('task_id')

  console.log('taskIDParam', taskIDParam)

  useEffect(() => {
    // Simulate progress during loading
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 90) {
          clearInterval(interval)
          return prevProgress
        }
        return prevProgress + 10
      })
    }, 500)

    // get task id from params.
    let task_id = null
    if (taskIDParam) {
      task_id = parseInt(taskIDParam)
    }

    console.log('task_id', task_id)

    // Fetch redirect URL here
    createSession(activity.activity_uuid, task_id, access_token).then((res) => {
      const url = `${res.workspace_url}?token=${encodeURIComponent(
        res.token
      )}&backlink=${encodeURIComponent(backlink)}`
      setURL(url)
      setProgress(100)
      clearInterval(interval)

      // Short delay before redirect to show 100% progress
      setTimeout(() => {
        window.location.href = url
      }, 50)
    })

    return () => clearInterval(interval)
  }, [access_token, activity.activity_uuid, backlink, taskIDParam])

  return (
    <div className="py-16 bg-gray-50 flex items-center justify-center p-4 rounded-md">
      <Card className="w-full max-w-md bg-white shadow-sm">
        <CardContent className="pt-4 pb-4 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-medium text-gray-800">
              {url ? 'Redirecting to Workspace...' : 'Creating Your Workspace'}
            </h2>
          </div>

          <Progress value={progress} className="w-full h-1 bg-gray-100 mb-4" />

          <p className="text-gray-500 text-sm mb-2 text-center">
            {url
              ? "You'll be redirected automatically in a moment"
              : 'Please wait while we set up your environment'}
          </p>

          {url && (
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500 text-blue-500 hover:bg-blue-50"
              onClick={() => (window.location.href = url)}
            >
              Open Workspace Now
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default WorkspaceActivity
