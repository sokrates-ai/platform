import { useOrg } from '@components/Contexts/OrgContext'
import React from 'react'

interface UseGetAIFeatures {
  feature: 'editor' | 'activity_ask' | 'course_ask' | 'global_ai_ask'
}

function useGetAIFeatures(props: UseGetAIFeatures) {
  const org = useOrg() as any
  const [isEnabled, setisEnabled] = React.useState(false)

  const checkAvailableAIFeaturesOnOrg = React.useCallback((feature: string) => {
    const config = org?.config?.config?.features.ai.enabled

    return config
  }, [org])

  React.useEffect(() => {
    if (org) {
      // Check if org is not null or undefined
      let isEnabledStatus = checkAvailableAIFeaturesOnOrg(props.feature)
      setisEnabled(isEnabledStatus)
    }
  }, [checkAvailableAIFeaturesOnOrg, org, props.feature])

  return isEnabled
}

export default useGetAIFeatures
