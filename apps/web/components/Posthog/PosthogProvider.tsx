'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import PostHogPageView from "./PosthogPageView"
import PosthogIdentity  from './PosthogIdentify'

const apiKey = 'phc_HFcwzERJWM9IpAuyxelJdn24G2ZSbJAVDp2BV2n3SZW';
const apiHost = 'https://eu.i.posthog.com';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
      posthog.init(apiKey, {
        api_host: apiHost,
        
        // Disable automatic pageview capture, as we capture manually
        capture_pageview: false,
        
        // Disabling automatic pageview capture, disables capture of pageleave
        // Therefore, we manually activate it
        capture_pageleave: true, 
      })
  }, [])

  return (
    <PHProvider client={posthog}>
        <PostHogPageView/>
        <PosthogIdentity/>
      {children}
    </PHProvider>
  )
}