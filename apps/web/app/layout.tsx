'use client'

import '../styles/globals.css'
import React, { useEffect, useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { DM_Sans } from 'next/font/google'

import { SessionProvider } from 'next-auth/react'
import { PostHogProvider } from '@components/Posthog/PosthogProvider'
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry'
import SokratesSessionProvider from '@components/Contexts/SokratesSessionContext'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
})

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SokratesSessionProvider>
        <PostHogProvider>
          <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
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
        {isStaging && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'rgba(255, 0, 0, 0.5)',
              color: 'black',
              padding: '10px',
              textAlign: 'center',
              fontWeight: 'bolder',
              fontSize: '2rem',
              position: 'absolute',
              width: '100%',
              zIndex: 999,
              bottom: 0,
              overflowX: 'hidden',
              gap: '1rem',
            }}
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