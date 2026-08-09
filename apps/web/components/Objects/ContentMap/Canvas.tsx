import React, { useRef, useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { Application } from "@pixi/react";
import CanvasViewport from "./CanvasViewport";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssetData, ChapterState } from "./Asset/assetTypes";
import { SPRITE_SCALE_FACTOR, MINOR_GRID_SIZE } from "./constants";
import useCanvasShortcuts from "./hooks/useCanvasShortcuts";

interface ContextMenuData {
    assetId: number;
    x: string;
    y: string;
}

export interface LayoutState {
    layout: AssetData[] | null;
    updateOriginator: "user" | "initial";
    boundaries?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

export interface CanvasProps {
    layout: LayoutState;
    setLayout: Dispatch<SetStateAction<LayoutState>>;
    onChapterClick: (chapterID: number) => void;
    onAssetClick?: (asset: AssetData) => void;
    onViewportReady?: (viewport: any) => void;
    minZoom?: number;
    maxZoom?: number;
    readOnly?: boolean;
    showGrid?: boolean;
    snapToGrid?: boolean;
    gridGranularity?: number;
    chapterStates?: Record<number, ChapterState>;
    undoRedo?: {
        undo: () => void;
        redo: () => void;
    };
    clampToMap?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({
    layout,
    setLayout,
    onChapterClick,
    onAssetClick,
    onViewportReady,
    minZoom,
    maxZoom,
    readOnly = false,
    showGrid = true,
    snapToGrid = true,
    gridGranularity = 5,
    chapterStates = {},
    undoRedo,
    clampToMap,
}) => {
    const PLACEHOLDER_STONE_FILE = "Placeholder.webp";
    const parentRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [layerInput, setLayerInput] = useState<string>("");
    const [layerInputError, setLayerInputError] = useState(false);
    const [orderInput, setOrderInput] = useState<string>("");
    const [orderInputError, setOrderInputError] = useState(false);
    const [viewport, setViewport] = useState<any>(null);
    const handleViewportReady = useCallback(
        (nextViewport: any) => {
            setViewport(nextViewport);
            onViewportReady?.(nextViewport);
        },
        [onViewportReady]
    );
    const dispatchRef = useRef<typeof undoRedo | null>(undoRedo || null);

    // Update dispatch ref when undoRedo changes
    useEffect(() => {
        dispatchRef.current = undoRedo || null;
    }, [undoRedo]);

    // Calculate effective grid size based on granularity
    const effectiveGridSize = MINOR_GRID_SIZE * (11 - gridGranularity);

    /**
     * Pull all keyboard, clipboard and mouse-move bookkeeping into a tidy hook.
     * This returns the single handler we still need to wire to the <div>.
     */
    const { handleMouseMove } = useCanvasShortcuts({
        layout,
        setLayout,
        selectedIds,
        setSelectedIds,
        parentRef,
        viewport,
        effectiveGridSize,
        snapToGrid,
        undoRedo: dispatchRef.current ?? undefined,
        readOnly,
    });


    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("application/json");
        if (data && viewport) {
            try {
                const spriteData = JSON.parse(data);
                const targetRect = e.currentTarget.getBoundingClientRect();
                const localX = e.clientX - targetRect.left;
                const localY = e.clientY - targetRect.top;
                const worldPosition = viewport.toWorld(localX, localY);
                // snap the drop position too if enabled
                const snappedX = snapToGrid ? Math.round(worldPosition.x / effectiveGridSize) * effectiveGridSize : worldPosition.x;
                const snappedY = snapToGrid ? Math.round(worldPosition.y / effectiveGridSize) * effectiveGridSize : worldPosition.y;
                const newAsset: AssetData = {
                    id: Date.now(),
                    file: spriteData.file,
                    label: spriteData.label,
                    sourceUrl: spriteData.sourceUrl,
                    scale: spriteData.scale * SPRITE_SCALE_FACTOR,
                    x: snappedX,
                    y: snappedY,
                    type: {
                        kind: "default",
                        associatedChapterID: undefined,
                        label: "",
                        customChapterId: 0
                    },
                };

                setLayout({
                    layout: [...layout.layout!, newAsset],
                    updateOriginator: "user",
                    boundaries: layout.boundaries
                });
            } catch (error) {
            }
        }
    };

    const handleAssetPositionChange = useCallback((id: number, newX: number, newY: number) => {
        if (selectedIds.length <= 1) {
            setLayout({
                layout: layout.layout!.map((asset) =>
                    asset.id === id ? { ...asset, x: newX, y: newY } : asset
                ),
                updateOriginator: "user",
                boundaries: layout.boundaries
            });
        } else {
            const asset = layout.layout!.find(a => a.id === id);
            if (!asset) return;
            
            const deltaX = newX - asset.x;
            const deltaY = newY - asset.y;
            
            setLayout({
                layout: layout.layout!.map((a) => {
                    if (selectedIds.includes(a.id)) {
                        const updatedX = snapToGrid 
                            ? Math.round((a.x + deltaX) / effectiveGridSize) * effectiveGridSize 
                            : a.x + deltaX;
                        const updatedY = snapToGrid 
                            ? Math.round((a.y + deltaY) / effectiveGridSize) * effectiveGridSize 
                            : a.y + deltaY;
                        return { ...a, x: updatedX, y: updatedY };
                    }
                    return a;
                }),
                updateOriginator: "user",
                boundaries: layout.boundaries
            });
        }
    }, [layout.layout, layout.boundaries, setLayout, selectedIds, effectiveGridSize, snapToGrid]);

    const handleAssetContextMenu = useCallback((assetId: number, pos: { clientX: number; clientY: number }) => {
        if (parentRef.current) {
            parentRef.current.oncontextmenu = (e) => e.preventDefault();
        }
        setContextMenu({
            assetId,
            x: `${pos.clientX}px`,
            y: `${pos.clientY}px`,
        });
    }, []);

    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener("pointerdown", handlePointerDown);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [contextMenu]);

    const isPlaceholderStone = useCallback(
        (asset?: AssetData | null) =>
            typeof asset?.file === "string" &&
            asset.file.endsWith(PLACEHOLDER_STONE_FILE),
        [PLACEHOLDER_STONE_FILE]
    );

    useEffect(() => {
        if (!contextMenu || !layout.layout) return;
        const index = layout.layout.findIndex((asset) => asset.id === contextMenu.assetId);
        const asset = index !== -1 ? layout.layout[index] : null;
        setLayerInput(index !== -1 ? String(index + 1) : "");
        setLayerInputError(false);
        if (isPlaceholderStone(asset)) {
            const nextOrder = asset?.order ?? 0;
            setOrderInput(String(nextOrder));
        } else {
            setOrderInput("");
        }
        setOrderInputError(false);
    }, [contextMenu, layout.layout, isPlaceholderStone]);

    const handleIncreaseLayer = () => {
        if (!layout.layout) return;
        const index = layout.layout.findIndex(asset => asset.id === contextMenu?.assetId);
        if (index === -1 || index === layout.layout.length - 1) return;
        const newLayout = [...layout.layout];
        const temp = newLayout[index];
        newLayout[index] = newLayout[index + 1];
        newLayout[index + 1] = temp;
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
    };

    const handleDecreaseLayer = () => {
        if (!layout.layout) return;
        const index = layout.layout.findIndex(asset => asset.id === contextMenu?.assetId);
        if (index <= 0) return;
        const newLayout = [...layout.layout];
        const temp = newLayout[index];
        newLayout[index] = newLayout[index - 1];
        newLayout[index - 1] = temp;
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
    };

    const commitLayerInput = () => {
        if (!layout.layout || !contextMenu) return;
        const trimmed = layerInput.trim();
        const currentIndex = layout.layout.findIndex((asset) => asset.id === contextMenu.assetId);
        if (currentIndex === -1) return;
        if (!trimmed) {
            setLayerInputError(true);
            return;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            setLayerInputError(true);
            return;
        }
        const targetIndex = Math.floor(parsed) - 1;
        if (targetIndex < 0 || targetIndex >= layout.layout.length) {
            setLayerInputError(true);
            return;
        }
        if (targetIndex === currentIndex) {
            setLayerInputError(false);
            setLayerInput(String(currentIndex + 1));
            return;
        }
        const newLayout = [...layout.layout];
        const [asset] = newLayout.splice(currentIndex, 1);
        newLayout.splice(targetIndex, 0, asset);
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
        setLayerInputError(false);
        setLayerInput(String(targetIndex + 1));
    };

    const handleDecreaseOrder = () => {
        if (!layout.layout) return;
        const index = layout.layout.findIndex(asset => asset.id === contextMenu?.assetId);
        if (index === -1) return;
        const newLayout = [...layout.layout];
        const asset = newLayout[index];
        if (!isPlaceholderStone(asset)) return;
        if (asset.order === undefined) {
            asset.order = 0;
        }
        asset.order -= 1;
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
        setOrderInput(String(asset.order));
        setOrderInputError(false);
    };

    const handleIncreaseOrder = () => {
        if (!layout.layout) return;
        const index = layout.layout.findIndex(asset => asset.id === contextMenu?.assetId);
        if (index === -1) return;
        const newLayout = [...layout.layout];
        const asset = newLayout[index];
        if (!isPlaceholderStone(asset)) return;
        if (asset.order === undefined) {
            asset.order = 0;
        }
        asset.order += 1;
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
        setOrderInput(String(asset.order));
        setOrderInputError(false);
    };

    const commitOrderInput = () => {
        if (!layout.layout || !contextMenu) return;
        const trimmed = orderInput.trim();
        const currentIndex = layout.layout.findIndex((asset) => asset.id === contextMenu.assetId);
        if (currentIndex === -1) return;
        const asset = layout.layout[currentIndex];
        if (!isPlaceholderStone(asset)) return;
        if (!trimmed) {
            setOrderInputError(true);
            return;
        }
        if (!/^\d+$/.test(trimmed)) {
            setOrderInputError(true);
            return;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            setOrderInputError(true);
            return;
        }
        const newLayout = [...layout.layout];
        newLayout[currentIndex] = { ...asset, order: parsed };
        setLayout({
            layout: newLayout,
            updateOriginator: "user",
            boundaries: layout.boundaries
        });
        setOrderInputError(false);
        setOrderInput(String(parsed));
    };

    const handleDeleteAsset = () => {
        setLayout({
            layout: layout.layout!.filter(asset => asset.id !== contextMenu?.assetId),
            updateOriginator: "user"
        });
        setContextMenu(null);
    };

    const handleContextMenuClose = () => {
        setContextMenu(null);
    };

    const defaultWorldWidth = 2000;
    const defaultWorldHeight = 2000;

    useEffect(() => {
        const parent = parentRef.current;
        if (!parent) return;

        // Prevent overscroll and navigation gestures
        const prevent = (e: Event) => {
            e.preventDefault();
        };
        // For wheel events (trackpad, mouse)
        parent.addEventListener('wheel', prevent, { passive: false });
        // For touch events (mobile, trackpad)
        parent.addEventListener('touchmove', prevent, { passive: false });
        // For gesture events (Safari, Mac)
        parent.addEventListener('gesturestart', prevent, { passive: false });
        parent.addEventListener('gesturechange', prevent, { passive: false });
        parent.addEventListener('gestureend', prevent, { passive: false });

        return () => {
            parent.removeEventListener('wheel', prevent);
            parent.removeEventListener('touchmove', prevent);
            parent.removeEventListener('gesturestart', prevent);
            parent.removeEventListener('gesturechange', prevent);
            parent.removeEventListener('gestureend', prevent);
        };
    }, []);



    return (
        <div style={{ width: "100%", height: "100%", display: "flex", maxHeight: '100%' }}>
            <div
                ref={parentRef}
                id="canvas-parent"
                style={{ flex: "1", height: "100%", maxHeight: '100%', position: "relative", overflow: "hidden", overscrollBehavior: "none" }}
                onDragOver={readOnly ? undefined : handleDragOver}
                onDrop={readOnly ? undefined : handleDrop}
                onMouseMove={handleMouseMove}
            >
                <Application
                    backgroundColor={0x8da64a}
                    antialias={true}
                    resolution={window.devicePixelRatio}
                    autoDensity={true}
                    resizeTo={parentRef}
                >
                    <CanvasViewport
                        placedAssets={layout.layout || []}
                        selectedIds={selectedIds}
                        onSelectIds={setSelectedIds}
                        onViewportReady={handleViewportReady}
                        onAssetPositionChange={handleAssetPositionChange}
                        onAssetContextMenu={handleAssetContextMenu}
                        onAssetClick={onAssetClick}
                        onChapterClick={onChapterClick}
                        readOnly={!!readOnly}
                        minZoom={minZoom}
                        maxZoom={maxZoom}
                        boundaries={layout.boundaries}
                        showGrid={showGrid}
                        snapToGrid={snapToGrid}
                        gridGranularity={gridGranularity}
                        effectiveGridSize={effectiveGridSize}
                        chapterStates={chapterStates}
                        clampToMap={clampToMap}
                    />
                </Application>
            </div>
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                    className="absolute z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in"
                    style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="p-2">
                        {/* Row for Remove button and asset type label */}
                        <div className="flex flex-row justify-between items-center mb-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                {(() => {
                                    const asset = layout.layout!.find((a) => a.id === contextMenu.assetId);
                                    if (asset && asset.type.kind === "chapter") {
                                        return "Chapter Stone";
                                    } else {
                                        return "Asset";
                                    }
                                })()}
                            </span>
                            <button
                                className="p-1 rounded-full bg-primary text-white hover:bg-primary/80 transition-colors text-xs shadow-lg"
                                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAsset();
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                        <div className="grid gap-2">
                            {(() => {
                                const asset = layout.layout!.find((a) => a.id === contextMenu.assetId);
                                if (asset && asset?.type.kind === "chapter") {
                                    return <span>Chapter ID: {asset.type.associatedChapterID}</span>;
                                } else {
                                    return null;
                                }
                            })()}
                            <div className="flex items-center justify-between">
                                <Label htmlFor="layer" className="text-xs font-medium">
                                    Layer
                                </Label>
                                <div className="flex h-7 items-center">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-r-none px-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecreaseLayer();
                                        }}
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                        <span className="sr-only">Decrease layer</span>
                                    </Button>
                                    <Input
                                        id="layer"
                                        value={layerInput}
                                        onFocus={() => setLayerInputError(false)}
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            if (next === "" || /^\d+$/.test(next)) {
                                                if (layerInputError) setLayerInputError(false);
                                                setLayerInput(next);
                                            }
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                commitLayerInput();
                                            }
                                            if (event.key === "Escape") {
                                                event.preventDefault();
                                                const index = layout.layout!.findIndex(
                                                    (a) => a.id === contextMenu.assetId
                                                );
                                                setLayerInput(index !== -1 ? String(index + 1) : "");
                                                setLayerInputError(false);
                                            }
                                        }}
                                        onBlur={commitLayerInput}
                                        inputMode="numeric"
                                        className={`h-7 w-14 rounded-none text-center text-base font-semibold px-1 ${
                                            layerInputError ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-background' : ''
                                        }`}
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-l-none px-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleIncreaseLayer();
                                        }}
                                    >
                                        <ChevronUp className="h-3 w-3" />
                                        <span className="sr-only">Increase layer</span>
                                    </Button>
                                </div>
                            </div>
                            {(() => {
                                const asset = layout.layout!.find((a) => a.id === contextMenu.assetId);
                                if (!isPlaceholderStone(asset)) {
                                    return null;
                                }
                                return (
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="order" className="text-xs font-medium">
                                            Order
                                        </Label>
                                        <div className="flex h-7 items-center">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7 rounded-r-none px-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDecreaseOrder();
                                                }}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                                <span className="sr-only">Decrease order</span>
                                            </Button>
                                            <Input
                                                id="order"
                                                value={orderInput}
                                                onFocus={() => setOrderInputError(false)}
                                                onChange={(event) => {
                                                    const next = event.target.value;
                                                    if (next === "" || /^\d+$/.test(next)) {
                                                        if (orderInputError) setOrderInputError(false);
                                                        setOrderInput(next);
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        commitOrderInput();
                                                    }
                                                    if (event.key === "Escape") {
                                                        event.preventDefault();
                                                        const index = layout.layout!.findIndex(
                                                            (a) => a.id === contextMenu.assetId
                                                        );
                                                        const nextOrder =
                                                            index !== -1 ? layout.layout![index]?.order ?? 0 : 0;
                                                        setOrderInput(String(nextOrder));
                                                        setOrderInputError(false);
                                                    }
                                                }}
                                                onBlur={commitOrderInput}
                                                inputMode="numeric"
                                                className={`h-7 w-14 rounded-none text-center text-base font-semibold px-1 ${
                                                    orderInputError ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-background' : ''
                                                }`}
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7 rounded-l-none px-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleIncreaseOrder();
                                                }}
                                            >
                                                <ChevronUp className="h-3 w-3" />
                                                <span className="sr-only">Increase order</span>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Canvas;
