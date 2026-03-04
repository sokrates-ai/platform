'use client'

import React from 'react'
import { signIn } from 'next-auth/react'

import { Button } from '@/components/ui/button'

type HpiKeycloakButtonProps = {
  className?: string
  onError?: (message: string) => void
}

export default function HpiKeycloakButton({
  className = '',
  onError,
}: HpiKeycloakButtonProps) {
  const getErrorMessage = (code?: string) => {
    const messages: Record<string, string> = {
      OAuthSignin: 'Keycloak sign-in failed. Check realm/issuer/client settings.',
      OAuthCallback: 'Keycloak callback failed. Check redirect URI and client config.',
      OAuthCreateAccount: 'Could not create account. Please try again.',
      OAuthAccountNotLinked: 'Account already exists with a different sign-in method.',
      AccessDenied: 'Access denied. Please contact an administrator.',
      Configuration: 'Authentication is misconfigured. Check Keycloak env vars.',
      Verification: 'Verification failed. Please try again.',
    }

    if (!code) {
      return 'Authentication error. Please try again.'
    }

    return messages[code] || 'Authentication error. Please try again.'
  }

  return (
    <Button
      variant="outline"
      className={`w-full h-12 border-2 border-[#707070] bg-white hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2 ${className}`}
      type="button"
      onClick={async () => {
        try {
          const res = await signIn('keycloak', {
            callbackUrl: '/redirect_from_auth',
            redirect: false,
          })

          if (res?.url) {
            window.location.href = res.url
            return
          }

          if (res?.error) {
            onError?.(getErrorMessage(res.error))
            return
          }

          onError?.('Keycloak sign-in failed. Please try again.')
        } catch (err) {
          onError?.('Keycloak sign-in failed. Check realm/issuer/client settings.')
        }
      }}
    >
      <img src="hpi-logo.png" alt="HPI" className="w-5 h-5" />
      <span className="text-[#454545] font-medium">HPI Keycloak</span>
    </Button>
  )
}
