'use client'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import useSWR from 'swr'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/CourseTabSelector'

export const CourseContext = createContext(null)
export const CourseDispatchContext = createContext(null)

const EMPTY_MAP_STATE = {
  objects: [],
  boundaries: {
    left: -1000,
    right: 1000,
    top: -1000,
    bottom: 1000,
  },
};
export function CourseProvider({ children, courseuuid }: any) {
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const { data: courseStructureData, error } = useSWR(`${getAPIUrl()}courses/${courseuuid}/meta`,
    (url: string) => swrFetcher(url, access_token)
  );

  const defaultTabId = DEFAULT_COURSE_TABS[0]?.id ?? 'tab-1';
  const rawCourseUuid = useMemo(() => {
    if (typeof courseuuid !== 'string') return '';
    return courseuuid.startsWith('course_') ? courseuuid.slice('course_'.length) : courseuuid;
  }, [courseuuid]);
  const activeTabStorageKey = useMemo(() => {
    if (!rawCourseUuid) return '';
    return `course_editor_active_tab_${rawCourseUuid}`;
  }, [rawCourseUuid]);

  const initialState = useMemo(() => ({
    courseStructure: {
      course_uuid: courseuuid,
    },
    courseOrder: {},
    courseTabsStore: {},
    courseTabMetadata: DEFAULT_COURSE_TABS,
    activeTabId: defaultTabId,
    isSaved: true,
    isSaving: false,
    isLoading: true,
  }), [courseuuid, defaultTabId]);

  const [state, dispatch] = useReducer(courseReducer, initialState) as any;
  const activeTabIdRef = useRef<string | null>(initialState.activeTabId ?? null);

  useEffect(() => {
    activeTabIdRef.current = state.activeTabId ?? null;
  }, [state.activeTabId]);

  useEffect(() => {
    if (courseStructureData) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseContext] meta loaded', {
          courseuuid,
          activeTabStorageKey,
          previousActive: activeTabIdRef.current,
        });
      }
      const transformed = transformCourseStructure(courseStructureData);
      dispatch({ type: 'setCourseTabsStore', payload: transformed.courseTabsStore });
      dispatch({ type: 'setCourseStructure', payload: transformed.courseStructure });
      const metadata = Array.isArray(transformed.courseStructure?.tabMetadata)
        ? transformed.courseStructure.tabMetadata
        : [];
      const metadataIds = metadata
        .map((tab: any) => tab?.id ?? tab?.tab_uuid ?? null)
        .filter((value: string | null): value is string => Boolean(value));
      const storeKeys = Object.keys(transformed.courseTabsStore ?? {});
      const previousActive = activeTabIdRef.current;
      const fallbackTabId =
        metadataIds[0] ??
        storeKeys[0] ??
        DEFAULT_COURSE_TABS[0]?.id ??
        'tab-1';
      const storedTabId =
        typeof window !== 'undefined' && activeTabStorageKey
          ? window.sessionStorage.getItem(activeTabStorageKey)
          : null;
      const normalizeStoredTabId = (value: string | null): string | null => {
        if (!value) return null;
        if (metadataIds.includes(value) || storeKeys.includes(value)) {
          return value;
        }
        const candidates = Array.from(new Set([...metadataIds, ...storeKeys]));
        const prefixMatches = candidates.filter(
          (candidate) => candidate.startsWith(value) || value.startsWith(candidate),
        );
        if (prefixMatches.length === 1) {
          return prefixMatches[0];
        }
        return null;
      };
      const normalizedStoredTabId = normalizeStoredTabId(storedTabId);
      const hasStoredTab = !!normalizedStoredTabId;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseContext] active tab resolve', {
          courseuuid,
          activeTabStorageKey,
          storedTabId,
          normalizedStoredTabId,
          hasStoredTab,
          metadataIds,
          storeKeys,
          fallbackTabId,
          previousActive,
        });
      }
      const shouldKeepPrevious =
        !!previousActive &&
        (metadataIds.includes(previousActive) || storeKeys.includes(previousActive));
      const nextActiveTabId = hasStoredTab
        ? (normalizedStoredTabId as string)
        : shouldKeepPrevious
        ? previousActive
        : fallbackTabId;
      if (storedTabId && !hasStoredTab && typeof window !== 'undefined' && activeTabStorageKey) {
        window.sessionStorage.removeItem(activeTabStorageKey);
      }
      if (nextActiveTabId) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[CourseContext] setActiveTab', {
            courseuuid,
            nextActiveTabId,
          });
        }
        dispatch({ type: 'setActiveTab', payload: nextActiveTabId });
      }
      dispatch({ type: 'setIsLoaded' });
    }
  }, [activeTabStorageKey, courseStructureData]);

  useEffect(() => {
    if (!activeTabStorageKey) return;
    if (!state?.activeTabId) return;
    if (state?.isLoading) return;
    const metadataIds = Array.isArray(state?.courseTabMetadata)
      ? state.courseTabMetadata
          .map((tab: any) => tab?.id ?? tab?.tab_uuid ?? null)
          .filter((value: string | null): value is string => Boolean(value))
      : [];
    const storeKeys = Object.keys(state?.courseTabsStore ?? {});
    const hasValidActive =
      metadataIds.includes(state.activeTabId) || storeKeys.includes(state.activeTabId);
    if (!hasValidActive) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CourseContext] skip persist active tab (invalid)', {
          courseuuid,
          activeTabStorageKey,
          activeTabId: state.activeTabId,
          metadataIds,
          storeKeys,
        });
      }
      return;
    }
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CourseContext] persist active tab', {
        courseuuid,
        activeTabStorageKey,
        activeTabId: state.activeTabId,
      });
    }
    window.sessionStorage.setItem(activeTabStorageKey, state.activeTabId);
  }, [activeTabStorageKey, state?.activeTabId]);

  if (error) return <div>Failed to load course structure</div>;
  if (!courseStructureData) return '';

  if (courseStructureData) {
    return (
      <CourseContext.Provider value={state}>
        <CourseDispatchContext.Provider value={dispatch}>
          {children}
        </CourseDispatchContext.Provider>
      </CourseContext.Provider>
    )
  }
}

export function useCourse() {
  return useContext(CourseContext)
}

export function useCourseDispatch() {
  return useContext(CourseDispatchContext)
}

function courseReducer(state: any, action: any) {
  switch (action.type) {
    case 'setCourseStructure': {
      const nextMetadata =
        action.payload?.tabMetadata ??
        action.payload?.tab_metadata ??
        state.courseTabMetadata;
      return {
        ...state,
        courseTabMetadata: nextMetadata,
        courseStructure: {
          ...action.payload,
          tabStore:
            action.payload?.tabStore ??
            action.payload?.tab_store ??
            state.courseTabsStore,
          tabMapStore:
            action.payload?.tabMapStore ??
            action.payload?.tab_map_store ??
            state.courseStructure?.tabMapStore ??
            {},
          tabMetadata: nextMetadata,
        },
      }
    }
    case 'setCourseTabsStore':
      const nextTabsStore = action.payload as CourseTabsStore | undefined;
      return {
        ...state,
        courseTabsStore: nextTabsStore,
        courseStructure: {
          ...state.courseStructure,
          tabStore: nextTabsStore,
          tab_store: nextTabsStore,
          tabMapStore: Object.fromEntries(
            Object.entries(nextTabsStore ?? {}).map(([tabId, value]) => [
              tabId,
              value?.map ? { ...value.map } : { ...EMPTY_MAP_STATE },
            ]),
          ),
          chapters: ensureActivitiesArray(nextTabsStore?.[state.activeTabId]?.content?.chapters),
        },
      }
    case 'setCourseTabMetadata':
      return {
        ...state,
        courseTabMetadata: action.payload,
        courseStructure: {
          ...state.courseStructure,
          tabMetadata: action.payload,
          tab_metadata: action.payload,
        },
      }
    case 'setActiveTab':
      return {
        ...state,
        activeTabId: action.payload,
        courseStructure: {
          ...state.courseStructure,
          chapters: ensureActivitiesArray(state.courseTabsStore?.[action.payload]?.content?.chapters),
        },
      }
    case 'setCourseOrder':
      return { ...state, courseOrder: action.payload }
    case 'setIsSaved':
      return { ...state, isSaved: true }
    case 'setIsNotSaved':
      return { ...state, isSaved: false }
    case 'setIsSaving':
      return { ...state, isSaving: true }
    case 'setIsNotSaving':
      return { ...state, isSaving: false }
    case 'setIsLoaded':
      return { ...state, isLoading: false }
    default:
      throw new Error(`Unhandled action type: ${action.type}`)
  }
}

type CourseTabsStore = Record<string, {
  map: any;
  content: Pick<any, 'chapters'>;
}>;

function ensureActivitiesArray(chapters?: any[]): any[] {
  if (!Array.isArray(chapters)) return [];
  return chapters.map((chapter) => ({
    ...chapter,
    activities: Array.isArray(chapter?.activities) ? [...chapter.activities] : [],
  }));
}

function cloneTabStore(store?: CourseTabsStore): CourseTabsStore | undefined {
  if (!store) return undefined;
  const entries = Object.entries(store).map(([tabId, value]) => [
    tabId,
    {
      map: value?.map ? { ...value.map } : { ...EMPTY_MAP_STATE },
      content: {
        chapters: ensureActivitiesArray(value?.content?.chapters),
      },
    },
  ]);
  return Object.fromEntries(entries) as CourseTabsStore;
}

function transformCourseStructure(courseStructureData: any): {
  courseStructure: any;
  courseTabsStore: CourseTabsStore;
} {
  const rawTabMetadata = courseStructureData?.tabMetadata ?? courseStructureData?.tab_metadata;
  const normalizedTabs = Array.isArray(rawTabMetadata)
    ? rawTabMetadata.map((tab: any, index: number) => {
        const visibleAfter =
          tab?.visibleAfter ??
          tab?.visible_after ??
          tab?.visible_after_at ??
          null;
        const manualVisibility =
          typeof tab?.visibility === 'boolean'
            ? tab.visibility
            : typeof tab?.visible === 'boolean'
            ? tab.visible
            : true;
        const parsedVisibleAfter =
          typeof visibleAfter === 'string' || visibleAfter instanceof Date
            ? new Date(visibleAfter)
            : null;
        const hasValidDate =
          parsedVisibleAfter instanceof Date &&
          !Number.isNaN(parsedVisibleAfter.getTime());
        const today = new Date();
        const todayDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );
        const visibleAfterDate =
          hasValidDate
            ? new Date(
                parsedVisibleAfter.getFullYear(),
                parsedVisibleAfter.getMonth(),
                parsedVisibleAfter.getDate(),
              )
            : null;
        const effectiveVisibility =
          typeof tab?.isVisible === 'boolean'
            ? tab.isVisible
            : typeof tab?.is_visible === 'boolean'
            ? tab.is_visible
            : manualVisibility &&
              (!visibleAfterDate || visibleAfterDate <= todayDate);
        return {
          id: tab?.tab_uuid ?? tab?.id ?? `tab-${index + 1}`,
          name: tab?.name ?? `Tab ${index + 1}`,
          position: typeof tab?.position === 'number' ? tab.position : index,
          description: tab?.description ?? '',
          visibility: manualVisibility,
          visibleAfter,
          isVisible: effectiveVisibility,
        };
      })
    : DEFAULT_COURSE_TABS.map((tab, index) => ({ ...tab, position: index }));

  const sortedTabs = [...normalizedTabs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const fallbackTabId = sortedTabs[0]?.id ?? DEFAULT_COURSE_TABS[0]?.id ?? 'tab-1';

  const rawTabStore = courseStructureData?.tabStore ?? courseStructureData?.tab_store;
  const mapStore =
    rawTabStore && typeof rawTabStore === 'object'
      ? Object.entries(rawTabStore).reduce<Record<string, any>>((acc, [tabId, mapValue]) => {
          if (mapValue && typeof mapValue === 'object') {
            const candidate =
              'objects' in mapValue && 'boundaries' in mapValue
                ? mapValue
                : typeof (mapValue as any).map === 'object'
                ? (mapValue as any).map
                : undefined;
            if (candidate) {
              acc[tabId] = { ...candidate };
            }
          }
          return acc;
        }, {})
      : {};

  const allChapters = ensureActivitiesArray(courseStructureData?.chapters);

  const derivedStore: CourseTabsStore = {};
  sortedTabs.forEach((tab) => {
    const tabId = tab.id;
    const mapState = mapStore[tabId] ? { ...mapStore[tabId] } : { ...EMPTY_MAP_STATE };
    const tabChapters = allChapters
      .filter((chapter: any) => {
        const chapterTabId = chapter?.tab_uuid ?? chapter?.tabUuid ?? fallbackTabId;
        return chapterTabId === tabId;
      })
      .map((chapter: any) => ({
        ...chapter,
        tab_uuid: tabId,
      }));

    derivedStore[tabId] = {
      map: mapState,
      content: {
        chapters: tabChapters,
      },
    };
  });

  if (Object.keys(derivedStore).length === 0) {
    derivedStore[fallbackTabId] = {
      map: { ...EMPTY_MAP_STATE },
      content: {
        chapters: ensureActivitiesArray([]),
      },
    };
  }

  const sanitizedCourseStructure = {
    ...courseStructureData,
    map_state: courseStructureData?.map_state ?? derivedStore[fallbackTabId]?.map ?? { ...EMPTY_MAP_STATE },
    tabStore: derivedStore,
    tab_store: derivedStore,
    tabMapStore: mapStore,
    tabMetadata: sortedTabs,
    tab_metadata: sortedTabs,
    chapters: ensureActivitiesArray(
      derivedStore[fallbackTabId]?.content?.chapters ??
        derivedStore[Object.keys(derivedStore)[0]]?.content?.chapters ??
        [],
    ),
  };

  return {
    courseStructure: sanitizedCourseStructure,
    courseTabsStore: derivedStore,
  };
}
