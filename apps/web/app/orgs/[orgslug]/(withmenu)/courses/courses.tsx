'use client'
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse'
import React from 'react'
import { useSearchParams } from 'next/navigation'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"

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

  async function closeNewCourseModal() {
    setNewCourseModal(false)
  }

  return (
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
							<Card key={course.course_uuid}>
                <CardHeader>
                  <CardTitle>{course.name}</CardTitle>
                </CardHeader>
                  <CardContent>
                    <CourseThumbnail course={course} orgslug={orgslug} />
                  </CardContent>
							</Card>
						))}

                  {courses.length === 0 && (
                    <div className="col-span-full flex justify-center">
                      <Alert variant="default" className="max-w-md">
                        <AlertTitle>No courses yet</AlertTitle>
                        <AlertDescription>
                          {isUserAdmin ? "Create a course to add content." : "No courses available yet."}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
            
          </div>
        </div>
      </GeneralWrapperStyled>
    </div>
  )
}

export default Courses
