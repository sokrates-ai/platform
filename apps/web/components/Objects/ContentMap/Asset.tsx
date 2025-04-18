import React, { useEffect, useState, useRef } from "react";
import * as PIXI from "pixi.js";
import { Sprite, Container, Text } from "pixi.js";
import { extend } from "@pixi/react";

extend({ Sprite, Container, Text });

export type AssetTypeDataKind = "default" | "chapter"

export interface AssetTypeData {
    kind: AssetTypeDataKind;
    associatedChapterID?: number
    customChapterId?: number | undefined;
    label?: string;
}

export interface AssetData {
    id: number;
    x: number;
    y: number;
    scale: number;
    file: string;
    label?: string;
    type: AssetTypeData
};

export interface AssetProps {
    asset: AssetData;
    layer: number;
    spriteURL: (file: string) => string;
    onPointerDown: (e: any, asset: any) => void;
}

const Asset: React.FC<AssetProps> = React.memo(({ asset, spriteURL, onPointerDown, layer }) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(null);
    const hasLoaded = useRef(false);
    const { file } = asset;

    useEffect(() => {
        if (!hasLoaded.current) {
            console.log("useEffect Triggered");
            PIXI.Assets.load(spriteURL(file))
                .then((tex) => {
                    setTexture(tex);
                    hasLoaded.current = true;
                })
                .catch((err) => console.error("Error loading texture:", err));
        }
    }, [file, spriteURL]);

    if (!texture) {
        return null;
    }

    // Render differently based on asset type
    if (asset.type.kind === "chapter" && asset.type.associatedChapterID !== undefined) {
        console.log(`Chapter Label: ${asset.type.label}`)
        return (
            <pixiContainer
                x={asset.x}
                y={asset.y}
                zIndex={layer}
                interactive
                onPointerDown={(e: PIXI.FederatedPointerEvent) => onPointerDown(e, asset)}
            >
                <pixiSprite
                    texture={texture}
                    scale={asset.scale}
                    anchor={0.5}
                />
                <IsometricChapterText
                    chapterID={asset.type.customChapterId ?? 0}
                    width={texture.width * asset.scale}
                    height={texture.height * asset.scale}
                />
            </pixiContainer>
        );
    }

    // Default rendering for non-chapter assets
    return (
        <pixiSprite
            texture={texture}
            x={asset.x}
            y={asset.y}
            zIndex={layer}
            scale={asset.scale}
            interactive
            onPointerDown={(e: PIXI.FederatedPointerEvent) => onPointerDown(e, asset)}
        />
    );
});

// Subcomponent for isometric chapter text
interface IsometricChapterTextProps {
    chapterID: number;
    width: number;
    height: number;
}

const IsometricChapterText: React.FC<IsometricChapterTextProps> = ({ chapterID, width, height }) => {
    const [isometricTexture, setIsometricTexture] = useState<PIXI.Texture | null>(null);

    useEffect(() => {
        // Create a canvas for isometric text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Set canvas size (make it larger to accommodate the isometric projection)
            canvas.width = width * 2;
            canvas.height = height * 2;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Text content
            const text = chapterID.toString();

            // Calculate text size - making it larger for better visibility
            const fontSize = height * 0.8;
            ctx.font = `bold ${fontSize}px Times New Roman`;
            const textMetrics = ctx.measureText(text);

            // Save context for transformations
            ctx.save();

            // Move to center of canvas
            ctx.translate(canvas.width / 2, canvas.height / 2);

            // Isometric projection
            // First, rotate by 45 degrees
            ctx.rotate(2 * Math.PI);
            // Then scale to flatten it (more on Y to create the isometric look)
            ctx.scale(1, 0.5);

            // Text style
            ctx.fillStyle = '#58554d';
            ctx.strokeStyle = '#45423C';
            ctx.lineWidth = fontSize * 0.1;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw text with stroke for better visibility
            ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);

            // Restore context
            ctx.restore();

            // Create texture from canvas
            const texture = PIXI.Texture.from(canvas);
            setIsometricTexture(texture);
        }
    }, [chapterID, width, height]);

    if (!isometricTexture) {
        return null;
    }

    return (
        <pixiSprite
            texture={isometricTexture}
            anchor={0.5}
            blendMode="linear-burn"
            alpha={0.7}
            y={height * -0.05} // Offset slightly to position on the "ground"
        />
    );
};

Asset.displayName = 'Asset';

export default Asset;