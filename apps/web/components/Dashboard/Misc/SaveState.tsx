'use client'
import { getAPIUrl } from '@services/config/config'
import { updateCourseOrderStructure } from '@services/courses/chapters'
import { revalidateTags } from '@services/utils/ts/requests'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { DEFAULT_COURSE_TABS } from '@components/Objects/Modals/Course/Create/CourseTabSelector'
import { Check, Loader2, SaveAllIcon, Timer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { mutate } from 'swr'
import { updateCourse } from '@services/courses/courses'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'

function SaveState(props: { orgslug: string }) {
  const course = useCourse() as any
  const session = useSokratesSession() as any;  const router = useRouter()
  const saved = course ? course.isSaved : true
  const dispatchCourse = useCourseDispatch() as any
  const course_structure = course.courseStructure
  const [isSaving, setIsSaving] = React.useState(false)
  const fallbackMapState = {
    objects: [],
    boundaries: {
      left: -1000,
      right: 1000,
      top: -1000,
      bottom: 1000,
    },
  };

  const buildCourseUpdatePayload = () => {
    const metadataSource = Array.isArray(course.courseTabMetadata)
      ? [...course.courseTabMetadata].sort(
          (a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0),
        )
      : DEFAULT_COURSE_TABS.map((tab, index) => ({ ...tab, position: index }));

    const metadata = metadataSource.map((tab: any, index: number) => ({
      tab_uuid: tab?.id ?? tab?.tab_uuid ?? `tab-${index + 1}`,
      name: tab?.name ?? `Tab ${index + 1}`,
      position: typeof tab?.position === 'number' ? tab.position : index,
      visible:
        typeof tab?.visibility === 'boolean'
          ? tab.visibility
          : typeof tab?.visible === 'boolean'
          ? tab.visible
          : true,
      visible_after:
        tab?.visibleAfter ??
        tab?.visible_after ??
        tab?.visible_after_at ??
        null,
    }));

    const tabStoreSource =
      course_structure?.tabMapStore ??
      Object.fromEntries(
        Object.entries(course_structure?.tabStore ?? {}).map(([tabId, value]: [string, any]) => [
          tabId,
          value?.map ? { ...value.map } : { ...fallbackMapState },
        ]),
      );

    const sanitizedTabStore = metadata.reduce<Record<string, any>>((acc, tab) => {
      const mapState = tabStoreSource?.[tab.tab_uuid]
        ? { ...tabStoreSource[tab.tab_uuid] }
        : { ...fallbackMapState };
      acc[tab.tab_uuid] = mapState;
      return acc;
    }, {});

    const primaryMap =
      metadata.length > 0
        ? sanitizedTabStore[metadata[0].tab_uuid] ?? { ...fallbackMapState }
        : { ...fallbackMapState };

    const payload: Record<string, any> = {
      name: course_structure?.name,
      description: course_structure?.description,
      about: course_structure?.about,
      learnings: course_structure?.learnings,
      tags: course_structure?.tags,
      public: course_structure?.public,
      tabStore: sanitizedTabStore,
      map_state: primaryMap,
      tabs: metadata,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  };

  //
  // Course Order
  const changeOrderBackend = async () => {
    // TODO: this does nothing!
    return

    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    await updateCourseOrderStructure(
      course.courseStructure.course_uuid,
      course.courseOrder,
      session.data?.tokens?.access_token
    )
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    dispatchCourse({ type: 'setIsSaved' })
  }

  // Course metadata
  const changeMetadataBackend = async () => {
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    const payload = buildCourseUpdatePayload()
    await updateCourse(
      course.courseStructure.course_uuid,
      payload,
      session.data?.tokens?.access_token
    )
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    dispatchCourse({ type: 'setIsSaved' })
  }

  const saveCourseState = React.useCallback(async () => {
    // Course  order
    if (saved || isSaving) return
    setIsSaving(true)
    try {
      await changeOrderBackend()
      mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
      // Course metadata
      await changeMetadataBackend()
      mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
      await revalidateTags(['courses'], props.orgslug)
      dispatchCourse({ type: 'setIsSaved' })
    } finally {
      setIsSaving(false)
    }
  }, [changeMetadataBackend, changeOrderBackend, course?.courseStructure?.course_uuid, dispatchCourse, props.orgslug, saved, isSaving])

  const handleCourseOrder = React.useCallback((course_structure: any) => {
    const chapters = course_structure.chapters
    const chapter_order_by_ids = chapters.map((chapter: any) => {
      return {
        chapter_id: chapter.id,
        activities_order_by_ids: (chapter.activities ?? []).map((activity: any) => {
          return {
            activity_id: activity.id,
          }
        }),
      }
    })
    dispatchCourse({
      type: 'setCourseOrder',
      payload: { chapter_order_by_ids: chapter_order_by_ids },
    })
    dispatchCourse({ type: 'setIsNotSaved' })
  }, [dispatchCourse])

  const initOrderPayload = React.useCallback(() => {
    if (course_structure && course_structure.chapters) {
      handleCourseOrder(course_structure)
      dispatchCourse({ type: 'setIsSaved' })
    }
  }, [course_structure, dispatchCourse, handleCourseOrder])

  const changeOrderPayload = React.useCallback(() => {
    if (course_structure && course_structure.chapters) {
      handleCourseOrder(course_structure)
      dispatchCourse({ type: 'setIsNotSaved' })
    }
  }, [course_structure, dispatchCourse, handleCourseOrder])

  useEffect(() => {
    if (course_structure?.chapters) {
      initOrderPayload()
    }
    if (course_structure?.chapters && !saved) {
      changeOrderPayload()
    }
  }, [changeOrderPayload, course_structure, initOrderPayload, saved]) // This effect depends on the `course_structure` variable

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.key || event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveCourseState();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveCourseState]);

  return (
    <div className="flex space-x-4">
      {saved ? (
        <></>
      ) : (
        <div className="text-gray-600 flex space-x-2 items-center antialiased">
          <Timer size={15} />
          <div>Unsaved changes</div>
        </div>
      )}
      <div
        className={
          `px-4 py-2 rounded-lg drop-shadow-md cursor-pointer flex space-x-2 items-center font-bold antialiased transition-all ease-linear ` +
          (saved
            ? 'bg-gray-600 text-white'
            : 'bg-black text-white border hover:bg-gray-900 ') +
          (isSaving ? ' opacity-80 cursor-not-allowed' : '')
        }
        onClick={isSaving ? undefined : saveCourseState}
      >
        {isSaving ? (
          <Loader2 size={20} className="animate-spin" />
        ) : saved ? (
          <Check size={20} />
        ) : (
          <SaveAllIcon size={20} />
        )}
        {saved ? <div className="">Saved</div> : <div className="">Save</div>}
      </div>
    </div>
  )
}

export default SaveState
