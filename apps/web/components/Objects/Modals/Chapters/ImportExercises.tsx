import React, { useState } from 'react'
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Loader2, Check, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function ImportExercises({ closeModal, course, onImportSuccess }: { 
  closeModal: () => void; 
  course: any;
  onImportSuccess: () => void;
}) {
  const [link, setLink] = useState('')
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const validateLink = (url: string) => {
    try {
      const urlObj = new URL(url)
      // Add your specific domain validation here if needed
      // For example: urlObj.hostname === 'inflekt.com'
      const isValid = urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
      setIsValidLink(isValid)
      return isValid
    } catch {
      setIsValidLink(false)
      return false
    }
  }

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLink(value)
    if (value.trim()) {
      validateLink(value)
    } else {
      setIsValidLink(null)
    }
  }

  const handleImport = async () => {
    if (!isValidLink) return

    try {
      setIsImporting(true)
      // TODO: Implement actual import logic
      // await importFromLink(link, course.id, session?.data?.tokens?.access_token)
      
      console.log('Importing from link:', link)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Call success callback
      onImportSuccess()
      
      // Close modal after successful import
      closeModal()
    } catch (error) {
      console.error('Failed to import:', error)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      {/* Link Input */}
      <div className="space-y-2">
        <Label htmlFor="link">inflekt Rooms Link</Label>
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            id="link"
            type="text"
            placeholder="https://inflekt.com/rooms/..."
            value={link}
            onChange={handleLinkChange}
            className={cn(
              "pl-10 pr-10",
              isValidLink === true && "border-green-500 focus-visible:ring-green-500",
              isValidLink === false && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          {isValidLink !== null && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isValidLink ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          )}
        </div>
        {isValidLink === false && (
          <p className="text-xs text-red-500">
            Please enter a valid URL
          </p>
        )}
        {isValidLink === true && (
          <p className="text-xs text-green-600">
            Valid link detected
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={closeModal} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!isValidLink || isImporting}
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            'Import'
          )}
        </Button>
      </div>
    </div>
  )
}

export default ImportExercises