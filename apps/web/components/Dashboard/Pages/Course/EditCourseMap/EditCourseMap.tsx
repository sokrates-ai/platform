import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { MutableRefObject, Ref, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Stage, Sprite } from '@pixi/react';
import {  BlurFilter, SCALE_MODES } from 'pixi.js';
import { TEST_SPRITES } from './assets'
import { settings as pixiSettings } from 'pixi.js'

type EditCourseMapProps = {
    orgslug: string
    course_uuid?: string
}



const MapEditorCanvas = () => {
  // const blurFilter = useMemo(() => new BlurFilter(2), []);
  // const bunnyUrl = 'https://pixijs.io/pixi-react/img/bunny.png';
  // Set PixiJS SCALE_MODE
  pixiSettings.SCALE_MODE = SCALE_MODES.NEAREST;

  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
        console.log('resize')

        const parentDiv = document.getElementById('canvas-parent')
        if (!parentDiv) {
            console.error("BUGGGG")
            return
        }

      setSize({
        width: parentDiv.offsetWidth,
        height: parentDiv.offsetHeight,
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

  interface DraggableState {
    x: number,
    y: number,
    source: string,
    label: string,
    id: number,
  }

  const [additional_elementsInternal, setAdditional_elementsInternal] = useState<DraggableState[]>([])
  const [additional_elements, setAdditional_elements] = useState<DraggableState[]>([])

  function handleClickAsset(e: any, sprite: any) {
        const newList = [...additional_elementsInternal, {
           x: 100,
           y: 100,
           source: sprite.image,
           label: sprite.name,
           id: additional_elements.length,
        } as DraggableState]

        console.log(newList)

        setAdditional_elements(newList)
  }

  // Drag functionality (no changes needed here)
  const useDrag = ({ x, y, id }: { x: number, y: number, id: number }) => {
    const sprite = useRef() as RefObject<any>;

    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x, y });

    const setPositionWrapper = ({x, y}: {x: number, y: number}) => {
        setPosition({x, y})
    }

    const onDown = useCallback(() => {
        // const additional_elements2 = additional_elements.map((e) => {
        //     if (e.id  === id) {
        //         const e2 = {
        //             ...e,
        //             x: x,
        //             y: y,
        //         }
        //
        //         console.dir(e2)
        //
        //         return e2
        //     } else {
        //         return e
        //     }
        // })
        // setAdditional_elementsInternal(additional_elements2)

        setIsDragging(true)
    }, []);
    const onUp = useCallback(() => setIsDragging(false), []);
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

  const DraggableAsset = ({ x = 400, y = 300, id = 0, src="", ...props }) => {
    const bind = useDrag({ x, y, id });

    return (
      <Sprite
        image={src}
        scale={4}
        {...bind}
        {...props}
      />
    );
  };


  // const [sprites, setSprites] = useState([]);  // Store sprite positions
  // const [draggingSprite, setDraggingSprite] = useState(null);  // Keep track of the dragged sprite
  // const [dragStartPos, setDragStartPos] = useState(null);  // Store the starting position of the drag

  // Function to handle drop
  // const handleDrop = (e: any) => {
  //   if (draggingSprite) {
  //     const dropX = e.data.global.x;
  //     const dropY = e.data.global.y;
  //     setSprites((prevSprites) => [
  //       ...prevSprites,
  //       { ...draggingSprite, x: dropX, y: dropY },
  //     ]);
  //     setDraggingSprite(null);  // Clear the dragging state after drop
  //   }
  // };
  //
  // // Function to handle when drag starts
  // const handleDragStart = (e: any, sprite: any) => {
  //     console.dir(e.clientX)
  //   setDraggingSprite(sprite);
  //   setDragStartPos({ x: e.clientX, y: e.clientY });
  // };
  //
  // // Function to update the position of the dragging sprite (on mouse move)
  // const handleDragMove = (e: any) => {
  //   if (draggingSprite) {
  //     const deltaX = e.data.global.x - dragStartPos.x;  // Calculate the delta from the start
  //     const deltaY = e.data.global.y - dragStartPos.y;
  //     setDraggingSprite({ ...draggingSprite, x: draggingSprite.x + deltaX, y: draggingSprite.y + deltaY });
  //     setDragStartPos({ x: e.data.global.x, y: e.data.global.y });  // Update the drag start position
  //   }
  // };

  return (
        <div className='flex w-full h-full bg-green-100'>
            <div id='canvas-parent' style={{width: '80%', height: 'auto', 'aspectRatio': '16/9'}}>
                <Stage options={{ background: 0x1099bb }} style={{ width: size.width, height: size.height }}>
                    {additional_elements.map((sprite, _) => (
                        <DraggableAsset
                            id={sprite.id}
                            x={100}
                            y={100}
                            scale={0.1}
                            src={sprite.source}
                        />
                    ))}
                </Stage>
            </div>
            <div className='w-1/3 bg-red-400' style={{width: '20%', 'overflowY': 'auto', height: '100%'}}>
                <div className="sprite-panel">
                    <h3>Available Sprites</h3>
                        {TEST_SPRITES.map((sprite, index) => (
                        <div
                            key={index}
                            className="sprite-item"
                            draggable
                            // onDragStart={(e) => handleDragStart(e, sprite)}  // Trigger drag start for each sprite
                            onClick={(e) => handleClickAsset(e, sprite)}
                        >
                            <img src={sprite.image} alt={sprite.name} width={50} height={50} />
                            <p>{sprite.name}</p>
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
        <MapEditorCanvas/>
    );
}

export default EditCourseMap;
