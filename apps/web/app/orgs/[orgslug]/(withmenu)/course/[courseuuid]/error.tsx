'use client' // Error components must be Client Components

import { useEffect } from 'react'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    void error
  }, [error])

  return (
    <ErrorUI
      message="This course could not be loaded"
      submessage="The course may have been removed or is temporarily unavailable."
    />
  )
}
