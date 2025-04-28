import React, { useEffect, useState, useRef, useImperativeHandle } from "react";
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
    onPointerDown: (e: any, asset: AssetData, target: PIXI.Container | PIXI.Sprite) => void;
    selected: boolean;
    chapterState?: 'locked' | 'unlocked' | 'finished';
}

const Asset = React.memo(React.forwardRef<PIXI.Container | PIXI.Sprite, AssetProps>(({ asset, spriteURL, onPointerDown, layer, selected, chapterState }, ref) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(null);
    const hasLoaded = useRef(false);
    const spriteRef = useRef<PIXI.Sprite>(null);
    const containerRef = useRef<PIXI.Container>(null);
    const { file } = asset;

    useImperativeHandle(
        ref,
        () =>
            asset.type.kind === "chapter"
                ? (containerRef.current as PIXI.Container)
                : (spriteRef.current as PIXI.Sprite),
        [asset.type.kind]
    );

    useEffect(() => {
        const target =
            asset.type.kind === "chapter" ? containerRef.current : spriteRef.current;
        if (target) target.alpha = selected ? 0.8 : 1;
    }, [selected, asset.type.kind]);

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

    // Determine tint color for chapter states
    let tint: number | undefined = undefined;
    if (asset.type.kind === 'chapter' && chapterState) {
        if (chapterState === 'locked') {
            tint = 0x888888; // gray
        } else if (chapterState === 'unlocked') {
            tint = 0xffffff; // white
        } else if (chapterState === 'finished') {
            tint = 0xdddddd; // light gray
        }
    }

    if (!texture) {
        return null;
    }

    if (asset.type.kind === "chapter" && asset.type.associatedChapterID !== undefined) {
        console.log(`Chapter Label: ${asset.type.label}`)
        return (
            <pixiContainer
                ref={containerRef}
                x={asset.x}
                y={asset.y}
                zIndex={layer}
                interactive
                onPointerDown={(e: PIXI.FederatedPointerEvent) => onPointerDown(e, asset, containerRef.current!)}
            >
                <pixiSprite
                    ref={spriteRef}
                    texture={texture}
                    scale={asset.scale}
                    anchor={0.5}
                    tint={tint}
                />
                <IsometricChapterText
                    chapterID={asset.type.customChapterId ?? 0}
                    width={texture.width * asset.scale}
                    height={texture.height * asset.scale}
                />
            </pixiContainer>
        );
    }

    return (
        <pixiSprite
            ref={spriteRef}
            texture={texture}
            x={asset.x}
            y={asset.y}
            zIndex={layer}
            scale={asset.scale}
            interactive
            onPointerDown={(e: PIXI.FederatedPointerEvent) => onPointerDown(e, asset, spriteRef.current!)}
        />
    );
}));

interface IsometricChapterTextProps {
    chapterID: number;
    width: number;
    height: number;
}

const IsometricChapterText: React.FC<IsometricChapterTextProps> = ({ chapterID, width, height }) => {
    const [isometricTexture, setIsometricTexture] = useState<PIXI.Texture | null>(null);

    useEffect(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx) {
            canvas.width = width * 2;
            canvas.height = height * 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const text = chapterID.toString();

            const fontSize = height * 0.8;
            ctx.font = `bold ${fontSize}px Times New Roman`;
            const textMetrics = ctx.measureText(text);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(2 * Math.PI);
            ctx.scale(1, 0.5);

            ctx.fillStyle = '#58554d';
            ctx.strokeStyle = '#45423C';
            ctx.lineWidth = fontSize * 0.1;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);

            ctx.restore();

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
            y={height * -0.05}
        />
    );
};

Asset.displayName = 'Asset';

export default Asset;
