import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { CourseMapEditorToolbar } from './EditCourseMapToolbar';
import { BarLoader } from 'react-spinners';

import dynamic from 'next/dynamic';
import { AssetData } from '@components/Objects/ContentMap/Asset';
import { SPRITES } from '@components/Objects/ContentMap/spriteIndex';
import ChapterActivities from '@components/Pages/Courses/ChapterActivities';
import { SPRITE_SCALE_FACTOR } from '@components/Objects/ContentMap/constants';
import { setLazyProp } from 'next/dist/server/api-utils';
import { LayoutState } from './../../../../Objects/ContentMap/Canvas';
const ContentMap = dynamic(() => import('./../../../../Objects/ContentMap/Canvas'), { ssr: false });

export interface EditCourseMapProps {
    orgslug: string
    course_uuid?: string
    onChapterClick?: (chapterID: number) => void
}

function updateChapterStonesInContentMapState(oldState: AssetData[], chapters: any[]): AssetData[] {
    // if (!courseStructure || !courseStructure.chapters) return;
    
    const currentChapterNodes = oldState.filter(el => el.type && el.type.kind === 'chapter');
    const nonChapterNodes = oldState.filter(el => !el.type || el.type.kind !== 'chapter');

    const CHAPTER_SPRITE_LABEL = 'Stein blockiert.webp'
    const chapterSprite = SPRITES.find((sprite) => sprite.file === CHAPTER_SPRITE_LABEL)
    if (!chapterSprite) {
        throw("Chapter asset not found in sprite index; Index is likely corrupt.")
    }

    const newChapterNodes: AssetData[] = chapters
        .filter((chapter: any) =>
            !currentChapterNodes.some(el => el.type.associatedChapterID === chapter.id)
        )
        .map((chapter: any, index: number) => {
            const padding = 150;

            const offsetX = padding
            const offsetY = index * padding + padding
            const data: AssetData = {
                x: offsetX,
                y: offsetY,
                label: `${chapter.id}`,
                id: -chapter.id,
                scale: SPRITE_SCALE_FACTOR,
                file: chapterSprite.file,
                type: {
                    kind: "chapter",
                    associatedChapterID: chapter.id,
                }
            };
            return data
        });

    const updatedChapterNodes = currentChapterNodes.filter(el =>
        chapters.find((chapter: any) => chapter.id === el.type.associatedChapterID)
    );

    const merged = [...nonChapterNodes, ...updatedChapterNodes, ...newChapterNodes];
    return merged

}

function createInitialLayout(courseStructure: any): AssetData[] {
    const layout = courseStructure.map_state.objects
    console.log(layout)
    // TODO: for the production version: perform a deep type verification here and fix it in case it is broken.
    return updateChapterStonesInContentMapState(layout, courseStructure.chapters)
}

const EditCourseMap: React.FC<EditCourseMapProps> = () => {
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token
    const course = useCourse() as any
    const { isLoading, courseStructure } = course as any
    const dispatchCourse = useCourseDispatch() as any

    //
    // Load an initial layout.
    //

    const [layout, setLayout] = useState<LayoutState>({
        layout: null,
        updateOriginator: 'initial'
    })
    const onMapUpdateCallbackRef = useRef<Function | undefined>(undefined)

    useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined) {
            onMapUpdateCallbackRef.current = (mapData: any[]) => {
                dispatchCourse({ type: 'setIsNotSaved' })
                const updatedCourse = { ...courseStructure, map_state: { objects: mapData } }
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
            }

            console.log("Created initial layout.")
            // setLayout()

            const initialLayout = createInitialLayout(courseStructure)
            setLayout({
                layout: initialLayout,
                updateOriginator: 'initial'
            })
        }
    }, [isLoading, courseStructure])

    //
    // Listen to layout updates.
    //

    useEffect(() => {
        if (layout.updateOriginator !== 'user') {
            console.log('not a real update')
            return
        }

        console.log("LAYOUT CHANGE: ")

        if (!onMapUpdateCallbackRef.current) {
            console.log(onMapUpdateCallbackRef.current)
            throw("BUG: map update callback is not a function")
        }

        onMapUpdateCallbackRef.current!(layout.layout)

    }, [layout])

    function resetLayout() {
        const resetted = updateChapterStonesInContentMapState([], courseStructure.chapters)
        setLayout({
            layout: resetted,
            updateOriginator: 'user'
        })
    }

    if (!onMapUpdateCallbackRef.current || !layout) {
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
                    <CourseMapEditorToolbar undo={() => { }} redo={() => { }} reset={resetLayout} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <ContentMap
                        layout={layout}
                        setLayout={setLayout}
                        readOnly={false}
                        onChapterClick={() => { }} />
                </div>
            </div>
        );
    }
};

export default EditCourseMap
