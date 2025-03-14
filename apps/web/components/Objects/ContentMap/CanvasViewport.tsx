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
    onChapterClick?: (chapterID: number) => void;
    readOnly: boolean;
}

const CanvasViewport: React.FC<CanvasViewportProps> = ({
    placedAssets,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
}) => {
    const { app } = useApplication();
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const dragDataRef = useRef<{ assetId: number, offsetX: number, offsetY: number } | null>(null);

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

    // Global pointer move to update asset position
    const onGlobalMove = useCallback(
        (e: PointerEvent) => {
            if (!dragDataRef.current || !viewport || !onAssetPositionChange) return;
            const canvasElement = document.getElementById("canvas-parent");
            if (canvasElement) {
                const rect = canvasElement.getBoundingClientRect();
                const localX = e.clientX - rect.left;
                const localY = e.clientY - rect.top;
                const worldPos = viewport.toWorld(localX, localY);
                // Subtract the initial offset so the asset stays relative to the click position
                onAssetPositionChange(
                    dragDataRef.current.assetId,
                    worldPos.x - dragDataRef.current.offsetX,
                    worldPos.y - dragDataRef.current.offsetY
                );
            }
        },
        [viewport, onAssetPositionChange]
    );


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

    const handlePointerDown = (e: any, asset: any) => {
        if (readOnly) return;

        e.stopPropagation();

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
        if (!originalEvent) return;

        if (asset.type === "chapter") {
            if (originalEvent.button === 0) {
                onChapterClick && onChapterClick(asset.id);
            }
            return;
        }

        if (originalEvent.button === 2) {
            originalEvent.preventDefault();
            onAssetContextMenu &&
                onAssetContextMenu(asset.id, {
                    clientX: originalEvent.clientX,
                    clientY: originalEvent.clientY,
                });
            return;
        }

        if (originalEvent.button === 0) {
            if (viewport && viewport.plugins) {
                viewport.plugins.pause("drag");
            }
            // Calculate the offset between the pointer and asset's position
            const canvasElement = document.getElementById("canvas-parent");
            let offsetX = 0;
            let offsetY = 0;
            if (canvasElement && viewport) {
                const rect = canvasElement.getBoundingClientRect();
                const localX = originalEvent.clientX - rect.left;
                const localY = originalEvent.clientY - rect.top;
                const worldPos = viewport.toWorld(localX, localY);
                offsetX = worldPos.x - asset.x;
                offsetY = worldPos.y - asset.y;
            }
            dragDataRef.current = { assetId: asset.id, offsetX, offsetY };
            window.addEventListener("pointermove", onGlobalMove);
            window.addEventListener("pointerup", onGlobalUp);
        }
    };


    if (!app || !app.renderer) return null;

    const spriteURL = useCallback((file: string) => `/contentMap/${file}`, []);

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
