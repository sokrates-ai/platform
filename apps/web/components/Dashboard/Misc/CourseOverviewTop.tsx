'use client'

import { useCourse } from '@components/Contexts/CourseContext'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import SaveState from './SaveState'
import { CourseOverviewParams } from 'app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import Image from 'next/image'
import EmptyThumbnailImage from '../../../public/empty_thumbnail.webp'

export function CourseOverviewTop({
  params,
}: {
  params: CourseOverviewParams
}) {
  const course = useCourse() as any
  const org = useOrg() as any
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const target = document.getElementById('dash-topbar-slot')
    setPortalTarget(target)
  }, [])

  const headerContent = useMemo(
    () => (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={getUriWithOrg(org?.slug, '') + `/course/${params.courseuuid}`}
            className="shrink-0"
          >
            {course?.courseStructure?.thumbnail_image ? (
              <img
                className="h-[34px] w-[60px] rounded-md object-cover shadow-sm"
                src={`${getCourseThumbnailMediaDirectory(
                  org?.org_uuid,
                  'course_' + params.courseuuid,
                  course.courseStructure.thumbnail_image
                )}`}
                alt=""
              />
            ) : (
              <Image
                width={60}
                height={34}
                className="h-[34px] w-[60px] rounded-md object-cover shadow-sm"
                src={EmptyThumbnailImage}
                alt=""
              />
            )}
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Course
            </div>
            <div className="truncate text-sm font-semibold text-gray-900">
              {course?.courseStructure?.name ?? 'Course'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <SaveState orgslug={params.orgslug} />
        </div>
      </div>
    ),
    [
      course?.courseStructure?.name,
      course?.courseStructure?.thumbnail_image,
      org?.org_uuid,
      org?.slug,
      params.courseuuid,
      params.orgslug,
    ],
  )

  if (portalTarget) {
    return createPortal(headerContent, portalTarget)
  }

  return <div className="flex w-full items-center">{headerContent}</div>
}
