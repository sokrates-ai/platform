import React from 'react'
import { Metadata } from 'next'
import TermsPage from './terms'

export const metadata: Metadata = {
  title: 'Sokrates | Terms & Conditions',
}

export default function Terms() {
  return <TermsPage />
}
