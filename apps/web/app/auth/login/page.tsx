import { getOrganizationContextInfo } from '@services/organizations/orgs'
import LoginClient from './login'
import { Metadata } from 'next'

type MetadataProps = {
  params: { orgslug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(params: MetadataProps): Promise<Metadata> {
  const orgslug = params.searchParams.orgslug

  //const orgslug = params.orgslug
  // Get Org context information
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return {
    title: 'Login' + ` — Sokrates`,
    description: 'Sign in to continue learning with Sokrates.',
  }
}

const Login = async (params: MetadataProps) => {
  const orgslug = params.searchParams.orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return (
    <LoginClient org={org}></LoginClient>
  )
}

export default Login
