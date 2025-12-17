import FormLayout, {
  Flex,
  FormField,
  Input,
  Textarea,
  FormLabel,
} from '@components/Objects/StyledElements/Form/Form'
import { FormMessage } from '@radix-ui/react-form'
import * as Form from '@radix-ui/react-form'
import React, { useState } from 'react'
import BarLoader from 'react-spinners/BarLoader'
import { Button } from "@components/ui/button";
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ImportExercises from './ImportExercises'
import { FileDown, CheckCircle } from 'lucide-react'

function NewChapterModal({ submitChapter, closeModal, course }: any) {
  const [chapterName, setChapterName] = useState('')
  const [chapterDescription, setChapterDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  const handleChapterNameChange = (e: any) => {
    setChapterName(e.target.value)
  }

  const handleChapterDescriptionChange = (e: any) => {
    setChapterDescription(e.target.value)
  }

  const handleImportSuccess = () => {
    setImportSuccess(true)
    // Reset success indicator after 3 seconds
    setTimeout(() => setImportSuccess(false), 3000)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    setIsSubmitting(true)
    const chapter_object = {
      name: chapterName,
      description: chapterDescription,
      thumbnail_image: '',
      course_id: course.id,
      org_id: course.org_id,
    }
    await submitChapter(chapter_object)
    setIsSubmitting(false)
  }

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="chapter-name">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>Chapter name</FormLabel>
          <FormMessage match="valueMissing">
            Please provide a chapter name
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input onChange={handleChapterNameChange} type="text" required />
        </Form.Control>
      </FormField>
      <FormField name="chapter-desc">
        <Flex css={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
          <FormLabel>Chapter description</FormLabel>
          <FormMessage match="valueMissing">
            Please provide a chapter description
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Textarea onChange={handleChapterDescriptionChange} required />
        </Form.Control>
      </FormField>

      <Flex css={{ marginTop: 25, justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center space-x-2">
          <Modal
            isDialogOpen={isImportModalOpen}
            onOpenChange={(open) => {
              setIsImportModalOpen(open)
              if (!open) setImportSuccess(false)
            }}
            minHeight="no-min"
            minWidth="md"
            dialogContent={
              <ImportExercises 
                closeModal={() => setIsImportModalOpen(false)} 
                course={course}
                onImportSuccess={handleImportSuccess}
              />
            }
            dialogTitle="Import from inflekt Rooms"
            dialogDescription="Enter the link to the inflekt Rooms exercise you want to import"
            dialogTrigger={
              <Button type="button" variant="outline" className="flex items-center space-x-2">
                <FileDown className="w-4 h-4" />
                <span>Import from inflekt Rooms</span>
              </Button>
            }
          />
          {importSuccess && (
            <div className="flex items-center space-x-1 text-green-600 animate-in fade-in slide-in-from-left-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Import successful</span>
            </div>
          )}
        </div>
        
        <Form.Submit asChild>
          <Button>
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Create Chapter'
            )}
          </Button>
        </Form.Submit>
      </Flex>
    </FormLayout>
  )
}

export default NewChapterModal
