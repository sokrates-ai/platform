import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { CourseMapEditorToolbar } from './CourseMapEditorToolbar';
import { MapEditorCanvas } from './MapEditorCanvas';

export interface EditCourseMapProps {
    orgslug: string;
    course_uuid?: string;
}

const EditCourseMap: React.FC<EditCourseMapProps> = () => {
    const session = useLHSession() as any;
    const access_token = session?.data?.tokens?.access_token;
    const course = useCourse() as any;
    const { isLoading, courseStructure } = course as any;
    const dispatchCourse = useCourseDispatch() as any;

    const { data: usergroups } = useSWR(
        courseStructure ? `${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}` : null,
        (url: string) => swrFetcher(url, access_token)
    );
    const [isClientPublic, setIsClientPublic] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined) {
            setIsClientPublic(courseStructure.public);
        }
    }, [isLoading, courseStructure]);

    useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined && isClientPublic !== undefined) {
            if (isClientPublic !== courseStructure.public) {
                dispatchCourse({ type: 'setIsNotSaved' });
                const updatedCourse = { ...courseStructure, public: isClientPublic };
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
            }
        }
    }, [isLoading, isClientPublic, courseStructure, dispatchCourse]);

    return (
        <div>
            <div className="flex items-center p-5">
                <CourseMapEditorToolbar undo={() => { }} redo={() => { }} reset={() => { }} />
            </div>
            <MapEditorCanvas courseStructure={courseStructure} readOnly={false} />
        </div>
    );
};

export default EditCourseMap;
