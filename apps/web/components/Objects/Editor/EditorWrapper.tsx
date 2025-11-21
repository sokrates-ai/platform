'use client'
import { default as React } from 'react'
import Editor from './Editor'
import { updateActivity } from '@services/courses/activities'
import { toast } from 'react-hot-toast'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import { OrgProvider } from '@components/Contexts/OrgContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useTranslations } from 'next-intl'

interface EditorWrapperProps {
  content: string
  activity: any
  course: any
  org: any
}

function EditorWrapper(props: EditorWrapperProps): JSX.Element {
  const session = useSokratesSession() as any
  const access_token = session?.data?.tokens?.access_token
  const t = useTranslations('EditorWrapper')

  async function setContent(content: any) {
    let activity = props.activity
    activity.content = content

    toast.promise(updateActivity(activity, activity.activity_uuid, access_token), {
      loading: t('toast.saving'),
      success: <b>{t('toast.saved')}</b>,
      error: <b>{t('toast.error')}</b>,
    })
  }

  {
    return (
      <>
        <Toast></Toast>
        <OrgProvider orgslug={props.org.slug}>
          {!session.isLoading && (
            <Editor
              org={props.org}
              course={props.course}
              activity={props.activity}
              content={props.content}
              setContent={setContent}
              session={session}
            ></Editor>
          )}
        </OrgProvider>
      </>
    )
  }
}

export default EditorWrapper