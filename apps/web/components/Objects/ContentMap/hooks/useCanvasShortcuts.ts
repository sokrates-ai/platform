import { useEffect, useRef } from "react";
import { AssetData } from "../Asset/assetTypes";
import { LayoutState } from "../Canvas";

interface Props {
  layout: LayoutState;
  setLayout: React.Dispatch<React.SetStateAction<LayoutState>>;
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  parentRef: React.RefObject<HTMLDivElement>;
  viewport: any;
  effectiveGridSize: number;
  snapToGrid: boolean;
  undoRedo?: { undo: () => void; redo: () => void };
  readOnly: boolean;
}

// Tiny util
const genId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

export default function useCanvasShortcuts({
  layout,
  setLayout,
  selectedIds,
  setSelectedIds,
  parentRef,
  viewport,
  effectiveGridSize,
  snapToGrid,
  undoRedo,
  readOnly,
}: Props) {
  const copiedRef = useRef<AssetData[]>([]);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  /* track mouse so we can paste "at cursor" */
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const move = (e: MouseEvent) =>
      (lastMouseRef.current = { x: e.clientX, y: e.clientY });
    parent.addEventListener("mousemove", move);
    return () => parent.removeEventListener("mousemove", move);
  }, [parentRef]);

  /* all keyboard handling lives here now */
  useEffect(() => {
    if (readOnly) return;

    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      /* ------- Undo / Redo ------- */
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRedo?.undo?.();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        undoRedo?.redo?.();
        return;
      }

      /* ------- Select all ------- */
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && layout.layout?.length) {
        e.preventDefault();
        setSelectedIds(layout.layout.map((a) => a.id));
        return;
      }

      /* ------- Arrow-key nudging ------- */
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
        selectedIds.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? effectiveGridSize * 5 : effectiveGridSize;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setLayout((s) => ({
          ...s,
          layout: s.layout!.map((a) =>
            selectedIds.includes(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a
          ),
          updateOriginator: "user",
        }));
        return;
      }

      /* ------- Copy / Cut ------- */
      if ((e.metaKey || e.ctrlKey) && ["c", "x"].includes(e.key.toLowerCase())) {
        if (!selectedIds.length) return;
        e.preventDefault();
        copiedRef.current = layout.layout!.filter((a) =>
          selectedIds.includes(a.id)
        );
        if (e.key === "x") {
          setLayout((s) => ({
            ...s,
            layout: s.layout!.filter((a) => !selectedIds.includes(a.id)),
            updateOriginator: "user",
          }));
          setSelectedIds([]);
        }
        return;
      }

      /* ------- Paste ------- */
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && copiedRef.current.length) {
        e.preventDefault();
        const copied = copiedRef.current;
        const cx = copied.reduce((s, a) => s + a.x, 0) / copied.length;
        const cy = copied.reduce((s, a) => s + a.y, 0) / copied.length;

        // default offset 1 grid down/right
        let dx = effectiveGridSize,
          dy = effectiveGridSize;
        if (viewport && parentRef.current && lastMouseRef.current) {
          const rect = parentRef.current.getBoundingClientRect();
          const local = {
            x: lastMouseRef.current.x - rect.left,
            y: lastMouseRef.current.y - rect.top,
          };
          const world = viewport.toWorld(local.x, local.y);
          dx = world.x - cx;
          dy = world.y - cy;
        }

        const clones = copied.map((a) => {
          const rawX = a.x + dx;
          const rawY = a.y + dy;
          return {
            ...a,
            id: genId(),
            x: snapToGrid
              ? Math.round(rawX / effectiveGridSize) * effectiveGridSize
              : rawX,
            y: snapToGrid
              ? Math.round(rawY / effectiveGridSize) * effectiveGridSize
              : rawY,
          };
        });

        setLayout((s) => ({
          ...s,
          layout: [...s.layout!, ...clones],
          updateOriginator: "user",
        }));
        setTimeout(() => setSelectedIds(clones.map((c) => c.id)), 50);
        return;
      }

      /* ------- Delete ------- */
      if (e.key === "Delete" && selectedIds.length) {
        e.preventDefault();
        setLayout((s) => ({
          ...s,
          layout: s.layout!.filter((a) => !selectedIds.includes(a.id)),
          updateOriginator: "user",
        }));
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    readOnly,
    undoRedo,
    layout,
    selectedIds,
    effectiveGridSize,
    snapToGrid,
    setLayout,
    setSelectedIds,
    parentRef,
    viewport,
  ]);

  /* expose a single mouse-move handler for the <div> */
  return {
    handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) =>
      (lastMouseRef.current = { x: e.clientX, y: e.clientY }),
  };
} 
