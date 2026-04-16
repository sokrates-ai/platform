'use client'

import '../styles/globals.css'
import React, { useEffect, useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
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

  const variants = {
    hidden: { opacity: 0 },
    enter: { opacity: 1 },
    exit: { opacity: 0 },
  }

  return (
    <html className={dmSans.className} lang="en">
      <body>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;0,900;1,400;1,500;1,700;1,900&display=swap"
          rel="stylesheet"
        />
        {isStaging && (
          <div
            className="flex justify-between bg-red-500/50 text-black p-2.5 text-center font-black text-4xl absolute w-full z-[999] bottom-0 overflow-x-hidden gap-4"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i}>STAGING</span>
            ))}
          </div>
        )}
        <AppProviders>
          <motion.main
            variants={variants}
            initial="hidden"
            animate="enter"
            exit="exit"
            transition={{ type: 'linear' }}
          >
            {children}
          </motion.main>
        </AppProviders>
      </body>
    </html>
  )
}
