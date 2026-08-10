'use client'
import React from 'react'
import FormLayout, {
    FormField,
    FormLabelAndMessage,
    Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, Info } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFormik } from 'formik'
import { resetPassword } from '@services/auth/auth'
import AuthCard from '@components/Pages/AuthCard'

const validate = (values: any) => {
    const errors: any = {}

    if (!values.new_password) {
        errors.new_password = 'Required'
    } else if (values.new_password.length < 8) {
        errors.new_password = 'Password must be at least 8 characters'
    }

    if (!values.confirm_password) {
        errors.confirm_password = 'Required'
    }

    if (values.new_password !== values.confirm_password) {
        errors.confirm_password = 'Passwords do not match'
    }

    return errors
}

function ResetPasswordClient() {
    const org = useOrg() as any;
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const searchParams = useSearchParams()
    const reset_code = searchParams.get('resetCode') || ''
    const email = searchParams.get('email') || ''
    const hasValidResetLink = Boolean(email && reset_code)
    const router = useRouter()
    const [error, setError] = React.useState('')
    const [message, setMessage] = React.useState('')

    const formik = useFormik({
        initialValues: {
            new_password: '',
            confirm_password: '',
        },
        validate,
        onSubmit: async (values) => {
            if (!hasValidResetLink) {
                setError('This password reset link is incomplete. Request a new one.')
                return
            }
            setIsSubmitting(true)
            setError('')
            setMessage('')
            try {
                const res = await resetPassword(email, values.new_password, org?.id, reset_code)
                if (res.status === 200) {
                    setMessage(res.data + ', please login')
                } else {
                    setError(res.data?.detail || 'Could not reset your password')
                }
            } catch {
                setError('Could not reset your password. Please try again later.')
            } finally {
                setIsSubmitting(false)
            }

        },
    })
    return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-8">
            <h1
                className="text-[3.25rem] font-extrabold leading-[1.25] tracking-[0.065rem]"
                style={{
                    backgroundImage:
                        'radial-gradient(328.3% 203.09% at 85.28% -100%, #646464 0%, #3C3C3C 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}
            >
                Reset password
            </h1>

            <AuthCard>
                {error && (
                    <div role="alert" aria-live="assertive" className="flex justify-center bg-red-200 rounded-md text-red-950 space-x-2 items-center p-4 transition-all shadow-sm">
                        <AlertTriangle size={18} />
                        <div className="font-bold text-sm">{error}</div>
                    </div>
                )}
                {message && (
                    <div role="status" aria-live="polite" className="flex justify-center bg-green-200 rounded-md text-green-950 space-x-2 items-center p-4 transition-all shadow-sm">
                        <Info size={18} />
                        <div className="font-bold text-sm">{message}</div>
                    </div>
                )}
                {!hasValidResetLink && !error && (
                    <div role="alert" className="flex justify-center bg-red-200 rounded-md text-red-950 space-x-2 items-center p-4 shadow-sm">
                        <AlertTriangle size={18} />
                        <div className="font-bold text-sm">This password reset link is incomplete. Request a new one.</div>
                    </div>
                )}
                <FormLayout onSubmit={formik.handleSubmit}>
                    <FormField name="new_password">
                        <FormLabelAndMessage
                            label="New Password"
                            message={formik.errors.new_password}
                        />
                        <Form.Control asChild>
                            <Input
                                onChange={formik.handleChange}
                                value={formik.values.new_password}
                                type="password"
                            />
                        </Form.Control>
                    </FormField>

                    <FormField name="confirm_password">
                        <FormLabelAndMessage
                            label="Confirm Password"
                            message={formik.errors.confirm_password}
                        />
                        <Form.Control asChild>
                            <Input
                                onChange={formik.handleChange}
                                value={formik.values.confirm_password}
                                type="password"
                            />
                        </Form.Control>
                    </FormField>

                    <div className="flex py-4">
                        <Form.Submit asChild>
                            <button
                                disabled={isSubmitting || !hasValidResetLink}
                                className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? 'Changing...' : 'Change Password'}
                            </button>
                        </Form.Submit>
                    </div>
                </FormLayout>
                <p className="text-center text-sm text-[#454545]">
                    Already reset your password?{' '}
                    <button
                        type="button"
                        onClick={() => router.push(`/login?orgslug=${encodeURIComponent(org?.slug || 'default')}`)}
                        className="font-semibold text-[#8f3518] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f3518] rounded"
                    >
                        Sign in
                    </button>
                </p>
            </AuthCard>
        </div>
    )
}

export default ResetPasswordClient
