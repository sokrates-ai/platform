import { getOrganizationContextInfo } from '@services/organizations/orgs'
import React from 'react'
import { nextAuthOptions } from 'app/auth/options'
import { getServerSession } from 'next-auth'
import ExercisesHome from './client'

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
