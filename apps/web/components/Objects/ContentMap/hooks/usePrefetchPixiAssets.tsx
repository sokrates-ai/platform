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

const isGifUrl = (url: string) => /\.gif(?:$|[?#])/i.test(url)

export default function usePrefetchPixiAssets(
  urls: string[],
  enabled = true,
) {
  const normalizedUrls = useMemo(() => normalizeUrls(urls), [urls])
  const [ready, setReady] = useState(
    !enabled || normalizedUrls.length === 0,
  )

  useEffect(() => {
    if (!enabled) {
      setReady(true)
      return
    }

    if (normalizedUrls.length === 0) {
      setReady(true)
      return
    }

    const gifUrls = normalizedUrls.filter(isGifUrl)
    gifUrls.forEach((url) => {
      PIXI.Texture.from(url)
    })

    const toLoad = normalizedUrls.filter(
      (url) => !isGifUrl(url) && !PIXI.Assets.get(url),
    )
    if (toLoad.length === 0) {
      setReady(true)
      return
    }

    let active = true
    setReady(false)

    Promise.allSettled(toLoad.map((url) => PIXI.Assets.load(url))).then(() => {
      if (active) {
        setReady(true)
      }
    })

    return () => {
      active = false
    }
  }, [enabled, normalizedUrls])

  return ready
}
