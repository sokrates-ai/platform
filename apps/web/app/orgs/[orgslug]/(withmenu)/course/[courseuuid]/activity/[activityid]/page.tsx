import { getActivityWithAuthHeader } from '@services/courses/activities'
import { getCourseMetadata } from '@services/courses/courses'
import ActivityClient from './activity'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { nextAuthOptions } from 'app/auth/options'
import { LEARNHOUSE_BASE_URL } from '@services/config/config'
import ActivityPageLayout from './ActivityPageLayout'

type MetadataProps = {
  params: { orgslug: string; courseuuid: string; activityid: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token

  // Get Org context information
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const course_meta = await getCourseMetadata(
    params.courseuuid,
    { revalidate: 0, tags: ['courses'] },
    access_token ? access_token : null,
    // Server component: the activity view renders one tab, and the fetch can
    // stay on the container network.
    { includeTabStore: false, serverSide: true }
  )
  const activity = await getActivityWithAuthHeader(
    params.activityid,
    { revalidate: 0, tags: ['activities'] },
    access_token ? access_token : null
  )

  // SEO
  return {
    title: activity.name + ` — ${course_meta.name} Course`,
    description: course_meta.description,
    keywords: course_meta.learnings,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: activity.name + ` — ${course_meta.name} Course`,
      description: course_meta.description,
      publishedTime: course_meta.creation_date,
      tags: course_meta.learnings,
    },
  }
}

const ActivityPage = async (params: any) => {
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const activityid = params.params.activityid
  const courseuuid = params.params.courseuuid
  const orgslug = params.params.orgslug

  const course_meta = await getCourseMetadata(
    courseuuid,
    { revalidate: 0, tags: ['courses'] },
    access_token ? access_token : null,
    // Server component: the activity view renders one tab, and the fetch can
    // stay on the container network.
    { includeTabStore: false, serverSide: true }
  )
  const activity = await getActivityWithAuthHeader(
    activityid,
    { revalidate: 0, tags: ['activities'] },
    access_token ? access_token : null
  )

  const chapterID = activity.course_id

  let backlink = "/"
  if (typeof window === 'undefined') {
      backlink = `${LEARNHOUSE_BASE_URL()}/course/${courseuuid}?chapter=${chapterID}`
  } else {
    const searchParams = new URLSearchParams(window.location.search)
    let backlinkT = searchParams.get('backlink')
    if (!backlinkT) {
      backlinkT = window.location.origin
    }

    backlink = backlinkT
 }

  return (
    <ActivityPageLayout>
      <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8">
        <ActivityClient
          activityid={activityid}
          courseuuid={courseuuid}
          orgslug={orgslug}
          activity={activity}
          course={course_meta}
          backlink={backlink}
        />
      </div>
    </ActivityPageLayout>
  )
}

export default ActivityPage
