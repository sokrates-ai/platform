import React from 'react'
import { Metadata } from 'next'
import PrivacyPage from './privacy'

export const metadata: Metadata = {
  title: 'Sokrates | Privacy Policy',
}

export default function Privacy() {
  return <PrivacyPage />
}
