'use client'

import { getUriWithOrg } from '@services/config/config'
import React from 'react'
import {
  CourseProvider,
  useCourse,
  useCourseDispatch,
} from '../../../../../../../../components/Contexts/CourseContext'
import Link from 'next/link'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import { motion } from 'framer-motion'
import { BarChart3, GalleryVerticalEnd, Map, Info, LayoutGrid, UserRoundCog, Users } from 'lucide-react'
import EditCourseStructure from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure'
import EditCourseGeneral from '@components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral'
import EditCourseAccess from '@components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess'
import EditCourseMap from '@components/Dashboard/Pages/Course/EditCourseMap/EditCourseMap'
import ManageCourseMembers from '@components/Dashboard/Pages/Course/ManageCourseMembers/ManageCourseMembers'
import ManageCourseRooms from '@components/Dashboard/Pages/Course/ManageCourseRooms/ManageCourseRooms'
import CourseAnalytics from '@components/Dashboard/Pages/Course/CourseAnalytics/CourseAnalytics'
import {
  CourseTab,
  DEFAULT_COURSE_TABS,
} from '@components/Objects/Modals/Course/Create/CourseTabSelector'

export type CourseOverviewParams = {
  orgslug: string
  courseuuid: string
  subpage: string
}

type CourseTabStoreEntry = {
  map: any
  content: {
    chapters: any[]
  }
}

type CourseTabStore = Record<string, CourseTabStoreEntry>

function createEmptyMapState() {
  return {
    objects: [],
    boundaries: {
      left: -1000,
      right: 1000,
      top: -1000,
      bottom: 1000,
    },
  }
}

function ensureStoreForTabs(
  tabs: CourseTab[],
  store: CourseTabStore,
  template?: CourseTabStoreEntry,
): CourseTabStore {
  const nextStore: CourseTabStore = {}
  tabs.forEach((tab) => {
    if (store[tab.id]) {
      nextStore[tab.id] = store[tab.id]
      return
    }
    nextStore[tab.id] = template
      ? {
          map: template.map ? { ...template.map } : createEmptyMapState(),
          content: {
            chapters: template.content?.chapters
              ? [...template.content.chapters]
              : [],
          },
        }
      : {
          map: createEmptyMapState(),
          content: { chapters: [] },
        }
  })
  return nextStore
}

function CourseOverviewPage({ params }: { params: CourseOverviewParams }) {
  function getEntireCourseUUID(courseuuid: string) {
    return `course_${courseuuid}`
  }

  return (
    <div className="grid h-screen w-full grid-rows-[auto,1fr] overscroll-x-none bg-SokratesLightGray">
      <CourseProvider courseuuid={getEntireCourseUUID(params.courseuuid)}>
        <CourseOverviewLayout params={params} />
      </CourseProvider>
    </div>
  )
}

export default CourseOverviewPage

function CourseOverviewLayout({ params }: { params: CourseOverviewParams }) {
  const course = useCourse() as any
  const dispatchCourse = useCourseDispatch() as any

  const initialTabs = React.useMemo<CourseTab[]>(() => {
    return course?.courseTabMetadata ?? DEFAULT_COURSE_TABS
  }, [course?.courseTabMetadata])

  const initialStore = React.useMemo<CourseTabStore>(() => {
    const baseStore: CourseTabStore =
      course?.courseTabsStore && Object.keys(course.courseTabsStore).length > 0
        ? course.courseTabsStore
        : course?.courseStructure?.tabStore &&
          Object.keys(course.courseStructure.tabStore).length > 0
        ? course.courseStructure.tabStore
        : {
            [DEFAULT_COURSE_TABS[0]?.id ?? 'tab-1']: {
              map:
                course?.courseStructure?.tabStore?.[
                  DEFAULT_COURSE_TABS[0]?.id ?? 'tab-1'
                ]?.map ?? createEmptyMapState(),
              content: {
                chapters:
                  course?.courseStructure?.tabStore?.[
                    DEFAULT_COURSE_TABS[0]?.id ?? 'tab-1'
                  ]?.content?.chapters ??
                  course?.courseStructure?.chapters ??
                  [],
              },
            },
          }
    return ensureStoreForTabs(initialTabs, baseStore)
  }, [course?.courseStructure?.chapters, course?.courseStructure?.tabStore, course?.courseTabsStore, initialTabs])

  const [tabs, setTabs] = React.useState<CourseTab[]>(initialTabs)
  const [tabStore, setTabStore] = React.useState<CourseTabStore>(initialStore)
  const [selectedTabId, setSelectedTabId] = React.useState<string>(
    course?.activeTabId ?? initialTabs[0]?.id ?? '',
  )
  const activeTabStorageKey = React.useMemo(
    () => `course_editor_active_tab_${params.courseuuid}`,
    [params.courseuuid],
  )
  const hasSyncedActiveTabRef = React.useRef(false)
  const getStoredTabId = React.useCallback(() => {
    if (typeof window === 'undefined') return null
    const value = window.sessionStorage.getItem(activeTabStorageKey)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CourseEditor] read stored tab', {
        activeTabStorageKey,
        value,
      })
    }
    return value
  }, [activeTabStorageKey])
  const setStoredTabId = React.useCallback(
    (tabId: string) => {
      if (typeof window === 'undefined') return
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseEditor] write stored tab', {
          activeTabStorageKey,
          tabId,
        })
      }
      window.sessionStorage.setItem(activeTabStorageKey, tabId)
    },
    [activeTabStorageKey],
  )

  React.useEffect(() => {
    setTabs(initialTabs)
  }, [initialTabs])

  React.useEffect(() => {
    if (!tabs.length) return
    const storedTabId = getStoredTabId()
    const normalizedStoredTabId =
      storedTabId &&
      (tabs.find((tab) => tab.id === storedTabId)?.id ??
        (() => {
          const matches = tabs.filter(
            (tab) => tab.id.startsWith(storedTabId) || storedTabId.startsWith(tab.id),
          )
          return matches.length === 1 ? matches[0]?.id : null
        })())
    if (
      normalizedStoredTabId &&
      tabs.some((tab) => tab.id === normalizedStoredTabId) &&
      normalizedStoredTabId !== selectedTabId
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseEditor] apply stored tab', {
          storedTabId,
          normalizedStoredTabId,
          selectedTabId,
          tabs: tabs.map((tab) => tab.id),
        })
      }
      setSelectedTabId(normalizedStoredTabId)
      if (course?.activeTabId !== normalizedStoredTabId) {
        dispatchCourse({ type: 'setActiveTab', payload: normalizedStoredTabId })
      }
      return
    }
    if (course?.activeTabId && course.activeTabId !== selectedTabId) {
      setSelectedTabId(course.activeTabId)
    }
  }, [course?.activeTabId, dispatchCourse, getStoredTabId, selectedTabId, tabs])

  React.useEffect(() => {
    if (hasSyncedActiveTabRef.current) return
    if (!tabs.length) return
    const storedTabId = getStoredTabId()
    if (storedTabId && tabs.some((tab) => tab.id === storedTabId)) {
      setSelectedTabId(storedTabId)
      dispatchCourse({ type: 'setActiveTab', payload: storedTabId })
      hasSyncedActiveTabRef.current = true
      return
    }
    if (storedTabId && course?.isLoading) {
      return
    } else if (storedTabId && !course?.isLoading && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(activeTabStorageKey)
    }
    hasSyncedActiveTabRef.current = true
  }, [activeTabStorageKey, course?.isLoading, dispatchCourse, getStoredTabId, tabs])

  React.useEffect(() => {
    setTabStore(ensureStoreForTabs(initialTabs, initialStore))
  }, [initialTabs, initialStore])

  React.useEffect(() => {
    if (!selectedTabId && tabs.length > 0) {
      setSelectedTabId(tabs[0].id)
      dispatchCourse({ type: 'setActiveTab', payload: tabs[0].id })
      setStoredTabId(tabs[0].id)
      return
    }
    if (selectedTabId && !tabs.some((tab) => tab.id === selectedTabId)) {
      const fallback = tabs[0]?.id ?? ''
      setSelectedTabId(fallback)
      if (fallback) {
        dispatchCourse({ type: 'setActiveTab', payload: fallback })
        setStoredTabId(fallback)
      }
    }
  }, [dispatchCourse, selectedTabId, setStoredTabId, tabs])

  React.useEffect(() => {
    if (!selectedTabId) return
    if (!tabs.some((tab) => tab.id === selectedTabId)) return
    if (course?.isLoading) return
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(activeTabStorageKey, selectedTabId)
  }, [activeTabStorageKey, course?.isLoading, selectedTabId, tabs])

  const syncStore = React.useCallback(
    (nextStore: CourseTabStore, markDirty = true) => {
      setTabStore(nextStore)
      dispatchCourse({ type: 'setCourseTabsStore', payload: nextStore })
      if (markDirty) {
        dispatchCourse({ type: 'setIsNotSaved' })
      }
    },
    [dispatchCourse],
  )

  const handleTabsChange = React.useCallback(
    (nextTabs: CourseTab[]) => {
      const existingIds = new Set(tabs.map((tab) => tab.id))
      const addedTab = nextTabs.find((tab) => !existingIds.has(tab.id))
      const wasAdded = Boolean(addedTab)
      const tabsWithPositions = nextTabs.map((tab, index) => ({
        ...tab,
        position: index,
      }))
      const nextStore = ensureStoreForTabs(tabsWithPositions, tabStore)
      setTabs(tabsWithPositions)
      dispatchCourse({ type: 'setIsNotSaved' })
      syncStore(nextStore, true)
      dispatchCourse({ type: 'setCourseTabMetadata', payload: tabsWithPositions })

      setSelectedTabId((current) => {
        if (wasAdded && addedTab) {
          dispatchCourse({ type: 'setActiveTab', payload: addedTab.id })
          setStoredTabId(addedTab.id)
          return addedTab.id
        }
        if (tabsWithPositions.some((tab) => tab.id === current)) {
          dispatchCourse({ type: 'setActiveTab', payload: current })
          setStoredTabId(current)
          return current
        }
        const fallback = tabsWithPositions[0]?.id ?? ''
        if (fallback) {
          dispatchCourse({ type: 'setActiveTab', payload: fallback })
          setStoredTabId(fallback)
        }
        return fallback
      })

      if (wasAdded && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('course:autosave'))
        }, 0)
      }
    },
    [dispatchCourse, syncStore, tabStore, tabs],
  )

  const handleTabChange = React.useCallback(
    (tabId: string) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseEditor] handleTabChange', {
          tabId,
          selectedTabId,
          tabs: tabs.map((tab) => tab.id),
        })
      }
      setStoredTabId(tabId)
      setSelectedTabId(tabId)
      dispatchCourse({ type: 'setActiveTab', payload: tabId })
    },
    [dispatchCourse, selectedTabId, setStoredTabId, tabs],
  )

  const handleUpdateTabMap = React.useCallback(
    (tabId: string, nextMap: any) => {
      const baseEntry =
        tabStore[tabId] ??
        {
          map: createEmptyMapState(),
          content: { chapters: [] },
        };
      const updatedStore: CourseTabStore = {
        ...tabStore,
        [tabId]: {
          ...baseEntry,
          map: nextMap,
        },
      }
      syncStore(updatedStore, true)
    },
    [tabStore, syncStore],
  )

  const handleUpdateTabContent = React.useCallback(
    (tabId: string, nextChapters: any[]) => {
      const baseEntry =
        tabStore[tabId] ??
        {
          map: createEmptyMapState(),
          content: { chapters: [] },
        };
      const updatedStore: CourseTabStore = {
        ...tabStore,
        [tabId]: {
          ...baseEntry,
          content: {
            ...baseEntry.content,
            chapters: nextChapters,
          },
        },
      }
      syncStore(updatedStore, true)
    },
    [tabStore, syncStore],
  )

  const currentTabMap = tabStore[selectedTabId]?.map ?? createEmptyMapState()
  const currentTabContent = tabStore[selectedTabId]?.content ?? { chapters: [] }

  return (
    <>
      <div className="z-10 bg-SokratesWhite px-10 pt-[60px] text-sm tracking-tight shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
        <CourseOverviewTop params={params} />
        <div className="flex space-x-3 font-black text-sm">
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/general`}
            active={params.subpage.toString() === 'general'}
            icon={<Info size={16} />}
            label="General"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/access`}
            active={params.subpage.toString() === 'access'}
            icon={<UserRoundCog size={16} />}
            label="Access"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/content`}
            active={params.subpage.toString() === 'content'}
            icon={<GalleryVerticalEnd size={16} />}
            label="Content"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/map`}
            active={params.subpage.toString() === 'map'}
            icon={<Map size={16} />}
            label="Map"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/students`}
            active={params.subpage.toString() === 'students'}
            icon={<Users size={16} />}
            label="Students"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/rooms`}
            active={params.subpage.toString() === 'rooms'}
            icon={<LayoutGrid size={16} />}
            label="Rooms"
          />
          <NavigationLink
            href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/analytics`}
            active={params.subpage.toString() === 'analytics'}
            icon={<BarChart3 size={16} />}
            label="Analytics"
          />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="h-full overflow-hidden"
      >
        {params.subpage === 'map' ? (
          <EditCourseMap
            orgslug={params.orgslug}
            tabs={tabs}
            selectedTabId={selectedTabId}
            onTabsChange={handleTabsChange}
            onTabChange={handleTabChange}
            mapState={currentTabMap}
            onMapStateChange={handleUpdateTabMap}
          />
        ) : null}
        {params.subpage === 'content' ? (
          <EditCourseStructure
            orgslug={params.orgslug}
            tabs={tabs}
            selectedTabId={selectedTabId}
            onTabsChange={handleTabsChange}
            onTabChange={handleTabChange}
            tabContent={currentTabContent}
            onTabContentChange={handleUpdateTabContent}
          />
        ) : null}
        {params.subpage === 'general' ? (
          <EditCourseGeneral orgslug={params.orgslug} />
        ) : null}
        {params.subpage === 'access' ? (
          <EditCourseAccess orgslug={params.orgslug} />
        ) : null}
        {params.subpage === 'students' ? (
          <ManageCourseMembers orgslug={params.orgslug} />
        ) : null}
        {params.subpage === 'rooms' ? <ManageCourseRooms /> : null}
        {params.subpage === 'analytics' ? <CourseAnalytics /> : null}
      </motion.div>
    </>
  )
}

function NavigationLink({
  href,
  active,
  icon,
  label,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link href={href}>
      <div
        className={`flex w-fit cursor-pointer space-x-4 border-SokratesBlackBoxShadow py-2 text-center transition-all ease-linear ${
          active ? 'border-b-4' : 'opacity-50'
        }`}
      >
        <div className="mx-2 flex items-center space-x-2.5">
          {icon}
          <div>{label}</div>
        </div>
      </div>
    </Link>
  )
}
