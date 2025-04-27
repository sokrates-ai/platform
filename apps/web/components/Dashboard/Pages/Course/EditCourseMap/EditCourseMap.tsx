import React, { useEffect, useRef, useState, useReducer, Dispatch } from 'react';
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
import { LayoutState } from '@components/Objects/ContentMap/Canvas'; 
const ContentMap = dynamic(() => import('components/Objects/ContentMap/Canvas'), { ssr: false });

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
                    label: chapter.name,
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

// Default boundaries
const DEFAULT_BOUNDARIES = {
    left: -1000,
    right: 1000,
    top: -1000,
    bottom: 1000
};

// Reducer actions
const ACTIONS = {
    SET_LAYOUT: 'set_layout',
    UNDO: 'undo',
    REDO: 'redo',
    RESET: 'reset',
    SET_BOUNDARIES: 'set_boundaries',
    INIT: 'init',
};

// Types for reducer
interface LayoutHistoryState extends LayoutState {
    history: AssetData[][];
    historyIndex: number;
    boundaries?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

type LayoutAction =
    | { type: 'init'; payload: { layout: AssetData[]; boundaries?: { left: number; right: number; top: number; bottom: number } } }
    | { type: 'set_layout'; payload: LayoutState }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'reset'; payload: AssetData[] }
    | { type: 'set_boundaries'; payload: { left: number; right: number; top: number; bottom: number } };

function layoutReducer(state: LayoutHistoryState, action: LayoutAction): LayoutHistoryState {
    switch (action.type) {
        case 'init': {
            return {
                ...state,
                layout: action.payload.layout,
                boundaries: action.payload.boundaries || DEFAULT_BOUNDARIES,
                history: [action.payload.layout],
                historyIndex: 0,
            };
        }
        case 'set_layout': {
            // Only push to history if updateOriginator is 'user'
            if (action.payload.updateOriginator !== 'user' || !action.payload.layout) {
                return {
                    ...state,
                    ...action.payload,
                };
            }
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push([...action.payload.layout]);
            return {
                ...state,
                ...action.payload,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            };
        }
        case 'set_boundaries': {
            if (state.boundaries && 
                state.boundaries.left === action.payload.left &&
                state.boundaries.right === action.payload.right &&
                state.boundaries.top === action.payload.top &&
                state.boundaries.bottom === action.payload.bottom) {
                return state;
            }
            
            return {
                ...state,
                boundaries: action.payload,
                updateOriginator: 'user',
            };
        }
        case 'undo': {
            if (state.historyIndex > 0) {
                const newIndex = state.historyIndex - 1;
                return {
                    ...state,
                    layout: state.history[newIndex],
                    updateOriginator: 'user',
                    historyIndex: newIndex,
                };
            }
            return state;
        }
        case 'redo': {
            if (state.historyIndex < state.history.length - 1) {
                const newIndex = state.historyIndex + 1;
                return {
                    ...state,
                    layout: state.history[newIndex],
                    updateOriginator: 'user',
                    historyIndex: newIndex,
                };
            }
            return state;
        }
        default:
            return state;
    }
}

const EditCourseMap: React.FC<EditCourseMapProps> = () => {
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token
    const course = useCourse() as any
    const { isLoading, courseStructure } = course as any
    const dispatchCourse = useCourseDispatch() as any
    const onMapUpdateCallbackRef = useRef<Function | undefined>(undefined)
    const [showGrid, setShowGrid] = React.useState<boolean>(true)
    const [snapToGrid, setSnapToGrid] = React.useState<boolean>(true)
    const [gridGranularity, setGridGranularity] = React.useState<number>(5)
    // Track last initialized course UUID to prevent infinite re-init
    const lastInitializedUUID = React.useRef<string | undefined>(undefined);

    // Initial state for reducer
    const [state, dispatch] = useReducer(layoutReducer, {
        layout: null,
        updateOriginator: 'initial',
        boundaries: DEFAULT_BOUNDARIES,
        history: [],
        historyIndex: -1,
    } as LayoutHistoryState);

    // Initialize layout and history when courseStructure is loaded (only on first load or course change)
    React.useEffect(() => {
        if (!isLoading && courseStructure?.public !== undefined) {
            const uuid = courseStructure?.course_uuid;
            if (lastInitializedUUID.current === uuid) return;
            lastInitializedUUID.current = uuid;
            onMapUpdateCallbackRef.current = (mapData: any[]) => {
                dispatchCourse({ type: 'setIsNotSaved' })
                const updatedCourse = {
                    ...courseStructure,
                    map_state: {
                        ...courseStructure.map_state,
                        objects: mapData
                    }
                }
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
            }
            const initialLayout = createInitialLayout(courseStructure)
            
            // Extract boundaries from map_state, fall back to legacy worldWidth/worldHeight if needed
            let boundaries = courseStructure.map_state.boundaries;
            
            if (!boundaries && (courseStructure.map_state.worldWidth || courseStructure.map_state.worldHeight)) {
                const width = courseStructure.map_state.worldWidth || 2000;
                const height = courseStructure.map_state.worldHeight || 2000;
                boundaries = {
                    left: -width / 2,
                    right: width / 2,
                    top: -height / 2,
                    bottom: height / 2
                };
            }

            dispatch({
                type: 'init',
                payload: {
                    layout: initialLayout,
                    boundaries: boundaries || DEFAULT_BOUNDARIES,
                }
            })
        }
    }, [isLoading, courseStructure])

    // Call update callback when layout changes (for saving)
    React.useEffect(() => {
        if (state.layout && state.updateOriginator === 'user' && onMapUpdateCallbackRef.current) {
            onMapUpdateCallbackRef.current(state.layout)
        }
    }, [state.layout, state.updateOriginator])

    // Call update callback when boundaries change (for saving)
    React.useEffect(() => {
        if (state.boundaries && state.updateOriginator === 'user' && courseStructure) {
            // Check if boundaries are actually different from what's in course structure
            const currentBoundaries = courseStructure.map_state.boundaries;
            if (currentBoundaries && 
                currentBoundaries.left === state.boundaries.left &&
                currentBoundaries.right === state.boundaries.right &&
                currentBoundaries.top === state.boundaries.top &&
                currentBoundaries.bottom === state.boundaries.bottom) {
                // Skip update if boundaries are the same
                return;
            }

            dispatchCourse({ type: 'setIsNotSaved' })
            const updatedCourse = {
                ...courseStructure,
                map_state: {
                    ...courseStructure.map_state,
                    boundaries: state.boundaries
                }
            }
            dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse })
        }
    }, [state.boundaries, state.updateOriginator, courseStructure, dispatchCourse])

    // Custom setLayout function to be passed to Canvas
    const setLayout = (updater: LayoutState | ((prev: LayoutState) => LayoutState)) => {
        if (typeof updater === 'function') {
            // updater is a function (prevState => newState)
            dispatch({
                type: 'set_layout',
                payload: updater({
                    layout: state.layout,
                    updateOriginator: 'user',
                    boundaries: state.boundaries,
                })
            })
        } else {
            // updater is a direct value
            dispatch({
                type: 'set_layout',
                payload: updater
            })
        }
    }

    function resetLayout() {
        const resetted = updateChapterStonesInContentMapState([], courseStructure.chapters)
        setLayout({
            layout: resetted,
            updateOriginator: 'user',
            boundaries: state.boundaries,
        })
    }

    const handleBoundariesChange = (newBoundaries: { left: number; right: number; top: number; bottom: number }) => {
        dispatch({ 
            type: 'set_boundaries', 
            payload: newBoundaries 
        });
    }

    const handleUndo = () => dispatch({ type: 'undo' })
    const handleRedo = () => dispatch({ type: 'redo' })
    const handleGridToggle = (showGrid: boolean) => setShowGrid(showGrid)
    const handleSnapToggle = (snapToGrid: boolean) => setSnapToGrid(snapToGrid)
    const handleGridGranularityChange = (value: number) => setGridGranularity(value)

    if (!onMapUpdateCallbackRef.current || !state.layout) {
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
                    <CourseMapEditorToolbar
                        undo={handleUndo}
                        redo={handleRedo}
                        reset={resetLayout}
                        boundaries={state.boundaries}
                        onBoundariesChange={handleBoundariesChange}
                        showGrid={showGrid}
                        onShowGridChange={handleGridToggle}
                        snapToGrid={snapToGrid}
                        onSnapToGridChange={handleSnapToggle}
                        gridGranularity={gridGranularity}
                        onGridGranularityChange={handleGridGranularityChange}
                        canUndo={state.historyIndex > 0}
                        canRedo={state.historyIndex < state.history.length - 1}
                    />
                </div>
                <div className="flex-1 overflow-hidden">
                    <ContentMap
                        layout={state}
                        setLayout={setLayout}
                        readOnly={false}
                        showGrid={showGrid}
                        snapToGrid={snapToGrid}
                        gridGranularity={gridGranularity}
                        onChapterClick={() => { }} />
                </div>
            </div>
        );
    }
};

export default EditCourseMap
