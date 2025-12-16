'use client'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
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

  const initialState = useMemo(() => ({
    courseStructure: {
      course_uuid: courseuuid,
    },
    courseOrder: {},
    courseTabsStore: {},
    courseTabMetadata: DEFAULT_COURSE_TABS,
    activeTabId: defaultTabId,
    isSaved: true,
    isLoading: true,
  }), [courseuuid, defaultTabId]);

  const [state, dispatch] = useReducer(courseReducer, initialState) as any;

  useEffect(() => {
    if (courseStructureData) {
      const transformed = transformCourseStructure(courseStructureData);
      dispatch({ type: 'setCourseTabsStore', payload: transformed.courseTabsStore });
      dispatch({ type: 'setCourseStructure', payload: transformed.courseStructure });
      const firstTabId =
        transformed.courseStructure?.tabMetadata?.[0]?.id ??
        Object.keys(transformed.courseTabsStore ?? {})[0] ??
        DEFAULT_COURSE_TABS[0]?.id ??
        'tab-1';
      if (firstTabId) {
        dispatch({ type: 'setActiveTab', payload: firstTabId });
      }
      dispatch({ type: 'setIsLoaded' });
    }
  }, [courseStructureData]);

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
      return {
        ...state,
        courseTabsStore: action.payload,
        courseStructure: {
          ...state.courseStructure,
          tabStore: action.payload,
          tab_store: action.payload,
          tabMapStore: Object.fromEntries(
            Object.entries(action.payload ?? {}).map(([tabId, value]) => [
              tabId,
              value?.map ? { ...value.map } : { ...EMPTY_MAP_STATE },
            ]),
          ),
          chapters: ensureActivitiesArray(action.payload?.[state.activeTabId]?.content?.chapters),
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
    ? rawTabMetadata.map((tab: any, index: number) => ({
        id: tab?.tab_uuid ?? tab?.id ?? `tab-${index + 1}`,
        name: tab?.name ?? `Tab ${index + 1}`,
        position: typeof tab?.position === 'number' ? tab.position : index,
        description: tab?.description ?? '',
      }))
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
