'use client'
import React, { useEffect } from 'react'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Mail,
  Lock,
  UserRound,
  FileText,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { signUpWithInviteCode } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AuthCard from '@components/Pages/AuthCard'

const validate = (values: any) => {
  const errors: any = {}
  if (!values.email) errors.email = 'Required'
  else if (
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
  )
    errors.email = 'Invalid email address'

  if (!values.password) errors.password = 'Required'
  else if (values.password.length < 8)
    errors.password = 'Password must be at least 8 characters'

  if (!values.username) errors.username = 'Required'
  else if (values.username.length < 4)
    errors.username = 'Username must be at least 4 characters'

  return errors
}

interface InviteOnlySignUpProps {
  inviteCode: string
}

export default function InviteOnlySignUpComponent(
  props: InviteOnlySignUpProps
) {
  const org = useOrg() as any
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')

  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: '',
      password: '',
      username: '',
      bio: '',
    },
    validate,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError('')
      setMessage('')
      setIsSubmitting(true)
      const res = await signUpWithInviteCode(values, props.inviteCode)
      const body = await res.json()
      if (res.status === 200) {
        setMessage('Your account was successfully created')
      } else if ([400, 401, 404, 409].includes(res.status)) {
        setError(body.detail)
      } else {
        setError('Something went wrong')
      }
      setIsSubmitting(false)
    },
  })

  useEffect(() => { }, [org])

  return (
    <AuthCard className="max-w-[95vw] sm:max-w-[45rem] md:max-w-[52.5rem]">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert
          variant="default"
          className="mb-6 bg-green-50 text-green-800 border-green-200"
        >
          <div className="flex flex-col w-full space-y-4">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4" />
              <span className="font-medium">{message}</span>
            </div>
            <div className="w-full border-t border-green-200 my-2" />
            <Link
              href={`/login?orgslug=${org?.slug}`}
              className="flex items-center text-green-800 hover:underline"
            >
              <UserRound size={14} className="mr-2" />
              <span>Login to your account</span>
            </Link>
          </div>
        </Alert>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-[#454545]">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className={`pl-10 h-10 border border-[#626262] rounded-md w-full ${formik.touched.email && formik.errors.email
                  ? 'border-red-500'
                  : ''
                }`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.email}
            />
          </div>
          {formik.touched.email && formik.errors.email && (
            <p className="text-xs text-red-500 mt-1">{formik.errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-[#454545]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="●●●●●●●●"
              className={`pl-10 h-10 border border-[#626262] rounded-md w-full ${formik.touched.password && formik.errors.password
                  ? 'border-red-500'
                  : ''
                }`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.password}
            />
          </div>
          {formik.touched.password && formik.errors.password && (
            <p className="text-xs text-red-500 mt-1">{formik.errors.password}</p>
          )}
        </div>

        {/* Username */}
        <div className="space-y-1">
          <label htmlFor="username" className="block text-sm font-medium text-[#454545]">
            Username
          </label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="your.username"
              className={`pl-10 h-10 border border-[#626262] rounded-md w-full ${formik.touched.username && formik.errors.username
                  ? 'border-red-500'
                  : ''
                }`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.username}
            />
          </div>
          {formik.touched.username && formik.errors.username && (
            <p className="text-xs text-red-500 mt-1">{formik.errors.username}</p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-1">
          <label htmlFor="bio" className="block text-sm font-medium text-[#454545]">
            Bio
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-2 text-[#707070]" />
            <Textarea
              id="bio"
              name="bio"
              placeholder="Briefly describe yourself"
              className={`pl-10 min-h-[80px] border border-[#626262] rounded-md w-full ${formik.touched.bio && formik.errors.bio
                  ? 'border-red-500'
                  : ''
                }`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.bio}
            />
          </div>
          {formik.touched.bio && formik.errors.bio && (
            <p className="text-xs text-red-500 mt-1">{formik.errors.bio}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-[#e25a26] rounded-md shadow-[0_4px_0_#c94918] text-white font-semibold flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Creating account...
            </>
          ) : (
            'Create Account & Join'
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-[#454545]">
        Already have an account?{' '}
        <Link
          href={`/login?orgslug=${org?.slug}`}
          className="font-semibold text-[#e25a26] hover:underline"
        >
          Sign In
        </Link>
      </p>
    </AuthCard>
  )
}
