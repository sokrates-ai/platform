'use client'

import '../styles/globals.css'
import 'katex/dist/katex.min.css'
import React, { useEffect, useState, ReactNode } from 'react'
import { DM_Sans } from 'next/font/google'

import { SessionProvider } from 'next-auth/react'
import { PostHogProvider } from '@components/Posthog/PosthogProvider'
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry'
import SokratesSessionProvider from '@components/Contexts/SokratesSessionContext'
import WebSocketNotifications from '@components/Notifications/WebSocketNotifications'
import { Toaster } from '@/components/ui/toaster'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  style: ['normal', 'italic'],
})

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SokratesSessionProvider>
        <PostHogProvider>
          <StyledComponentsRegistry>
            <Toaster />
            <WebSocketNotifications />
            {children}
          </StyledComponentsRegistry>
        </PostHogProvider>
      </SokratesSessionProvider>
    </SessionProvider>
  )
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [isStaging, setIsStaging] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsStaging(window.location.hostname.includes('staging'))
    }
  }, [])

  return (
    <html lang="en">
      <body className={dmSans.className}>
        {isStaging && (
          <div
            className="flex justify-between bg-red-500/50 text-black p-2.5 text-center font-black text-4xl w-full z-[999] bottom-0 overflow-x-hidden gap-4"
            style={{ position: 'absolute' }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i}>STAGING</span>
            ))}
          </div>
        )}
        <AppProviders>
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  )
}
