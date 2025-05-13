'use client'
import '../styles/globals.css'
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry'
import { motion } from 'framer-motion'
import { SessionProvider } from 'next-auth/react'
import LHSessionProvider from '@components/Contexts/LHSessionContext'
import Script from 'next/script'
import { isDevEnv } from '@services/config/config'
import { PostHogProvider } from '@components/Posthog/PosthogProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const variants = {
    hidden: { opacity: 0, x: 0, y: 0 },
    enter: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 0, y: 0 },
  }

  const isStaging = (typeof window !== 'undefined' && (window.location.hostname.includes('staging')))

  return (
    <html className="" lang="en">
      {isStaging && (
        <div
          style={{
            background: 'rgba(255, 0, 0, 0.4)',
            color: 'black',
            padding: '10px',
            textAlign: 'center',
            fontWeight: 'bold',
            position: 'fixed',
            width: '100%',
            zIndex: 999,
          }}
        >
          STAGING
        </div>
      )}

      <head />

      <body style={{ marginTop: isStaging ? '40px' : 0 }}>
        <SessionProvider>
          <LHSessionProvider>
            <PostHogProvider>
              <StyledComponentsRegistry>
                <motion.main
                  variants={variants} // Pass the variant object into Framer Motion
                  initial="hidden" // Set the initial state to variants.hidden
                  animate="enter" // Animated state to variants.enter
                  exit="exit" // Exit state (used later) to variants.exit
                  transition={{ type: 'linear' }} // Set the transition to linear
                  className=""
                >
                  {children}
                </motion.main>
              </StyledComponentsRegistry>
            </PostHogProvider>
          </LHSessionProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
