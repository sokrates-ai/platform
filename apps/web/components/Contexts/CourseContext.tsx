'use client'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import useSWR from 'swr'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/CourseTabSelector'

export const CourseContext = createContext(null)
export const CourseDispatchContext = createContext(null)

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
      const nextMetadata = action.payload?.tabMetadata ?? state.courseTabMetadata;
      return {
        ...state,
        courseTabMetadata: nextMetadata,
        courseStructure: {
          ...action.payload,
          tabStore: action.payload?.tabStore ?? state.courseTabsStore,
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
          chapters: action.payload?.[state.activeTabId]?.content?.chapters ?? [],
        },
      }
    case 'setCourseTabMetadata':
      return {
        ...state,
        courseTabMetadata: action.payload,
        courseStructure: {
          ...state.courseStructure,
          tabMetadata: action.payload,
        },
      }
    case 'setActiveTab':
      return {
        ...state,
        activeTabId: action.payload,
        courseStructure: {
          ...state.courseStructure,
          chapters: state.courseTabsStore?.[action.payload]?.content?.chapters ?? [],
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

function cloneTabStore(store?: CourseTabsStore): CourseTabsStore | undefined {
  if (!store) return undefined;
  const entries = Object.entries(store).map(([tabId, value]) => [
    tabId,
    {
      map: value?.map ? { ...value.map } : undefined,
      content: {
        chapters: value?.content?.chapters ? [...value.content.chapters] : [],
      },
    },
  ]);
  return Object.fromEntries(entries) as CourseTabsStore;
}

function transformCourseStructure(courseStructureData: any): {
  courseStructure: any;
  courseTabsStore: CourseTabsStore;
} {
  const fallbackTab = DEFAULT_COURSE_TABS[0];
  const fallbackTabId = fallbackTab?.id ?? 'tab-1';

  const existingStore = cloneTabStore(courseStructureData?.tabStore as CourseTabsStore | undefined);

  const safeMapState = courseStructureData?.map_state
    ? { ...courseStructureData.map_state }
    : {
        objects: [],
        boundaries: {
          left: -1000,
          right: 1000,
          top: -1000,
          bottom: 1000,
        },
      };

  const safeContent = {
    chapters: courseStructureData?.chapters ? [...courseStructureData.chapters] : [],
  };

  const derivedStore: CourseTabsStore = existingStore && Object.keys(existingStore).length > 0
    ? existingStore
    : {
        [fallbackTabId]: {
          map: safeMapState,
          content: safeContent,
        },
      };

  const tabMetadata =
    courseStructureData?.tabMetadata && Array.isArray(courseStructureData.tabMetadata)
      ? courseStructureData.tabMetadata
      : DEFAULT_COURSE_TABS;

  const sanitizedCourseStructure = {
    ...courseStructureData,
    map_state: undefined,
    tabStore: derivedStore,
    tabMetadata,
    chapters: (derivedStore[fallbackTabId] ?? Object.values(derivedStore)[0])?.content?.chapters ?? safeContent.chapters,
  };

  return {
    courseStructure: sanitizedCourseStructure,
    courseTabsStore: derivedStore,
  };
}
