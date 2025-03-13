import React, { useEffect, useState, useRef } from "react";
import * as PIXI from "pixi.js";
import { Sprite } from "pixi.js";
import { extend } from "@pixi/react";

extend({ Sprite });

interface AssetProps {
    asset: {
        id: number;
        x: number;
        y: number;
        scale: number;
        file: string;
        label: string;
    };
    spriteURL: (file: string) => string;
    onPointerDown: (e: any, asset: any) => void;
}

const Asset: React.FC<AssetProps> = ({ asset, spriteURL, onPointerDown }) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(null);
    const hasLoaded = useRef(false);

    const { file } = asset;

    useEffect(() => {
        if (!hasLoaded.current) {
            console.log("useEffect Triggered");
            PIXI.Assets.load(spriteURL(file))
                .then((tex) => {
                    console.log("Load texture");
                    setTexture(tex);
                    hasLoaded.current = true;
                })
                .catch((err) => console.error("Error loading texture:", err));
        }
    }, [file, spriteURL]);

    if (!texture) {
        // Optionally return a placeholder while loading.
        return null;
    }

    return (
        <pixiSprite
            texture={texture}
            x={asset.x}
            y={asset.y}
            scale={asset.scale}
            interactive
            onPointerDown={(e: PIXI.FederatedPointerEvent) => onPointerDown(e, asset)}
        />
    );
};

export default Asset;