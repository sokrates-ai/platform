import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@components/ui/card"
import CourseThumbnail from "@components/Objects/Thumbnails/CourseThumbnail"

interface CourseCardProps {
  course: any
  orgslug: string
}

const CourseCard: React.FC<CourseCardProps> = ({ course, orgslug }) => {
  return (
    <Card key={course.course_uuid} className="w-full" variant="defaultgradient">
      <CardHeader>
        <CardTitle className="text-lg font-bold">{course.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CourseThumbnail course={course} orgslug={orgslug} />
        <p className="text-sm text-gray-600 mt-2">{course.description}</p>
      </CardContent>
    </Card>
  )
}

export default CourseCard