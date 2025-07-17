'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import CourseCard from '@components/Objects/StyledElements/Cards/CourseCard'
import NoCoursesAlert from '@components/Objects/StyledElements/Alerts/NoCourseAlert'

import AnnouncementCarousel from '@components/Objects/AnnouncementCarousel'
import { LayoutGrid } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CoursesClientProps {
  orgslug: string
  courses: any[]
  org_id: string
  slides: Array<{ color: string; text: string }>
}

const CoursesClient: React.FC<CoursesClientProps> = ({
  orgslug,
  courses,
  org_id,
  slides,
}) => {
  const searchParams = useSearchParams()
  const isCreatingCourse = !!searchParams.get('new')
  const [newCourseModal, setNewCourseModal] = React.useState(isCreatingCourse)
  const isUserAdmin = useAdminStatus() as any

  const closeNewCourseModal = () => setNewCourseModal(false)

  return (
    <div className="relative flex flex-col min-h-screen md:overscroll-y-none">
      {/* pull-out announcement reel */}
      <AnnouncementCarousel slides={slides} />

      {/* Courses Section */}
      <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="flex flex-row items-center justify-between mb-8 sm:mb-10">
            <h1 className="flex items-center text-xl sm:text-2xl md:text-3xl font-bold text-[#3C3C3C]">
              <LayoutGrid className="mr-2" size={32} />
              Courses
            </h1>

            <AuthenticatedClientElement
              checkMethod="roles"
              action="create"
              ressourceType="courses"
              orgId={org_id}
            >
              <Dialog open={newCourseModal} onOpenChange={setNewCourseModal}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="relative z-50">
                    New Course
                  </Button>
                </DialogTrigger>
                <DialogContent className="relative z-50">
                  <DialogHeader>
                    <DialogTitle>New Course</DialogTitle>
                    <DialogDescription>
                      Create a new course
                    </DialogDescription>
                  </DialogHeader>
                  <CreateCourseModal
                    closeModal={closeNewCourseModal}
                    orgslug={orgslug}
                  />
                </DialogContent>
              </Dialog>
            </AuthenticatedClientElement>
          </div>

          {courses.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {courses.map((course) => (
                <CourseCard
                  key={course.course_uuid}
                  course={course}
                  orgslug={orgslug}
                />
              ))}
            </div>
          ) : (
            <NoCoursesAlert isUserAdmin={isUserAdmin} />
          )}
        </div>
      </div>

      {/* Bottom Fade */}
      <div
        className="fixed bottom-0 left-0 right-0 h-12 pointer-events-none z-40 opacity-25"
        style={{
          background:
            'linear-gradient(0deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  )
}

export default CoursesClient
