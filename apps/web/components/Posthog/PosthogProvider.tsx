'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef } from 'react'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import type posthog from 'posthog-js'

const apiKey = 'phc_HFcwzERJWM9IpAuyxelJdn24G2ZSbJAVDp2BV2n3SZW'
const apiHost = 'https://eu.i.posthog.com'

let posthogClient: typeof posthog | null = null
let posthogLoadPromise: Promise<typeof posthog> | null = null

const loadPostHog = async () => {
  if (posthogClient) return posthogClient
  if (!posthogLoadPromise) {
    posthogLoadPromise = import('posthog-js').then((module) => {
      const client = module.default
      if (!posthogClient) {
        client.init(apiKey, {
          api_host: apiHost,
          capture_pageview: false,
          capture_pageleave: true,
        })
        posthogClient = client
      }
      return client
    })
  }
  return posthogLoadPromise
}

const schedulePostHog = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const requestIdleCallback = window.requestIdleCallback
  if (requestIdleCallback) {
    const idleId = requestIdleCallback(callback, { timeout: 3000 })
    return () => window.cancelIdleCallback(idleId)
  }
  const timeoutId = window.setTimeout(callback, 1500)
  return () => window.clearTimeout(timeoutId)
}

function PostHogEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session, status }: any = useSokratesSession()
  const lastIdentifiedUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    return schedulePostHog(() => {
      void loadPostHog().then((client) => {
        let url = window.origin + pathname
        const queryString = searchParams.toString()
        if (queryString) {
          url = `${url}?${queryString}`
        }
        client.capture('$pageview', { '$current_url': url })
      })
    })
  }, [pathname, searchParams])

  useEffect(() => {
    return schedulePostHog(() => {
      void loadPostHog().then((client) => {
        if (status === 'unauthenticated' || status === 'loading') {
          if (lastIdentifiedUserRef.current) {
            client.reset()
            lastIdentifiedUserRef.current = null
          }
          return
        }

        const email = session?.user?.email
        const username = session?.user?.username
        const userId = session?.user?.user_uuid
        if (
          typeof email === 'string' &&
          typeof username === 'string' &&
          typeof userId === 'string' &&
          lastIdentifiedUserRef.current !== userId
        ) {
          client.identify(userId, { email, name: username })
          lastIdentifiedUserRef.current = userId
        }
      })
    })
  }, [session, status])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogEvents />
      </Suspense>
      {children}
    </>
  )
}
