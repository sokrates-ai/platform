import React, { useEffect, useState, useCallback, useRef, memo, Dispatch, SetStateAction } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, EDIT_SCALE_FACTOR, MINOR_SUBDIVISIONS, MINOR_GRID_SIZE } from "./constants";
import Asset from "./Asset";
import type { AssetData } from "./Asset";
import * as PIXI from "pixi.js";
import { Graphics } from "pixi.js"

extend({ Viewport, Graphics });

const snapValueToGrid = (value: number, gridSize: number) =>
    Math.round(value / gridSize) * gridSize;

interface CanvasViewportProps {
    placedAssets: AssetData[];
    selectedIds: number[];
    onSelectIds: Dispatch<SetStateAction<number[]>>;
    onViewportReady?: (viewport: Viewport) => void;
    onAssetPositionChange: (id: number, x: number, y: number) => void;
    onAssetContextMenu?: (assetId: number, pos: { clientX: number; clientY: number }) => void;
    onChapterClick?: (chapterID: number) => void;
    readOnly: boolean;
    worldWidth?: number;
    worldHeight?: number;
    showGrid?: boolean;
    snapToGrid?: boolean;
    gridGranularity?: number;
    effectiveGridSize?: number;
}

const CanvasViewport: React.FC<CanvasViewportProps> = memo(({
    placedAssets,
    selectedIds,
    onSelectIds,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
    worldWidth: customWorldWidth,
    worldHeight: customWorldHeight,
    showGrid = true,
    snapToGrid = true,
    gridGranularity = 5,
    effectiveGridSize,
}) => {
    const { app } = useApplication();

    const baseWorldWidth = customWorldWidth || WORLD_WIDTH;
    const baseWorldHeight = customWorldHeight || WORLD_HEIGHT;

    const worldWidth = baseWorldWidth;
    const worldHeight = baseWorldHeight;

    const [viewport, setViewport] = useState<Viewport | null>(null);
    const dragDataRef = useRef<{
        id: number;
        assetRef: PIXI.Sprite;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const canvasElementRef = useRef<HTMLElement | null>(null);

    // Use the provided effectiveGridSize or calculate based on gridGranularity
    const gridSize = effectiveGridSize || (MINOR_GRID_SIZE * (11 - gridGranularity));

    useEffect(() => {
        canvasElementRef.current = document.getElementById("canvas-parent");
    }, [app?.renderer]);

    const viewportRef = useCallback((node: Viewport | null) => {
        if (!node || node === viewport) return;
        node.resize(app.renderer.width, app.renderer.height, worldWidth, worldHeight);
        node.drag({ clampWheel: true });
        node.decelerate({
            friction: 0.9,
            bounce: 0,
            minSpeed: 0.02
        });
        node.moveCenter(worldWidth / 2, worldHeight / 2);
        if (readOnly) {
            node.clamp({ direction: 'all', underflow: 'center' });
        } else {
            // Allow 20% panning beyond each edge in edit mode
            const padX = worldWidth * 0.2;
            const padY = worldHeight * 0.2;
            node.clamp({
                left: -padX,
                right: worldWidth + padX,
                top: -padY,
                bottom: worldHeight + padY,
                underflow: 'none',
            });
        }

        setViewport(node);
        onViewportReady?.(node);
    }, [viewport, app?.renderer, worldWidth, worldHeight, baseWorldWidth, baseWorldHeight, onViewportReady, readOnly]);

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
        
        // Apply snapping only if enabled
        if (snapToGrid) {
            assetRef.x = snapValueToGrid(rawX, gridSize);
            assetRef.y = snapValueToGrid(rawY, gridSize);
        } else {
            assetRef.x = rawX;
            assetRef.y = rawY;
        }
    }, [viewport, snapToGrid, gridSize]);

    const onGlobalUp = useCallback(() => {
        if (!dragDataRef.current) return;
        const { id, assetRef } = dragDataRef.current;

        let finalX = assetRef.x;
        let finalY = assetRef.y;

        // snap to nearest grid size if enabled
        if (snapToGrid) {
            finalX = snapValueToGrid(assetRef.x, gridSize);
            finalY = snapValueToGrid(assetRef.y, gridSize);
            assetRef.x = finalX;
            assetRef.y = finalY;
        }

        onAssetPositionChange(id, finalX, finalY);

        dragDataRef.current = null;
        window.removeEventListener("pointermove", onGlobalMove);
        window.removeEventListener("pointerup", onGlobalUp);

        viewport?.plugins?.resume("drag");
    }, [onAssetPositionChange, onGlobalMove, viewport, snapToGrid, gridSize]);

    const handlePointerDown = useCallback((e: any, asset: AssetData, sprite: PIXI.Sprite) => {
        const orig = e.data?.originalEvent as MouseEvent;

        if (orig.button === 2 && !readOnly) {
            orig.preventDefault();
            onAssetContextMenu?.(asset.id, {
                clientX: orig.clientX,
                clientY: orig.clientY,
            });
            return;
        }


        if (orig.button !== 0 || readOnly) return;

        if (orig.shiftKey) {
            onSelectIds(ids =>
                ids.includes(asset.id)
                    ? ids.filter(id => id !== asset.id)
                    : [...ids, asset.id]
            );
        } else {
            onSelectIds([asset.id]);
        }

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
        if (!originalEvent) return;

        // handle chapter‐click in readOnly
        if (asset.type.kind === "chapter" && readOnly) {
            onChapterClick?.(asset.type.associatedChapterID!);
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
    }, [onAssetContextMenu, onChapterClick, onGlobalMove, onGlobalUp, readOnly, onSelectIds]);

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
            onPointerDown={(e: PIXI.FederatedPointerEvent) => {
                const orig = e as MouseEvent;
                if (e.target === e.currentTarget && !readOnly && !orig.shiftKey) {
                    onSelectIds([]);
                }
            }}

        >
            {!readOnly && showGrid && (
                <>
                    {/* minor grid */}
                    < graphics
                        draw={(g) => {
                            g.clear();
                            for (let x = 0; x <= worldWidth; x += gridSize) {
                                const px = Math.round(x) + 0.5;
                                g.moveTo(px, 0);
                                g.lineTo(px, worldHeight);
                            }
                            for (let y = 0; y <= worldHeight; y += gridSize) {
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
                    selected={selectedIds.includes(asset.id)}
                />
            ))}

            {/* {!readOnly && ( */}
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
                            g.fill({ color: 0xffffff, alpha: 0.8 });
                        }}
                    />
                </>
            {/* )} */}
            {/* @ts-expect-error Custom component render */}
        </viewport>
    );
});

CanvasViewport.displayName = "CanvasViewport";

export default CanvasViewport;
