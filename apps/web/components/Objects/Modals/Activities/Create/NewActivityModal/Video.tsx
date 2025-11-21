import FormLayout, {
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Youtube } from 'lucide-react'
import { constructAcceptValue } from '@/lib/constants';
import { Button } from '@components/ui/button'
import { useTranslations } from 'next-intl'

const SUPPORTED_FILES = constructAcceptValue(['mp4', 'webm'])

interface ExternalVideoObject {
  name: string
  type: string
  uri: string
  chapter_id: string
}

function VideoModal({
  submitFileActivity,
  submitExternalVideo,
  chapterId,
  course,
}: any) {
  const t = useTranslations('VideoActivityModal')
  const [video, setVideo] = React.useState(null) as any
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = React.useState('')
  const [youtubeUrl, setYoutubeUrl] = React.useState('')
  const [selectedView, setSelectedView] = React.useState('file') as any

  const handleVideoChange = (event: React.ChangeEvent<any>) => {
    setVideo(event.target.files[0])
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const handleYoutubeUrlChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setYoutubeUrl(event.target.value)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (selectedView === 'file') {
      await submitFileActivity(
        video,
        'video',
        {
          name: name,
          chapter_id: chapterId,
          activity_type: 'TYPE_VIDEO',
          activity_sub_type: 'SUBTYPE_VIDEO_HOSTED',
          published_version: 1,
          version: 1,
          course_id: course.id,
        },
        chapterId
      )
      setIsSubmitting(false)
    }
    if (selectedView === 'youtube') {
      const external_video_object: ExternalVideoObject = {
        name,
        type: 'youtube',
        uri: youtubeUrl,
        chapter_id: chapterId,
      }

      await submitExternalVideo(
        external_video_object,
        'activity',
        chapterId
      )
      setIsSubmitting(false)
    }
  }

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="video-activity-name">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>{t('labels.videoName')}</FormLabel>
          <FormMessage match="valueMissing">
            {t('messages.nameRequired')}
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input onChange={handleNameChange} type="text" required />
        </Form.Control>
      </FormField>
      <div className="flex flex-col rounded-md bg-gray-50 outline-dashed outline-gray-200">
        <div className="">
          <div className="flex m-4 justify-center space-x-2 mb-0">
            <div
              onClick={() => {
                setSelectedView('file')
              }}
              className="rounded-full bg-slate-900 text-zinc-50 py-2 px-4 text-sm drop-shadow-md hover:cursor-pointer hover:bg-slate-700 "
            >
              {t('tabs.upload')}
            </div>
            <div
              onClick={() => {
                setSelectedView('youtube')
              }}
              className="rounded-full bg-slate-900 text-zinc-50 py-2 px-4 text-sm drop-shadow-md hover:cursor-pointer hover:bg-slate-700"
            >
              {t('tabs.youtube')}
            </div>
          </div>
          {selectedView === 'file' && (
            <div className="p-4 justify-center m-auto align-middle">
              <FormField name="video-activity-file">
                <Flex
                  css={{
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <FormLabel>{t('labels.videoFile')}</FormLabel>
                  <FormMessage match="valueMissing">
                    {t('messages.videoRequired')}
                  </FormMessage>
                </Flex>
                <Form.Control asChild>
                  <input accept={SUPPORTED_FILES} type="file" onChange={handleVideoChange} required />
                </Form.Control>
              </FormField>
            </div>
          )}
          {selectedView === 'youtube' && (
            <div className="p-4 justify-center m-auto align-middle">
              <FormField name="video-activity-youtube">
                <Flex
                  css={{
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <FormLabel className="flex justify-center align-middle">
                    <Youtube className="m-auto pr-1" />
                    <span className="flex">{t('labels.youtubeUrl')}</span>
                  </FormLabel>
                  <FormMessage match="valueMissing">
                    {t('messages.videoRequired')}
                  </FormMessage>
                </Flex>
                <Form.Control asChild>
                  <Input
                    className="bg-white"
                    onChange={handleYoutubeUrlChange}
                    type="text"
                    required
                  />
                </Form.Control>
              </FormField>
            </div>
          )}
        </div>
      </div>

      <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
        <Form.Submit asChild>
          <Button type="submit">
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('buttons.create')
            )}
          </Button>
        </Form.Submit>
      </Flex>
    </FormLayout>
  )
}

export default VideoModal
