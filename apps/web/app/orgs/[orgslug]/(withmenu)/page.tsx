export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { getOrgCourses } from '@services/courses/courses'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getServerSession } from 'next-auth'
import { nextAuthOptions } from 'app/auth/options'
import { getOrgThumbnailMediaDirectory } from '@services/media/media'
import { slides } from './slides'
import CoursesClient from './coursesclient'
type MetadataProps = {
	params: { orgslug: string }
	searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({
	params,
}: MetadataProps): Promise<Metadata> {
	// Get Org context information
	const org = await getOrganizationContextInfo(params.orgslug, {
		revalidate: 0,
		tags: ['organizations'],
	})

	// SEO
	return {
		title: `Home — ${org.name}`,
		description: org.description,
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
			title: `Home — ${org.name}`,
			description: org.description,
			type: 'website',
			images: [
				{
					url: getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image),
					width: 800,
					height: 600,
					alt: org.name,
				},
			],
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
		<div className="w-full">
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
