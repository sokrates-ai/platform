import { useCallback, useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { AssetData } from "../Asset/assetTypes";

const snap = (v: number, g: number) => Math.round(v / g) * g;

interface Props {
  placedAssets: AssetData[];
  selectedIds: number[];
  onSelectIds: React.Dispatch<React.SetStateAction<number[]>>;
  onAssetPositionChange: (id: number, x: number, y: number) => void;
  onAssetContextMenu?: (
    assetId: number,
    pos: { clientX: number; clientY: number }
  ) => void;
  onAssetClick?: (asset: AssetData) => void;
  onChapterClick?: (chapterID: number) => void;
  readOnly: boolean;
  viewport: Viewport | null;
  snapToGrid?: boolean;
  gridSize: number;
}

export default function useDragInteractions({
  placedAssets,
  selectedIds,
  onSelectIds,
  onAssetPositionChange,
  onAssetContextMenu,
  onAssetClick,
  onChapterClick,
  readOnly,
  viewport,
  snapToGrid = true,
  gridSize,
}: Props) {
  /** ---- refs / state --------------------------------------------------- */
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<any>(null);
  const clickRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [tempPos, setTempPos] = useState(
    new Map<number, { x: number; y: number }>()
  );

  /* cache the canvas DOM element once */
  useEffect(() => {
    canvasRef.current = document.getElementById("canvas-parent");
  }, []);

  /** ---- internal helpers ---------------------------------------------- */
  const onMove = useCallback(
    (evt: PointerEvent) => {
      if (!dragRef.current || !viewport) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const world = viewport.toWorld(evt.clientX - r.left, evt.clientY - r.top);

      const {
        assetRef,
        offsetX,
        offsetY,
        selected,
        selectedIds: dragIds,
        initialPositions,
      } = dragRef.current;

      dragRef.current.moved = true;
      const rx = world.x - offsetX;
      const ry = world.y - offsetY;
      const nx = snapToGrid ? snap(rx, gridSize) : rx;
      const ny = snapToGrid ? snap(ry, gridSize) : ry;
      assetRef.position.set(nx, ny);

      /* mirror movement on other selected nodes */
      if (selected && dragIds.length > 1) {
        const { x: ox, y: oy } = initialPositions.get(dragRef.current.id);
        const dx = nx - ox;
        const dy = ny - oy;
        const m = new Map<number, { x: number; y: number }>();
        dragIds.forEach((aid: number) => {
          const { x, y } = initialPositions.get(aid);
          m.set(aid, {
            x: snapToGrid ? snap(x + dx, gridSize) : x + dx,
            y: snapToGrid ? snap(y + dy, gridSize) : y + dy,
          });
        });
        setTempPos(m);
      }
    },
    [gridSize, snapToGrid, viewport]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    const {
      id,
      assetRef,
      selected,
      selectedIds: dragIds,
      initialPositions,
    } = dragRef.current;

    let fx = assetRef.x;
    let fy = assetRef.y;
    if (snapToGrid) {
      fx = snap(assetRef.x, gridSize);
      fy = snap(assetRef.y, gridSize);
      assetRef.position.set(fx, fy);
    }

    /* multi-select – apply delta to every selected node */
    if (selected && dragIds.length > 1) {
      const { x: ox, y: oy } = initialPositions.get(id);
      const dx = fx - ox;
      const dy = fy - oy;
      dragIds.forEach((aid: number) => {
        const { x, y } = initialPositions.get(aid);
        onAssetPositionChange(
          aid,
          snapToGrid ? snap(x + dx, gridSize) : x + dx,
          snapToGrid ? snap(y + dy, gridSize) : y + dy
        );
      });
    } else {
      onAssetPositionChange(id, fx, fy);
    }

    setTempPos(new Map());
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    viewport?.plugins?.resume("drag");
  }, [gridSize, onAssetPositionChange, snapToGrid, viewport, onMove]);

  const handleClickMove = useCallback((evt: PointerEvent) => {
    if (!clickRef.current) return;
    const dx = evt.clientX - clickRef.current.startX;
    const dy = evt.clientY - clickRef.current.startY;
    if (Math.hypot(dx, dy) > 5) {
      clickRef.current.moved = true;
    }
  }, []);

  const clearClickTracking = useCallback(() => {
    clickRef.current = null;
    window.removeEventListener("pointermove", handleClickMove);
    window.removeEventListener("pointerup", clearClickTracking);
  }, [handleClickMove]);

  /** ---- public handlers ------------------------------------------------ */
  const onPointerDown = useCallback(
    (_e: any, asset: AssetData, target: PIXI.Container | PIXI.Sprite) => {
      const orig = _e.data?.originalEvent as MouseEvent;
      if (!orig) return;

      /* right-click → custom context menu */
      if (orig.button === 2 && !readOnly) {
        orig.preventDefault();
        onAssetContextMenu?.(asset.id, {
          clientX: orig.clientX,
          clientY: orig.clientY,
        });
        return;
      }

      if (readOnly && orig.button === 0) {
        clickRef.current = {
          id: asset.id,
          startX: orig.clientX,
          startY: orig.clientY,
          moved: false,
        };
        window.addEventListener("pointermove", handleClickMove);
        window.addEventListener("pointerup", clearClickTracking);
        return;
      }

      if (orig.button !== 0 || readOnly) return;

      viewport?.plugins?.pause("drag");

      const canvas = canvasRef.current;
      if (!canvas || !viewport) return;
      const rect = canvas.getBoundingClientRect();
      const world = viewport.toWorld(orig.clientX - rect.left, orig.clientY - rect.top);

      const already = selectedIds.includes(asset.id);
      const startPos = new Map<number, { x: number; y: number }>();
      if (already && selectedIds.length > 1) {
        placedAssets.forEach((a) =>
          selectedIds.includes(a.id) ? startPos.set(a.id, { x: a.x, y: a.y }) : null
        );
      } else {
        startPos.set(asset.id, { x: asset.x, y: asset.y });
      }

      dragRef.current = {
        id: asset.id,
        assetRef: target,
        offsetX: world.x - asset.x,
        offsetY: world.y - asset.y,
        selected: already,
        selectedIds: already ? [...selectedIds] : [asset.id],
        initialPositions: startPos,
        moved: false,
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
    },
    [
      onAssetContextMenu,
      placedAssets,
      readOnly,
      selectedIds,
      viewport,
      onMove,
      endDrag,
      handleClickMove,
      clearClickTracking,
    ]
  );

  const onPointerUp = useCallback(
    (_e: any, asset: AssetData) => {
      const orig = _e.data?.originalEvent as MouseEvent;
      if (!orig || orig.button !== 0) return;
      if (dragRef.current?.moved) return; // it was a drag, not a click

      const trackedClick = clickRef.current;
      if (trackedClick) {
        clearClickTracking();
        if (trackedClick.id !== asset.id || trackedClick.moved) {
          return;
        }
      }

      /* read-only click on a chapter stone */
      if (readOnly && asset.type.kind === "chapter") {
        onChapterClick?.(asset.type.associatedChapterID!);
        return;
      }
      if (readOnly) {
        onAssetClick?.(asset);
        return;
      }

      /* selection */
      const already = selectedIds.includes(asset.id);
      if (orig.shiftKey) {
        onSelectIds((ids) =>
          ids.includes(asset.id) ? ids.filter((i) => i !== asset.id) : [...ids, asset.id]
        );
      } else if (!already) {
        onSelectIds([asset.id]);
      }
    },
    [
      readOnly,
      onChapterClick,
      onAssetClick,
      selectedIds,
      onSelectIds,
      clearClickTracking,
    ]
  );

  return {
    temporaryAssetPositions: tempPos,
    handlePointerDown: onPointerDown,
    handlePointerUp: onPointerUp,
  };
} 
