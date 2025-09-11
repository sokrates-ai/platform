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

    if (!values.email) {
        errors.email = 'Required'
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
        errors.email = 'Invalid email address'
    }

    if (!values.new_password) {
        errors.new_password = 'Required'
    }

    if (!values.confirm_password) {
        errors.confirm_password = 'Required'
    }

    if (values.new_password !== values.confirm_password) {
        errors.confirm_password = 'Passwords do not match'
    }

    if (!values.reset_code) {
        errors.reset_code = 'Required'
    }
    return errors
}

function ResetPasswordClient() {
    const org = useOrg() as any;
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const searchParams = useSearchParams()
    const reset_code = searchParams.get('resetCode') || ''
    const email = searchParams.get('email') || ''
    const router = useRouter()
    const [error, setError] = React.useState('')
    const [message, setMessage] = React.useState('')

    const formik = useFormik({
        initialValues: {
            email: email,
            new_password: '',
            confirm_password: '',
            reset_code: reset_code
        },
        validate,
        enableReinitialize: true,
        onSubmit: async (values) => {
            setIsSubmitting(true)
            let res = await resetPassword(values.email, values.new_password, org?.id, values.reset_code)
            if (res.status == 200) {
                setMessage(res.data + ', please login')
                setIsSubmitting(false)
            } else {
                setError(res.data.detail)
                setIsSubmitting(false)
            }

        },
    })
    return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-8">
            <h1
                className="text-[3.25rem] font-extrabold leading-[1.25] tracking-[0.065rem]"
                style={{
                    fontFamily: '"DM Sans", sans-serif',
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
                    <div className="flex justify-center bg-red-200 rounded-md text-red-950 space-x-2 items-center p-4 transition-all shadow-sm">
                        <AlertTriangle size={18} />
                        <div className="font-bold text-sm">{error}</div>
                    </div>
                )}
                {message && (
                    <div className="flex justify-center bg-green-200 rounded-md text-green-950 space-x-2 items-center p-4 transition-all shadow-sm">
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
                            />
                        </Form.Control>
                    </FormField>

                    <FormField name="reset_code">
                        <FormLabelAndMessage
                            label="Reset Code"
                            message={formik.errors.reset_code}
                        />
                        <Form.Control asChild>
                            <Input
                                onChange={formik.handleChange}
                                value={formik.values.reset_code}
                                type="text"
                            />
                        </Form.Control>
                    </FormField>

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

                    <div className="flex  py-4">
                        <Form.Submit asChild>
                            <button className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer">
                                {isSubmitting ? 'Loading...' : 'Change Password'}
                            </button>
                        </Form.Submit>
                    </div>
                </FormLayout>
            </AuthCard>
        </div>
    )
}

export default ResetPasswordClient