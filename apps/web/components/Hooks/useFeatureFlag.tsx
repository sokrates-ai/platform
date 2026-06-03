'use client'

import React, { createContext, useContext, useMemo } from 'react'
import useSWR from 'swr'
import { useOrg } from '@components/Contexts/OrgContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'

export type FeatureFlagKey = 'pride_mode'
type FeatureFlagMap = Record<FeatureFlagKey, boolean>

const DEFAULT_FLAGS: FeatureFlagMap = {
  pride_mode: false,
}

const FeatureFlagsContext = createContext<FeatureFlagMap>(DEFAULT_FLAGS)

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const session = useSokratesSession() as any
  const org = useOrg() as any
  const accessToken = session?.data?.tokens?.access_token
  const shouldFetch = session?.status === 'authenticated' && org?.id
  const key = shouldFetch
    ? `${getAPIUrl()}features/effective?org_id=${org.id}`
    : null

  const { data } = useSWR(
    key,
    (url: string) => swrFetcher(url, accessToken),
  )

  const flags = useMemo(
    () => ({
      ...DEFAULT_FLAGS,
      ...(data?.flags ?? {}),
    }),
    [data?.flags],
  )

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlag(key: FeatureFlagKey) {
  const flags = useContext(FeatureFlagsContext)
  return flags[key] ?? false
}

export default useFeatureFlag
