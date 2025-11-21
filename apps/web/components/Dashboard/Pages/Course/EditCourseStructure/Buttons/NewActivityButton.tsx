import { useCourse } from '@components/Contexts/CourseContext'
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getAPIUrl } from '@services/config/config'
import {
  createActivity,
  createExternalVideoActivity,
  createFileActivity,
} from '@services/courses/activities'
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs'
import { revalidateTags } from '@services/utils/ts/requests'
import { Layers } from 'lucide-react'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { mutate } from 'swr'
import toast from 'react-hot-toast'
import { Button } from "@components/ui/button"
import { useTranslations } from 'next-intl'

type NewActivityButtonProps = {
  chapterId: string
  orgslug: string
}

function NewActivityButton(props: NewActivityButtonProps) {
  const [newActivityModal, setNewActivityModal] = React.useState(false)
  const router = useRouter()
  const course = useCourse() as any
  const session = useSokratesSession() as any;  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('NewActivityButton')

  const openNewActivityModal = async (chapterId: any) => {
    setNewActivityModal(true)
  }

  const closeNewActivityModal = async () => {
    setNewActivityModal(false)
  }

  // Submit new activity
  const submitActivity = async (activity: any) => {
    let org = await getOrganizationContextInfoWithoutCredentials(
      props.orgslug,
      { revalidate: 1800 }
    )
    const toast_loading = toast.loading(t('toast.creating'))
    await createActivity(activity, props.chapterId, org.org_id, access_token)
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    toast.dismiss(toast_loading)
    toast.success(t('toast.created'))
    setNewActivityModal(false)
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
  }

  // Submit File Upload
  const submitFileActivity = async (
    file: any,
    type: any,
    activity: any,
    chapterId: string
  ) => {
    const toast_loading = toast.loading(t('toast.uploadingAndCreating'))
    await createFileActivity(file, type, activity, chapterId, access_token)
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    setNewActivityModal(false)
    toast.dismiss(toast_loading)
    toast.success(t('toast.fileUploaded'))
    toast.success(t('toast.created'))
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
  }

  // Submit YouTube Video Upload
  const submitExternalVideo = async (
    external_video_data: any,
    activity: any,
    chapterId: string
  ) => {
    const toast_loading = toast.loading(t('toast.uploadingAndCreating'))
    await createExternalVideoActivity(
      external_video_data,
      activity,
      props.chapterId, access_token
    )
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    setNewActivityModal(false)
    toast.dismiss(toast_loading)
    toast.success(t('toast.created'))
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
  }

  useEffect(() => { }, [course])

  return (
    <div className="flex justify-center">
      <Modal
        isDialogOpen={newActivityModal}
        onOpenChange={setNewActivityModal}
        minHeight="no-min"
        minWidth='md'
        addDefCloseButton={false}
        dialogContent={
          <NewActivityModal
            closeModal={closeNewActivityModal}
            submitFileActivity={submitFileActivity}
            submitExternalVideo={submitExternalVideo}
            submitActivity={submitActivity}
            chapterId={props.chapterId}
            course={course}
            access_token={access_token}
          ></NewActivityModal>
        }
        dialogTitle={t('modal.title')}
        dialogDescription={t('modal.description')}
      />
      <Button
        variant={"default"}
        onClick={() => {
          openNewActivityModal(props.chapterId)
        }}
        className="flex w-44 h-10 space-x-2 items-center py-2 my-3 rounded-xl justify-center hover:cursor-pointer"
        aria-label={t('buttons.add')}
      >
        <Layers className="" size={17} />
        <div className="text-sm mx-auto my-auto items-center font-bold">
          {t('buttons.add')}
        </div>
      </Button>
    </div>
  )
}

export default NewActivityButton
