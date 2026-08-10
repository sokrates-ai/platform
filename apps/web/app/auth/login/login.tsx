'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from "next-auth/react"
import { useFormik } from 'formik'
import { AlertTriangle, Loader2, Mail, Lock } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import AuthCard from '@components/Pages/AuthCard'
import HpiKeycloakButton from '@components/Pages/HpiKeycloakButton'

interface LoginClientProps {
  org: any
}

const validate = (values: any) => {
  const errors: any = {}

  if (!values.email) {
    errors.email = 'Required'
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = 'Invalid email address'
  }

  if (!values.password) {
    errors.password = 'Password is Required'
  } 

  return errors
}

const LoginClient = (props: LoginClientProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter();
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (oauthErrorMessage && !error) {
      setError(oauthErrorMessage)
    }
  }, [oauthErrorMessage, error])

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values, { validateForm, setErrors, setSubmitting }) => {
      setIsSubmitting(true)
      const errors = await validateForm(values);
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        setSubmitting(false);
        setIsSubmitting(false);
        return;
      }

      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: '/redirect_from_auth'
      });

      if (res && res.error) {
        setError("Wrong Email or password");
        setSubmitting(false)
        setIsSubmitting(false);
      } else {
        router.push('/redirect_from_auth')
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
        Sign in
      </h1>

      <AuthCard>
        {error && (
          <Alert variant="destructive" className="mb-6" role="alert" aria-live="assertive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-[#242424]">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] h-4 w-4" aria-hidden="true" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.email && formik.errors.email ? 'border-[#E25A26]' : ''}`}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.email}
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
                aria-describedby={formik.touched.email && formik.errors.email ? 'login-email-error' : undefined}
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <p id="login-email-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.email}</p>
            )}
          </div>

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
                placeholder="••••••••"
                className={`h-10 pl-10 border border-[#626262] rounded-md w-full ${formik.touched.password && formik.errors.password ? 'border-[#E25A26]' : ''}`}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.password}
                autoComplete="current-password"
                required
                aria-required="true"
                aria-invalid={Boolean(formik.touched.password && formik.errors.password)}
                aria-describedby={formik.touched.password && formik.errors.password ? 'login-password-error' : undefined}
              />
            </div>
            {formik.touched.password && formik.errors.password && (
              <p id="login-password-error" role="alert" aria-live="polite" className="text-xs text-[#E25A26] mt-1">{formik.errors.password}</p>
            )}
          </div>

          <div className="flex justify-end -mt-1">
            <Link
              href={`/forgot?orgslug=${encodeURIComponent(props.org?.slug || 'default')}`}
              className="text-sm font-semibold text-[#8f3518] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f3518] rounded"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-10 bg-[#b7471f] hover:bg-[#9f3d1b] rounded-md shadow-[0_4px_0_#7f2f15] text-white font-semibold flex items-center justify-center">
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Please wait...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-[#666666]"></div>
          <span className="px-4 text-[#666666] font-medium">OR</span>
          <div className="flex-1 border-t border-[#666666]"></div>
        </div>

        <HpiKeycloakButton className="mb-6" onError={setError} />

        <p className="text-center font-semibold text-sm text-[#454545]">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup?orgslug=${props.org.slug}`}
            className="font-semibold text-[#e25a26] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </AuthCard>
    </div>
  )
}

export default LoginClient
