import { Metadata } from 'next'
import React from 'react'
import ResetPasswordClient from './reset'

export const metadata: Metadata = {
    title: 'Sokrates - Reset Password',
}

function ResetPasswordPage() {
    return (
        <ResetPasswordClient />
    )
}

export default ResetPasswordPage
