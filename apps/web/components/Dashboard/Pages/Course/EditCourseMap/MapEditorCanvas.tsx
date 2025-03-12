import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Container } from '@pixi/react';
import { DraggableAsset } from './DraggableAsset';
import { ChapterAsset } from './ChapterAsset';
import { DraggableState, DraggableStateData } from './types';
import { SPRITES } from './spriteIndex';
import { Position } from './useDrag';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp } from "lucide-react"


const LS_MAP_STATE_KEY = 'map_state';
const SCALE = 1;

const WORLD_LIMIT_X = 1000;
const WORLD_LIMIT_Y = 1000;

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export interface MapEditorCanvasProps {
	courseStructure: any;
	onMapUpdateCallback?: Function,
	onChapterClick: (chapterID: number) => void,
	readOnly?: boolean,
}

export const MapEditorCanvas: React.FC<MapEditorCanvasProps> = ({
	courseStructure,
	onMapUpdateCallback,
	onChapterClick,
	readOnly = false,
}) => {

	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [size, setSize] = useState({
		width: window.innerWidth,
		height: window.innerHeight,
		scale: SCALE,
	});
	const targetOffsetRef = useRef(offset);

	// State for draggable elements
	const initialElements: DraggableState[] = [];
	const additionalElementsRef = useRef<DraggableState[]>(initialElements);
	const [additionalElements, setAdditionalElementsState] = useState<DraggableState[]>(initialElements);

	// Helper: build sprite URL
	const spriteURL = (file: string): string => `/contentMap/${file}`;

	const updatePositionCallBack = (pos: Position, id: number) => {
		// Find element based on ID in the additional elements and patch its location.
		const index = additionalElementsRef.current.findIndex((element) => element.data.id === id)
		if (index < 0) {
			throw ('Bug: this cannot happen')
		}

		// Update position.
		const copy = additionalElementsRef.current
		copy[index].data.x = pos.x
		copy[index].data.y = pos.y
		additionalElementsRef.current = copy

		// Update additional elements.
		setAdditionalElements(additionalElementsRef.current)
	}

	const [contextMenu, setContextMenu] = useState<{ chapterID: number; x: string; y: string } | null>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);

	// Callback to receive the right-click info from ChapterAsset.
	const handleAssetContextMenu = (chapterID: number, pos: { clientX: number, clientY: number }) => {
		const canvasElement = document.getElementById('canvas-parent');
		const canvasBounds = canvasElement?.getBoundingClientRect();
		const anchorX = pos.clientX - (canvasBounds?.left ?? 0);
		const anchorY = pos.clientY - (canvasBounds?.top ?? 0);

		setContextMenu({ chapterID, x: `${anchorX}px`, y: `${anchorY}px` });
		setPopoverOpen(true);
	};

	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu) {
				setContextMenu(null);
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	}, [contextMenu]);

	// Memoize the node renderer so that it doesn’t change on every render.
	const renderDraggableNode = useCallback((data: DraggableStateData): React.ReactNode => {
		if (data.associatedWithChapterID) {
			return (
				<ChapterAsset
					x={data.x}
					y={data.y}
					overlaySource={data.textureSources[0]}
					stoneSource={data.textureSources[1]}
					updatePositionCallback={updatePositionCallBack}
					chapterID={data.associatedWithChapterID}
					id={data.id}
					readOnly={readOnly}
					onChapterClick={onChapterClick}
					onContextMenu={handleAssetContextMenu}
				/>
			);
		}
		return (
			<DraggableAsset
				x={data.x}
				y={data.y}
				id={data.id}
				src={data.textureSources[0]}
				updatePositionCallBack={updatePositionCallBack}
				readOnly={readOnly}
				onContextMenu={handleAssetContextMenu}
			/>
		);
	}, [readOnly, onChapterClick]);

	// Persist editor state to backend storage.
	const serializeEditorState = useCallback((data: DraggableState[]) => {
		const mapData = data.map((d) => d.data)
		if (onMapUpdateCallback) {
			onMapUpdateCallback(mapData)
		} else {
			console.warn('map update is not ready: ', onMapUpdateCallback)
		}
	}, [])

	const setAdditionalElements = (data: DraggableState[]) => {
		serializeEditorState(data);
		setAdditionalElementsState(data);
	};

	// Adjust canvas size on window resize
	useEffect(() => {
		const handleResize = () => {
			const parentDiv = document.getElementById('canvas-parent');
			if (!parentDiv) return;
			setSize({
				width: parentDiv.clientWidth,
				height: parentDiv.clientHeight,
				scale: SCALE,
			});
		};
		window.addEventListener("resize", handleResize);
		handleResize();
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Prevent default wheel behavior on canvas
	useEffect(() => {
		const canvasParent = document.getElementById('canvas-parent');
		if (!canvasParent) return;
		const handleWheelPassive = (e: WheelEvent) => {
			e.preventDefault();
		};
		canvasParent.addEventListener('wheel', handleWheelPassive, { passive: false });
		return () => canvasParent.removeEventListener('wheel', handleWheelPassive);
	}, []);

	// Update the target offset based on wheel events with clamping.
	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const newTargetX = clamp(targetOffsetRef.current.x - e.deltaX, -WORLD_LIMIT_X, WORLD_LIMIT_X);
		const newTargetY = clamp(targetOffsetRef.current.y - e.deltaY, -WORLD_LIMIT_Y, WORLD_LIMIT_Y);
		targetOffsetRef.current = { x: newTargetX, y: newTargetY };
	};

	// Animate the panning (using a lerp) and clamp the new offset.
	useEffect(() => {
		let animationFrameId: number;
		const animate = () => {
			setOffset((prev) => {
				const target = targetOffsetRef.current;
				const lerpFactor = 0.7;
				let newX = prev.x + (target.x - prev.x) * lerpFactor;
				let newY = prev.y + (target.y - prev.y) * lerpFactor;
				newX = clamp(newX, -WORLD_LIMIT_X, WORLD_LIMIT_X);
				newY = clamp(newY, -WORLD_LIMIT_Y, WORLD_LIMIT_Y);
				return { x: newX, y: newY };
			});
			animationFrameId = requestAnimationFrame(animate);
		};
		animate();
		return () => cancelAnimationFrame(animationFrameId);
	}, []);

	// Merge chapter nodes with existing ones to avoid re-creation and flickering.
	useEffect(() => {
		if (!courseStructure || !courseStructure.chapters) return;
		const chapters = courseStructure.chapters;
		const currentChapterNodes = additionalElementsRef.current.filter(
			(el) => el.data.associatedWithChapterID !== null
		);
		const nonChapterNodes = additionalElementsRef.current.filter(
			(el) => el.data.associatedWithChapterID === null
		);

		const newChapterNodes: DraggableState[] = chapters
			.filter((chapter: any) =>
				!currentChapterNodes.some(el => el.data.associatedWithChapterID === chapter.id)
			)
			.map((chapter: any, index: number) => {
				const padding = 1000;
				const centerX = (size.width / 2) * SCALE;
				const centerY = (size.height / 2) * SCALE;
				const offsetX = centerX - 100;
				const offsetY = centerY + index * padding - (chapters.length * padding) / 2;
				const data: DraggableStateData = {
					x: offsetX,
					y: offsetY,
					label: `${chapter.id}`,
					id: -chapter.id,
					textureSources: [
						spriteURL(SPRITES[30].file),
						spriteURL(SPRITES[112].file),
					],
					associatedWithChapterID: chapter.id,
				};
				return { data, node: renderDraggableNode(data) };
			});

		const updatedChapterNodes = currentChapterNodes.filter(el =>
			chapters.find((chapter: any) => chapter.id === el.data.associatedWithChapterID)
		);

		const merged = [...nonChapterNodes, ...updatedChapterNodes, ...newChapterNodes];
		additionalElementsRef.current = merged;
		setAdditionalElementsState(merged);
	}, [courseStructure, size, renderDraggableNode]);

	// Load saved state (from DB) once on mount.
	useEffect(() => {
		if (!courseStructure.map_state) {
			console.warn("waiting for more course data...")
			return
		}

		const objects = courseStructure.map_state.objects
		console.log('loaded objects from DB: ', objects)
		try {
			const reconstructed = objects.map((data: any) => ({
				data,
				node: renderDraggableNode(data),
			}));
			setAdditionalElementsState(reconstructed);
			additionalElementsRef.current = reconstructed;
		} catch (error) {
			console.error("Failed to parse stored map state", error);
		}
	}, [renderDraggableNode]);

	const worldWidth = WORLD_LIMIT_X * 2;
	const worldHeight = WORLD_LIMIT_Y * 2;

	const ratioX = size.width / worldWidth;
	const ratioY = size.height / worldHeight;

	const thumbWidth = ratioX * size.width;
	const thumbHeight = ratioY * size.height;

	const thumbLeft = (1 - ((offset.x + WORLD_LIMIT_X) / worldWidth)) * (size.width - thumbWidth);
	const thumbTop = (1 - ((offset.y + WORLD_LIMIT_Y) / worldHeight)) * (size.height - thumbHeight);

	const handleAddAssetAtDrop = (sprite: any, dropX: number, dropY: number) => {
		const id = additionalElementsRef.current.length;
		const data: DraggableStateData = {
			x: dropX,
			y: dropY,
			label: sprite.name,
			id,
			textureSources: [spriteURL(sprite.file)],
			associatedWithChapterID: null,
		};
		const newElement = {
			data,
			node: renderDraggableNode(data),
		};
		const newList = [...additionalElementsRef.current, newElement];
		additionalElementsRef.current = newList;
		setAdditionalElements(newList);
	};


	return (
		<div className="flex w-full h-full" style={{ height: 'calc(100vh - 19rem)', position: 'relative' }}>
			<div
				id="canvas-parent"
				style={{ width: '85%', height: '100%', overscrollBehaviorX: 'none' }}
				onWheel={handleWheel}
				onContextMenu={(e) => e.preventDefault()}
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => {
					e.preventDefault();
					const spriteData = e.dataTransfer.getData("application/json");
					if (!spriteData) return;
					const sprite = JSON.parse(spriteData);
					const canvasElement = document.getElementById('canvas-parent');
					const canvasBounds = canvasElement?.getBoundingClientRect();
					if (!canvasBounds) return;

					const stageX = e.clientX - canvasBounds.left;
					const stageY = e.clientY - canvasBounds.top;

					const containerScale = 0.1;

					const localX = (stageX - offset.x) / containerScale;
					const localY = (stageY - offset.y) / containerScale;

					handleAddAssetAtDrop(sprite, localX, localY);
				}}
			>
				<Stage
					width={size.width}
					height={size.height}
					options={{
						background: 0x8da64a,
						autoDensity: true,
						resolution: window.devicePixelRatio * 4,
						antialias: true,
					}}
				>
					<Container scale={0.1} position={[offset.x, offset.y]}>
						{additionalElements.map((sprite) => sprite.node)}
					</Container>
				</Stage>
			</div>

			{!readOnly && (
				<div className="bg-gray-300 p-5" style={{ width: '15%', overflowY: 'scroll' }}>
					<div className="sprite-panel flex flex-col items-center gap-10">
						{SPRITES.map((sprite, index) => (
							<div
								key={index}
								className="sprite-item flex flex-col items-center p-10 rounded-md w-full box-border bg-gray-400 hover:bg-sky-600 cursor-pointer"
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData("application/json", JSON.stringify(sprite));
								}}
							>
								<img
									style={{ filter: "saturate(150%)" }}
									src={spriteURL(sprite.file)}
									alt={sprite.label}
									width={80}
								/>
								<span className="font-bold text-2xl text-ellipsis overflow-hidden" style={{ maxWidth: '8rem' }}>
									{sprite.label}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
			{contextMenu && (
				<div
					onContextMenu={(e: React.MouseEvent) => {
						e.preventDefault()
					}}
					className="absolute z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
					style={{
						top: contextMenu.y,
						left: contextMenu.x,
					}}
				>
					<div className="p-2">
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="layer" className="text-xs font-medium">
									Layer
								</Label>
								<div className="flex h-7 items-center">
									<Button variant="outline" size="icon" className="h-7 w-7 rounded-r-none px-1" onClick={(e: any) => {
										e.stopPropagation()
									}}>
										<ChevronDown className="h-3 w-3" />
										<span className="sr-only">Decrease layer</span>
									</Button>
									<Input id="layer" value="1" className="h-7 w-8 rounded-none text-center text-xs" readOnly />
									<Button variant="outline" size="icon" className="h-7 w-7 rounded-l-none px-1" onClick={(e: any) => {
										e.stopPropagation()
									}}>
										<ChevronUp className="h-3 w-3" />
										<span className="sr-only">Increase layer</span>
									</Button>
								</div>
							</div>
							<Button variant="destructive" size="sm" className="mt-1 w-full text-xs">
								Remove
							</Button>
						</div>
					</div>
				</div>
			)}

			<div
				className="absolute bottom-0 left-0 w-[85%] h-2"
			>
				<div
					className="absolute h-full rounded-full bg-primary dark:bg-primary-foreground hover:bg-primary/80 dark:hover:bg-primary-foreground/80 transition-colors"
					style={{
						left: thumbLeft,
						width: thumbWidth,
					}}
				/>
			</div>


			<div
				className="absolute top-0 right-[15%] w-2 h-full"
			>
				<div
					className="absolute w-full rounded-full bg-primary dark:bg-primary-foreground hover:bg-primary/80 dark:hover:bg-primary-foreground/80 transition-colors"
					style={{
						top: thumbTop,
						height: thumbHeight,
					}}
				/>
			</div>
		</div>
	);
};
