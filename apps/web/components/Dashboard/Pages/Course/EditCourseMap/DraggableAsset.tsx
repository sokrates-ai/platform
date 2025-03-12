import React, { useMemo } from 'react';
import { Sprite } from '@pixi/react';
import { Texture, SCALE_MODES } from 'pixi.js';
import { useDrag } from './useDrag';

interface DraggableAssetProps {
    x: number;
    y: number;
    id: number;
    src: string;
    updatePositionCallBack: Function;
    readOnly?: boolean;
    onContextMenu?: (id: number, pos: { clientX: number; clientY: number }) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

export const DraggableAsset: React.FC<DraggableAssetProps> = ({
    x,
    y,
    id,
    src,
    updatePositionCallBack,
    onContextMenu,
    onDragStart,
    onDragEnd,
    readOnly = false,
}) => {
    const bind = useDrag({ x, y }, id, updatePositionCallBack, readOnly);

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (!readOnly && e.data?.originalEvent?.button === 2) {
            e.data.originalEvent.preventDefault();
            if (onContextMenu) {
                const { clientX, clientY } = e.data.originalEvent;
                onContextMenu(id, { clientX, clientY });
            }
        }
        if (onDragStart) onDragStart();
    };

    const texture = useMemo(() => {
        const tex = Texture.from(src);
        tex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        return tex;
    }, [src]);

    return (
        <Sprite
            texture={texture}
            scale={1}
            {...bind}
            interactive
            onpointerdown={handlePointerDown}
            onpointerup={(e) => {
                e.stopPropagation();
                if (onDragEnd) onDragEnd();
            }}
        />
    );
};
