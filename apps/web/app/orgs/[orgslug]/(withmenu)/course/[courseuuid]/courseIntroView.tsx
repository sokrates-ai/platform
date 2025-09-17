'use client'

import React, { useMemo } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Check } from 'lucide-react'
import {
  getCourseThumbnailMediaDirectory,
} from '@services/media/media'
import CourseUpdates from '@components/Objects/Courses/CourseUpdates/CourseUpdates'
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions'
import { CourseProvider } from '@components/Contexts/CourseContext'
import { useOrg } from '@components/Contexts/OrgContext'

type Props = {
  courseuuid: string
  orgslug: string
  course: any
}

const CourseIntroView = ({ courseuuid, orgslug, course }: Props) => {
  const org = useOrg() as any

  const learnings = useMemo(() => {
    if (!course?.learnings) return []
    return course.learnings.split(',').filter((l: string) => l && l !== 'null')
  }, [course?.learnings])

  const thumbnailUrl = course?.thumbnail_image && org
    ? getCourseThumbnailMediaDirectory(
        org.org_uuid,
        course.course_uuid,
        course.thumbnail_image,
      )
    : '../empty_thumbnail.webp'

  if (!org || !course) return null

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-col items-start justify-between pb-3 md:flex-row md:items-center">
        <div>
          <Badge variant="secondary" className="mb-2">
            Course
          </Badge>
          <h1 className="text-2xl font-bold md:text-3xl">{course.name}</h1>
        </div>

        <div className="mt-4 w-full md:mt-0 md:w-auto">
          <CourseProvider courseuuid={course.course_uuid}>
            <CourseUpdates />
          </CourseProvider>
        </div>
      </div>

      <Card className="mb-6 overflow-hidden border-none">
        <div
          className="h-52 w-full rounded-lg bg-cover bg-center shadow-md md:h-96 lg:h-[500px]"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 text-xl font-bold">About</h2>
              <p className="whitespace-pre-wrap text-gray-700">
                {course.about}
              </p>
            </CardContent>
          </Card>

          {learnings.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-xl font-bold">What you will learn</h2>
                <div className="space-y-2">
                  {learnings.map((learning: string, i: number) => (
                    <div key={i} className="flex items-start space-x-3">
                      <span className="rounded-full bg-primary/10 p-1.5">
                        <Check className="text-primary" size={14} />
                      </span>
                      <p className="text-gray-700">{learning}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <CoursesActions
            courseuuid={courseuuid}
            orgslug={orgslug}
            course={course}
          />
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

export default CourseIntroView
