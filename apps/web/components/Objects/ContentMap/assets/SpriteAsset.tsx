import React, { useImperativeHandle, useRef } from 'react';
import { Sprite } from 'pixi.js';
import { extend } from '@pixi/react';
import usePixiTexture from '../hooks/usePixiTexture';
import { CommonAssetProps } from '../Asset/assetTypes';

extend({ Sprite });

type Props = CommonAssetProps;

const SpriteAsset = React.forwardRef<Sprite, Props>(
  ({ asset,
     layer,
     spriteURL,
     onPointerDown,
     onPointerUp,
     selected,
     assetId }, ref) => {
    const spriteRef = useRef<Sprite>(null);
    useImperativeHandle(ref, () => spriteRef.current as Sprite, []);

    const texture = usePixiTexture(spriteURL(asset.file));
    if (!texture) return null;

    return (
      <pixiSprite
        ref={spriteRef}
        texture={texture}
        x={asset.x}
        y={asset.y}
        zIndex={layer}
        scale={asset.scale}
        alpha={selected ? 0.8 : 1}
        interactive
        onPointerDown={(e: any) => onPointerDown(e, asset, spriteRef.current!)}
        onPointerUp={
          onPointerUp ? (e: any) => onPointerUp(e, asset, spriteRef.current!) : undefined
        }
        data-asset-id={assetId ?? asset.id}
      />
    );
  }
);

SpriteAsset.displayName = 'SpriteAsset';
export default React.memo(SpriteAsset);
