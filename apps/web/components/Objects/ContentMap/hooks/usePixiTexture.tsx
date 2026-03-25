import { useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';

/**
 * Loads a PIXI.Texture (with cache) and returns it.
 */
export default function usePixiTexture(url: string): PIXI.Texture | null {
  const [texture, setTexture] = useState<PIXI.Texture | null>(null);

    useEffect(() => {
    if (!url) return; // <-- just return, not null

    const isGif = /\.gif(?:$|[?#])/i.test(url);
    if (isGif) {
        const gifTexture = PIXI.Texture.from(url);
        setTexture(gifTexture);
        return;
    }

    const cached = PIXI.Assets.get(url);
    if (cached) {
        setTexture(cached);
        return;
    }

    let active = true;

    PIXI.Assets.load(url)
        .then((tex) => active && setTexture(tex as PIXI.Texture))
        .catch(() => {});

    return () => {
        active = false;
    };
    }, [url]);

  return texture;
}
