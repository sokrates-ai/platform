'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from "next-auth/react"
import { useFormik } from 'formik'
import { AlertTriangle, UserRoundPlus, Loader2, Mail, Lock } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import AuthCard from '@components/Pages/AuthCard'

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
    errors.password = 'Required'
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  return errors
}

const LoginClient = (props: LoginClientProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter();
  const [error, setError] = useState('')

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
        setIsSubmitting(false);
      } else {
        await signIn('credentials', {
          email: values.email,
          password: values.password,
          callbackUrl: '/redirect_from_auth'
        });
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
        Sign in
      </h1>

      <AuthCard>
        {error && (
          <Alert variant="destructive" className="mb-6">
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
              />
            </div>
            {formik.touched.email && formik.errors.email && (
              <p className="text-xs text-[#E25A26] mt-1">{formik.errors.email}</p>
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
              />
            </div>
            {formik.touched.password && formik.errors.password && (
              <p className="text-xs text-[#E25A26] mt-1">{formik.errors.password}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-10 bg-[#e25a26] rounded-md shadow-[0_4px_0_#c94918] text-white font-semibold flex items-center justify-center">
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

        <Link href={`/signup?orgslug=${props.org.slug}`}>
          <Button variant="outline" className="w-full h-12 border-2 border-[#707070] bg-white hover:bg-gray-50 rounded-lg flex items-center justify-center">
            <UserRoundPlus className="mr-2 h-4 w-4" />
            Create an Account
          </Button>
        </Link>
      </AuthCard>
    </div>
  )
}

export default LoginClient