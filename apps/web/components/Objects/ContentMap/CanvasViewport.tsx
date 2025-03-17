import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";
import Asset from "./Asset"
import type { AssetData, AssetTypeData, AssetTypeDataKind } from "./Asset"

extend({ Viewport });

interface CanvasViewportProps {
    placedAssets: AssetData[];
    onViewportReady?: (viewport: Viewport) => void;
    onAssetPositionChange: (id: number, x: number, y: number) => void;
    // onPointerRelease: () => void;
    onAssetContextMenu?: (assetId: number, pos: { clientX: number; clientY: number }) => void;
    onChapterClick?: (chapterID: number) => void;
    readOnly: boolean;
}

const CanvasViewport: React.FC<CanvasViewportProps> = memo(({
    placedAssets,
    onViewportReady,
    onAssetPositionChange,
    // onPointerRelease,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
}) => {
    const { app } = useApplication();
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const dragDataRef = useRef<{ assetId: number, offsetX: number, offsetY: number } | null>(null);
    const canvasElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        canvasElementRef.current = document.getElementById("canvas-parent");
    }, []);

    const viewportRef = useCallback(
        (node: Viewport | null) => {
            if (node && node !== viewport) {
                setViewport(node);
                onViewportReady && onViewportReady(node);
            }
        },
        [viewport, onViewportReady]
    );

    useEffect(() => {
        if (viewport) {
            viewport.drag().decelerate();
            viewport.clamp({direction: "all"});
            viewport.moveCenter(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)
            viewport.setZoom(1);
        }
    }, [viewport]);

    const onGlobalMove = useCallback(
        (e: PointerEvent) => {
            if (!dragDataRef.current || !viewport || !onAssetPositionChange) return;
            const canvasElement = canvasElementRef.current;
            if (canvasElement) {
                const rect = canvasElement.getBoundingClientRect();
                const localX = e.clientX - rect.left;
                const localY = e.clientY - rect.top;
                const worldPos = viewport.toWorld(localX, localY);
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

            // onPointerRelease()
        },
        [viewport, onGlobalMove]
    );

    const handlePointerDown = useCallback((e: any, asset: AssetData) => {
        e.stopPropagation();

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
        if (!originalEvent) return;

        if (asset.type.kind === "chapter" && readOnly) {
            if (originalEvent.button === 0) {
                onChapterClick && onChapterClick(asset.type.associatedChapterID!);
            }
            return;
        }

        if (readOnly) return;

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
            const canvasElement = canvasElementRef.current;
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
    }, [viewport, onGlobalMove, onGlobalUp, onAssetContextMenu, onChapterClick, readOnly]);

    const spriteURL = useCallback((file: string) => `/contentMap/${file}`, []);

    if (!app || !app.renderer) return null;

    return (
        // @ts-expect-error: This is not being recognized by typescript, though it is registered in global.d.ts
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
        {/* @ts-expect-error: This is not being recognized by typescript, though it is registered in global.d.ts */}
        </viewport>
    );
});

CanvasViewport.displayName = 'CanvasViewport';

export default CanvasViewport;