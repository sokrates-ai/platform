// app/[orgslug]/signup/page.tsx  (or pages/signup.tsx)
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import SignUpClient from './signup'

type Props = {
  searchParams: { orgslug: string; inviteCode?: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Sokrates Sign Up' }
}

export default async function SignUpPage({ searchParams }: Props) {
  const orgslug = searchParams.orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return (
    <SignUpClient org={org} inviteCode={searchParams.inviteCode} />
  )
}
