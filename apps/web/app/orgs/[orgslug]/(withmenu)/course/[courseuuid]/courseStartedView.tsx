'use client'

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation' // ✅ import hook
import { Button } from '@/components/ui/button'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import { DoorOpen, EyeOff, Menu, Sparkles, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getUriWithOrg, getWebSocketUrl } from '@services/config/config'
import { AnimatePresence, motion } from 'framer-motion'
import type { Viewport } from 'pixi-viewport'
import { getSpriteUrl } from '@components/Objects/ContentMap/utils/spriteUrl'
import type { AssetData } from '@components/Objects/ContentMap/Asset/assetTypes'
import {
  buildActivityTabIndex,
  getActivityTutorVerification,
  getCourseFallbackTabId,
  isActivityDone,
  isChapterLocked,
  resolveChapterTabId,
} from '@components/Pages/Courses/utils'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import {
  getCourseMetadata,
  updateCourseCanvasInteractionState,
} from '@services/courses/courses'
import { cn } from '@/lib/utils'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/courseTabs'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import CourseGroupPill from '@components/Objects/Courses/CourseGroupPill'

const CourseChapter = dynamic(
  () => import('@components/Pages/Courses/CourseChapter'),
  { loading: () => <PageLoading /> },
)

const CourseSandbox = dynamic(
  () => import('@components/Pages/Courses/CourseSandbox'),
  { loading: () => <PageLoading /> },
)

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
  const { toast } = useToast()
  const [courseData, setCourseData] = useState(course)

  useEffect(() => {
    setCourseData(course)
  }, [course])

  const activeCourse = courseData ?? course

  const rawTabMetadata = useMemo(
    () =>
      activeCourse?.tabMetadata ??
      activeCourse?.tab_metadata ??
      activeCourse?.courseStructure?.tabMetadata ??
      activeCourse?.courseStructure?.tab_metadata ??
      [],
    [activeCourse],
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
      activeCourse?.tabStore ??
      activeCourse?.tab_store ??
      activeCourse?.courseStructure?.tabStore ??
      activeCourse?.courseStructure?.tab_store ??
      {},
    [activeCourse],
  )

  const tabMaps = useMemo(() => {
    const fallbackMap =
      activeCourse?.map_state ??
      activeCourse?.courseStructure?.map_state ?? {
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
  }, [normalizedTabs, rawTabStore, activeCourse])

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
    return getCourseFallbackTabId(activeCourse)
  }, [visibleTabs, activeCourse])

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
  const [groupPillOpen, setGroupPillOpen] = useState(false)
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
    const result: Record<
      number,
      'locked' | 'unlocked' | 'finished' | 'verified' | 'incorrect'
    > = {}
    const chapters = Array.isArray(activeCourse?.chapters)
      ? activeCourse.chapters
      : []
    if (!chapters.length) {
      return result
    }

    const activeTabId = selectedTab ?? fallbackTabId
    const activityTabIndex = buildActivityTabIndex(
      activeCourse,
      fallbackTabId,
    )

    chapters.forEach((chapter: any) => {
      const chapterTabId = resolveChapterTabId(
        chapter,
        activeCourse,
        fallbackTabId,
      )
      if (chapterTabId !== activeTabId) {
        return
      }

      const isLocked = isChapterLocked(chapter.id, activeCourse, {
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
      if (activities.length === 0) {
        result[chapter.id] = 'unlocked'
        return
      }

      let allDone = true
      let allVerified = true
      let hasIncorrect = false

      activities.forEach((act: any) => {
        const activityUuid =
          act?.activity_uuid ??
          act?.activityUuid ??
          act?.activityUUID ??
          act?.id
        const isDone = isActivityDone(activeCourse, activityUuid, {
          activeTabId,
          activityTabIndex,
          fallbackTabId,
        })
        if (!isDone) {
          allDone = false
          allVerified = false
          return
        }
        const verification = getActivityTutorVerification(
          activeCourse,
          activityUuid,
          {
            activeTabId,
            activityTabIndex,
            fallbackTabId,
          },
        )
        if (verification === 'INCORRECT') {
          hasIncorrect = true
          allVerified = false
          return
        }
        if (verification !== 'CORRECT') {
          allVerified = false
        }
      })

      if (!allDone) {
        result[chapter.id] = 'unlocked'
        return
      }
      if (hasIncorrect) {
        result[chapter.id] = 'incorrect'
        return
      }
      result[chapter.id] = allVerified ? 'verified' : 'finished'
    })

    return result
  }, [activeCourse, selectedTab, fallbackTabId])

  const layout: LayoutState = useMemo(() => {
    const fallback = tabMaps[selectedTab] ?? {
      objects:
        Array.isArray(activeCourse?.map_state?.objects)
          ? activeCourse.map_state.objects
          : [],
      boundaries: {
        left:
          activeCourse?.map_state?.boundaries?.left ??
          DEFAULT_BOUNDARIES.left,
        right:
          activeCourse?.map_state?.boundaries?.right ??
          DEFAULT_BOUNDARIES.right,
        top:
          activeCourse?.map_state?.boundaries?.top ??
          DEFAULT_BOUNDARIES.top,
        bottom:
          activeCourse?.map_state?.boundaries?.bottom ??
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
  }, [tabMaps, selectedTab, activeCourse])

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

  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [mapReady, setMapReady] = useState(false)
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

  const showMapLoader = Boolean(activeCourse) && !mapReady

  useEffect(() => {
    setMapReady(false)
    setViewport(null)
    setZoomPercent(null)
  }, [selectedTab])

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
    } else if (typeof window !== 'undefined') {
      const isTablet =
        window.matchMedia('(min-width: 768px) and (max-width: 1180px)')
          .matches
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      if (isTablet || isMobile) {
        targetScale = clampScale(0.3)
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
  const [sandboxOpen, setSandboxOpen] = useState(false)

  const session = useSokratesSession() as any
  const access_token: string | undefined = session?.data?.tokens?.access_token
  const notificationSocketRef = useRef<WebSocket | null>(null)
  const notificationReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const notificationRetryRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const dynamicPreviewOpenRef = useRef(false)
  const dynamicPreviewActivityRef = useRef<string | null>(null)
  const studentUserId =
    typeof session?.data?.user?.id === 'number' ? session.data.user.id : null
  const courseUuidWithPrefix = useMemo(
    () =>
      courseuuid.startsWith('course_') ? courseuuid : `course_${courseuuid}`,
    [courseuuid],
  )
  const notificationTopics = useMemo(() => {
    if (!studentUserId) return []
    return [`user/${studentUserId}/courses/${courseUuidWithPrefix}/#`]
  }, [courseUuidWithPrefix, studentUserId])

  const refreshCourseData = useCallback(async () => {
    if (!access_token) return
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    try {
      const updated = await getCourseMetadata(
        courseIdWithoutPrefix,
        null,
        access_token,
      )
      if (updated) {
        setCourseData(updated)
      }
    } catch {
      // Ignore transient refresh errors.
    } finally {
      refreshInFlightRef.current = false
    }
  }, [access_token, courseIdWithoutPrefix])

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

  const handleDynamicPreviewStateChange = useCallback(
    (state: { isOpen: boolean; activityUuid?: string | null }) => {
      dynamicPreviewOpenRef.current = state.isOpen
      dynamicPreviewActivityRef.current = state.activityUuid ?? null
    },
    [],
  )

  const normalizeActivityUuid = useCallback((value: unknown) => {
    if (value === null || value === undefined) return null
    const raw = String(value)
    if (!raw) return null
    return raw.startsWith('activity_') ? raw : `activity_${raw}`
  }, [])

  useEffect(() => {
    if (!access_token || notificationTopics.length === 0) {
      if (notificationReconnectRef.current) {
        clearTimeout(notificationReconnectRef.current)
        notificationReconnectRef.current = null
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close()
        notificationSocketRef.current = null
      }
      return
    }

    const baseUrl = getWebSocketUrl()
    if (!baseUrl) {
      return
    }

    let active = true

    const cleanup = () => {
      if (notificationReconnectRef.current) {
        clearTimeout(notificationReconnectRef.current)
        notificationReconnectRef.current = null
      }
      if (notificationSocketRef.current) {
        notificationSocketRef.current.onopen = null
        notificationSocketRef.current.onmessage = null
        notificationSocketRef.current.onclose = null
        notificationSocketRef.current.onerror = null
        notificationSocketRef.current.close()
        notificationSocketRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (!active) return
      const delay = Math.min(1000 * 2 ** notificationRetryRef.current, 30000)
      const jitter = Math.floor(Math.random() * 300)
      notificationRetryRef.current += 1
      notificationReconnectRef.current = setTimeout(() => {
        connect()
      }, delay + jitter)
    }

    const connect = () => {
      cleanup()
      const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
      const url = new URL(`${normalized}notifications/ws`)
      url.searchParams.set('topics', notificationTopics.join(','))
      url.searchParams.set('token', access_token)
      const socket = new WebSocket(url.toString())
      notificationSocketRef.current = socket

      socket.onopen = () => {
        notificationRetryRef.current = 0
        socket.send(
          JSON.stringify({
            type: 'set_subscriptions',
            topics: notificationTopics,
          }),
        )
      }

      socket.onmessage = (event) => {
        let payload: any = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        if (!payload || payload.type !== 'notification') return
        const notification = payload.notification || {}
        const data = notification.data || {}
        if (data.course_uuid && data.course_uuid !== courseUuidWithPrefix) {
          return
        }
        const kind = typeof data.kind === 'string' ? data.kind.toLowerCase() : ''
        const topic = typeof notification.topic === 'string' ? notification.topic : ''
        const hasVerificationData =
          typeof data.tutor_verified === 'string' ||
          typeof data.tutorVerified === 'string' ||
          typeof data.verification === 'string' ||
          typeof data.verification_status === 'string'
        const isVerificationNotification =
          kind.includes('verify') ||
          kind.includes('verification') ||
          topic.includes('activity-verified') ||
          hasVerificationData
        const isSilentGroupActivitySync =
          kind === 'group_activity_state_sync' ||
          topic.includes('group-activity-state-sync')
        const variant =
          notification.level === 'error' ? 'destructive' : 'default'
        if (!isSilentGroupActivitySync) {
          toast({
            title: notification.title || 'Notification',
            description: notification.body || '',
            variant,
            duration: 5000,
          })
        }
        if (isVerificationNotification && dynamicPreviewOpenRef.current) {
          const activityUuid = normalizeActivityUuid(
            data.activity_uuid ??
              data.activityUuid ??
              data.activityUUID ??
              data.activity_id ??
              data.activityId,
          )
          if (
            activityUuid &&
            activityUuid === dynamicPreviewActivityRef.current
          ) {
            setChapterDialogOpen(false)
          }
        }
        refreshCourseData()
      }

      socket.onerror = () => {
        socket.close()
      }

      socket.onclose = () => {
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      active = false
      cleanup()
    }
  }, [
    access_token,
    courseUuidWithPrefix,
    notificationTopics,
    refreshCourseData,
    toast,
    normalizeActivityUuid,
  ])

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

  if (!activeCourse) return <PageLoading />

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <AnimatePresence>
        {showMapLoader && (
          <motion.div
            key="course-map-loader"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 z-50 bg-white"
          >
            <PageLoading />
            <div className="absolute bottom-10 left-1/2 w-[18rem] max-w-[80vw] -translate-x-1/2">
              <div
                className="mb-2 text-center text-sm font-medium text-gray-600"
                role="status"
                aria-live="polite"
              >
                Loading course map
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[#FF6934]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Modal
        isDialogOpen={chapterDialogOpen}
        onOpenChange={(open) => {
          setChapterDialogOpen(open)
          if (!open) {
            dynamicPreviewOpenRef.current = false
            dynamicPreviewActivityRef.current = null
          }
        }}
        customWidth="w-screen max-w-screen rounded-none border-0 sm:w-[80vw] sm:max-w-[80vw] sm:rounded-[0.875rem] sm:border-4 md:w-[90vw] md:max-w-[90vw] lg:w-[90vw] lg:max-w-[90vw] xl:w-[60vw] xl:max-w-[60vw]"
        customHeight="h-[100dvh] max-h-[100dvh] sm:h-[75vh] sm:max-h-[75vh] md:h-[90vh] md:max-h-[90vh] lg:h-[90vh] lg:max-h-[90vh] xl:h-[60vh] xl:max-h-[60vh]"
        overlayClassName="backdrop-blur-sm"
        dialogContent={
          chapterDialogOpen ? (
            <CourseChapter
              course={activeCourse}
              courseId={courseIdWithoutPrefix}
              orgslug={orgslug}
              chapterID={selectedChapter}
              access_token={access_token ?? ''}
              selectedTabId={selectedTab}
              onDynamicPreviewStateChange={handleDynamicPreviewStateChange}
            />
          ) : null
        }
      />
      <Modal
        isDialogOpen={sandboxOpen}
        onOpenChange={setSandboxOpen}
        customWidth="w-screen max-w-screen rounded-none border-0 sm:w-[80vw] sm:max-w-[80vw] sm:rounded-[0.875rem] sm:border-4 md:w-[90vw] md:max-w-[90vw] lg:w-[90vw] lg:max-w-[90vw] xl:w-[70vw] xl:max-w-[70vw]"
        customHeight="h-[100dvh] max-h-[100dvh] sm:h-[80vh] sm:max-h-[80vh] md:h-[85vh] md:max-h-[85vh] lg:h-[85vh] lg:max-h-[85vh] xl:h-[80vh] xl:max-h-[80vh]"
        overlayClassName="backdrop-blur-sm"
        dialogContent={
          sandboxOpen ? (
            <CourseSandbox
              courseUuid={courseUuidWithPrefix}
              userId={studentUserId}
              accessToken={access_token ?? null}
              onClose={() => setSandboxOpen(false)}
            />
          ) : null
        }
      />
      <Modal
        isDialogOpen={imageDialogOpen}
        onOpenChange={(open) => {
          setImageDialogOpen(open)
          if (!open) {
            setSelectedImage(null)
          }
        }}
        customWidth="w-screen max-w-screen rounded-none border-0 p-0 gap-0 overflow-hidden sm:w-[80vw] sm:max-w-[80vw] sm:rounded-[0.875rem] sm:border-4 lg:w-[60vw] lg:max-w-[60vw]"
        customHeight="h-[100dvh] max-h-[100dvh] sm:h-[75vh] sm:max-h-[75vh] lg:h-[60vh] lg:max-h-[60vh] p-0"
        overlayClassName="backdrop-blur-sm"
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

      {groupPillOpen ? (
        <div className="fixed inset-0 z-[205] bg-[radial-gradient(51.03%_51.03%_at_50%_50%,rgba(255,255,255,0)_0%,rgba(0,0,0,0.15)_100%)] backdrop-blur-sm" />
      ) : null}

      {/* Hamburger Menu Button */}
      <div className="fixed right-8 top-8 z-[220] pointer-events-auto">
        <CourseGroupPill
          courseUuid={courseUuidWithPrefix}
          onOpenChange={setGroupPillOpen}
        />
      </div>

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

      <div
        className="
          absolute bottom-8
          left-1/2 transform -translate-x-1/2
          md:left-8 md:translate-x-0
          z-10 flex items-center gap-2
        "
      >
        <Link href={getUriWithOrg(orgslug, '/')}>
          <Button variant="secondary" size="default" className="h-10 w-18">
            <DoorOpen className="size-6" style={{ color: '#454545' }} />
          </Button>
        </Link>
        {access_token ? (
          <Button
            variant="secondary"
            size="default"
            onClick={() => setSandboxOpen(true)}
            className="h-10 gap-1.5 px-3"
          >
            <Sparkles className="size-4" style={{ color: '#FF6934' }} />
            <span className="text-sm font-medium text-[#454545]">Sandbox</span>
          </Button>
        ) : null}
      </div>

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
            onViewportReady={(nextViewport) => {
              setViewport(nextViewport)
              setMapReady(true)
            }}
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
