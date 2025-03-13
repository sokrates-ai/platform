import { useEffect } from "react";
import * as PIXI from "pixi.js";
import { SPRITES } from "./spriteIndex";

const useAssetPreloader = () => {
    useEffect(() => {
        const spriteURL = (file: string): string => `/contentMap/${file}`;
        const urls = SPRITES.map(sprite => spriteURL(sprite.file));
        PIXI.Assets.load(urls)
            .then(() => console.log("All textures preloaded"))
            .catch(err => console.error("Error preloading textures:", err));
    }, []);
};

export default useAssetPreloader;
