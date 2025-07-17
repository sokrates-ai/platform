import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { motion } from "framer-motion"
import { useOrg } from "@components/Contexts/OrgContext"
import { useSokratesSession } from "@components/Contexts/SokratesSessionContext"
import AuthenticatedClientElement from "@components/Security/AuthenticatedClientElement"
import ConfirmationModal from "@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal"
import { getCourseThumbnailMediaDirectory } from "@services/media/media"
import { getUriWithOrg } from "@services/config/config"
import { deleteCourseFromBackend } from "@services/courses/courses"
import { revalidateTags } from "@services/utils/ts/requests"
import { BookMinus, FilePenLine, Settings2, EllipsisVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@components/ui/dropdown-menu"

interface CourseCardProps {
  course: any
  orgslug: string
}

const CourseCard: React.FC<CourseCardProps> = ({ course, orgslug }) => {
  const org = useOrg() as any
  const router = useRouter()
  const session = useSokratesSession() as any

  const deleteCourse = async () => {
    const toastId = toast.loading("Deleting course...")
    try {
      await deleteCourseFromBackend(course.course_uuid, session.data?.tokens?.access_token)
      await revalidateTags(["courses"], orgslug)
      toast.success("Course deleted successfully")
      router.refresh()
    } catch {
      toast.error("Failed to delete course")
    } finally {
      toast.dismiss(toastId)
    }
  }

  const removeCoursePrefix = (id: string) => id.replace("course_", "")

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(
        org?.org_uuid,
        course.course_uuid,
        course.thumbnail_image
      )
    : "/empty_thumbnail.png"

  return (
    <div>
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Link
          prefetch
          href={getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)}
          className="
            block w-full relative h-0 pb-[61%]
            overflow-hidden rounded-xl border border-gray-600 bg-gray-100
            shadow-[0_8px_0_0_#454545] cursor-pointer
          "
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${thumbnailImage})` }}
          />
        </Link>
      </motion.div>

      <div className="mt-3 sm:mt-4 flex items-center justify-between px-2">
        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold line-clamp-2 text-[#3C3C3C]">
          {course.name}
        </h2>
        <AdminEditOptions
          course={course}
          orgSlug={orgslug}
          deleteCourse={deleteCourse}
        />
      </div>
    </div>
  )
}

export default CourseCard

const AdminEditOptions: React.FC<{
  course: any
  orgSlug: string
  deleteCourse: () => Promise<void>
}> = ({ course, orgSlug, deleteCourse }) => (
  <AuthenticatedClientElement
    action="update"
    ressourceType="courses"
    checkMethod="roles"
    orgId={course.org_id}
  >
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 bg-white rounded-md transition-colors group">
          <EllipsisVertical
            size={20}
            className="text-[#939393] transition-colors group-hover:text-gray-700"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link
            prefetch
            href={getUriWithOrg(
              orgSlug,
              `/dash/courses/course/${course.course_uuid.replace("course_", "")}/content`
            )}
            className="flex items-center px-2 py-1"
          >
            <FilePenLine className="mr-2 h-4 w-4" /> Edit Content
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            prefetch
            href={getUriWithOrg(
              orgSlug,
              `/dash/courses/course/${course.course_uuid.replace("course_", "")}/general`
            )}
            className="flex items-center px-2 py-1"
          >
            <Settings2 className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <ConfirmationModal
            confirmationButtonText="Delete Course"
            confirmationMessage="Are you sure you want to delete this course?"
            dialogTitle={`Delete ${course.name}?`}
            dialogTrigger={
              <button className="w-full text-left flex items-center px-2 py-1 rounded-md text-sm bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-red-600">
                <BookMinus className="mr-4 h-4 w-4" /> Delete Course
              </button>
            }
            functionToExecute={deleteCourse}
            status="warning"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </AuthenticatedClientElement>
)
