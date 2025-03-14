import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@components/ui/card"
import CourseThumbnail from "@components/Objects/Thumbnails/CourseThumbnail"

interface CourseCardProps {
  course: any
  orgslug: string
}

const CourseCard: React.FC<CourseCardProps> = ({ course, orgslug }) => {
  return (
    <Card key={course.course_uuid}>
      <CardHeader>
        <CardTitle>{course.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CourseThumbnail course={course} orgslug={orgslug} />
      </CardContent>
    </Card>
  )
}

export default CourseCard
