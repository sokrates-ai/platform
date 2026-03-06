'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation' // ✅ import hook
import { Button } from '@/components/ui/button'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import { DoorOpen, EyeOff, Menu, X } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
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
}

const CourseStartedView = ({
  courseuuid,
  orgslug,
  course,
  selectedChapterId,
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
    return fallbackTabId ?? 'default-map'
  }, [fallbackTabId, visibleTabs])

  const [selectedTab, setSelectedTab] = useState(initialSelectedTab)
  const selectedTabRef = useRef(selectedTab)
  selectedTabRef.current = selectedTab
  
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // ✅ Initialize from URL param first, then fall back to prop
  const [chapterDialogOpen, setChapterDialogOpen] = useState(
    chapterFromUrl != null || selectedChapterId != null,
  )
  const [selectedChapter, setSelectedChapter] = useState(
    chapterFromUrl ?? selectedChapterId ?? 0,
  )

  const session = useSokratesSession() as any
  const access_token: string | undefined = session?.data?.tokens?.access_token

  useEffect(() => {
    updateCourseCanvasInteractionState({
      courseUuid: `course_${courseuuid}`,
      selectedChapter: chapterDialogOpen ? selectedChapter : null,
      access_token,
    })
  }, [selectedChapter, chapterDialogOpen, access_token, courseuuid])

  if (!course) return <PageLoading />

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
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

      <div className="relative flex-1 overflow-hidden flex flex-col">
        <div className="relative flex-1">
          <Canvas
            key={selectedTab}
            layout={layout}
            readOnly
            chapterStates={chapterStates}
            setLayout={() => {
              throw new Error(
                'BUG: Canvas layout mutation should not be called from read-only view.',
              )
            }}
            onChapterClick={(chapterId: number) => {
              setSelectedChapter(chapterId)
              setChapterDialogOpen(true)
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default CourseStartedView
