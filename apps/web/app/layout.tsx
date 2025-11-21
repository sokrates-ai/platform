'use client'

import '../styles/globals.css'
import React, { useEffect, useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { DM_Sans } from 'next/font/google'

import { SessionProvider } from 'next-auth/react'
import { PostHogProvider } from '@components/Posthog/PosthogProvider'
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry'
import SokratesSessionProvider from '@components/Contexts/SokratesSessionContext'
import { IntlProvider } from 'next-intl'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  style: ['normal', 'italic'],
})

function AppProviders({ children, locale }: { children: ReactNode; locale: string }) {
  let messages
  try {
    messages = require(`../messages/${locale}.json`)
  } catch {
    messages = require(`../messages/en.json`)
  }

  return (
    <IntlProvider messages={messages} locale={locale}>
      <SessionProvider>
        <SokratesSessionProvider>
          <PostHogProvider>
            <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
          </PostHogProvider>
        </SokratesSessionProvider>
      </SessionProvider>
    </IntlProvider>
  )
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [isStaging, setIsStaging] = useState(false)
  const [locale, setLocale] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsStaging(window.location.hostname.includes('staging'))

    const cookieMatch = document.cookie.match(/(?:^|; )locale=([^;]*)/)
    let detectedLocale: string | null = null

    if (cookieMatch && /^[a-z]{2}$/i.test(cookieMatch[1])) {
      detectedLocale = cookieMatch[1].toLowerCase()
      console.log('Locale from cookie:', detectedLocale)

      // Check against current browser locale (Intl preferred)
      const navLocale =
        (Intl.DateTimeFormat().resolvedOptions().locale ||
          navigator.language ||
          (navigator.languages?.[0] ?? '')).slice(0, 2).toLowerCase()

      if (navLocale && navLocale !== detectedLocale) {
        detectedLocale = navLocale
        document.cookie = `locale=${detectedLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
        console.log('Cookie updated to match browser:', detectedLocale)
      }
    } else {
      // Fallback: detect from browser language (Intl first)
      const nav =
        Intl.DateTimeFormat().resolvedOptions().locale ||
        navigator.language ||
        (navigator.languages?.[0] ?? '') ||
        'en'

      const codeMatch = nav.match(/^([a-z]{2})/i)
      const code = codeMatch ? codeMatch[1].toLowerCase() : 'en'
      detectedLocale = code
      console.log('Locale from browser:', nav, '->', detectedLocale)

      // Persist detected locale to cookie for future visits
      document.cookie = `locale=${detectedLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
    }

    setLocale(detectedLocale)
  }, [])

  if (!locale) return null

  const variants = {
    hidden: { opacity: 0 },
    enter: { opacity: 1 },
    exit: { opacity: 0 },
  }

  return (
    <html className={dmSans.className} lang={locale}>
      <body>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;0,900;1,400;1,500;1,700;1,900&display=swap"
          rel="stylesheet"
        />
        {isStaging && (
          <div className="flex justify-between bg-red-500/50 text-black p-2.5 text-center font-black text-4xl absolute w-full z-[999] bottom-0 overflow-x-hidden gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i}>STAGING</span>
            ))}
          </div>
        )}
        <AppProviders locale={locale}>
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
