'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Upload, X, FileImage, FileText, Loader2 } from 'lucide-react'
import { useSession } from '@/shared/hooks/useSession'
import { prepareContentForInsertion } from '@/features/text-editor/utils/contentUtils'
import Image from 'next/image'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: (content: string) => void
  initialFile?: File | null
}

interface FileWithPreview {
  file: File
  preview?: string
  type: 'image' | 'document'
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onOpenChange,
  onUploadComplete,
  initialFile
}) => {
  const { apiClient } = useSession();
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper function to truncate filename
  const truncateFilename = (filename: string, maxLength: number = 18) => {
    const extension = filename.split('.').pop() || ''
    const nameWithoutExtension = filename.slice(0, filename.lastIndexOf('.')) || filename

    if (nameWithoutExtension.length <= maxLength) {
      return filename
    }

    return `${nameWithoutExtension.slice(0, maxLength)}...${extension ? `.${extension}` : ''}`
  }

  const processFile = useCallback((file: File) => {
    const fileType = file.type.startsWith('image/') ? 'image' : 'document'

    if (fileType === 'image') {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedFile({
          file,
          preview: e.target?.result as string,
          type: fileType
        })
      }
      reader.readAsDataURL(file)
    } else {
      setSelectedFile({
        file,
        type: fileType
      })
    }
  }, [])

  // Initialize with initial file if provided
  React.useEffect(() => {
    if (initialFile && open) {
      processFile(initialFile)
    }
  }, [initialFile, open, processFile])

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setIsUploading(false)
      setIsDragOver(false)
      setUploadError(null)
    }
  }, [open])

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0]
      // Accept images and common document formats
      if (file.type.startsWith('image/') ||
        file.type === 'application/pdf' ||
        file.type.includes('document') ||
        file.type.includes('text')) {
        processFile(file)
      }
    }
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleBrowseFiles = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !apiClient) return

    setIsUploading(true)
    setUploadError(null)

    try {
      if (selectedFile.type === 'image') {
        // Use the real API for image processing
        const extractedContent = await apiClient.uploadImage(selectedFile.file)
        console.log('[UploadDialog] Raw image recognition content:', extractedContent);

        // Convert plain text to properly formatted HTML
        const formattedContent = prepareContentForInsertion(extractedContent, true)
        console.log('[UploadDialog] Formatted content for insertion:', formattedContent);

        onUploadComplete(formattedContent)
      } else {
        // For non-image files, we still show a placeholder since the backend only handles images
        const placeholderContent = `📄 **Document uploaded: ${selectedFile.file.name}**\n\n*Document processing not yet implemented for this file type.*`
        const formattedContent = prepareContentForInsertion(placeholderContent, false)
        onUploadComplete(formattedContent)
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, apiClient, onUploadComplete, onOpenChange])

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden" showCloseButton>
        {/* Separated title area */}
        <div className="border-b-4 border-b-[#707070] bg-[#EBEBEB] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className='text-[#151515] flex justify-center text-lg sm:text-xl'>Upload Document or Image</DialogTitle>
          </DialogHeader>
        </div>

        {/* Main content area */}
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 min-h-[360px] sm:min-h-[400px]">
          {!selectedFile ? (
            // Upload zone
            <div
              className={`border-4 border-dashed rounded-[0.875rem] p-6 sm:p-8 text-center transition-colors min-h-[200px] sm:min-h-[260px] flex flex-col justify-center ${isDragOver
                ? 'border-[#E25A26] bg-blue-50/50'
                : 'border-[#707070] hover:border-[#454545] bg-white/50'
                }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-10 w-10 sm:h-14 sm:w-14 text-[#707070] mb-4 sm:mb-6" />
              <p className="text-base sm:text-lg font-medium text-[#454545] mb-2 sm:mb-3">
                Drop files here or click to browse
              </p>
              <p className="text-xs sm:text-sm text-[#707070] mb-6 sm:mb-8">
                Supports images, PDFs, and documents
              </p>
              <Button onClick={handleBrowseFiles} variant="outline" className='px-5 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-sm'>
                Browse Files
              </Button>
            </div>
          ) : (
            // File preview
            <div className="border-4 border-[#707070] rounded-[0.875rem] px-6 sm:px-8 py-3 sm:py-5 bg-white/50 min-h-[200px] sm:min-h-[260px] flex flex-col">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1 max-w-[calc(100%-60px)]">
                  {selectedFile.type === 'image' ? (
                    <FileImage className="h-7 w-7 sm:h-9 sm:w-9 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-7 w-7 sm:h-9 sm:w-9 text-[#707070] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#454545] text-sm sm:text-base truncate" title={selectedFile.file.name}>
                      {truncateFilename(selectedFile.file.name)}
                    </p>
                    <p className="text-xs sm:text-sm text-[#707070]">
                      {(selectedFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                  className="hover:bg-red-100 hover:text-red-600 p-2 flex-shrink-0 w-[40px] h-[40px] sm:w-[44px] sm:h-[44px]"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {selectedFile.type === 'image' && selectedFile.preview && (
                <div className="flex-1 flex items-center justify-center mt-4 sm:mt-6">
                  <Image
                    src={selectedFile.preview as string}
                    width={100}
                    height={100}
                    alt="Preview"
                    className="max-w-full h-auto max-h-[140px] sm:max-h-[180px] rounded-[0.5rem] border-2 border-[#707070]"
                  />
                </div>
              )}

              {selectedFile.type === 'document' && (
                <div className="flex-1 flex items-center justify-center mt-4 sm:mt-6">
                  <div className="text-center text-[#707070]">
                    <FileText className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4" />
                    <p className="text-base font-medium">Document ready for upload</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {uploadError && (
            <div className="bg-red-50 border-2 border-red-300 rounded-[0.875rem] p-3 sm:p-4">
              <p className="text-sm sm:text-base text-red-600">{uploadError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-center sm:space-x-4 gap-3 sm:gap-0 pt-2 sm:pt-4">
            {!selectedFile ? (
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                className="px-4 sm:px-5 py-2 text-sm sm:text-sm self-center"
              >
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2.5 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  variant="default"
                  className="flex-1 px-4 py-2.5 text-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </DialogContent>
    </Dialog>
  )
}

export default UploadDialog 