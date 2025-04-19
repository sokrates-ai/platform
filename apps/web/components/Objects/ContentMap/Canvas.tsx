import React, { useRef, useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { Application } from "@pixi/react";
import CanvasViewport from "./CanvasViewport";
import { SPRITES } from "./spriteIndex";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetData } from "./Asset";
import { SPRITE_SCALE_FACTOR, MINOR_GRID_SIZE } from "./constants";

interface ContextMenuData {
    assetId: number;
    x: string;
    y: string;
}

export interface LayoutState {
    layout: AssetData[] | null;
    updateOriginator: "user" | "initial";
}

export interface CanvasProps {
    layout: LayoutState;
    setLayout: Dispatch<SetStateAction<LayoutState>>;
    onChapterClick: (chapterID: number) => void;
    readOnly?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({
    layout,
    setLayout,
    onChapterClick,
    readOnly = false,
}) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const copiedRef = useRef<AssetData[]>([]);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
    const [viewport, setViewport] = useState<any>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            const key = e.key.toLowerCase();

            if (key === "c" && selectedIds.length) {
                e.preventDefault();
                copiedRef.current = layout.layout!
                    .filter(a => selectedIds.includes(a.id))
                    .map(a => ({ ...a }));
            }
            else if (key === "x" && selectedIds.length) {
                e.preventDefault();
                copiedRef.current = layout.layout!
                    .filter(a => selectedIds.includes(a.id))
                    .map(a => ({ ...a }));
                setLayout(old => ({
                    layout: old.layout!.filter(a => !selectedIds.includes(a.id)),
                    updateOriginator: "user",
                }));
                setSelectedIds([]);
            }
            else if (key === "v" && copiedRef.current.length) {
                e.preventDefault();
                // compute target world‐coords
                let targetWorld = null;
                if (viewport && parentRef.current && lastMousePos) {
                    const rect = parentRef.current.getBoundingClientRect();
                    const localX = lastMousePos.x - rect.left;
                    const localY = lastMousePos.y - rect.top;
                    targetWorld = viewport.toWorld(localX, localY);
                }
                // compute centroid of copied group
                const copied = copiedRef.current;
                const cx = copied.reduce((sum, a) => sum + a.x, 0) / copied.length;
                const cy = copied.reduce((sum, a) => sum + a.y, 0) / copied.length;

                const pasted = copied.map(a => {
                    // delta: either to grid‐offset or to cursor center
                    let dx = MINOR_GRID_SIZE, dy = MINOR_GRID_SIZE;
                    if (targetWorld) {
                        dx = targetWorld.x - cx;
                        dy = targetWorld.y - cy;
                    }
                    const rawX = a.x + dx;
                    const rawY = a.y + dy;
                    // snap to grid
                    const snappedX = Math.round(rawX / MINOR_GRID_SIZE) * MINOR_GRID_SIZE;
                    const snappedY = Math.round(rawY / MINOR_GRID_SIZE) * MINOR_GRID_SIZE;

                    return {
                        ...a,
                        id: Date.now() + Math.random(),
                        x: snappedX,
                        y: snappedY,
                    };
                });

                setLayout(old => ({
                    layout: [...old.layout!, ...pasted],
                    updateOriginator: "user",
                }));
                setSelectedIds(pasted.map(a => a.id));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [layout.layout, selectedIds, viewport, lastMousePos, setLayout]);


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
                // snap the drop position too
                const snappedX = Math.round(worldPosition.x / MINOR_GRID_SIZE) * MINOR_GRID_SIZE;
                const snappedY = Math.round(worldPosition.y / MINOR_GRID_SIZE) * MINOR_GRID_SIZE;
                const newAsset: AssetData = {
                    id: Date.now(),
                    file: spriteData.file,
                    label: spriteData.label,
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

                setLayout((old: LayoutState) => {
                    const newData = [...old.layout!, newAsset];
                    return {
                        layout: newData,
                        updateOriginator: "user",
                    } as LayoutState;
                });
            } catch (error) {
                console.error("Error parsing dropped data", error);
            }
        }
    };

    const handleAssetPositionChange = useCallback((id: number, newX: number, newY: number) => {
        setLayout((old: LayoutState) => {
            const newLayout = old.layout!.map((asset) =>
                asset.id === id ? { ...asset, x: newX, y: newY } : asset
            );
            return {
                layout: newLayout,
                updateOriginator: "user",
            } as LayoutState;
        });
    }, []);

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

    const handleIncreaseLayer = () => {
        setLayout((old: LayoutState) => {
            if (!old.layout) return old;

            const index = old.layout.findIndex(asset => asset.id === contextMenu?.assetId);
            if (index === -1 || index === old.layout.length - 1) return old; // Already top-most

            const newLayout = [...old.layout];
            // Correctly swap the elements
            const temp = newLayout[index];
            newLayout[index] = newLayout[index + 1];
            newLayout[index + 1] = temp;

            return {
                layout: newLayout,
                updateOriginator: "user",
            };
        });
    };

    const handleDecreaseLayer = () => {
        setLayout((old: LayoutState) => {
            if (!old.layout) return old;

            const index = old.layout.findIndex(asset => asset.id === contextMenu?.assetId);
            if (index <= 0) return old; // Already bottom-most

            const newLayout = [...old.layout];
            // Correctly swap the elements
            const temp = newLayout[index];
            newLayout[index] = newLayout[index - 1];
            newLayout[index - 1] = temp;

            return {
                layout: newLayout,
                updateOriginator: "user",
            };
        });
    };

    const handleDecreaseAssetStoneId = () => {
        setLayout((old: LayoutState) => {
            if (!old.layout) return old;

            const index = old.layout.findIndex(asset => asset.id === contextMenu?.assetId);
            if (index === -1) return old;

            const newLayout = [...old.layout];
            const asset = newLayout[index];

            if (asset.type.customChapterId === undefined) {
                asset.type.customChapterId = 0;
            } else {
                asset.type.customChapterId -= 1;
            }

            return {
                layout: newLayout,
                updateOriginator: "user",
            };
        });
    };

    const handleIncreaseAssetStoneId = () => {
        setLayout((old: LayoutState) => {
            if (!old.layout) return old;

            const index = old.layout.findIndex(asset => asset.id === contextMenu?.assetId);
            if (index === -1) return old;

            const newLayout = [...old.layout];
            const asset = newLayout[index];

            if (asset.type.customChapterId === undefined) {
                asset.type.customChapterId = 0;
            } else {
                asset.type.customChapterId += 1;
            }

            return {
                layout: newLayout,
                updateOriginator: "user",
            };
        });
    };




    const handleDeleteAsset = () => {
        setLayout((old: LayoutState) => {
            const newLayout = old.layout!.filter(asset => asset.id !== contextMenu?.assetId);
            return { layout: newLayout, updateOriginator: "user" };
        });
        setContextMenu(null);
    };

    return (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
            <div
                ref={parentRef}
                id="canvas-parent"
                style={{ flex: "1", height: "100%", position: "relative", overflow: "auto", overscrollBehavior: "none" }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onMouseMove={handleMouseMove}
            >
                <Application backgroundColor={0x8da64a} autoDensity={true} resizeTo={parentRef}>
                    <CanvasViewport
                        placedAssets={layout.layout!}
                        selectedIds={selectedIds}
                        onSelectIds={setSelectedIds as Dispatch<SetStateAction<number[]>>}
                        onViewportReady={setViewport}
                        onAssetPositionChange={handleAssetPositionChange}
                        onAssetContextMenu={handleAssetContextMenu}
                        onChapterClick={onChapterClick}
                        readOnly={readOnly}
                    />
                </Application>
            </div>
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
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                    className="absolute z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in"
                    style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="p-2">
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
                                        value={(() => {
                                            const index = layout.layout!.findIndex(
                                                (a) => a.id === contextMenu.assetId
                                            );
                                            return index !== -1 ? (index + 1).toString() : "";
                                        })()}
                                        className="h-7 w-8 rounded-none text-center text-xs"
                                        readOnly
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
                            <div className="flex items-center justify-between">
                                <Label htmlFor="layer" className="text-xs font-medium">
                                    Stone Id
                                </Label>
                                <div className="flex h-7 items-center">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-r-none px-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecreaseAssetStoneId();
                                        }}
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                        <span className="sr-only">Decrease stone id</span>
                                    </Button>
                                    <Input
                                        id="stoneId"
                                        value={(() => {
                                            const index = layout.layout!.findIndex(asset => asset.id === contextMenu?.assetId);
                                            const chapterId = layout.layout![index]?.type.customChapterId;
                                            return chapterId != undefined ? chapterId.toString() : "0";
                                        })()}
                                        className="h-7 w-8 rounded-none text-center text-xs"
                                        readOnly
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7 rounded-l-none px-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleIncreaseAssetStoneId();
                                        }}
                                    >
                                        <ChevronUp className="h-3 w-3" />
                                        <span className="sr-only">Increase stone id</span>
                                    </Button>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="mt-1 w-full text-xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAsset();
                                }}
                            >
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
