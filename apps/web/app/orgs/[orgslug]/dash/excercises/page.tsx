import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import CoursesHome from './client'
import { nextAuthOptions } from 'app/auth/options'
import { getServerSession } from 'next-auth'
import { getOrgCourses } from '@services/courses/courses'
import ExercisesHome from './client'
import { getAPIUrl } from '@services/config/config'
import useSWR from 'swr'
import { swrFetcher } from '@services/utils/ts/requests'

type MetadataProps = {
  params: { orgslug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}


async function CoursesPage(params: any) {
  const orgslug = params.params.orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const session = await getServerSession(nextAuthOptions)
  return <ExercisesHome org_id={org.id} orgslug={orgslug}/>
}

export default CoursesPage
