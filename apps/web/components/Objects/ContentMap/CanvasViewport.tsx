import React, { useEffect, useState, useCallback, useRef } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";
import Asset from "./Asset";

extend({ Viewport });

interface CanvasViewportProps {
    placedAssets: any[];
    onViewportReady?: (viewport: Viewport) => void;
    onAssetPositionChange: (id: number, x: number, y: number) => void;
    onAssetContextMenu?: (assetId: number, pos: { clientX: number; clientY: number }) => void;
}

const CanvasViewport: React.FC<CanvasViewportProps> = ({
    placedAssets,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
}) => {
    const { app } = useApplication();
    const [viewport, setViewport] = useState<Viewport | null>(null);
    // Use a ref to hold current drag data.
    const dragDataRef = useRef<{ assetId: number } | null>(null);

    // Callback ref to store the viewport instance.
    const viewportRef = useCallback(
        (node: Viewport | null) => {
            if (node) {
                setViewport(node);
                onViewportReady && onViewportReady(node);
            }
        },
        [onViewportReady]
    );

    useEffect(() => {
        if (viewport) {
            viewport.drag().decelerate();
            viewport.setZoom(1);
        }
    }, [viewport]);

    // Update asset's position during a global pointer move.
    const onGlobalMove = useCallback(
        (e: PointerEvent) => {
            if (!dragDataRef.current || !viewport || !onAssetPositionChange) return;
            const canvasElement = document.getElementById("canvas-parent");
            if (canvasElement) {
                const rect = canvasElement.getBoundingClientRect();
                const localX = e.clientX - rect.left;
                const localY = e.clientY - rect.top;
                const worldPos = viewport.toWorld(localX, localY);
                onAssetPositionChange(dragDataRef.current.assetId, worldPos.x, worldPos.y);
            }
        },
        [viewport, onAssetPositionChange]
    );

    // End dragging on pointer up.
    const onGlobalUp = useCallback(
        (e: PointerEvent) => {
            if (viewport && viewport.plugins) {
                viewport.plugins.resume("drag");
            }
            dragDataRef.current = null;
            window.removeEventListener("pointermove", onGlobalMove);
            window.removeEventListener("pointerup", onGlobalUp);
        },
        [viewport, onGlobalMove]
    );

    // Handle pointer down on an asset.
    const handlePointerDown = (e: any, asset: any) => {
        e.stopPropagation();
        const originalEvent = e.data?.originalEvent;
        if (originalEvent?.button === 2) {
            // Right-click: show context menu.
            originalEvent.preventDefault();
            if (onAssetContextMenu) {
                onAssetContextMenu(asset.id, {
                    clientX: originalEvent.clientX,
                    clientY: originalEvent.clientY,
                });
            }
            return;
        }
        // Left-click: start dragging.
        if (viewport && viewport.plugins) {
            viewport.plugins.pause("drag");
        }
        dragDataRef.current = { assetId: asset.id };
        window.addEventListener("pointermove", onGlobalMove);
        window.addEventListener("pointerup", onGlobalUp);
    };

    if (!app || !app.renderer) return null;

    // Helper to build the sprite URL.
    const spriteURL = useCallback((file: string) => {
        return `/contentMap/${file}`;
      }, []);

    return (
        <viewport
            ref={viewportRef}
            worldWidth={WORLD_WIDTH}
            worldHeight={WORLD_HEIGHT}
            events={app.renderer.events}
        >
            {placedAssets.map((asset) => (
                <Asset
                    key={asset.id}
                    asset={asset}
                    spriteURL={spriteURL}
                    onPointerDown={handlePointerDown}
                />
            ))}
        </viewport>
    );
};

export default CanvasViewport;
