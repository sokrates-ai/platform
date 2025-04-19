import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, EDIT_SCALE_FACTOR, MINOR_SUBDIVISIONS, MINOR_GRID_SIZE } from "./constants";
import Asset from "./Asset";
import type { AssetData } from "./Asset";
import * as PIXI from "pixi.js";
import { Graphics } from "pixi.js"

extend({ Viewport, Graphics });

const snapToGrid = (value: number, gridSize: number) =>
    Math.round(value / gridSize) * gridSize;

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

    const paddingFactor = readOnly ? 1 : EDIT_SCALE_FACTOR;

    const baseWorldWidth = WORLD_WIDTH;
    const baseWorldHeight = WORLD_HEIGHT;

    const worldWidth = baseWorldWidth * paddingFactor;
    const worldHeight = baseWorldHeight * paddingFactor;

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
        if (!node || node === viewport) return;

        node.resize(app.renderer.width, app.renderer.height, worldWidth, worldHeight);
        node.drag();
        node.moveCenter(worldWidth / 2, worldHeight / 2);
        node.clamp({ direction: 'all', underflow: 'center' });

        setViewport(node);
        onViewportReady?.(node);
    }, [viewport, app?.renderer, worldWidth, worldHeight, baseWorldWidth, baseWorldHeight, onViewportReady]);

    const onGlobalMove = useCallback((e: PointerEvent) => {
        if (!dragDataRef.current || !viewport) return;
        const canvasElement = canvasElementRef.current;
        if (!canvasElement) return;

        const rect = canvasElement.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const worldPos = viewport.toWorld(localX, localY);

        const { assetRef, offsetX, offsetY } = dragDataRef.current;
        const rawX = worldPos.x - offsetX;
        const rawY = worldPos.y - offsetY;
        assetRef.x = snapToGrid(rawX, MINOR_GRID_SIZE);
        assetRef.y = snapToGrid(rawY, MINOR_GRID_SIZE);
    }, [viewport]);

    const onGlobalUp = useCallback(() => {
        if (!dragDataRef.current) return;
        const { id, assetRef } = dragDataRef.current;

        // snap to nearest GRID_SIZE
        const snappedX = snapToGrid(assetRef.x, MINOR_GRID_SIZE);
        const snappedY = snapToGrid(assetRef.y, MINOR_GRID_SIZE);
        assetRef.x = snappedX;
        assetRef.y = snappedY;
        onAssetPositionChange(id, snappedX, snappedY);

        dragDataRef.current = null;
        window.removeEventListener("pointermove", onGlobalMove);
        window.removeEventListener("pointerup", onGlobalUp);

        viewport?.plugins?.resume("drag");
    }, [onAssetPositionChange, onGlobalMove, viewport]);

    const handlePointerDown = useCallback((e: any, asset: AssetData, sprite: PIXI.Sprite) => {
        if (!readOnly) e.stopPropagation();

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
        if (!originalEvent) return;

        if (asset.type.kind === "chapter" && readOnly) {
            if (originalEvent.button === 0) onChapterClick?.(asset.type.associatedChapterID!);
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
            viewport?.plugins?.pause("drag");

            const canvasElement = canvasElementRef.current;
            if (!canvasElement || !viewport) return;

            const rect = canvasElement.getBoundingClientRect();
            const localX = originalEvent.clientX - rect.left;
            const localY = originalEvent.clientY - rect.top;
            const worldPos = viewport.toWorld(localX, localY);

            dragDataRef.current = {
                id: asset.id,
                assetRef: sprite,
                offsetX: worldPos.x - asset.x,
                offsetY: worldPos.y - asset.y,
            };

            window.addEventListener("pointermove", onGlobalMove);
            window.addEventListener("pointerup", onGlobalUp);
        }
    }, [onAssetContextMenu, onChapterClick, onGlobalMove, onGlobalUp, readOnly, viewport]);

    const spriteURL = useCallback((file: string) => `/contentMap/${file}`, []);

    if (!app || !app.renderer) return null;

    return (
        // @ts-expect-error
        <viewport
            ref={viewportRef}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            events={app.renderer.events}
            sortableChildren={true}
        >
            {!readOnly && (
                <>
                    {/* minor grid */}
                    < graphics
                        draw={(g) => {
                            g.clear();
                            for (let x = 0; x <= worldWidth; x += MINOR_GRID_SIZE) {
                                const px = Math.round(x) + 0.5;
                                g.moveTo(px, 0);
                                g.lineTo(px, worldHeight);
                            }
                            for (let y = 0; y <= worldHeight; y += MINOR_GRID_SIZE) {
                                const py = Math.round(y) + 0.5;
                                g.moveTo(0, py);
                                g.lineTo(worldWidth, py);
                            }
                            g.stroke({ color: 0xffffff, alpha: 0.2, pixelLine: true });
                        }}
                    />
                    {/* major grid */}
                    <graphics
                        draw={(g) => {
                            g.clear();
                            for (let x = 0; x <= worldWidth; x += GRID_SIZE) {
                                const px = Math.round(x) + 0.5;
                                g.moveTo(px, 0);
                                g.lineTo(px, worldHeight);
                            }
                            for (let y = 0; y <= worldHeight; y += GRID_SIZE) {
                                const py = Math.round(y) + 0.5;
                                g.moveTo(0, py);
                                g.lineTo(worldWidth, py);
                            }
                            g.stroke({ color: 0xffffff, alpha: 0.8, pixelLine: true });
                        }}
                    />
                </>
            )}

            {placedAssets.map((asset, idx) => (
                <Asset
                    key={asset.id}
                    asset={asset}
                    layer={idx}
                    spriteURL={spriteURL}
                    onPointerDown={handlePointerDown}
                />
            ))}

            {!readOnly && (
                <>
                    {/* Boundary */}
                    <graphics
                        draw={(g) => {
                            g.clear();
                            g.rect((worldWidth - baseWorldWidth) / 2,
                                (worldHeight - baseWorldHeight) / 2,
                                baseWorldWidth,
                                baseWorldHeight)
                            g.stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
                        }}
                    />

                    {/* Origin */}
                    <graphics
                        draw={(g) => {
                            g.clear();
                            g.circle((worldWidth) / 2,
                                (worldHeight) / 2, 10)
                            g.fill({color: 0xffffff, alpha: 0.8});
                        }}
                    />
                </>
            )}
            {/* @ts-expect-error Custom component render */}
        </viewport>
    );
});

CanvasViewport.displayName = "CanvasViewport";

export default CanvasViewport;
