import React from 'react';

import type {
	AssetData,
	CommonAssetProps,
	ChapterStoneTheme,
} from './assetTypes';

import SpriteAsset from '../assets/SpriteAsset';
import ChapterStoneAsset from '../assets/ChapterStoneAsset';

const registry = {
	default: SpriteAsset,
	chapter: ChapterStoneAsset,
} as const;

type Kind = keyof typeof registry;

export interface AssetWrapperProps
	extends Omit<CommonAssetProps, 'asset'> {
	asset: AssetData;

	icon?: string;
	theme?: ChapterStoneTheme;
	scaleFactor?: number;
	verticalSquish?: number;
}

const Asset: React.FC<AssetWrapperProps> = (props) => {
	const Concrete =
		registry[(props.asset.type.kind as Kind) ?? 'default'] || SpriteAsset;

	// @ts-ignore
	return <Concrete {...props} />;
};

export default React.memo(Asset);
