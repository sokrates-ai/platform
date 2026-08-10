'use client'
import React, { useEffect, useState } from 'react'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import OpenSignUpComponent from './OpenSignup'
import InviteOnlySignUpComponent from './InviteOnlySignUp'
import NoTokenScreen from './NoToken'

interface SignUpClientProps {
  org: any
  inviteCode?: string
}

export default function SignUpClient({
  org,
  inviteCode: inviteCodeProp,
}: SignUpClientProps) {
  const session = useSokratesSession() as any
  const [inviteCode, setInviteCode] = useState(inviteCodeProp || '')
  const [mode, setMode] = useState<'open' | 'inviteOnly'>('open')

  useEffect(() => {
    if (org?.config?.features?.members?.signup_mode) {
      setMode(org.config.features.members.signup_mode)
    }
  }, [org])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-8">
      {/* Page headline */}
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
        Sign up
      </h1>

      {/* Choose flow */}
      {mode === 'open' ? (
        <OpenSignUpComponent />
      ) : inviteCode ? (
        <InviteOnlySignUpComponent inviteCode={inviteCode} />
      ) : (
        <NoTokenScreen org={org} />
      )}
    </div>
  )
}
