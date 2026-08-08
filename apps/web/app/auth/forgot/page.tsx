import React from 'react'
import ForgotPasswordClient from './forgot'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot password — Sokrates',
  description: 'Request a link to reset your Sokrates password.',
}

function ForgotPasswordPage() {
  return (
    <ForgotPasswordClient />
  )
}

export default ForgotPasswordPage
