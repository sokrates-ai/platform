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
import { useRouter } from 'next/navigation'
import { useFormik } from 'formik'
import { sendResetLink } from '@services/auth/auth'
import AuthCard from '@components/Pages/AuthCard'

const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
        errors.email = 'Required'
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = 'Invalid email address'
    }


    return errors
}

function ForgotPasswordClient() {
    const org = useOrg() as any;
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const router = useRouter()
    const [error, setError] = React.useState('')
    const [message, setMessage] = React.useState('')

    const formik = useFormik({
        initialValues: {
            email: ''
        },
        validate,
        validateOnBlur: true,
        onSubmit: async (values) => {
            setIsSubmitting(true)
            setError('')
            setMessage('')
            try {
                const res = await sendResetLink(values.email, org?.id)
                if (res.status === 200) {
                    setMessage(res.data)
                } else {
                    setError(res.data?.detail || 'Could not send the reset email')
                }
            } catch {
                setError('Could not send the reset email. Please try again later.')
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
                Forgot password
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
                <FormLayout onSubmit={formik.handleSubmit}>
                    <FormField name="email">
                        <FormLabelAndMessage
                            label="Email"
                            message={formik.errors.email}
                        />
                        <Form.Control asChild>
                            <Input
                                onChange={formik.handleChange}
                                value={formik.values.email}
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="email"
                                aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
                                aria-describedby={formik.touched.email && formik.errors.email ? 'forgot-email-error' : undefined}
                                required
                            />
                        </Form.Control>
                    </FormField>
                    <div className="flex  py-4">
                        <Form.Submit asChild>
                            <button
                                disabled={isSubmitting}
                                className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </Form.Submit>
                    </div>
                </FormLayout>
                <p className="text-center text-sm text-[#454545]">
                    Remembered your password?{' '}
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

export default ForgotPasswordClient
