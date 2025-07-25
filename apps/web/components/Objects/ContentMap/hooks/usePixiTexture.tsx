import { useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';

/**
 * Loads a PIXI.Texture (with cache) and returns it.
 */
export default function usePixiTexture(url: string): PIXI.Texture | null {
  const [texture, setTexture] = useState<PIXI.Texture | null>(null);

  console.log('usePixiTexture', url);

  if (!url) return null;

  useEffect(() => {
    const cached = PIXI.Assets.get(url);
    if (cached) {
      setTexture(cached);
      return;
    }

    let active = true;
    PIXI.Assets.load(url)
      .then((tex) => active && setTexture(tex as PIXI.Texture))
      .catch(console.error);

    return () => {
      active = false;
    };
  }, [url]);

  return texture;
}
