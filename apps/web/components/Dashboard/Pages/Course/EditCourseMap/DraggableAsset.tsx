import React from 'react';
import { Sprite } from '@pixi/react';
import { Texture, SCALE_MODES } from 'pixi.js';
import { useDrag } from './useDrag';

interface DraggableAssetProps {
    x: number;
    y: number;
    id: number;
    src: string;
    updatePositionCallBack: Function,
    readOnly?: boolean;
}

export const DraggableAsset: React.FC<DraggableAssetProps> = ({
    x,
    y,
    id,
    src,
    updatePositionCallBack,
    readOnly = false,
}) => {
    const bind = useDrag({ x, y }, id, updatePositionCallBack, readOnly);

    const texture = React.useMemo(() => {
        const tex = Texture.from(src);
        tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        return tex;
    }, [src]);

    return (
        <Sprite
            texture={texture}
            scale={1}
            {...bind}
        />
    );
};
