import * as PIXI from 'pixi.js';

export type AssetKind = 'default' | 'chapter';

export interface AssetTypeData {
    kind: AssetKind;
    /** Chapter-only fields */
    associatedChapterID?: number;
    customChapterId?: number;
    label?: string;
}

export interface AssetData {
    id: number;
    x: number;
    y: number;
    scale: number;
    file: string;
    label?: string;
    type: AssetTypeData;
}

export interface CommonAssetProps {
    asset: AssetData;
    layer: number;
    spriteURL: (file: string) => string;
    onPointerDown: (
        e: PIXI.FederatedPointerEvent,
        asset: AssetData,
        target: PIXI.Container | PIXI.Sprite
    ) => void;

    onPointerUp?: (
        e: PIXI.FederatedPointerEvent,
        asset: AssetData,
        target: PIXI.Container | PIXI.Sprite
    ) => void;

    selected: boolean;
    /** Only relevant for chapter stones */
    chapterState?: 'locked' | 'unlocked' | 'finished';
    assetId?: number;
}

export interface ChapterStoneVisual {
    skin: string;
    iconStroke: number;
    iconShadow: number;
}

export interface ChapterStoneTheme {
    locked: ChapterStoneVisual;
    unlocked: ChapterStoneVisual;
    finished: ChapterStoneVisual;
}