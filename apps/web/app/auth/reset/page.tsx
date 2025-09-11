import { Metadata } from 'next'
import React from 'react'
import ResetPasswordClient from './reset'
import AuthLayout from '@components/Pages/AuthLayout'

export const metadata: Metadata = {
    title: 'Sokrates',
}

function ResetPasswordPage() {
    return (
        <AuthLayout>
            <ResetPasswordClient />
        </AuthLayout>
    )
}

export default ResetPasswordPage
