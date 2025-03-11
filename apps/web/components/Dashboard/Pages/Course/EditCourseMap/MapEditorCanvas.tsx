import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Container } from '@pixi/react';
import { SCALE_MODES } from 'pixi.js';
import { DraggableAsset } from './DraggableAsset';
import { ChapterAsset } from './ChapterAsset';
import { DraggableState, DraggableStateData } from './types';
import { SPRITES } from './spriteIndex';

const LS_MAP_STATE_KEY = 'map_state';
const SCALE = 1;

export interface MapEditorCanvasProps {
  courseStructure: any;
  readOnly?: boolean;
}

export const MapEditorCanvas: React.FC<MapEditorCanvasProps> = ({
  courseStructure,
  readOnly = false,
}) => {
  // State for panning and canvas size
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    scale: SCALE,
  });
  const targetOffsetRef = useRef(offset);

  // State for draggable elements
  const initialElements: DraggableState[] = [];
  const additionalElementsRef = useRef<DraggableState[]>(initialElements);
  const [additionalElements, setAdditionalElementsState] = useState<DraggableState[]>(initialElements);

  // Helper: build sprite URL
  const spriteURL = (file: string): string => `/contentMap/${file}`;

  // Memoize the node renderer so it doesn’t change on every render.
  const renderDraggableNode = useCallback((data: DraggableStateData): React.ReactNode => {
    if (data.associatedWithChapterID) {
      return (
        <ChapterAsset
          x={data.x}
          y={data.y}
          overlaySource={data.textureSources[0]}
          stoneSource={data.textureSources[1]}
          chapterID={data.associatedWithChapterID}
          id={data.id}
          readOnly={readOnly}
        />
      );
    }
    return (
      <DraggableAsset
        x={data.x}
        y={data.y}
        id={data.id}
        src={data.textureSources[0]}
        readOnly={readOnly}
      />
    );
  }, [readOnly]);

  // Save editor state to localStorage
  const serializeEditorState = useCallback((data: DraggableState[]) => {
    const serialized = JSON.stringify(data.map((d) => d.data));
    localStorage.setItem(LS_MAP_STATE_KEY, serialized);
  }, []);

  const setAdditionalElements = (data: DraggableState[]) => {
    serializeEditorState(data);
    setAdditionalElementsState(data);
  };

  // Handle canvas resizing
  useEffect(() => {
    const handleResize = () => {
      const parentDiv = document.getElementById('canvas-parent');
      if (!parentDiv) return;
      setSize({
        width: parentDiv.clientWidth,
        height: parentDiv.clientHeight,
        scale: SCALE,
      });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent default wheel behavior on canvas
  useEffect(() => {
    const canvasParent = document.getElementById('canvas-parent');
    if (!canvasParent) return;
    const handleWheelPassive = (e: WheelEvent) => {
      e.preventDefault();
    };
    canvasParent.addEventListener('wheel', handleWheelPassive, { passive: false });
    return () => canvasParent.removeEventListener('wheel', handleWheelPassive);
  }, []);

  // Pan the canvas using the wheel event.
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetOffsetRef.current = {
      x: targetOffsetRef.current.x - e.deltaX,
      y: targetOffsetRef.current.y - e.deltaY,
    };
  };

  // Animate the panning with a simple lerp.
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setOffset((prev) => {
        const target = targetOffsetRef.current;
        const lerpFactor = 0.7;
        const newX = prev.x + (target.x - prev.x) * lerpFactor;
        const newY = prev.y + (target.y - prev.y) * lerpFactor;
        return { x: newX, y: newY };
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Merge chapter nodes without overwriting existing ones.
  useEffect(() => {
    if (!courseStructure || !courseStructure.chapters) return;
    const chapters = courseStructure.chapters;

    // Separate the current nodes into chapter and non-chapter assets.
    const currentChapterNodes = additionalElementsRef.current.filter(
      (el) => el.data.associatedWithChapterID !== null
    );
    const nonChapterNodes = additionalElementsRef.current.filter(
      (el) => el.data.associatedWithChapterID === null
    );

    // Create new nodes for chapters that are not already on the map.
    const newChapterNodes: DraggableState[] = chapters
      .filter((chapter: any) =>
        !currentChapterNodes.some(el => el.data.associatedWithChapterID === chapter.id)
      )
      .map((chapter: any, index: number) => {
        const padding = 1000;
        const centerX = (size.width / 2) * SCALE;
        const centerY = (size.height / 2) * SCALE;
        const offsetX = centerX - 100;
        const offsetY = centerY + index * padding - (chapters.length * padding) / 2;
        const data: DraggableStateData = {
          x: offsetX,
          y: offsetY,
          label: `${chapter.id}`,
          id: -chapter.id,
          textureSources: [
            spriteURL(SPRITES[30].file),
            spriteURL(SPRITES[112].file),
          ],
          associatedWithChapterID: chapter.id,
        };
        return { data, node: renderDraggableNode(data) };
      });

    // Remove any chapter nodes that no longer exist in the course structure.
    const updatedChapterNodes = currentChapterNodes.filter(el =>
      chapters.find((chapter: any) => chapter.id === el.data.associatedWithChapterID)
    );

    // Merge non-chapter assets with the updated chapter nodes.
    const merged = [...nonChapterNodes, ...updatedChapterNodes, ...newChapterNodes];

    additionalElementsRef.current = merged;
    setAdditionalElements(merged);
  }, [courseStructure, size, renderDraggableNode]);

  // Load saved state from localStorage (runs only once on mount)
  useEffect(() => {
    const item = localStorage.getItem(LS_MAP_STATE_KEY);
    if (!item) return;
    try {
      const deserialized: DraggableStateData[] = JSON.parse(item);
      const reconstructed = deserialized.map((data) => ({
        data,
        node: renderDraggableNode(data),
      }));
      setAdditionalElementsState(reconstructed);
      additionalElementsRef.current = reconstructed;
    } catch (error) {
      console.error("Failed to parse stored map state", error);
    }
  }, [renderDraggableNode]);

  // Handler for adding a new asset from the sprite panel.
  const handleClickAsset = (sprite: any) => {
    const x = (size.width / 2) * SCALE;
    const y = (size.height / 2) * SCALE;
    const id = additionalElementsRef.current.length;
    const data: DraggableStateData = {
      x,
      y,
      label: sprite.name,
      id,
      textureSources: [spriteURL(sprite.file)],
      associatedWithChapterID: null,
    };
    const newElement = {
      data,
      node: renderDraggableNode(data),
    };
    const newList = [...additionalElementsRef.current, newElement];
    additionalElementsRef.current = newList;
    setAdditionalElements(newList);
  };

  return (
    <div className="flex w-full h-full overflow-hidden" style={{ height: 'calc(100vh - 19rem)' }}>
      <div
        id="canvas-parent"
        style={{ width: '85%', height: '100%', overscrollBehaviorX: 'none' }}
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
            {additionalElements.map((sprite) => sprite.node)}
          </Container>
        </Stage>
      </div>

      {/* Only show the asset panel if not in read-only mode */}
      {!readOnly && (
        <div className="bg-gray-300 p-5" style={{ width: '15%', overflowY: 'scroll' }}>
          <div className="sprite-panel flex flex-col items-center gap-10">
            {SPRITES.map((sprite, index) => (
              <div
                key={index}
                className="sprite-item flex flex-col items-center p-10 rounded-md w-full box-border bg-gray-400 hover:bg-sky-600 cursor-pointer"
                onClick={() => handleClickAsset(sprite)}
              >
                <img
                  style={{ filter: "saturate(150%)" }}
                  src={spriteURL(sprite.file)}
                  alt={sprite.label}
                  width={80}
                />
                <span className="font-bold text-2xl text-ellipsis overflow-hidden" style={{ maxWidth: '8rem' }}>
                  {sprite.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
