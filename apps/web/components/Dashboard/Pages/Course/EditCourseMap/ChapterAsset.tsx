import React from 'react';
import { Container, Sprite, Text as PText } from '@pixi/react';
import { Texture, SCALE_MODES, TextStyle } from 'pixi.js';
import { useDrag } from './useDrag';

interface ChapterAssetProps {
    x: number;
    y: number;
    id: number;
    overlaySource: string;
    stoneSource: string;
    updatePositionCallback: Function,
    chapterID: number;
    readOnly?: boolean;
}

export const ChapterAsset: React.FC<ChapterAssetProps> = ({
    x,
    y,
    id,
    overlaySource,
    stoneSource,
    updatePositionCallback,
    chapterID,
    readOnly = false,
}) => {
    const bind = useDrag({ x, y }, id, updatePositionCallback, readOnly);

    const overlayTexture = React.useMemo(() => {
        const tex = Texture.from(overlaySource);
        tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        return tex;
    }, [overlaySource]);

    const stoneTexture = React.useMemo(() => {
        const tex = Texture.from(stoneSource);
        tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        return tex;
    }, [stoneSource]);

    return (
        <Container>
            <Sprite texture={stoneTexture} scale={1} {...bind} />
            <Sprite texture={overlayTexture} scale={1} {...bind} />
            <PText
                text={`${chapterID}`}
                {...bind}
                style={
                    new TextStyle({
                        align: 'center',
                        fontFamily: '"Source Sans Pro", Helvetica, sans-serif',
                        fontSize: 300,
                        fontWeight: '400',
                        fill: ['#ffffff', '#00ff99'],
                        stroke: '#01d27e',
                        strokeThickness: 5,
                        letterSpacing: 20,
                        dropShadow: true,
                        dropShadowColor: '#ccced2',
                        dropShadowBlur: 4,
                        dropShadowAngle: Math.PI / 6,
                        dropShadowDistance: 6,
                        wordWrap: true,
                        wordWrapWidth: 440,
                    })
                }
            />
        </Container>
    );
};
