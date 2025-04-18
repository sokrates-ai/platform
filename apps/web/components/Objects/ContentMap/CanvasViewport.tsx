import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";
import Asset from "./Asset";
import type { AssetData } from "./Asset";
import * as PIXI from "pixi.js";

extend({ Viewport });

interface CanvasViewportProps {
    placedAssets: AssetData[];
    onViewportReady?: (viewport: Viewport) => void;
    onAssetPositionChange: (id: number, x: number, y: number) => void;
    onAssetContextMenu?: (assetId: number, pos: { clientX: number; clientY: number }) => void;
    onChapterClick?: (chapterID: number) => void;
    readOnly: boolean;
}

const CanvasViewport: React.FC<CanvasViewportProps> = memo(({
    placedAssets,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
}) => {
    const { app } = useApplication();
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const dragDataRef = useRef<{
        id: number;
        assetRef: PIXI.Sprite;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const canvasElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        canvasElementRef.current = document.getElementById("canvas-parent");
    }, [app?.renderer]);

    const viewportRef = useCallback((node: Viewport | null) => {
        if (node && node !== viewport) {
            setViewport(node);
            onViewportReady?.(node);
        }
    }, [viewport, onViewportReady]);

    useEffect(() => {
        if (viewport) {
            viewport.drag();
            viewport.clamp({ direction: "all" });
            viewport.moveCenter((WORLD_WIDTH / 4) * 1.8, (WORLD_HEIGHT / 4) * 3);
            viewport.setZoom(readOnly ? 1 : 0.8);
        }
    }, [viewport, readOnly]);

    const onGlobalMove = useCallback((e: PointerEvent) => {
        if (!dragDataRef.current || !viewport) return;
        const canvasElement = canvasElementRef.current;
        if (canvasElement) {
            const rect = canvasElement.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const localY = e.clientY - rect.top;
            const worldPos = viewport.toWorld(localX, localY);

            const { assetRef, offsetX, offsetY } = dragDataRef.current;
            assetRef.x = worldPos.x - offsetX;
            assetRef.y = worldPos.y - offsetY;
        }
    }, [viewport]);

    const onGlobalUp = useCallback(() => {
        if (!dragDataRef.current) return;
        const { id, assetRef } = dragDataRef.current;

        onAssetPositionChange(id, assetRef.x, assetRef.y);

        dragDataRef.current = null;
        window.removeEventListener("pointermove", onGlobalMove);
        window.removeEventListener("pointerup", onGlobalUp);

        if (viewport && viewport.plugins) {
            viewport.plugins.resume("drag");
        }
    }, [onAssetPositionChange, onGlobalMove, viewport]);

    const handlePointerDown = useCallback((e: any, asset: AssetData, sprite: PIXI.Sprite) => {
        if (!readOnly) {
            e.stopPropagation();
        }

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
        if (!originalEvent) return;

        if (asset.type.kind === "chapter" && readOnly) {
            if (originalEvent.button === 0) {
                onChapterClick?.(asset.type.associatedChapterID!);
            }
            return;
        }

        if (readOnly) return;

        if (originalEvent.button === 2) {
            originalEvent.preventDefault();
            onAssetContextMenu?.(asset.id, {
                clientX: originalEvent.clientX,
                clientY: originalEvent.clientY,
            });
            return;
        }

        if (originalEvent.button === 0) {
            if (viewport?.plugins) {
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

            dragDataRef.current = {
                id: asset.id,
                assetRef: sprite,
                offsetX,
                offsetY,
            };

            window.addEventListener("pointermove", onGlobalMove);
            window.addEventListener("pointerup", onGlobalUp);
        }
    }, [onAssetContextMenu, onChapterClick, onGlobalMove, onGlobalUp, readOnly, viewport]);

    const spriteURL = useCallback((file: string) => `/contentMap/${file}`, []);

    if (!app || !app.renderer) return null;

    return (
        // @ts-expect-error Viewport type not recognized by TS
        <viewport
            ref={viewportRef}
            worldWidth={WORLD_WIDTH}
            worldHeight={WORLD_HEIGHT}
            events={app.renderer.events}
            sortableChildren={true}
        >
            {placedAssets.map((asset, idx) => (
                <Asset
                    key={asset.id}
                    asset={asset}
                    layer={idx}
                    spriteURL={spriteURL}
                    onPointerDown={handlePointerDown}
                />
            ))}
            {/* @ts-expect-error Custom component render */}
        </viewport>
    );
});

CanvasViewport.displayName = 'CanvasViewport';

export default CanvasViewport;
