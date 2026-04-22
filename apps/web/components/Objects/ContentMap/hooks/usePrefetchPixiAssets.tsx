import { useEffect, useMemo, useState } from 'react'
import * as PIXI from 'pixi.js'

const normalizeUrls = (urls: string[]) => {
  const unique = new Set<string>()
  urls.forEach((url) => {
    if (url) {
      unique.add(url)
    }
  })
  return Array.from(unique)
}

export default function usePrefetchPixiAssets(
  urls: string[],
  enabled = true,
) {
  const normalizedUrls = useMemo(() => normalizeUrls(urls), [urls])
  const [ready, setReady] = useState(!enabled || normalizedUrls.length === 0)
  const [progressState, setProgressState] = useState({
    loaded: 0,
    total: 0,
  })

  useEffect(() => {
    if (!enabled) {
      setReady(true)
      setProgressState({ loaded: 0, total: 0 })
      return
    }

    if (normalizedUrls.length === 0) {
      setReady(true)
      setProgressState({ loaded: 0, total: 0 })
      return
    }

    const toLoad = normalizedUrls.filter((url) => !PIXI.Assets.get(url))
    if (toLoad.length === 0) {
      setReady(true)
      setProgressState({
        loaded: normalizedUrls.length,
        total: normalizedUrls.length,
      })
      return
    }

    let active = true
    const total = normalizedUrls.length
    const cachedCount = total - toLoad.length
    setReady(false)
    setProgressState({ loaded: cachedCount, total })

    const loadPromises = toLoad.map(async (url) => {
      try {
        await PIXI.Assets.load(url)
      } finally {
        if (active) {
          setProgressState((prev) => ({
            loaded: Math.min(prev.loaded + 1, total),
            total,
          }))
        }
      }
    })

    Promise.allSettled(loadPromises).then(() => {
      if (active) {
        setReady(true)
      }
    })

    return () => {
      active = false
    }
  }, [enabled, normalizedUrls])

  const { loaded, total } = progressState
  const progress = total > 0 ? loaded / total : 1

  return {
    ready,
    progress,
    loaded,
    total,
  }
}
