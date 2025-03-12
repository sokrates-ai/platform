"use client"

import React, { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { CourseMapEditorToolbar } from './CourseMapEditorToolbar'
import { MapEditorCanvas } from './MapEditorCanvas'
import { Skeleton } from '@/components/ui/skeleton'

export interface EditCourseMapProps {
    orgslug: string
    course_uuid?: string
    onChapterClick?: (chapterID: number) => void
}

const EditCourseMap: React.FC<EditCourseMapProps> = () => {
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token
    const course = useCourse() as any
    const { isLoading, courseStructure } = course as any
    const dispatchCourse = useCourseDispatch() as any

    const { data: usergroups } = useSWR(
        courseStructure ? `${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}` : null,
        (url: string) => swrFetcher(url, access_token)
    )
    const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>(undefined)
    const onMapUpdateCallbackRef = useRef<Function | undefined>(undefined)

    useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined) {
            setIsClientPublic(courseStructure.public)

            onMapUpdateCallbackRef.current = (mapData: any[]) => {
                dispatchCourse({ type: 'setIsNotSaved' })
                const updatedCourse = { ...courseStructure, map_state: { objects: mapData } }
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
            }
        }
    }, [isLoading, courseStructure])

    useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined && isClientPublic !== undefined) {
            if (isClientPublic !== courseStructure.public) {
                dispatchCourse({ type: 'setIsNotSaved' })
                const updatedCourse = { ...courseStructure, public: isClientPublic }
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
            }
        }
    }, [isLoading, isClientPublic, courseStructure, dispatchCourse])

    if (!onMapUpdateCallbackRef.current) {
        return (
            <div className="flex items-center justify-center w-full h-[calc(100vh-10rem)]">
                <Skeleton className="w-[600px] h-2 rounded-full" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center p-4 border-b">
                <CourseMapEditorToolbar
                    undo={() => { }}
                    redo={() => { }}
                    reset={() => { }}
                />
            </div>
            <MapEditorCanvas
                courseStructure={courseStructure}
                onMapUpdateCallback={onMapUpdateCallbackRef.current}
                readOnly={false}
                onChapterClick={() => {
                    console.log("HELLO")
                    if (courseStructure.onChapterClick) courseStructure.onChapterClick()
                }}
            />
        </div>
    )
}

export default EditCourseMap
