'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from "next-auth/react"
import { useFormik } from 'formik'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, UserRoundPlus, Loader2, Mail, Lock } from 'lucide-react'

import whiteLogo from 'public/white_logo.svg'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const session = useLHSession() as any;
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
    <div className="grid md:grid-cols-2 min-h-screen">
      {/* Left side (dark background) */}
      <div
        className="bg-gradient-to-br from-gray-800 to-black flex flex-col justify-between p-6 md:p-10"
      >
        <div className="login-topbar flex justify-center md:justify-start">
          <Link prefetch href={getUriWithOrg(props.org.slug, '/')}>
            <Image
              quality={100}
              width={120}
              height={120}
              src={whiteLogo}
              alt="Logo"
              className="hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center text-white py-10 md:py-0">
          <div className="text-center hidden md:block">
            <div className="flex items-center space-x-2">
              <p className="text-lg md:text-2xl">Login to your</p>
              <Image
                quality={100}
                width={120}
                height={120}
                src={whiteLogo}
                alt="Logo"
                className="hover:opacity-80 transition-opacity"
              />
              <p className="text-lg md:text-2xl">Account</p>
            </div>
          </div>
        </div>
        <div className="hidden md:block"> {/* Spacer for desktop layout */}
        </div>
      </div>

      {/* Right side (white background) */}
      <div className="bg-white flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md shadow-none border-none">
          <CardHeader className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-center">
              Welcome Back!
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Great to see you again. Let's get you back into your account.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={formik.handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    className={`pl-10 ${formik.touched.email && formik.errors.email ? 'border-red-500' : ''}`}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.email}
                  />
                </div>
                {formik.touched.email && formik.errors.email && (
                  <p className="text-xs text-red-500 mt-1">{formik.errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  {/* <Link
                    href={{
                      pathname: getUriWithoutOrg('/forgot'),
                      query: props.org.slug ? { orgslug: props.org.slug } : null
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link> */}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className={`pl-10 ${formik.touched.password && formik.errors.password ? 'border-red-500' : ''}`}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                  />
                </div>
                {formik.touched.password && formik.errors.password && (
                  <p className="text-xs text-red-500 mt-1">{formik.errors.password}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-muted-foreground">
                OR
              </span>
            </div>

            <Link
              href={{
                pathname: getUriWithoutOrg('/signup'),
                query: props.org.slug ? { orgslug: props.org.slug } : null
              }}
            >
              <Button variant="outline" className="w-full">
                <UserRoundPlus className="mr-2 h-4 w-4" />
                Create an Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LoginClient