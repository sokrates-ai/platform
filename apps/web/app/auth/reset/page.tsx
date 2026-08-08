import { Metadata } from 'next'
import React from 'react'
import ResetPasswordClient from './reset'
import AuthLayout from '@components/Pages/AuthLayout'

export const metadata: Metadata = {
    title: 'Reset password — Sokrates',
    description: 'Set a new password for your Sokrates account.',
}

function ResetPasswordPage() {
    return (
        <AuthLayout>
            <ResetPasswordClient />
        </AuthLayout>
    )
}

export default ResetPasswordPage
