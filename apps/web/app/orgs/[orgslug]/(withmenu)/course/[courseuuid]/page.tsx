import React from 'react'
import CourseClient from './course'
import {
  getCourse,
  getCourseCanvasInteractionState,
  getCourseMetadata,
} from '@services/courses/courses'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { nextAuthOptions } from 'app/auth/options'
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'

const isLikelyAssetRequest = (value: string) => value.includes('.')

type MetadataProps = {
  params: { orgslug: string; courseuuid: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  if (isLikelyAssetRequest(params.courseuuid)) {
    return {
      title: 'Not Found',
      robots: {
        index: false,
        follow: false,
      },
    }
  }
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token

  // Get Org context information
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const course_meta = await getCourse(
    `course_${params.courseuuid}`,
    { revalidate: 0, tags: ['courses'] },
    access_token ? access_token : null,
    { includeTabStore: false, serverSide: true }
  )

  // SEO
  return {
    title: course_meta.name + ` — Sokrates`,
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
      title: course_meta.name + ` — Sokrates`,
      description: course_meta.description ? course_meta.description : '',
      images: [
        {
          url: getCourseThumbnailMediaDirectory(
            org?.org_uuid,
            course_meta?.course_uuid,
            course_meta?.thumbnail_image
          ),
          width: 800,
          height: 600,
          alt: course_meta.name,
        },
      ],
      type: 'article',
      publishedTime: course_meta.creation_date ? course_meta.creation_date : '',
      tags: course_meta.learnings ? course_meta.learnings : [],
    },
  }
}

const CoursePage = async (params: any) => {
  const courseuuid = params.params.courseuuid
  const orgslug = params.params.orgslug
  if (isLikelyAssetRequest(courseuuid)) {
    notFound()
  }
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const course_meta = access_token
    ? await getCourseMetadata(
        courseuuid,
        { revalidate: 0, tags: ['courses'] },
        access_token,
        { includeTabStore: false, serverSide: true }
      )
    : await getCourse(
        `course_${courseuuid}`,
        { revalidate: 0, tags: ['courses'] },
        null,
        { includeTabStore: false, serverSide: true }
      )
  const courseCanvas = access_token
    ? await getCourseCanvasInteractionState({
        // TODO: Find out why we normally remove "course" from the course uuid.
        courseUuid: `course_${courseuuid}`,
        access_token,
      })
    : { selected_chapter_id: null, selected_tab_id: null }
  
  return (
    <div>
      <CourseClient
        courseuuid={courseuuid}
        orgslug={orgslug}
        course={course_meta}
        selectedChapterId={courseCanvas.selected_chapter_id}
        selectedTabId={courseCanvas.selected_tab_id}
      />
    </div>
  )
}

export default CoursePage
