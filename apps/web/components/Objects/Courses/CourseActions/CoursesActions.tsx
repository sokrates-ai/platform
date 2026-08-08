import React from 'react'
import UserAvatar from '../../UserAvatar'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { removeCourse, startCourse } from '@services/courses/activity'
import { revalidateTags } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useMediaQuery } from 'usehooks-ts'
import { getUriWithOrg } from '@services/config/config'
import { LogIn, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button";

interface Author {
  user_uuid: string
  avatar_image: string
  first_name: string
  last_name: string
  username: string
}

interface CourseRun {
  status: string
  course_id: string
}

interface Course {
  id: string
  authors: Author[]
  trail?: {
    runs: CourseRun[]
  }
}

interface CourseActionsProps {
  courseuuid: string
  orgslug: string
  course: Course & {
    org_id: number
  }
}

// Separate component for author display
const AuthorInfo = ({ author, isMobile }: { author: Author, isMobile: boolean }) => (
  <div className="flex flex-row md:flex-col mx-auto space-y-0 md:space-y-3 space-x-4 md:space-x-0 px-2 py-2 items-center">
    <UserAvatar
      border="border-8"
      avatar_url={author.avatar_image ? getUserAvatarMediaDirectory(author.user_uuid, author.avatar_image) : ''}
      predefined_avatar={author.avatar_image ? undefined : 'empty'}
      width={isMobile ? 60 : 100}
    />
    <div className="md:-space-y-2">
      <div className="text-[12px] text-neutral-600 font-semibold">Author</div>
      <div className="text-lg md:text-xl font-bold text-neutral-800">
        {(author.first_name && author.last_name) ? (
          <div className="flex space-x-2 items-center">
            <p>{`${author.first_name} ${author.last_name}`}</p>
            <span className="text-xs bg-neutral-100 p-1 px-3 rounded-full text-neutral-600 font-semibold">
              @{author.username}
            </span>
          </div>
        ) : (
          <div className="flex space-x-2 items-center">
            <p>@{author.username}</p>
          </div>
        )}
      </div>
    </div>
  </div>
)

export function courseIsStarted(course: any): boolean {
  return course.trail?.runs?.some(
    (run: any) => run.status === 'STATUS_IN_PROGRESS' && run.course_id === course.id
  ) ?? false
}

const Actions = ({ courseuuid, orgslug, course }: CourseActionsProps) => {
  const router = useRouter()
  const session = useSokratesSession() as any;
  const isStarted = courseIsStarted(course)

  const handleCourseAction = async () => {
    if (!session.data?.user) {
      router.push(getUriWithOrg(orgslug, '/login?orgslug=' + orgslug))
      return
    }
    const action = isStarted ? removeCourse : startCourse
    await action('course_' + courseuuid, orgslug, session.data?.tokens?.access_token)
    await revalidateTags(['courses'], orgslug)
    router.refresh()
  }

  return (
    <Button
      onClick={handleCourseAction}
      variant={isStarted ? "destructive" : "default"}
      className="w-full"
    >
      {!session.data?.user ? (
        <>
          <LogIn className="w-5 h-5" />
          Authenticate to start course
        </>
      ) : isStarted ? (
        <>
          <LogOut className="w-5 h-5" />
          Leave Course
        </>
      ) : (
        <>
          <LogIn className="w-5 h-5" />
          Start Course
        </>
      )}
    </Button>
  )
}

function CoursesActions({ courseuuid, orgslug, course }: CourseActionsProps) {
  const router = useRouter()
  const session = useSokratesSession() as any;
  const isMobile = useMediaQuery('(max-width: 768px)')


  return (
    <div className=" space-y-3  antialiased flex flex-col   p-3 py-5 bg-white shadow-md shadow-gray-300/25 outline outline-1 outline-neutral-200/40 rounded-lg overflow-hidden">
     <AuthorInfo author={course.authors[0]} isMobile={isMobile} />
      <div className='px-3 py-2'>
        <Actions courseuuid={courseuuid} orgslug={orgslug} course={course} />
      </div>
    </div>
  )
}

export default CoursesActions
