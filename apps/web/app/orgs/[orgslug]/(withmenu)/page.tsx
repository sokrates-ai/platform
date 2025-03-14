export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { getUriWithOrg } from '@services/config/config'
import { getOrgCourses } from '@services/courses/courses'
import Link from 'next/link'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { Button } from '@components/ui/button'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getServerSession } from 'next-auth'
import { nextAuthOptions } from 'app/auth/options'
import { getOrgThumbnailMediaDirectory } from '@services/media/media'
import CourseCard from '@components/Objects/StyledElements/Cards/CourseCard'
import NoCoursesAlert from '@components/Objects/StyledElements/Alerts/NoCourseAlert'




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
	const org_id = org.id

	return (
		<div className="w-full">
			<GeneralWrapperStyled>
				{/* Courses */}
				<div className="flex flex-col space-y-4">
					<div className="flex items-center justify-between">
						<TypeOfContentTitle title="Courses" type="cou" />
						<AuthenticatedClientElement
							ressourceType="courses"
							action="create"
							checkMethod="roles"
							orgId={org_id}
						>
							<Link href={getUriWithOrg(orgslug, '/courses?new=true')}>
								<Button variant="default">New Course</Button>
							</Link>
						</AuthenticatedClientElement>
					</div>


					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{courses.map((course: any) => (
						
						<CourseCard key={course.course_uuid} course={course} orgslug={orgslug} />
						))}


						{courses.length === 0 && courses.length === 0 && <NoCoursesAlert text="Create courses to add content" />}
					</div>
				</div>
			</GeneralWrapperStyled>
		</div>
	)
}

export default OrgHomePage
