import { getCourseMetadata } from '@services/courses/courses'
import { getSpriteUrl } from '@components/Objects/ContentMap/utils/spriteUrl'

type CourseLike = {
  course_uuid?: string
  map_state?: unknown
  mapState?: unknown
  tab_store?: unknown
  tabStore?: unknown
}

type ConnectionInformation = {
  effectiveType?: string
  saveData?: boolean
}

const prefetchPromises = new Map<string, Promise<void>>()
const MAX_PREFETCH_ASSETS = 32
const ASSET_LOAD_CONCURRENCY = 4

const getCourseUuid = (courseUuid: string) =>
  courseUuid.startsWith('course_') ? courseUuid.slice('course_'.length) : courseUuid

const isAssetFilename = (value: string) =>
  /\.(avif|gif|jpeg|jpg|png|svg|webp)(\?.*)?$/i.test(value)

const extractAssetUrls = (value: unknown, urls: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach((item) => extractAssetUrls(item, urls))
    return
  }

  if (!value || typeof value !== 'object') return

  const record = value as Record<string, unknown>
  if (typeof record.file === 'string' && isAssetFilename(record.file)) {
    urls.add(getSpriteUrl(record.file))
  }

  Object.values(record).forEach((item) => extractAssetUrls(item, urls))
}

export const extractCourseAssetUrls = (course: CourseLike) => {
  const urls = new Set<string>()
  extractAssetUrls(course.map_state ?? course.mapState, urls)
  extractAssetUrls(course.tab_store ?? course.tabStore, urls)
  return Array.from(urls)
}

export const canPrefetchFullCourse = () => {
  if (typeof window === 'undefined') return false
  if (window.innerWidth < 768) return false
  if (window.matchMedia('(pointer: coarse)').matches) return false

  const connection = (
    navigator as Navigator & { connection?: ConnectionInformation }
  ).connection
  if (connection?.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
}

const loadCourseCode = async () => {
  await import(
    '../../app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/courseStartedView'
  )
}

const loadAssetsWithConcurrency = async (urls: string[]) => {
  const PIXI = await import('pixi.js')
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex++
      await PIXI.Assets.load(urls[index]).catch(() => undefined)
    }
  }

  const workerCount = Math.min(ASSET_LOAD_CONCURRENCY, urls.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
}

export const prefetchCourseExperience = (
  courseUuid: string,
  accessToken?: string,
  loadAssets = canPrefetchFullCourse(),
) => {
  const normalizedUuid = getCourseUuid(courseUuid)
  const existing = prefetchPromises.get(normalizedUuid)
  if (existing) return existing

  const promise = (async () => {
    const metadataPromise = getCourseMetadata(
      normalizedUuid,
      { revalidate: 0 },
      accessToken ?? null,
    )

    await Promise.all([loadCourseCode(), metadataPromise])
    if (!loadAssets) return

    const metadata = await metadataPromise
    const assetUrls = extractCourseAssetUrls(metadata).slice(0, MAX_PREFETCH_ASSETS)
    if (assetUrls.length === 0) return

    await loadAssetsWithConcurrency(assetUrls)
  })().catch(() => undefined)

  prefetchPromises.set(normalizedUuid, promise)
  return promise
}

export const scheduleIdleTask = (callback: () => void) => {
  if (typeof window === 'undefined') return () => undefined

  const idleCallback = window.requestIdleCallback
  if (idleCallback) {
    const id = idleCallback(callback, { timeout: 4000 })
    return () => window.cancelIdleCallback(id)
  }

  const timeoutId = window.setTimeout(callback, 2000)
  return () => window.clearTimeout(timeoutId)
}
