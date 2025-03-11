import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Stage, Sprite, Container, Text as PText } from '@pixi/react';
import { BaseTexture, SCALE_MODES, Texture, TextStyle, Point } from 'pixi.js';
import { SPRITES } from './spriteIndex'
import { CourseMapEditorToolbar } from './CourseMapEditorToolbar'

BaseTexture.defaultOptions.scaleMode = SCALE_MODES.LINEAR;

type EditCourseMapProps = {
    orgslug: string
    course_uuid?: string
}

function spriteURL(file: string): string {
    return `/contentMap/${file}`
}

const LS_MAP_STATE_KEY = 'map_state'

const MapEditorCanvas = (courseStructure: any) => {
    function draggableNodeFromData(data: DraggableStateData): ReactNode {
        if (data.associatedWithChapterID) {
            return (<ChapterAsset
                x={data.x}
                y={data.y}
                overlaySource={data.textureSources[0]}
                stoneSource={data.textureSources[1]}
                chapterID={data.associatedWithChapterID}
                id={data.id}
            />)
        } else {
            return (
                <DraggableAsset
                    x={data.x}
                    y={data.y}
                    id={data.id}
                    src={data.textureSources[0]}
                />
            )
        }
    }

    useEffect(() => {
        const canvasParent = document.getElementById('canvas-parent');
        if (!canvasParent) return;

        const handleWheelPassive = (e: WheelEvent) => {
            e.preventDefault();
        };

        canvasParent.addEventListener('wheel', handleWheelPassive, { passive: false });

        return () => {
            canvasParent.removeEventListener('wheel', handleWheelPassive);
        };
    }, []);

    const SCALE = 1

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
        scale: SCALE,
    });

    const targetOffsetRef = useRef(offset);

    useEffect(() => {
        const handleResize = () => {
            const parentDiv = document.getElementById('canvas-parent');
            if (!parentDiv) {
                return;
            }
            const width = parentDiv.clientWidth;
            const height = parentDiv.clientHeight;
            setSize({
                width,
                height,
                scale: SCALE
            });
        };

        window.addEventListener("resize", handleResize);
        handleResize();
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        targetOffsetRef.current = {
            x: targetOffsetRef.current.x - e.deltaX,
            y: targetOffsetRef.current.y - e.deltaY,
        };
    };

    useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            setOffset((prev) => {
                const target = targetOffsetRef.current;
                const lerpFactor = 0.9;
                const newX = prev.x + (target.x - prev.x) * lerpFactor;
                const newY = prev.y + (target.y - prev.y) * lerpFactor;
                return { x: newX, y: newY };
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);


    interface DraggableStateData {
        x: number,
        y: number,
        label: string,
        id: number,
        textureSources: string[],
        associatedWithChapterID: number | null
    }

    interface DraggableState {
        node: ReactNode,
        data: DraggableStateData,
    }

    const initialElements: DraggableState[] = []
    const additional_elementsInternal = useRef<DraggableState[]>(initialElements)
    const [additional_elements, setAdditional_elementsUnwrapped] = useState<DraggableState[]>(initialElements)

    function serializeEditorState(data: DraggableState[]) {
        const serialized = JSON.stringify(data.map((datapoint) => datapoint.data))
        localStorage.setItem(LS_MAP_STATE_KEY, serialized)
    }

    function setAdditional_elements(data: DraggableState[]) {
        serializeEditorState(data)
        setAdditional_elementsUnwrapped(data)
    }

    useEffect(() => {
        if (!courseStructure.courseStructure.chapters) {
            return
        }

        // MERGE ALGO:
        //      1) only add the nodes which are not already present.
        //      2) remove the ones that are no longer present.
        const chapters = courseStructure.courseStructure.chapters

        // Step 1: Prevent duplicates.
        const chaptersToAdd = chapters.filter((chapter: any) => {
            if (additional_elements.find((element) => element.data.associatedWithChapterID === chapter.id)) {
                return null
            } else {
                return chapter
            }
        })

        const initial: DraggableState[] = chaptersToAdd.map((chapter: any, index: number) => {
            const padding = 1000
            const centerPointX = size.width / 2 * SCALE
            const centerPointY = size.height / 2 * SCALE
            const offsetX = (centerPointX - 100)
            const offsetY = (centerPointY + index * padding) - (courseStructure.courseStructure.chapters.length * padding / 2)

            const aboveTextureSource = spriteURL(SPRITES[30].file)
            const stoneTextureSource = spriteURL(SPRITES[112].file)

            const data = {
                x: offsetX,
                y: offsetY,
                label: `${chapter.id}`,
                id: -chapter.id,
                textureSources: [
                    aboveTextureSource,
                    stoneTextureSource,
                ],
                associatedWithChapterID: chapter.id,
            }
            const node = draggableNodeFromData(data)
            return Object.create({ node, data } as DraggableState)
        })

        // Step 2: Remove old chapters.
        const initialWithoutOld = initial.filter((draggable) => {
            if (!draggable.data.associatedWithChapterID) {
                return draggable
            }
            const corresPondingChapter = chapters.find((chapter: any) => {
                return chapter.id === draggable.data.associatedWithChapterID
            })
            if (!corresPondingChapter) {
                return null
            }
            return draggable
        })

        additional_elementsInternal.current = initialWithoutOld
        setAdditional_elements(initialWithoutOld)
    }, [courseStructure])

    useEffect(() => {
        // Load previous editor state from disk.
        const item = localStorage.getItem(LS_MAP_STATE_KEY)
        if (!item) {
            return
        }
        const deserialized: DraggableStateData[] = JSON.parse(item)
        const reconstructed = deserialized.map((data) => {
            const node = draggableNodeFromData(data)
            return { data, node } as DraggableState
        })
        setAdditional_elementsUnwrapped(reconstructed)
        additional_elementsInternal.current = reconstructed
    }, [])

    function handleClickAsset(_e: any, sprite: any) {
        const x = size.width / 2 * SCALE
        const y = size.height / 2 * SCALE
        const id = additional_elements.length

        const data = {
            x,
            y,
            label: sprite.name,
            id,
            textureSources: [spriteURL(sprite.file)],
            associatedWithChapterID: null,
        } as DraggableStateData
        const node = draggableNodeFromData(data)
        const toAdd = { node, data } as DraggableState
        const newList = [...additional_elementsInternal.current, toAdd]
        additional_elementsInternal.current = newList
        setAdditional_elements(newList)
    }

    const useDrag = ({ x, y, id }: { x: number, y: number, id: number }) => {
        const sprite = useRef<any>(null);
        const [isDragging, setIsDragging] = useState(false);
        const [position, setPosition] = useState({ x, y });
        const stageRef = useRef<any>(null);
        const isDraggingRef = useRef(false);

        const setPositionWrapper = ({ x, y }: { x: number, y: number }) => {
            // Update the state and persist the new position in additional_elementsInternal
            const updatedElements = additional_elementsInternal.current.map((e) => {
                if (e.data.id === id) {
                    return {
                        node: e.node,
                        data: { ...e.data, x, y },
                    };
                }
                return e;
            });
            additional_elementsInternal.current = updatedElements;
            setPosition({ x, y });
        };

        const setIsDraggingWrapper = (value: any) => {
            isDraggingRef.current = value;
            setIsDragging(value);
        };

        // Global pointer move event using Pixi's toLocal conversion.
        const onGlobalMove = useCallback((e: PointerEvent) => {
            const canvasElement = document.getElementById('canvas-parent');
            if (canvasElement) {
                const canvasBounds = canvasElement.getBoundingClientRect();

                const relativeX = e.clientX - canvasBounds.left;
                const relativeY = e.clientY - canvasBounds.top;

                const localPos = stageRef.current.toLocal(new Point(relativeX, relativeY));
                setPositionWrapper(localPos);
            }
        }, []);

        const onGlobalUp = useCallback((e: any) => {
            setIsDraggingWrapper(false);
            window.removeEventListener('pointermove', onGlobalMove);
            window.removeEventListener('pointerup', onGlobalUp);
        }, [onGlobalMove]);

        const onDown = useCallback((e: any) => {
            setIsDraggingWrapper(true);
            stageRef.current = sprite.current?.parent;
            window.addEventListener('pointermove', onGlobalMove);
            window.addEventListener('pointerup', onGlobalUp);
        }, [onGlobalMove, onGlobalUp]);

        const onMove = useCallback((e: any) => {
            if (isDraggingRef.current && sprite.current) {
                const newPos = e.data.getLocalPosition(sprite.current.parent);
                setPositionWrapper(newPos);
            }
        }, []);

        return {
            ref: sprite,
            interactive: true,
            pointerdown: onDown,
            pointermove: onMove,
            alpha: isDragging ? 0.5 : 1,
            anchor: 0.5,
            position,
        };
    };

    const DraggableAsset = ({ x, y, id, src, ...props }: { x: number, y: number, id: number, src: string }) => {
        const bind = useDrag({ x, y, id });
        const texture = React.useMemo(() => {
            const tex = Texture.from(src);
            tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
            return tex;
        }, [src]);

        return (
            <Sprite
                texture={texture}
                scale={1}
                {...bind}
                {...props}
            />
        );
    };

    const ChapterAsset = (
        { x, y, id, overlaySource, stoneSource, chapterID, ...props }:
            {
                x: number,
                y: number,
                id: number,
                overlaySource: string,
                stoneSource: string,
                chapterID: number,
            }) => {
        const bind = useDrag({ x, y, id });
        const texture = React.useMemo(() => {
            const tex = Texture.from(overlaySource);
            tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
            return tex;
        }, [overlaySource]);

        const stoneTexture = React.useMemo(() => {
            const tex = Texture.from(stoneSource);
            tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
            return tex;
        }, [stoneSource]);

        return (
            <Container>
                <Sprite
                    texture={stoneTexture}
                    scale={1}
                    {...bind}
                    {...props}
                />
                <Sprite
                    texture={texture}
                    scale={1}
                    {...bind}
                    {...props}
                />
                <PText
                    text={`${chapterID}`}
                    {...bind}
                    {...props}
                    style={
                        new TextStyle({
                            align: 'center',
                            fontFamily: '"Source Sans Pro", Helvetica, sans-serif',
                            fontSize: 300,
                            fontWeight: '400',
                            fill: ['#ffffff', '#00ff99'],
                            stroke: '#01d27e',
                            strokeThickness: 5,
                            letterSpacing: 20,
                            dropShadow: true,
                            dropShadowColor: '#ccced2',
                            dropShadowBlur: 4,
                            dropShadowAngle: Math.PI / 6,
                            dropShadowDistance: 6,
                            wordWrap: true,
                            wordWrapWidth: 440,
                        })
                    }
                />
            </Container>
        );
    };

    return (
        <div className="flex w-full h-full overflow-hidden" style={{ height: 'calc(100vh - 19rem)'}}>
            <div
                id="canvas-parent"
                style={{ width: '85%', height: '100%', overscrollBehaviorX: 'none'}}
                onWheel={handleWheel}
            >
                <Stage
                    width={size.width}
                    height={size.height}
                    options={{
                        background: 0x8da64a,
                        autoDensity: true,
                        resolution: window.devicePixelRatio * 4,
                        antialias: true,
                    }}
                >
                    <Container scale={0.1} position={[offset.x, offset.y]}>
                        {additional_elements.map((sprite) => sprite.node)}
                    </Container>
                </Stage>
            </div>

            <div className='bg-gray-300 p-5' style={{ width: '15%', overflowY: 'scroll' }}>
                <div className="sprite-panel flex flex-col items-center gap-10">
                    {SPRITES.map((sprite, index) => (
                        <div
                            key={index}
                            draggable
                            onClick={(e) => handleClickAsset(e, sprite)}
                            className='sprite-item flex flex-col items-center p-10 rounded-md w-full box-border bg-gray-400 hover:bg-sky-600 cursor-pointer'
                        >
                            <img
                                style={{ filter: "saturate(150%)" }}
                                src={spriteURL(sprite.file)}
                                alt={sprite.label}
                                width={80}
                            />
                            <span
                                style={{ maxWidth: '8rem' }}
                                className='font-bold text-2xl text-ellipsis overflow-hidden'
                            >
                                {sprite.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

function EditCourseMap(props: EditCourseMapProps) {
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
                const updatedCourse = {
                    ...courseStructure,
                    public: isClientPublic,
                };
                dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
            }
        }
    }, [isLoading, isClientPublic, courseStructure, dispatchCourse]);

    return (
        <div>
            <div className='flex items-center p-5'>
                <CourseMapEditorToolbar
                    undo={() => { }}
                    redo={() => { }}
                    reset={() => { }}
                />
            </div>
            <MapEditorCanvas courseStructure={courseStructure} />
        </div>
    );
}

export default EditCourseMap;
