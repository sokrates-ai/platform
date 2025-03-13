import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { CourseMapEditorToolbar } from './EditCourseMapToolbar';
import { BarLoader } from 'react-spinners';

import dynamic from 'next/dynamic';
const ContentMap = dynamic(() => import('./../../../../Objects/ContentMap/Canvas'), { ssr: false });

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

    if (!onMapUpdateCallbackRef.current) {
        return (<div className='bg-black flex flex-col items-center justify-center h-full'>
            <BarLoader
                width={600}
                height={10}
                color="#ffffff"
                cssOverride={{ 'borderRadius': '3rem' }}
            >
            </BarLoader>
        </div>)
    } else {
        return (
            <div className="flex flex-col h-full">
                <div className="p-3 border-b">
                    <CourseMapEditorToolbar undo={() => { }} redo={() => { }} reset={() => { }} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <ContentMap
                        courseStructure={courseStructure}
                        onMapUpdateCallback={onMapUpdateCallbackRef.current}
                        readOnly={false}
                        onChapterClick={() => { }} />
                </div>
            </div>
        );
    }
};

export default EditCourseMap
