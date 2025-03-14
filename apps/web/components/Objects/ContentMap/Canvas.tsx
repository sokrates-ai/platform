import React, { useRef, useState, useEffect, useCallback } from "react";
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
    const parentRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [placedAssets, setPlacedAssets] = useState<any[]>([]);
    const [viewport, setViewport] = useState<any>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

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

    const handleAssetPositionChange = useCallback((id: number, newX: number, newY: number) => {
        setPlacedAssets((assets) =>
            assets.map((asset) => (asset.id === id ? { ...asset, x: newX, y: newY } : asset))
        );
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

    return (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
            <div
                ref={parentRef}
                id="canvas-parent"
                style={{ flex: "1", height: "100%", position: "relative" }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <Application backgroundColor={0x8da64a} autoDensity={true} resizeTo={parentRef}>
                    <CanvasViewport
                        placedAssets={placedAssets}
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
