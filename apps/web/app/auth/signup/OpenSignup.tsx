'use client'
import React, { useEffect, useMemo } from 'react'
import { useFormik } from 'formik'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Mail,
  Lock,
  UserRound,
  FileText,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { signup } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'
import HpiKeycloakButton from '@components/Pages/HpiKeycloakButton'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const validateStep1 = (values: any) => {
  const errors: any = {}
  if (!values.email) errors.email = 'Required'
  else if (
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
  )
    errors.email = 'Invalid email address'
  return errors
}

const validateStep2 = (values: any) => {
  const errors: any = {}
  if (!values.password) errors.password = 'Required'
  else if (values.password.length < 8)
    errors.password = 'Password must be at least 8 characters'

  if (!values.confirmPassword) errors.confirmPassword = 'Required'
  else if (values.password !== values.confirmPassword)
    errors.confirmPassword = 'Passwords do not match'

  return errors
}

const validateStep3 = (values: any) => {
  const errors: any = {}
  if (!values.username) errors.username = 'Required'
  else if (values.username.length < 4)
    errors.username = 'Username must be at least 4 characters'
  // Bio is optional, so no validation needed
  return errors
}

export default function OpenSignUpComponent() {
  const org = useOrg() as any
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const searchParams = useSearchParams()

  const oauthErrorMessage = useMemo(() => {
    const code = searchParams?.get('error') || ''
    const description = searchParams?.get('error_description') || ''

    const messages: Record<string, string> = {
      OAuthSignin: 'Keycloak sign-in failed. Check realm/issuer/client settings.',
      OAuthCallback: 'Keycloak callback failed. Check redirect URI and client config.',
      OAuthCreateAccount: 'Could not create account. Please try again.',
      OAuthAccountNotLinked: 'Account already exists with a different sign-in method.',
      AccessDenied: 'Access denied. Please contact an administrator.',
      Configuration: 'Authentication is misconfigured. Check Keycloak env vars.',
      Verification: 'Verification failed. Please try again.',
    }

    if (!code && !description) {
      return ''
    }

    if (description) {
      if (description.includes('Realm does not exist')) {
        return 'Keycloak realm does not exist. Check LEARNHOUSE_KEYCLOAK_ISSUER.'
      }
      return `${messages[code] || 'Authentication error.'} (${description})`
    }

    return messages[code] || 'Authentication error. Please try again.'
  }, [searchParams])

  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
      bio: '',
    },
    validate: (values) => {
      switch (currentStep) {
        case 1:
          return validateStep1(values)
        case 2:
          return validateStep2(values)
        case 3:
          return validateStep3(values)
        default:
          return {}
      }
    },
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1)
        setError('')
        return
      }

      // Final submission
      setError('')
      setMessage('')
      setIsSubmitting(true)
      const res = await signup(values)
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

  useEffect(() => {
    // Revalidate when step changes
    formik.validateForm()
  }, [currentStep, org, formik])

  useEffect(() => {
    if (oauthErrorMessage && !error) {
      setError(oauthErrorMessage)
    }
  }, [oauthErrorMessage, error])

  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 1:
        return !validateStep1(formik.values).email && formik.values.email
      case 2:
        return !validateStep2(formik.values).password && !validateStep2(formik.values).confirmPassword && formik.values.password && formik.values.confirmPassword
      case 3:
        return !validateStep3(formik.values).username && formik.values.username
      default:
        return false
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError('')
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Enter your email'
      case 2:
        return 'Create a password'
      case 3:
        return 'Complete your profile'
      default:
        return 'Sign Up'
    }
  }

  const getButtonText = () => {
    if (isSubmitting) return 'Creating Account...'
    return currentStep === 3 ? 'Create Account' : 'Continue'
  }

  return (
    <div className="bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] border-2 border-[#707070] rounded-xl shadow-[0_4px_0_#454545] w-full max-w-[95vw] sm:max-w-[45rem] md:max-w-[52.5rem] p-10 sm:p-12 md:p-16">
      {/* Header with step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center text-[#454545] hover:text-[#e25a26] transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" aria-hidden="true" />
              Back
            </button>
          )}
          <div className="flex space-x-2 ml-auto">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full ${step === currentStep
                    ? 'bg-[#e25a26]'
                    : step < currentStep
                      ? 'bg-[#454545]'
                      : 'bg-[#d0d0d0]'
                  }`}
              />
            ))}
          </div>
        </div>
        <h2 className="text-lg font-semibold text-[#242424]">{getStepTitle()}</h2>
        <p className="text-sm text-[#666666]">Step {currentStep} of 3</p>
      </div>

      {/* Error / Success Messages */}
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
              <AlertDescription>{message}</AlertDescription>
            </div>
            <div className="w-full border-t border-green-200 my-2" />
            <Link
              href={`/login?orgslug=${org?.slug}`}
              className="flex items-center justify-center space-x-2 bg-green-100 rounded-md py-2 hover:bg-green-200 transition-colors"
            >
              <UserRound size={14} />
              <span>Login to your account</span>
            </Link>
          </div>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        {/* Step 1: Email */}
        {currentStep === 1 && (
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-[#242424]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] h-4 w-4" aria-hidden="true" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.email && formik.errors.email
                    ? 'border-[#E25A26]'
                    : ''
                  }`}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.email}
                autoComplete="email"
                inputMode="email"
                required
                aria-required="true"
                aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
                aria-describedby={formik.touched.email && formik.errors.email ? 'email-error' : undefined}
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <p id="email-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.email}</p>
            )}
          </div>
        )}

        {/* Step 2: Password */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-[#242424]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] h-4 w-4" aria-hidden="true" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create a strong password"
                  className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.password && formik.errors.password
                      ? 'border-[#E25A26]'
                      : ''
                    }`}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.password}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(formik.touched.password && formik.errors.password)}
                  aria-describedby={formik.touched.password && formik.errors.password ? 'password-error' : undefined}
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </div>
              {formik.touched.password && formik.errors.password && (
                <p id="password-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#242424]">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] h-4 w-4" aria-hidden="true" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.confirmPassword && formik.errors.confirmPassword
                      ? 'border-[#E25A26]'
                      : ''
                    }`}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.confirmPassword}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(formik.touched.confirmPassword && formik.errors.confirmPassword)}
                  aria-describedby={formik.touched.confirmPassword && formik.errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </div>
              {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                <p id="confirmPassword-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.confirmPassword}</p>
              )}
            </div>

            <p className="text-xs text-[#666666] mt-1">
              Password must be at least 8 characters long
            </p>
          </div>
        )}

        {/* Step 3: Username and Bio */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {/* Username */}
            <div className="space-y-1">
              <label htmlFor="username" className="block text-sm font-medium text-[#242424]">
                Username
              </label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] h-4 w-4" aria-hidden="true" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.username && formik.errors.username
                      ? 'border-[#E25A26]'
                      : ''
                    }`}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.username}
                  autoComplete="username"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(formik.touched.username && formik.errors.username)}
                  aria-describedby={formik.touched.username && formik.errors.username ? 'username-error' : undefined}
                />
              </div>
              {formik.touched.username && formik.errors.username && (
                <p id="username-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.username}</p>
              )}
            </div>

            {/* Bio (Optional) */}
            <div className="space-y-1">
              <label htmlFor="bio" className="block text-sm font-medium text-[#242424]">
                Bio <span className="text-[#666666] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-[#666666] h-4 w-4" aria-hidden="true" />
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us a bit about yourself (optional)"
                  className="min-h-[80px] pl-10 border border-[#626262] rounded-md w-full"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.bio}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!isCurrentStepValid() || isSubmitting}
          className="w-full h-10 bg-[#e25a26] rounded-md shadow-[0_4px_0_#c94918] text-white font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Creating Account...
            </>
          ) : (
            getButtonText()
          )}
        </Button>
      </form>

      {/* OR Divider */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-[#666666]"></div>
        <span className="px-4 text-[#666666] font-medium">OR</span>
        <div className="flex-1 border-t border-[#666666]"></div>
      </div>

      {/* HPI Keycloak Login */}
      <HpiKeycloakButton className="mb-6" onError={setError} />

      <p className="text-center font-semibold text-sm text-[#454545]">
        Already have an account?{' '}
        <Link
          href={`/login?orgslug=${org?.slug}`}
          className="font-semibold text-[#e25a26] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
