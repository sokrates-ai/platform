import FormLayout, {
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form'
import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Button } from "@components/ui/button";
import { useTranslations } from 'next-intl' // added

function DynamicCanvaModal({ submitActivity, chapterId, course }: any) {
  const t = useTranslations('DynamicCanvaModal') // added
  const [activityName, setActivityName] = useState('')
  const [activityDescription, setActivityDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleActivityNameChange = (e: any) => {
    setActivityName(e.target.value)
  }

  const handleActivityDescriptionChange = (e: any) => {
    setActivityDescription(e.target.value)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setIsSubmitting(true)
    await submitActivity({
      name: activityName,
      chapter_id: chapterId,
      activity_type: 'TYPE_DYNAMIC',
      activity_sub_type: 'SUBTYPE_DYNAMIC_PAGE',
      published_version: 1,
      version: 1,
      course_id: course.id,
    })
    setIsSubmitting(false)
  }
  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="dynamic-activity-name">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>{t('labels.activityName')}</FormLabel>
          <FormMessage match="valueMissing">
            {t('messages.nameRequired')}
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={handleActivityNameChange}
            type="text"
            required
            placeholder={t('placeholders.activityName')}
          />
        </Form.Control>
      </FormField>
      <FormField name="dynamic-activity-desc">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>{t('labels.activityDescription')}</FormLabel>
          <FormMessage match="valueMissing">
            {t('messages.descriptionRequired')}
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Textarea
            onChange={handleActivityDescriptionChange}
            placeholder={t('placeholders.activityDescription')}
          />
        </Form.Control>
      </FormField>

      <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
        <Form.Submit asChild>
          <Button>
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

export default DynamicCanvaModal
