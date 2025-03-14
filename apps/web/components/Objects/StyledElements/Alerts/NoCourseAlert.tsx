import React from "react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
interface NoCoursesAlertProps {
  text?: string
  isUserAdmin?: boolean
}

const NoCoursesAlert: React.FC<NoCoursesAlertProps> = ({ text, isUserAdmin }) => {
  return (
    <div className="col-span-full flex justify-center">
      <Alert variant="default" className="max-w-md">
        <AlertTitle>No courses yet</AlertTitle>
        <AlertDescription>
          {text ? text : isUserAdmin ? "Create a course to add content." : "No courses available yet."}
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default NoCoursesAlert
