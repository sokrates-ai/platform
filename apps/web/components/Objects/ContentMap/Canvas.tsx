import React, { useRef, useState, useEffect } from "react";
import { Application } from "@pixi/react";
import CanvasViewport from "./CanvasViewport";
import { SPRITES } from "./spriteIndex";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CanvasProps {
    courseStructure: any;
    onMapUpdateCallback?: Function;
    onChapterClick: (chapterID: number) => void;
    readOnly?: boolean;
}

interface ContextMenuData {
    assetId: number;
    x: string;
    y: string;
}

const Canvas: React.FC<CanvasProps> = ({
    courseStructure,
    onMapUpdateCallback,
    onChapterClick,
    readOnly = false,
}) => {
    // useAssetPreloader();

    // Ref for the canvas container (used for drop events and context menu positioning).
    const parentRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [placedAssets, setPlacedAssets] = useState<any[]>([]);
    const [viewport, setViewport] = useState<any>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const hasLoadedMapState = useRef(false);

    // Allow dropping by preventing default dragover behavior.
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    // On drop, convert the drop position to world coordinates using the viewport.
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
                const newAsset = {
                    id: Date.now(),
                    file: spriteData.file,
                    label: spriteData.label,
                    scale: spriteData.scale * 0.2,
                    x: worldPosition.x,
                    y: worldPosition.y,
                };
                setPlacedAssets((prev) => [...prev, newAsset]);
            } catch (error) {
                console.error("Error parsing dropped data", error);
            }
        }
    };

    const handleAssetPositionChange = (id: number, newX: number, newY: number) => {
        setPlacedAssets((assets) =>
            assets.map((asset) => (asset.id === id ? { ...asset, x: newX, y: newY } : asset))
        );
    };

    // Callback when an asset is right-clicked.
    const handleAssetContextMenu = (assetId: number, pos: { clientX: number; clientY: number }) => {
        // Prevent the default browser context menu.
        if (parentRef.current) {
            parentRef.current.oncontextmenu = (e) => e.preventDefault();
        }
        // Set context menu state with absolute positioning.
        setContextMenu({
            assetId,
            x: `${pos.clientX}px`,
            y: `${pos.clientY}px`,
        });
    };

    // Global pointerdown listener to close the context menu if clicking outside.
    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };

        // Delay adding the listener to avoid immediate closure.
        const timer = setTimeout(() => {
            document.addEventListener("pointerdown", handlePointerDown);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [contextMenu]);

    // Load saved state from backend (if available)
    /*useEffect(() => {
        if (!courseStructure?.map_state || hasLoadedMapState.current) {
            return;
        }
        const objects = courseStructure.map_state.objects;
        try {
            setPlacedAssets(objects);
            hasLoadedMapState.current = true;
        } catch (error) {
            console.error("Failed to parse stored map state", error);
        }
    }, [courseStructure]);
    */

    // merge chapter nodes into current assets
    /*useEffect(() => {
        if (!courseStructure?.chapters) return;
        setPlacedAssets((prevAssets) => {
            // Find chapter nodes already present.
            const currentChapterNodes = prevAssets.filter(
                (asset) => asset.associatedWithChapterID != null
            );
            // Only add chapters that are not already represented.
            const missingChapters = courseStructure.chapters.filter(
                (chapter: any) =>
                    !currentChapterNodes.some(
                        (asset: any) => asset.associatedWithChapterID === chapter.id
                    )
            );
            if (missingChapters.length === 0) {
                // No new chapter nodes to add.
                return prevAssets;
            }
            const newChapterNodes = missingChapters.map((chapter: any, index: number) => {
                const padding = 1000;
                const centerX = WORLD_WIDTH / 2;
                const centerY = WORLD_HEIGHT / 2;
                const offsetX = centerX - 100;
                const offsetY =
                    centerY + index * padding - (courseStructure.chapters.length * padding) / 2;
                const spriteFile = SPRITES[119 + index]?.file || SPRITES[100]?.file;
                return {
                    id: -chapter.id, // Negative ID to indicate a chapter node.
                    file: spriteFile,
                    label: `${chapter.id}`,
                    scale: 0.2,
                    x: offsetX,
                    y: offsetY,
                    associatedWithChapterID: chapter.id,
                };
            });
            return [...prevAssets, ...newChapterNodes];
        });
    }, [courseStructure?.chapters]);
    */

    // serialize and send out current map state
    /*useEffect(() => {
        if (onMapUpdateCallback) {
            onMapUpdateCallback(placedAssets);
        } else {
            console.warn("map update is not ready: ", onMapUpdateCallback);
        }
    }, [placedAssets, onMapUpdateCallback]);
    */

    return (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
            {/* Canvas area with drop handlers */}
            <div
                ref={parentRef}
                id="canvas-parent"
                style={{ flex: "1", height: "100%", position: "relative" }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <Application
                    backgroundColor={0x8da64a}
                    autoDensity={true}
                    resizeTo={parentRef}
                >
                    <CanvasViewport
                        placedAssets={placedAssets}
                        onViewportReady={setViewport}
                        onAssetPositionChange={handleAssetPositionChange}
                        onAssetContextMenu={handleAssetContextMenu}
                    />
                </Application>
            </div>
            {/* Asset library panel */}
            {!readOnly && (
                <div className="border-l bg-card h-full overflow-y-auto w-80">
                    <div className="p-3 border-b">
                        <h3 className="text-sm font-medium">Asset Library</h3>
                    </div>
                    <div className="p-2">
                        <div className="grid grid-cols-2 gap-2">
                            {SPRITES.map((sprite, index) => (
                                <div
                                    key={index}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("application/json", JSON.stringify(sprite));
                                    }}
                                    className="group flex flex-col items-center p-2 rounded-md border bg-background hover:border-primary transition-colors cursor-grab active:cursor-grabbing"
                                >
                                    <div className="relative w-full aspect-square flex items-center justify-center mb-1 bg-muted/40 rounded overflow-hidden">
                                        <img
                                            src={`/contentMap/${sprite.file}`}
                                            alt={sprite.label}
                                            className="object-contain max-h-full max-w-full group-hover:scale-105 transition-transform"
                                            style={{ filter: "saturate(120%)" }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium truncate w-full text-center text-muted-foreground group-hover:text-foreground">
                                        {sprite.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                    className="absolute z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in"
                    style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="p-2">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="layer" className="text-xs font-medium">
                                    Layer
                                </Label>
                                <div className="flex h-7 items-center">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-r-none px-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                        <span className="sr-only">Decrease layer</span>
                                    </Button>
                                    <Input
                                        id="layer"
                                        value="1"
                                        className="h-7 w-8 rounded-none text-center text-xs"
                                        readOnly
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-l-none px-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ChevronUp className="h-3 w-3" />
                                        <span className="sr-only">Increase layer</span>
                                    </Button>
                                </div>
                            </div>
                            <Button variant="destructive" size="sm" className="mt-1 w-full text-xs">
                                Remove
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Canvas;
