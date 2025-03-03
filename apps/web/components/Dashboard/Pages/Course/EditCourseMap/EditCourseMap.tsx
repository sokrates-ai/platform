import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Stage, Sprite, Container, Text as PText } from '@pixi/react';
import {  BaseTexture, SCALE_MODES, Texture, TextStyle } from 'pixi.js';
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

    // TODO: why are the texture sources empty???
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

   const SCALE = 10

  const [zoom, setZoom] = useState(0.05);
  const [size, setSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight,
      scale: SCALE,
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
        console.log('resize')

        const parentDiv = document.getElementById('canvas-parent')
        if (!parentDiv) {
            console.error("BUGGGG")
            return
        }

    const width = parentDiv.offsetWidth
    const height = parentDiv.offsetHeight

      setSize({
        width: width,
        height: height,
        scale: SCALE
      });
    };

    window.addEventListener("resize", handleResize);

    // Call the resize function one time.
    handleResize()

    // Clean up the event listener
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleZoomChange = (factor: number) => {
    setZoom((prevZoom) => Math.max(0.05, prevZoom + factor)); // Prevent zooming too far out
  };

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
        console.log(serialized)
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

    //
    // TODO: when loading the old data from disk, we should create a merge algo that also checks for
    // new chapters / deleted chapters and adds / removes them from the nodes list.
    //
    // MERGE ALGO HERE!!!
    //
    // MERGE ALGO:
    //      1) only add the nodes which are not already present.
    //      2) remove the ones that are no longer present.

    const chapters = courseStructure.courseStructure.chapters

    // Step 1: Prevent duplicates.
    const chaptersToAdd = chapters.filter((chapter: any) => {
        if (additional_elements.find((element) => element.data.associatedWithChapterID === chapter.id)) {
            console.log(`Prevented duplicate: ID ${chapter.id} exists.`)
            return null
        } else {
            return chapter
        }
    })

    const initial: DraggableState[] = chaptersToAdd.map((chapter: any, index: number) => {
       const padding = 1000
       const centerPointX = size.width / 2 * SCALE
       const centerPointY = size.height / 2 * SCALE

       // Translate to the left (approx 100pixels).
       const offsetX = (centerPointX - 100)

       // Translate to the top and then align vertically.
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

       return Object.create({node, data} as DraggableState)
    })

    // Step 2: Remove old chapters.
    const initialWithoutOld = initial.filter((draggable) => {
        // If no chapter is associated, just return it.
        if (!draggable.data.associatedWithChapterID) {
            return draggable
        }

        const corresPondingChapter = chapters.find((chapter: any) => {
            return chapter.id === draggable.data.associatedWithChapterID
        })

        if (!corresPondingChapter) {
            console.log(`Prevented dangling pointer: chapter ${draggable.data.associatedWithChapterID} was deleted`)
            return null
        }

        return draggable
    })

    additional_elementsInternal.current = initialWithoutOld
    setAdditional_elements(initialWithoutOld)
  }, [courseStructure])

    useEffect(()=>{
        //
        // Load previous editor state from disk.
        //

        const item = localStorage.getItem(LS_MAP_STATE_KEY)
        if (!item) {
            // Nothing to load!
            return
        }

        const deserialized: DraggableStateData[] = JSON.parse(item)
        const reconstructed = deserialized.map((data) => {
            const node = draggableNodeFromData(data)

            return {
                data,
                node,
            } as DraggableState
        })

        setAdditional_elementsUnwrapped(reconstructed)
        additional_elementsInternal.current = reconstructed
    }, [])

  function handleClickAsset(_e: any, sprite: any) {
         console.log(size.width / 2, size.height / 2)
         const x = size.width / 2 * SCALE
         const y = size.height / 2 * SCALE
         const id = additional_elements.length

         const data = {
            x,
            y,
            label: sprite.name,
            id,
            textureSources: [sprite.image],
            associatedWithChapterID: null,
        } as DraggableStateData
         const node = draggableNodeFromData(data)

         const toAdd = {
           node,
           data,
        } as DraggableState

        const newList = [...additional_elementsInternal.current, toAdd]

        console.log(newList)

        additional_elementsInternal.current = newList
        setAdditional_elements(newList)
  }

  // Drag functionality (no changes needed here)
  const useDrag = ({ x, y, id }: { x: number, y: number, id: number }) => {
    const sprite = useRef() as RefObject<any>;

    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x, y });

    const setPositionWrapper = ({x, y}: {x: number, y: number}) => {
        const additional_elements2 = additional_elementsInternal.current.map((e) => {
            if (e.data.id  === id) {
                const e2: DraggableState = {
                    node: e.node,
                    data: {
                        id: e.data.id,
                        label: e.data.label,
                        x: x,
                        y: y,
                        textureSources: e.data.textureSources,
                        associatedWithChapterID: e.data.associatedWithChapterID,
                    }
                }

                return e2
            } else {
                return e
            }
        })

        additional_elementsInternal.current = additional_elements2

        setPosition({x, y})
        // console.log(additional_elementsInternal.current)
        // setAdditional_elements(additional_elements2)
    }

    const onDown = useCallback(() => {
        setIsDragging(true)
    }, []);

    const onUp = useCallback(() => {
     setIsDragging(false)

     // setTimeout(() => {
     //    setAdditional_elements(additional_elementsInternal.current)
     // }, 100)

    }, [])

    // TODO: this is currently fucked
    const onMove = useCallback((e: any) => {
        // console.dir(e)
      if (isDragging && sprite.current) {
        setPositionWrapper(e.data.getLocalPosition((sprite.current as any).parent));
      }
    }, [isDragging, setPosition]);

    return {
      ref: sprite,
      interactive: true,
      pointerdown: onDown,
      pointerup: onUp,
      pointerupoutside: onUp,
      pointermove: onMove,
      alpha: isDragging ? 0.5 : 1,
      anchor: 0.5,
      position,
    };
  };

  // const DraggableBunny = ({ x = 400, y = 300, ...props }) => {
  //   const bind = useDrag({ x, y });
  //
  //   return (
  //     <Sprite
  //       image="https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/IaUrttj.png"
  //       scale={4}
  //       {...bind}
  //       {...props}
  //     />
  //   );
  // };

  const DraggableAsset = ({ x, y, id, src, ...props }: { x: number, y: number, id: number, src: string }) => {
    const bind = useDrag({ x, y, id });

    // Create texture and set scale mode
    const texture = React.useMemo(() => {
        console.log(`TEX SRC=${src}`)
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

    // Create texture and set scale mode
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
                        fill: ['#ffffff', '#00ff99'], // gradient
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
        <div className='flex w-full h-full overflow-hidden' style={{height: 'calc(100vh - 19rem)'}}>
            <div id='canvas-parent' style={{width: '85%', height: 'auto', 'aspectRatio': '16/9'}}>
                <Stage
                    options={{
                        background: 0x8da64a,
                        autoDensity: true,
                        resolution: window.devicePixelRatio * 4
                    }}
                    style={{ width: size.width, height: size.height }}
                >
                <Container scale={zoom}>
                    {additional_elements.map((sprite) => ( sprite.node ))}
                    </Container>
                </Stage>
            </div>
            <div className='bg-gray-300 p-5' style={{width: '15%', 'overflowY': 'scroll'}}>
                <div className="sprite-panel flex flex-col items-center gap-10">
                    {SPRITES.map((sprite, index) => (
                        <div
                            key={index}
                            draggable
                            // onDragStart={(e) => handleDragStart(e, sprite)}  // Trigger drag start for each sprite
                            onClick={(e) => handleClickAsset(e, sprite)}
                            className='sprite-item flex flex-col items-center p-10 rounded-md w-full box-border bg-gray-400 hover:bg-sky-600 cursor-pointer'
                        >
                            <img
                                style={{filter: "saturate(150%)"}}
                                src={spriteURL(sprite.file)}
                                // src={'/contentMap/Bank.webp'}
                                alt={sprite.label}
                                width={80}
                            />
                            <span
                                style={{maxWidth: '8rem'}}
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

    const { data: usergroups } = useSWR(courseStructure ? `${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}` : null, (url: string) => swrFetcher(url, access_token));
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
                    undo={() => {}}
                    redo={() => {}}
                    reset={() => {}}
                />
            </div>
            <MapEditorCanvas courseStructure={courseStructure}/>
        </div>
    );
}

export default EditCourseMap;
