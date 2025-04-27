import React, { useEffect, useState, useCallback, useRef, memo, Dispatch, SetStateAction } from "react";
import { Viewport } from "pixi-viewport";
import { useApplication, extend } from "@pixi/react";
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, MINOR_GRID_SIZE } from "./constants";
import Asset from "./Asset";
import type { AssetData } from "./Asset";
import * as PIXI from "pixi.js";
import { Graphics } from "pixi.js"

extend({ Viewport, Graphics });

const snapValueToGrid = (value: number, gridSize: number) =>
    Math.round(value / gridSize) * gridSize;

interface DragData {
    id: number;
    assetRef: PIXI.Container | PIXI.Sprite;
    offsetX: number;
    offsetY: number;
}

interface CanvasViewportProps {
    placedAssets: AssetData[];
    selectedIds: number[];
    onSelectIds: Dispatch<SetStateAction<number[]>>;
    onViewportReady?: (viewport: Viewport) => void;
    onAssetPositionChange: (id: number, x: number, y: number) => void;
    onAssetContextMenu?: (assetId: number, pos: { clientX: number; clientY: number }) => void;
    onChapterClick?: (chapterID: number) => void;
    readOnly: boolean;
    boundaries?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    showGrid?: boolean;
    snapToGrid?: boolean;
    gridGranularity?: number;
    effectiveGridSize?: number;
}

// Default boundaries
const DEFAULT_BOUNDARIES = {
    left: -1000,
    right: 1000,
    top: -1000,
    bottom: 1000
};

const CanvasViewport: React.FC<CanvasViewportProps> = memo(({
    placedAssets,
    selectedIds,
    onSelectIds,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
    boundaries,
    showGrid = true,
    snapToGrid = true,
    gridGranularity = 5,
    effectiveGridSize,
}) => {
    const { app } = useApplication();

    const { left, right, top, bottom } = boundaries || DEFAULT_BOUNDARIES;

    const worldWidth = Math.abs(right - left);
    const worldHeight = Math.abs(bottom - top);

    const [viewport, setViewport] = useState<Viewport | null>(null);
    const dragDataRef = useRef<DragData | null>(null);
    const canvasElementRef = useRef<HTMLElement | null>(null);

    const gridSize = effectiveGridSize || (MINOR_GRID_SIZE * (11 - gridGranularity));

    useEffect(() => {
        canvasElementRef.current = document.getElementById("canvas-parent");
    }, [app?.renderer]);

    const viewportRef = useCallback((node: Viewport | null) => {
        if (!node) return;

        const isNewViewport = node !== viewport;

        node.resize(app.renderer.width, app.renderer.height, worldWidth, worldHeight);

        if (isNewViewport) {

            const FRACTION = 0.12;
            const shortestSide = Math.min(app.renderer.width, app.renderer.height);
            const pixelsWanted = shortestSide * FRACTION;
            const scale = pixelsWanted / worldWidth;


            node
                .drag({ clampWheel: true, mouseButtons: "left" })
                .decelerate({ friction: 0.9, bounce: 0, minSpeed: 0.02 })
                .pinch()
                .wheel({ percent: 0.15 })
                .setZoom(scale, true)
                .clampZoom({
                    minWidth: worldWidth * 0.5,
                    maxWidth: worldWidth * 1
                });

            node.fit();
            node.moveCenter(0, 0);

            // expose to parent
            setViewport(node);
            onViewportReady?.(node);
        }

        if (readOnly) {
            node.clamp({
                left: left,
                right: right,
                top: top,
                bottom: bottom,
                underflow: 'none',
            });
        } else {
            const padX = worldWidth * 0.2;
            const padY = worldHeight * 0.2;
            node.clamp({
                left: left - padX,
                right: right + padX,
                top: top - padY,
                bottom: bottom + padY,
                underflow: 'none',
            });
        }

    }, [viewport, app?.renderer, worldWidth, worldHeight, left, right, top, bottom, onViewportReady, readOnly]);

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

    const handlePointerDown = useCallback(
        (e: any, asset: AssetData, target: PIXI.Container | PIXI.Sprite) => {
            const orig = e.data?.originalEvent as MouseEvent;

            // Handle right click first
            if (orig.button === 2 && !readOnly) {
                orig.preventDefault();
                onAssetContextMenu?.(asset.id, {
                    clientX: orig.clientX,
                    clientY: orig.clientY,
                });
                return;
            }

            // Handle chapter click in readOnly mode
            if (asset.type.kind === "chapter" && readOnly && orig.button === 0) {
                onChapterClick?.(asset.type.associatedChapterID!);
                return;
            }

            // Skip if not left click or in readOnly mode
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

            viewport?.plugins?.pause("drag");

            const canvasElement = canvasElementRef.current;
            if (!canvasElement || !viewport) return;

            const rect = canvasElement.getBoundingClientRect();
            const localX = originalEvent.clientX - rect.left;
            const localY = originalEvent.clientY - rect.top;
            const worldPos = viewport.toWorld(localX, localY);

            dragDataRef.current = {
                id: asset.id,
                assetRef: target,
                offsetX: worldPos.x - asset.x,
                offsetY: worldPos.y - asset.y,
            };

            window.addEventListener("pointermove", onGlobalMove);
            window.addEventListener("pointerup", onGlobalUp);
        },
        [onAssetContextMenu, onChapterClick, onGlobalMove, onGlobalUp, readOnly, onSelectIds]
    );

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
                    {/* Combined Grid (Minor + Major Emphasis) */}
                    < graphics
                        draw={(g) => {
                            g.clear();
                            const majorGridInterval = GRID_SIZE; // Interval for emphasis

                            // Draw vertical lines
                            for (let x = Math.ceil(left / gridSize) * gridSize; x <= right; x += gridSize) {
                                const roundedX = snapValueToGrid(x, gridSize);
                                // Check if the snapped coordinate is close to a multiple of the major interval
                                const isMajorLine = Math.abs(roundedX % majorGridInterval) < 1e-6 || Math.abs(roundedX % majorGridInterval - majorGridInterval) < 1e-6;
                                const alpha = isMajorLine ? 0.8 : 0.2;
                                const px = Math.round(x) + 0.5;

                                g.moveTo(px, top);
                                g.lineTo(px, bottom);
                                g.stroke({ color: 0xffffff, alpha: alpha, pixelLine: true });
                            }

                            // Draw horizontal lines
                            for (let y = Math.ceil(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
                                const roundedY = snapValueToGrid(y, gridSize);
                                // Check if the snapped coordinate is close to a multiple of the major interval
                                const isMajorLine = Math.abs(roundedY % majorGridInterval) < 1e-6 || Math.abs(roundedY % majorGridInterval - majorGridInterval) < 1e-6;
                                const alpha = isMajorLine ? 0.8 : 0.2;
                                const py = Math.round(y) + 0.5;

                                g.moveTo(left, py);
                                g.lineTo(right, py);
                                g.stroke({ color: 0xffffff, alpha: alpha, pixelLine: true });
                            }
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

            {!readOnly && (
            <>
                {/* Boundary */}
                <graphics
                    draw={(g) => {
                        g.clear();
                        g.rect(left, top, worldWidth, worldHeight)
                        g.stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
                    }}
                />

                {/* Origin */}
                <graphics
                    draw={(g) => {
                        g.clear();
                        g.circle(0, 0, 10)
                        g.fill({ color: 0xffffff, alpha: 0.8 });
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
