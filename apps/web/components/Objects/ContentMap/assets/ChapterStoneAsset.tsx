/* eslint-disable react/prop-types */
import React, {
  useImperativeHandle,
  useRef,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Container, Sprite } from 'pixi.js';
import { extend } from '@pixi/react';
import usePixiTexture from '../hooks/usePixiTexture';
import type {
  CommonAssetProps,
  ChapterStoneTheme,
} from '../Asset/assetTypes';

extend({ Container, Sprite });

export const DEFAULT_CHAPTER_STONE_ICON = '/chapterStones/defaultIcon.svg';

export const DEFAULT_CHAPTER_STONE_THEME: ChapterStoneTheme = {
  locked: {
    skin: '/chapterStones/locked.svg',
    iconStroke: 0x9d9993,
    iconShadow: 0x58554d,
  },
  unlocked: {
    skin: '/chapterStones/unlocked.svg',
    iconStroke: 0xd3d3d3,
    iconShadow: 0x9e998d,
  },
  finished: {
    skin: '/chapterStones/unlocked.svg',
    iconStroke: 0xd3d3d3,
    iconShadow: 0x9e998d,
  },
};

type Props = CommonAssetProps & {
  theme?: ChapterStoneTheme;
  icon?: string;
  scaleFactor?: number;
  verticalSquish?: number;
};

const ChapterStoneAsset = React.forwardRef<Container, Props>(
  (
    {
      asset,
      layer,
      onPointerDown,
      onPointerUp,
      selected,
      chapterState = 'unlocked',
      assetId,

      theme = DEFAULT_CHAPTER_STONE_THEME,
      icon = DEFAULT_CHAPTER_STONE_ICON,
      scaleFactor = 6,
      verticalSquish = 8,
    },
    ref,
  ) => {
    // determine the correct visuals
    const visual = useMemo(() => theme[chapterState], [theme, chapterState]);

    // PIXI plumbing
    const containerRef = useRef<Container>(null);
    const stoneSpriteRef = useRef<Sprite>(null);
    const iconSpriteRef = useRef<Sprite>(null);

    useImperativeHandle(ref, () => containerRef.current as Container, []);

    // click feedback (pressed state)
    const [pressed, setPressed] = useState(false);

    /* base stone -------------------------------------------------------- */
    const stoneSrc = useMemo(
      () =>
        pressed
          ? visual.skin.replace(/\.svg$/, '-pressed.svg')
          : visual.skin,
      [visual.skin, pressed],
    );
    const stoneTexture = usePixiTexture(stoneSrc);
    /* centre icon */
    const iconTexture = usePixiTexture(icon);

    if (!stoneTexture || !iconTexture) return null;

    /** drag starts on pointer-down … */
    const handlePointerDown = (e: any) => {
      onPointerDown(e, asset, containerRef.current!);
      if (e.button === 0) {
        setPressed(true);
      }
    };

    /** … but ordinary "click" actions happen on pointer-up */
    const handlePointerUp = (e: any) => {
      setPressed(false);
      if (onPointerUp) onPointerUp(e, asset, containerRef.current!);
    };

    /** reset pressed state when pointer leaves the asset */
    const handlePointerOut = (e: any) => {
      setPressed(false);
    };

    // calculate scales
    const baseScale = asset.scale * scaleFactor;
    const iconScale = baseScale * 1.0;   // larger icon
    const iconSquish =
      (iconTexture.height - verticalSquish) / iconTexture.height;

    // shadow sprite
    const shadowOffset = 4;
    const halfOffset = shadowOffset / 2;
    const shadowAlpha = 1;

    // render
    return (
      <pixiContainer
        ref={containerRef}
        x={asset.x}
        y={asset.y}
        zIndex={layer}
        interactive
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        alpha={selected ? 0.8 : 1}
        data-asset-id={assetId ?? asset.id}
      >
        {/* -------- stone base -------- */}
        <pixiSprite
          ref={stoneSpriteRef}
          texture={stoneTexture}
          scale={baseScale}
          anchor={0.5}
        />

        {/* -------- centre icon -------- */}
        {/* --- icon + shadow grouped and centered --- */}
        <pixiContainer y={pressed ? -8 : -16} x={-4}>
          {/* shadow */}
          <pixiSprite
            texture={iconTexture}
            anchor={0.5}
            y={halfOffset}
            scale={{ x: iconScale, y: iconScale * iconSquish}}
            tint={visual.iconShadow}
            alpha={shadowAlpha}
          />


          {/* stroke */}
          <pixiSprite
            ref={iconSpriteRef}
            texture={iconTexture}
            anchor={0.5}
            y={-halfOffset}
            scale={{ x: iconScale, y: iconScale * iconSquish}}
            tint={visual.iconStroke}
          />
        </pixiContainer>
      </pixiContainer>
    );
  },
);

ChapterStoneAsset.displayName = 'ChapterStoneAsset';
export default React.memo(ChapterStoneAsset);
