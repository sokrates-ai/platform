'use client'

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation' // ✅ import hook
import { Button } from '@/components/ui/button'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import { DoorOpen, EyeOff, Menu, X } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import usePrefetchPixiAssets from '@components/Objects/ContentMap/hooks/usePrefetchPixiAssets'
import { AnimatePresence, motion } from 'framer-motion'
import type { Viewport } from 'pixi-viewport'
import {
  DEFAULT_CHAPTER_STONE_ICON,
  DEFAULT_CHAPTER_STONE_THEME,
} from '@components/Objects/ContentMap/assets/ChapterStoneAsset'
import { getSpriteUrl } from '@components/Objects/ContentMap/utils/spriteUrl'
import type { AssetData } from '@components/Objects/ContentMap/Asset/assetTypes'
import {
  buildActivityTabIndex,
  getCourseFallbackTabId,
  isActivityDone,
  isChapterLocked,
  resolveChapterTabId,
} from '@components/Pages/Courses/utils'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { updateCourseCanvasInteractionState } from '@services/courses/courses'
import CourseChapter from '@components/Pages/Courses/CourseChapter'
import { cn } from '@/lib/utils'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/CourseTabSelector'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'

const DEFAULT_BOUNDARIES = {
  left: -1000,
  right: 1000,
  top: -1000,
  bottom: 1000,
}

type Props = {
  courseuuid: string
  orgslug: string
  course: any
  selectedChapterId: number | null
  selectedTabId: string | null
}

const CourseStartedView = ({
  courseuuid,
  orgslug,
  course,
  selectedChapterId,
  selectedTabId,
}: Props) => {
  const searchParams = useSearchParams()
  const chapterParam = searchParams.get('chapter') // ✅ read from URL
  const chapterFromUrl = chapterParam ? parseInt(chapterParam, 10) : null
  const initialTabParamRef = useRef(searchParams.get('tab'))

  const rawTabMetadata = useMemo(
    () =>
      course?.tabMetadata ??
      course?.tab_metadata ??
      course?.courseStructure?.tabMetadata ??
      course?.courseStructure?.tab_metadata ??
      [],
    [course],
  )

  const normalizedTabs = useMemo(() => {
    const baseArray = Array.isArray(rawTabMetadata)
      ? rawTabMetadata
      : DEFAULT_COURSE_TABS

    const deduped = baseArray
      .map((tab: any, index: number) => {
        const tabId =
          tab?.id ??
          tab?.tab_uuid ??
          tab?.tabUuid ??
          tab?.tabUUID ??
          `tab-${index + 1}`
        const visibleAfter =
          tab?.visibleAfter ??
          tab?.visible_after ??
          tab?.visible_after_at ??
          null
        const manualVisible =
          typeof tab?.visibility === 'boolean'
            ? tab.visibility
            : typeof tab?.visible === 'boolean'
            ? tab.visible
            : true
        const parsedVisibleAfter =
          typeof visibleAfter === 'string' || visibleAfter instanceof Date
            ? new Date(visibleAfter)
            : null
        const hasValidDate =
          parsedVisibleAfter instanceof Date &&
          !Number.isNaN(parsedVisibleAfter.getTime())
        const today = new Date()
        const todayDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        )
        const visibleAfterDate =
          hasValidDate
            ? new Date(
                parsedVisibleAfter.getFullYear(),
                parsedVisibleAfter.getMonth(),
                parsedVisibleAfter.getDate(),
              )
            : null
        const derivedVisible =
          manualVisible &&
          (!visibleAfterDate || visibleAfterDate <= todayDate)
        const effectiveVisible =
          typeof tab?.is_visible === 'boolean'
            ? tab.is_visible
            : typeof tab?.isVisible === 'boolean'
            ? tab.isVisible
            : derivedVisible
        return {
          id: tabId,
          name: tab?.name ?? `Tab ${index + 1}`,
          position:
            typeof tab?.position === 'number' ? tab.position : index,
          visible: manualVisible,
          visibleAfter,
          isVisible: effectiveVisible,
        }
      })
      .filter((tab) => !!tab.id)

    if (deduped.length === 0) {
      return DEFAULT_COURSE_TABS.map((tab, index) => ({
        ...tab,
        position: index,
      }))
    }

    return deduped.sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    )
  }, [rawTabMetadata])

  const rawTabStore = useMemo(
    () =>
      course?.tabStore ??
      course?.tab_store ??
      course?.courseStructure?.tabStore ??
      course?.courseStructure?.tab_store ??
      {},
    [course],
  )

  const tabMaps = useMemo(() => {
    const fallbackMap =
      course?.map_state ??
      course?.courseStructure?.map_state ?? {
        objects: [],
        boundaries: { ...DEFAULT_BOUNDARIES },
      }

    return normalizedTabs.reduce<Record<string, { objects: any[]; boundaries: any }>>(
      (acc, tab) => {
        const raw = rawTabStore?.[tab.id]
        const candidate =
          (raw && typeof raw === 'object' && 'map' in raw && raw.map) ||
          (raw && typeof raw === 'object' && 'map_state' in raw && raw.map_state) ||
          (raw && typeof raw === 'object' && 'objects' in raw && raw) ||
          undefined

        const mapObjects = Array.isArray(candidate?.objects)
          ? candidate.objects
          : Array.isArray(fallbackMap?.objects)
          ? fallbackMap.objects
          : []

        const mapBoundaries = {
          left:
            candidate?.boundaries?.left ??
            fallbackMap?.boundaries?.left ??
            DEFAULT_BOUNDARIES.left,
          right:
            candidate?.boundaries?.right ??
            fallbackMap?.boundaries?.right ??
            DEFAULT_BOUNDARIES.right,
          top:
            candidate?.boundaries?.top ??
            fallbackMap?.boundaries?.top ??
            DEFAULT_BOUNDARIES.top,
          bottom:
            candidate?.boundaries?.bottom ??
            fallbackMap?.boundaries?.bottom ??
            DEFAULT_BOUNDARIES.bottom,
        }

        acc[tab.id] = {
          objects: mapObjects,
          boundaries: mapBoundaries,
        }
        return acc
      },
      {},
    )
  }, [normalizedTabs, rawTabStore, course])

  const tabs = useMemo(() => {
    if (normalizedTabs.length) {
      return normalizedTabs
    }
    return [
      {
        id: 'default-map',
        name: 'Map',
        isVisible: true,
      },
    ]
  }, [normalizedTabs])

  const { isCourseStaff } = useCourseStaffStatus()
  const canSeeHiddenTabs = Boolean(isCourseStaff)

  const visibleTabs = useMemo(() => {
    if (canSeeHiddenTabs) {
      return tabs
    }
    return tabs.filter((tab) => 'isVisible' in tab && tab.isVisible !== false)
  }, [canSeeHiddenTabs, tabs])

  const fallbackTabId = useMemo(() => {
    if (visibleTabs.length > 0 && visibleTabs[0]?.id) {
      return visibleTabs[0].id
    }
    return getCourseFallbackTabId(course)
  }, [visibleTabs, course])

  const initialSelectedTab = useMemo(() => {
    const initialTabParam = initialTabParamRef.current
    if (initialTabParam && visibleTabs.some((tab) => tab.id === initialTabParam)) {
      return initialTabParam
    }
    if (selectedTabId && visibleTabs.some((tab) => tab.id === selectedTabId)) {
      return selectedTabId
    }
    return fallbackTabId ?? 'default-map'
  }, [fallbackTabId, visibleTabs, selectedTabId])

  const [selectedTab, setSelectedTab] = useState(initialSelectedTab)
  const selectedTabRef = useRef(selectedTab)
  selectedTabRef.current = selectedTab
  
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shouldPersistCanvasRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!visibleTabs.length) {
      return
    }
    if (!visibleTabs.some((tab) => tab.id === selectedTab)) {
      setSelectedTab(visibleTabs[0].id)
    }
  }, [visibleTabs, selectedTab])

  // URL-driven tab selection is applied only on initial load.

  const courseIdWithoutPrefix = courseuuid.replace('course_', '')

  const chapterStates = useMemo(() => {
    const result: Record<number, 'locked' | 'unlocked' | 'finished'> = {}
    const chapters = Array.isArray(course?.chapters) ? course.chapters : []
    if (!chapters.length) {
      return result
    }

    const activeTabId = selectedTab ?? fallbackTabId
    const activityTabIndex = buildActivityTabIndex(
      course,
      fallbackTabId,
    )

    chapters.forEach((chapter: any) => {
      const chapterTabId = resolveChapterTabId(
        chapter,
        course,
        fallbackTabId,
      )
      if (chapterTabId !== activeTabId) {
        return
      }

      const isLocked = isChapterLocked(chapter.id, course, {
        activeTabId,
        activityTabIndex,
        fallbackTabId,
      })

      if (isLocked) {
        result[chapter.id] = 'locked'
        return
      }

      const activities = Array.isArray(chapter?.activities)
        ? chapter.activities
        : []
      const allDone =
        activities.length > 0 &&
        activities.every((act: any) =>
          isActivityDone(
            course,
            act?.activity_uuid ??
              act?.activityUuid ??
              act?.activityUUID ??
              act?.id,
            {
              activeTabId,
              activityTabIndex,
              fallbackTabId,
            },
          ),
        )
      result[chapter.id] = allDone ? 'finished' : 'unlocked'
    })

    return result
  }, [course, selectedTab, fallbackTabId])

  const layout: LayoutState = useMemo(() => {
    const fallback = tabMaps[selectedTab] ?? {
      objects:
        Array.isArray(course?.map_state?.objects)
          ? course.map_state.objects
          : [],
      boundaries: {
        left:
          course?.map_state?.boundaries?.left ??
          DEFAULT_BOUNDARIES.left,
        right:
          course?.map_state?.boundaries?.right ??
          DEFAULT_BOUNDARIES.right,
        top:
          course?.map_state?.boundaries?.top ??
          DEFAULT_BOUNDARIES.top,
        bottom:
          course?.map_state?.boundaries?.bottom ??
          DEFAULT_BOUNDARIES.bottom,
      },
    }

    return {
      layout: Array.isArray(fallback.objects) ? fallback.objects : [],
      boundaries: {
        left: fallback.boundaries?.left ?? DEFAULT_BOUNDARIES.left,
        right:
          fallback.boundaries?.right ?? DEFAULT_BOUNDARIES.right,
        top: fallback.boundaries?.top ?? DEFAULT_BOUNDARIES.top,
        bottom:
          fallback.boundaries?.bottom ?? DEFAULT_BOUNDARIES.bottom,
      },
      updateOriginator: 'initial',
    }
  }, [tabMaps, selectedTab, course])

  const layeredLayout: LayoutState = useMemo(() => {
    const assets = Array.isArray(layout.layout) ? layout.layout : []
    if (!assets.length) {
      return layout
    }
    const chapterAssets = assets.filter(
      (asset) => asset?.type?.kind === 'chapter',
    )
    if (!chapterAssets.length) {
      return layout
    }
    const nonChapterAssets = assets.filter(
      (asset) => asset?.type?.kind !== 'chapter',
    )
    return {
      ...layout,
      layout: [...nonChapterAssets, ...chapterAssets],
    }
  }, [layout])

  const prefetchUrls = useMemo(() => {
    const urls = new Set<string>()
    const addUrl = (url?: string) => {
      if (url) {
        urls.add(url)
      }
    }

    const assets = Array.isArray(layout.layout) ? layout.layout : []
    assets.forEach((asset) => {
      if (asset?.file) {
        addUrl(getSpriteUrl(asset.file))
      }
      if (asset?.type?.kind === 'chapter') {
        Object.values(DEFAULT_CHAPTER_STONE_THEME).forEach((visual) => {
          const skin = visual?.skin
          if (!skin) return
          addUrl(skin)
          if (skin.endsWith('.svg')) {
            addUrl(skin.replace(/\.svg$/, '-pressed.svg'))
          }
        })
        addUrl(DEFAULT_CHAPTER_STONE_ICON)
      }
    })

    return Array.from(urls)
  }, [layout.layout])

  const assetsReady = usePrefetchPixiAssets(prefetchUrls, !!course)

  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [zoomPercent, setZoomPercent] = useState<number | null>(null)
  const initialZoomRef = useRef<number | null>(null)
  const isAnimatingZoomRef = useRef(false)
  const lastAnimatedKeyRef = useRef<string | null>(null)
  const hasAppliedStoredZoomRef = useRef(false)
  const MIN_ZOOM = 0.1
  const MAX_ZOOM = 1
  const ANIM_START_ZOOM = 0.05

  const zoomStorageKey = useMemo(
    () => `sokrates:course-map-zoom:${courseuuid}:${selectedTab}`,
    [courseuuid, selectedTab],
  )

  const clampScale = useCallback(
    (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)),
    [MIN_ZOOM, MAX_ZOOM],
  )

  useEffect(() => {
    if (!viewport) {
      return
    }

    const updateZoom = () => {
      const rawScale = viewport.scale.x
      const minScale = isAnimatingZoomRef.current ? ANIM_START_ZOOM : MIN_ZOOM
      const clampedScale = Math.min(
        MAX_ZOOM,
        Math.max(minScale, rawScale),
      )
      if (clampedScale !== rawScale) {
        viewport.setZoom(clampedScale, true)
      }
      setZoomPercent(Math.round(clampedScale * 100))
      if (!isAnimatingZoomRef.current && hasAppliedStoredZoomRef.current) {
        localStorage.setItem(zoomStorageKey, clampedScale.toString())
      }
    }

    const handleZoom = () => updateZoom()

    updateZoom()
    viewport.on('zoomed', handleZoom)
    viewport.on('zoomed-end', handleZoom)

    return () => {
      viewport.off('zoomed', handleZoom)
      viewport.off('zoomed-end', handleZoom)
    }
  }, [viewport, clampScale, zoomStorageKey])

  useEffect(() => {
    if (!viewport) {
      return
    }

    const clampPlugin = viewport.plugins.get('clamp-zoom', true) as
      | { options?: { minWidth?: number | null; maxWidth?: number | null }; clamp?: () => void }
      | undefined

    const applyClampRange = (minZoom: number, maxZoom: number) => {
      if (!clampPlugin?.options) return
      const safeMin = Math.max(0.01, Math.min(minZoom, maxZoom))
      const safeMax = Math.max(minZoom, maxZoom)
      clampPlugin.options.minWidth = viewport.screenWidth / safeMax
      clampPlugin.options.maxWidth = viewport.screenWidth / safeMin
      clampPlugin.clamp?.()
    }

    let targetScale = MAX_ZOOM
    const stored = localStorage.getItem(zoomStorageKey)
    if (stored) {
      const parsed = Number.parseFloat(stored)
      if (Number.isFinite(parsed)) {
        targetScale = clampScale(parsed)
      }
    }

    initialZoomRef.current = targetScale

    const shouldAnimate = lastAnimatedKeyRef.current !== zoomStorageKey
    lastAnimatedKeyRef.current = zoomStorageKey

    hasAppliedStoredZoomRef.current = true

    if (shouldAnimate) {
      applyClampRange(ANIM_START_ZOOM, MAX_ZOOM)
      viewport.setZoom(ANIM_START_ZOOM, true)
      isAnimatingZoomRef.current = true
      viewport.animate({
        scale: targetScale,
        time: 700,
        ease: 'easeInOutSine',
        callbackOnComplete: () => {
          isAnimatingZoomRef.current = false
          applyClampRange(MIN_ZOOM, MAX_ZOOM)
          setZoomPercent(Math.round(targetScale * 100))
          localStorage.setItem(zoomStorageKey, targetScale.toString())
        },
      })
    } else {
      applyClampRange(MIN_ZOOM, MAX_ZOOM)
      viewport.setZoom(targetScale, true)
      setZoomPercent(Math.round(targetScale * 100))
      localStorage.setItem(zoomStorageKey, targetScale.toString())
    }
  }, [viewport, clampScale, zoomStorageKey])

  const handleZoomIn = () => {
    if (!viewport) return
    const nextScale = Math.min(MAX_ZOOM, viewport.scale.x * 1.15)
    viewport.setZoom(nextScale, true)
    setZoomPercent(Math.round(nextScale * 100))
  }

  const handleZoomOut = () => {
    if (!viewport) return
    const nextScale = Math.max(MIN_ZOOM, viewport.scale.x * 0.85)
    viewport.setZoom(nextScale, true)
    setZoomPercent(Math.round(nextScale * 100))
  }

  const handleZoomReset = () => {
    if (!viewport) return
    const initialZoom = initialZoomRef.current ?? viewport.scale.x
    const clampedInitial = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, initialZoom),
    )
    viewport.setZoom(clampedInitial, true)
    setZoomPercent(Math.round(clampedInitial * 100))
  }

  // ✅ Initialize from URL param first, then fall back to prop
  const [chapterDialogOpen, setChapterDialogOpen] = useState(
    chapterFromUrl != null || selectedChapterId != null,
  )
  const [selectedChapter, setSelectedChapter] = useState(
    chapterFromUrl ?? selectedChapterId ?? 0,
  )
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{
    src: string
    label?: string
  } | null>(null)

  const session = useSokratesSession() as any
  const access_token: string | undefined = session?.data?.tokens?.access_token

  const isCustomImageAsset = useCallback((asset: AssetData) => {
    if (!asset || asset.type?.kind === 'chapter') {
      return false
    }
    if (typeof asset.sourceUrl === 'string' && asset.sourceUrl.trim()) {
      return true
    }
    const file = typeof asset.file === 'string' ? asset.file.trim() : ''
    if (!file) return false
    if (file.startsWith('data:') || file.startsWith('blob:')) {
      return true
    }
    if (file.includes('/mapProxy?') || file.includes('/mapProxy/')) {
      return true
    }
    return false
  }, [])

  const handleAssetClick = useCallback(
    (asset: AssetData) => {
      if (!isCustomImageAsset(asset)) {
        return
      }
      const src = getSpriteUrl(asset.file)
      if (!src) return
      setSelectedImage({ src, label: asset.label })
      setImageDialogOpen(true)
    },
    [isCustomImageAsset],
  )

  useEffect(() => {
    if (!shouldPersistCanvasRef.current) {
      return
    }
    updateCourseCanvasInteractionState({
      courseUuid: `course_${courseuuid}`,
      selectedChapter: chapterDialogOpen ? selectedChapter : null,
      selectedTabId: selectedTab,
      access_token,
    })
  }, [selectedChapter, chapterDialogOpen, access_token, courseuuid, selectedTab])

  if (!course) return <PageLoading />

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <AnimatePresence>
        {!assetsReady && (
          <motion.div
            key="course-map-loader"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 z-50 bg-white"
          >
            <PageLoading />
          </motion.div>
        )}
      </AnimatePresence>
      <Modal
        isDialogOpen={chapterDialogOpen}
        onOpenChange={setChapterDialogOpen}
        customWidth="w-[95vw] max-w-[62.4375rem]"
        customHeight="h-[60vh] max-h-[35rem]" 
        dialogContent={<CourseChapter
          course={course}
          courseId={courseIdWithoutPrefix}
          orgslug={orgslug}
          chapterID={selectedChapter}
          access_token={access_token ?? ''}
          selectedTabId={selectedTab}
        />}
      />
      <Modal
        isDialogOpen={imageDialogOpen}
        onOpenChange={(open) => {
          setImageDialogOpen(open)
          if (!open) {
            setSelectedImage(null)
          }
        }}
        customWidth="w-[95vw] max-w-[62.4375rem] p-0 gap-0 overflow-hidden"
        customHeight="h-[60vh] max-h-[35rem] p-0"
        dialogContent={
          selectedImage ? (
            <div className="h-full w-full">
              <img
                src={selectedImage.src}
                alt={selectedImage.label || 'Custom asset'}
                className="h-full w-full"
                style={{ objectFit: 'contain' }}
              />
            </div>
          ) : null
        }
      />

      {/* Hamburger Menu Button */}
      <div ref={menuRef} className="absolute top-1/2 left-8 -translate-y-1/2 z-20">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center justify-center h-12 w-12 rounded-lg bg-white shadow-lg hover:bg-gray-50 transition-all border border-gray-200"
          aria-label="Menu"
        >
          {menuOpen ? (
            <X className="h-6 w-6 text-gray-700" strokeWidth={2.5} />
          ) : (
            <Menu className="h-6 w-6 text-gray-700" strokeWidth={2.5} />
          )}
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="mt-2 bg-white rounded-xl shadow-2xl p-2 border border-gray-200">
            <div className="space-y-1">
              {visibleTabs.map((tab) => {
                const tabIsHidden = 'isVisible' in tab && tab.isVisible === false
                const isSelected = selectedTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      shouldPersistCanvasRef.current = true
                      setSelectedTab(tab.id)
                      setMenuOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                      !tabIsHidden && 'hover:scale-105 transform',
                      tabIsHidden
                        ? isSelected
                          ? 'bg-[#FF6934]/50 text-white/90 shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : isSelected
                        ? 'bg-[#FF6934] text-white shadow-md'
                        : 'text-gray-700 hover:bg-[#FF6934]/10 hover:text-[#FF6934]',
                    )}
                  >
                    <span className="flex-1">{tab.name}</span>
                    {canSeeHiddenTabs && tabIsHidden ? (
                      <EyeOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Link href={getUriWithOrg(orgslug, '/')}>
        <Button
          variant="secondary"
          size="default"
          className="
            absolute bottom-8
            left-1/2 transform -translate-x-1/2
            md:left-8 md:translate-x-0
            z-10 h-10 w-18
          "
        >
          <DoorOpen className="size-6" style={{ color: '#454545' }} />
        </Button>
      </Link>

      <div className="absolute bottom-8 right-8 z-20 flex items-center gap-1 rounded-xl border border-gray-200 bg-white/90 px-2 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={!viewport}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold transition-all',
            viewport
              ? 'border-gray-200 text-gray-700 hover:bg-gray-100'
              : 'cursor-not-allowed border-gray-100 text-gray-300',
          )}
          aria-label="Zoom out"
        >
          –
        </button>
        <div className="min-w-[3.5rem] text-center text-sm font-semibold text-gray-700">
          {zoomPercent !== null ? `${zoomPercent}%` : '--%'}
        </div>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={!viewport}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold transition-all',
            viewport
              ? 'border-gray-200 text-gray-700 hover:bg-gray-100'
              : 'cursor-not-allowed border-gray-100 text-gray-300',
          )}
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="mx-1 h-6 w-px bg-gray-200" />
        <button
          type="button"
          onClick={handleZoomReset}
          disabled={!viewport}
          className={cn(
            'flex h-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold uppercase tracking-wide transition-all',
            viewport
              ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
              : 'cursor-not-allowed border-gray-100 text-gray-300',
          )}
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden flex flex-col">
        <div className="relative flex-1">
          <Canvas
            key={selectedTab}
            layout={layeredLayout}
            readOnly
            chapterStates={chapterStates}
            onViewportReady={setViewport}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            setLayout={() => {
              throw new Error(
                'BUG: Canvas layout mutation should not be called from read-only view.',
              )
            }}
            onChapterClick={(chapterId: number) => {
              shouldPersistCanvasRef.current = true
              setSelectedChapter(chapterId)
              setChapterDialogOpen(true)
            }}
            onAssetClick={handleAssetClick}
          />
        </div>
      </div>
    </div>
  )
}

export default CourseStartedView
