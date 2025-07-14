'use client'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import React from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import CourseCard from '@components/Objects/StyledElements/Cards/CourseCard'
import NoCoursesAlert from '@components/Objects/StyledElements/Alerts/NoCourseAlert'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { slides } from '../slides'


interface CourseProps {
  orgslug: string
  courses: any
  org_id: string
}

function Courses(props: CourseProps) {
  const orgslug = props.orgslug
  const courses = props.courses
  const searchParams = useSearchParams()
  const isCreatingCourse = searchParams.get('new') ? true : false
  const [newCourseModal, setNewCourseModal] = React.useState(isCreatingCourse)
  const isUserAdmin = useAdminStatus() as any



  const [currentSlide, setCurrentSlide] = React.useState(0)

  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }
  

  return (

<div>
  <div 
   className={`w-full relative z-10 flex-1 mx-auto flex items-center justify-center text-2xl font-bold text-white transition-all duration-300 ${slides[currentSlide].color} -mt-16`}
    style={{
      minHeight: "180px",
      height: "600px",
    }}
  >
      {slides[currentSlide].text}
      {/* Spheres for manual selection, absolutely positioned at the bottom */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex justify-center gap-3">
        {slides.map((_, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`transition-all duration-200 cursor-pointer bg-white shadow
              ${currentSlide === idx
                ? "w-8 h-4 rounded-xl scale-110"
                : "w-4 h-4 rounded-full opacity-60"}
            `}
            style={{
              border: "1.5px solid #e0e0e0",
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>

  <div className="w-full">
    <GeneralWrapperStyled>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <TypeOfContentTitle title="Courses" type="cou" />
          <AuthenticatedClientElement
            checkMethod="roles"
            action="create"
            ressourceType="courses"
            orgId={props.org_id}
          >
            <Dialog open={newCourseModal} onOpenChange={setNewCourseModal}>
              <DialogTrigger asChild>
                <Button variant="default">New Course</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Course</DialogTitle>
                  <DialogDescription>Create a new course</DialogDescription>
                </DialogHeader>
                <CreateCourseModal closeModal={closeNewCourseModal} orgslug={orgslug} />
              </DialogContent>
            </Dialog>
          </AuthenticatedClientElement>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {courses.map((course: any) => (
            <CourseCard key={course.course_uuid} course={course} orgslug={orgslug} />
          ))}

          {courses.length === 0 && <NoCoursesAlert isUserAdmin={isUserAdmin} />}
        </div>
      </div>
    </GeneralWrapperStyled>
  </div>
</div>
  )
}

export default Courses
