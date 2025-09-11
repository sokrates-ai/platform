export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { getOrgCourses } from '@services/courses/courses'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getServerSession } from 'next-auth'
import { nextAuthOptions } from 'app/auth/options'
import { getOrgThumbnailMediaDirectory } from '@services/media/media'
import { slides } from './slides'
import CoursesClient from './courses'
type MetadataProps = {
	params: { orgslug: string }
	searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({
	params,
	searchParams,
}: MetadataProps): Promise<Metadata> {
	const org = await getOrganizationContextInfo(params.orgslug, {
		revalidate: 86400,
		tags: ['organizations'],
	})

	let title = "Home - Sokrates"
	let description = org.description
	let imageUrl = null

	if (org.logo_image) {
		imageUrl = getOrgThumbnailMediaDirectory(org.org_uuid, org.logo_image)
	}

	return {
		title: title,
		description: description,
		openGraph: {
			title: title,
			description: description,
			images: imageUrl
				? [
						{
							url: imageUrl,
							width: 1200,
							height: 630,
							alt: title,
						},
				  ]
				: [],
		},
		twitter: {
			card: 'summary_large_image',
			title: title,
			description: description,
			images: imageUrl ? [imageUrl] : [],
		},
	}
}

const OrgHomePage = async (params: any) => {
	const orgslug = params.params.orgslug
	const session = await getServerSession(nextAuthOptions)
	const access_token = session?.tokens?.access_token
	const courses = await getOrgCourses(
		orgslug,
		{ revalidate: 0, tags: ['courses'] },
		access_token ? access_token : null
	)
	const org = await getOrganizationContextInfo(orgslug, {
		revalidate: 1800,
		tags: ['organizations'],
	})

	return (
		<div className="relative z-10 w-full">
			<CoursesClient 
				org_id={org.org_id} 
				orgslug={orgslug} 
				courses={courses} 
				slides={slides}
			/>
		</div>
	)
}

export default OrgHomePage
