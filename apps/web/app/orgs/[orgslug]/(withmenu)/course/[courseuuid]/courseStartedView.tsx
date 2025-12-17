'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation' // ✅ import hook
import { Button } from '@/components/ui/button'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Canvas, { LayoutState } from '@components/Objects/ContentMap/Canvas'
import { DoorOpen } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import {
  isActivityDone,
  isChapterLocked,
} from '@components/Pages/Courses/utils'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { updateCourseCanvasInteractionState } from '@services/courses/courses'
import CourseChapter from '@components/Pages/Courses/CourseChapter'
import { cn } from '@/lib/utils'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/CourseTabSelector'

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

  const rawTabMetadata =
    course?.tabMetadata ??
    course?.tab_metadata ??
    course?.courseStructure?.tabMetadata ??
    course?.courseStructure?.tab_metadata ??
    []

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
        return {
          id: tabId,
          name: tab?.name ?? `Tab ${index + 1}`,
          position:
            typeof tab?.position === 'number' ? tab.position : index,
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

  const rawTabStore =
    course?.tabStore ??
    course?.tab_store ??
    course?.courseStructure?.tabStore ??
    course?.courseStructure?.tab_store ??
    {}

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

  const tabs = normalizedTabs.length
    ? normalizedTabs
    : [
        {
          id: 'default-map',
          name: 'Map',
        },
      ]

  const [selectedTab, setSelectedTab] = useState(
    () => tabs[0]?.id ?? 'default-map',
  )

  useEffect(() => {
    if (!tabs.length) {
      return
    }
    if (!tabs.some((tab) => tab.id === selectedTab)) {
      setSelectedTab(tabs[0].id)
    }
  }, [tabs, selectedTab])

  const courseIdWithoutPrefix = courseuuid.replace('course_', '')

  const chapterStates = useMemo(() => {
    const result: Record<number, 'locked' | 'unlocked' | 'finished'> = {}
    if (course?.chapters) {
      course.chapters.forEach((chapter: any) => {
        if (isChapterLocked(chapter.id, course)) {
          result[chapter.id] = 'locked'
        } else {
          const allDone =
            chapter.activities.length > 0 &&
            chapter.activities.every((act: any) =>
              isActivityDone(course, act.id),
            )
          result[chapter.id] = allDone ? 'finished' : 'unlocked'
        }
      })
    }
    return result
  }, [course])

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
        />}
      />

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
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <div className="pointer-events-auto inline-flex h-10 items-center rounded-full border border-neutral-200 bg-white/90 shadow-md backdrop-blur">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium transition-colors first:rounded-l-full last:rounded-r-full',
                  selectedTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
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
