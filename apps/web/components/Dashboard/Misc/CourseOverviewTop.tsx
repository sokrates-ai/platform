import { useCourse } from '@components/Contexts/CourseContext'
import { useEffect } from 'react'
import BreadCrumbs from './BreadCrumbs'
import SaveState from './SaveState'
import { CourseOverviewParams } from 'app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import Image from 'next/image'
import EmptyThumbnailImage from '../../../public/empty_thumbnail.png'
import { useTranslations } from 'next-intl'

export function CourseOverviewTop({
  params,
}: {
  params: CourseOverviewParams
}) {
  const course = useCourse() as any
  const org = useOrg() as any
  const t = useTranslations('CourseOverviewTop')

  useEffect(() => {}, [course, org])

  return (
    <>
      <BreadCrumbs
        type="courses"
        last_breadcrumb={course.courseStructure.name}
      ></BreadCrumbs>
      <div className="flex">
        <div className="flex py-3 grow items-center">
          <Link
            href={getUriWithOrg(org?.slug, '') + `/course/${params.courseuuid}`}
          >
            {course?.courseStructure?.thumbnail_image ? (
              <img
                className="w-[100px] h-[57px] rounded-md drop-shadow-md"
                src={`${getCourseThumbnailMediaDirectory(
                  org?.org_uuid,
                  'course_' + params.courseuuid,
                  course.courseStructure.thumbnail_image
                )}`}
                alt={t('alt.courseThumbnail')}
              />
            ) : (
              <Image
                width={100}
                className="h-[57px] rounded-md drop-shadow-md"
                src={EmptyThumbnailImage}
                alt={t('alt.courseThumbnail')}
              />
            )}
          </Link>
          <div className="flex flex-col course_metadata justify-center pl-5">
            <div className="text-gray-400 font-semibold text-sm">{t('labels.course')}</div>
            <div className="text-black font-bold text-xl -mt-1 first-letter:uppercase">
              {course.courseStructure.name}
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <SaveState orgslug={params.orgslug} />
        </div>
      </div>
    </>
  )
}
