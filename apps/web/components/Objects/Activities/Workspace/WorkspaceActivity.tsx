import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
import { getActivityMediaDirectory } from '@services/media/media'
import { RequestBodyWithAuthHeader, swrFetcher } from '@services/utils/ts/requests'
import React, { useEffect } from 'react'
import { BarLoader, MoonLoader } from 'react-spinners'
import useSWR from 'swr'

async function createSession(activity_uuid: string, access_token: string): Promise<{ token: string, workspace_url: string}> {
  const ACTIVATE_SESSION_URL = `${getAPIUrl()}ex/session`;
  const result = await fetch(
    `${getAPIUrl()}ex/session`,
    RequestBodyWithAuthHeader('POST', {
      activity_uuid 
    }, null, access_token)
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
  access_token: string,
  backlink: string,
}) {
  const org = useOrg() as any

  React.useEffect(() => {
  }, [activity, org])

  const [url, setURL] = React.useState<string | null>(null)

  console.dir(activity)

  useEffect(() => {
    // Fetch redirect URL here.
    createSession(activity.activity_uuid, access_token).then(res => {
      const url = `${res.workspace_url}?token=${encodeURIComponent(res.token)}&backlink=${encodeURIComponent(backlink)}`
      setURL(url)
      window.location.href = url
    })
  }, [])

      return (<div className="m-8 rounded-md mt-14 flex flex-col justify-center items-center gap-5">
        <h1 className='text-white'>
          {url ? "Redirecting..." : "Creating Workspace..."}
        </h1>

        <h5>
          {url ? (<a className='text-teal-600 underline decoration-solid' href={url}>{url}</a>) : 'please wait'}
        </h5>

        {/* <MoonLoader
          size={60}
          color="#ffffff"
        /> */}

        <BarLoader
          width={600}
          height={10}
          color="#ffffff"
          cssOverride={{'borderRadius': '3rem'}}
        >
        </BarLoader>
      </div>
        )
  }

export default WorkspaceActivity
