import React from 'react';
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
    onContextMenu?: (id: number, pos: { clientX: number, clientY: number }) => void;
}

export const DraggableAsset: React.FC<DraggableAssetProps> = ({
    x,
    y,
    id,
    src,
    updatePositionCallBack,
    onContextMenu,
    readOnly = false,
}) => {
    const bind = useDrag({ x, y }, id, updatePositionCallBack, readOnly);

    // const handleContextMenu = (e: any) => {
    //     e.preventDefault();
    //     if (!readOnly && onContextMenu && e.data?.originalEvent) {
    //         const { clientX, clientY } = e.data.originalEvent;
    //         onContextMenu(id, { clientX, clientY });
    //     }
    // };

    const handlePointerDown = (e: any) => {
        if (!readOnly && e.data?.originalEvent?.button === 2) {
            e.data.originalEvent.preventDefault();
            if (onContextMenu) {
                const { clientX, clientY } = e.data.originalEvent;
                onContextMenu(id, { clientX, clientY });
            }
        }
    };

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
            interactive={true}
            onpointerdown={handlePointerDown}
        />
    );

};
