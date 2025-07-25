"use client"
import { Undo2, Redo2, Trash2, Maximize, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Plus, Minus, ClipboardPaste, Scissors, Copy as CopyIcon, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface CourseMapEditorToolbarProps {
	undo: Function
	redo: Function
	reset: Function
	boundaries?: {
		left: number;
		right: number;
		top: number;
		bottom: number;
	}
	onBoundariesChange?: (boundaries: { left: number; right: number; top: number; bottom: number }) => void
	showGrid?: boolean
	onShowGridChange?: (showGrid: boolean) => void
	snapToGrid?: boolean
	onSnapToGridChange?: (snapToGrid: boolean) => void
	gridGranularity?: number
	onGridGranularityChange?: (value: number) => void
	clampToMap?: boolean
	onClampToMapChange?: (clampToMap: boolean) => void
	canUndo?: boolean
	canRedo?: boolean
}

export const CourseMapEditorToolbar = (props: CourseMapEditorToolbarProps) => {
	const defaultBoundaries = {
		left: -1000,
		right: 1000,
		top: -1000,
		bottom: 1000
	};
	
	const [boundaries, setBoundaries] = useState({
		left: props.boundaries?.left !== undefined ? Math.abs(props.boundaries.left).toString() : Math.abs(defaultBoundaries.left).toString(),
		right: props.boundaries?.right !== undefined ? props.boundaries.right.toString() : defaultBoundaries.right.toString(),
		top: props.boundaries?.top !== undefined ? Math.abs(props.boundaries.top).toString() : Math.abs(defaultBoundaries.top).toString(),
		bottom: props.boundaries?.bottom !== undefined ? props.boundaries.bottom.toString() : defaultBoundaries.bottom.toString()
	});

	useEffect(() => {
		if (props.boundaries) {
			const newBoundaries = {
				left: Math.abs(props.boundaries.left).toString(),
				right: props.boundaries.right.toString(),
				top: Math.abs(props.boundaries.top).toString(),
				bottom: props.boundaries.bottom.toString()
			};
			
			if (
				newBoundaries.left !== boundaries.left || 
				newBoundaries.right !== boundaries.right || 
				newBoundaries.top !== boundaries.top || 
				newBoundaries.bottom !== boundaries.bottom
			) {
				setBoundaries(newBoundaries);
			}
		}
	}, [props.boundaries]);

	const adjustBoundaryValue = (boundary: keyof typeof boundaries, change: number) => {
		const currentValue = parseInt(boundaries[boundary]);
		if (!isNaN(currentValue)) {
			const newValue = Math.max(0, currentValue + change);
			setBoundaries({...boundaries, [boundary]: newValue.toString()});
		}
	};

	const handleBoundariesUpdate = () => {
		const newBoundaries = {
			left: -parseInt(boundaries.left), 
			right: parseInt(boundaries.right),
			top: -parseInt(boundaries.top), 
			bottom: parseInt(boundaries.bottom)
		};

		if (
			props.onBoundariesChange && 
			!isNaN(newBoundaries.left) && 
			!isNaN(newBoundaries.right) && 
			!isNaN(newBoundaries.top) && 
			!isNaN(newBoundaries.bottom)
		) {
			props.onBoundariesChange(newBoundaries);
		}
	};

	const handleGridVisibilityChange = (checked: boolean) => {
		if (props.onShowGridChange) {
			props.onShowGridChange(checked);
		}
	};

	const handleSnapToGridChange = (checked: boolean) => {
		if (props.onSnapToGridChange) {
			props.onSnapToGridChange(checked);
		}
	};

	const handleGranularityChange = (value: number[]) => {
		if (props.onGridGranularityChange) {
			props.onGridGranularityChange(value[0]);
		}
	};

	const handleClampToMapChange = (checked: boolean) => {
		if (props.onClampToMapChange) {
			props.onClampToMapChange(checked);
		}
	};

	const getWorldWidth = () => {
		const left = parseInt(boundaries.left);
		const right = parseInt(boundaries.right);
		return !isNaN(left) && !isNaN(right) ? left + right : 2000;
	};

	const getWorldHeight = () => {
		const top = parseInt(boundaries.top);
		const bottom = parseInt(boundaries.bottom);
		return !isNaN(top) && !isNaN(bottom) ? top + bottom : 2000;
	};

	return (
		<div className="flex items-center space-x-2 flex-wrap gap-2">
			<div className="flex items-center space-x-1">
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.undo()} disabled={props.canUndo === false}>
								<Undo2 className="h-4 w-4" />
								<span className="sr-only">Undo</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Undo (Ctrl+Z)</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.redo()} disabled={props.canRedo === false}>
								<Redo2 className="h-4 w-4" />
								<span className="sr-only">Redo</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Redo (Ctrl+Y)</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			<Separator orientation="vertical" className="h-6" />

			<div className="flex items-center space-x-1">
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8" 
								onClick={(e) => {
									// Simulate Ctrl+C key press
									const keyEvent = new KeyboardEvent('keydown', {
										key: 'c',
										code: 'KeyC',
										ctrlKey: true,
										bubbles: true
									});
									document.dispatchEvent(keyEvent);
								}}>
								<CopyIcon className="h-4 w-4" />
								<span className="sr-only">Copy</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Copy (Ctrl+C)</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8"
								onClick={(e) => {
									// Simulate Ctrl+X key press
									const keyEvent = new KeyboardEvent('keydown', {
										key: 'x',
										code: 'KeyX',
										ctrlKey: true,
										bubbles: true
									});
									document.dispatchEvent(keyEvent);
								}}>
								<Scissors className="h-4 w-4" />
								<span className="sr-only">Cut</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Cut (Ctrl+X)</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8"
								onClick={(e) => {
									// Simulate Ctrl+V key press
									const keyEvent = new KeyboardEvent('keydown', {
										key: 'v',
										code: 'KeyV',
										ctrlKey: true,
										bubbles: true
									});
									document.dispatchEvent(keyEvent);
								}}>
								<ClipboardPaste className="h-4 w-4" />
								<span className="sr-only">Paste</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Paste (Ctrl+V)</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			<Separator orientation="vertical" className="h-6" />

			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.reset()}>
							<Trash2 className="h-4 w-4 text-destructive" />
							<span className="sr-only">Reset State</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Reset State</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<Separator orientation="vertical" className="h-6" />

			<Popover>
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<Button variant="outline" className="h-8">
									<Maximize className="h-4 w-4 mr-2" />
									<span>{getWorldWidth()} × {getWorldHeight()}</span>
								</Button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent>
							<p>Map Boundaries</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<PopoverContent className="w-72 p-3">
					<div className="space-y-2">
						<div className="flex justify-between items-center mb-1">
							<h4 className="font-medium text-sm">Map Boundaries</h4>
							<div className="text-xs text-muted-foreground">
								{getWorldWidth()} × {getWorldHeight()}
							</div>
						</div>
						
						<div className="relative">
							{/* Map visualization */}
							<div className="w-full aspect-square border border-primary/50 rounded-sm relative mb-1">
								{/* Center point marker */}
								<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"></div>

								{/* Top boundary */}
								<div className="absolute top-[20%] left-1/2 transform -translate-x-1/2 flex flex-col items-center">
									<ArrowUp className="h-3 w-3 text-primary mb-0.5" />
									<div className="flex items-center">
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-r-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('top', -100)}
										>
											<Minus className="h-2.5 w-2.5" />
										</Button>
										<Input
											id="top"
											value={boundaries.top}
											onChange={(e) => setBoundaries({...boundaries, top: e.target.value})}
											className="h-5 w-12 rounded-none text-center border-x-0 px-0 text-xs"
										/>
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-l-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('top', 100)}
										>
											<Plus className="h-2.5 w-2.5" />
										</Button>
									</div>
								</div>

								{/* Left boundary */}
								<div className="absolute left-[20%] top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
									<ArrowLeft className="h-3 w-3 text-primary mb-0.5" />
									<div className="flex items-center">
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-r-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('left', -100)}
										>
											<Minus className="h-2.5 w-2.5" />
										</Button>
										<Input
											id="left"
											value={boundaries.left}
											onChange={(e) => setBoundaries({...boundaries, left: e.target.value})}
											className="h-5 w-12 rounded-none text-center border-x-0 px-0 text-xs"
										/>
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-l-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('left', 100)}
										>
											<Plus className="h-2.5 w-2.5" />
										</Button>
									</div>
								</div>

								{/* Right boundary */}
								<div className="absolute right-[20%] top-1/2 transform translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
									<ArrowRight className="h-3 w-3 text-primary mb-0.5" />
									<div className="flex items-center">
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-r-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('right', -100)}
										>
											<Minus className="h-2.5 w-2.5" />
										</Button>
										<Input
											id="right"
											value={boundaries.right}
											onChange={(e) => setBoundaries({...boundaries, right: e.target.value})}
											className="h-5 w-12 rounded-none text-center border-x-0 px-0 text-xs"
										/>
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-l-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('right', 100)}
										>
											<Plus className="h-2.5 w-2.5" />
										</Button>
									</div>
								</div>

								{/* Bottom boundary */}
								<div className="absolute bottom-[20%] left-1/2 transform -translate-x-1/2 flex flex-col items-center">
									<div className="flex items-center">
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-r-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('bottom', -100)}
										>
											<Minus className="h-2.5 w-2.5" />
										</Button>
										<Input
											id="bottom"
											value={boundaries.bottom}
											onChange={(e) => setBoundaries({...boundaries, bottom: e.target.value})}
											className="h-5 w-12 rounded-none text-center border-x-0 px-0 text-xs"
										/>
										<Button 
											variant="outline" 
											size="icon" 
											className="h-5 w-5 rounded-l-none bg-muted px-0"
											onClick={() => adjustBoundaryValue('bottom', 100)}
										>
											<Plus className="h-2.5 w-2.5" />
										</Button>
									</div>
									<ArrowDown className="h-3 w-3 text-primary mt-0.5" />
								</div>
							</div>

							<div className="flex justify-end mt-1">
								<Button size="sm" className="h-6 text-xs px-2" onClick={handleBoundariesUpdate}>Apply</Button>
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			<Separator orientation="vertical" className="h-6" />

			<div className="flex items-center space-x-3">
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								<Label htmlFor="show-grid" className="text-xs font-medium">Grid</Label>
								<Switch 
									id="show-grid" 
									checked={props.showGrid} 
									onCheckedChange={handleGridVisibilityChange}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show/Hide Grid</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								<Label htmlFor="snap-grid" className="text-xs font-medium">Snap</Label>
								<Switch 
									id="snap-grid" 
									checked={props.snapToGrid} 
									onCheckedChange={handleSnapToGridChange}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Snap to Grid</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center space-x-2">
								<Label htmlFor="clamp-map" className="text-xs font-medium">Clamp</Label>
								<Switch 
									id="clamp-map" 
									checked={props.clampToMap} 
									onCheckedChange={handleClampToMapChange}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>Clamp to Map Boundaries</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<div className="flex items-center space-x-2">
					<Label htmlFor="granularity" className="text-xs font-medium">Size</Label>
					<Slider 
						id="granularity"
						value={[props.gridGranularity || 5]} 
						min={1} 
						max={10} 
						step={1} 
						className="w-20" 
						onValueChange={handleGranularityChange}
					/>
				</div>
			</div>

			<Separator orientation="vertical" className="h-6" />

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="icon" className="rounded-full h-8 w-8">
						<HelpCircle className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80">
					<div className="space-y-2">
						<h4 className="font-medium">Keyboard Shortcuts</h4>
						<div className="grid grid-cols-2 gap-2">
							<div className="text-sm text-muted-foreground">Undo</div>
							<div className="text-sm font-semibold">Ctrl+Z</div>
							
							<div className="text-sm text-muted-foreground">Redo</div>
							<div className="text-sm font-semibold">Ctrl+Y / Ctrl+Shift+Z</div>
							
							<div className="text-sm text-muted-foreground">Select All</div>
							<div className="text-sm font-semibold">Ctrl+A</div>
							
							<div className="text-sm text-muted-foreground">Copy</div>
							<div className="text-sm font-semibold">Ctrl+C</div>
							
							<div className="text-sm text-muted-foreground">Cut</div>
							<div className="text-sm font-semibold">Ctrl+X</div>
							
							<div className="text-sm text-muted-foreground">Paste</div>
							<div className="text-sm font-semibold">Ctrl+V</div>
							
							<div className="text-sm text-muted-foreground">Delete</div>
							<div className="text-sm font-semibold">Delete</div>
							
							<div className="text-sm text-muted-foreground">Move Selection</div>
							<div className="text-sm font-semibold">Arrow Keys</div>
							
							<div className="text-sm text-muted-foreground">Move Faster</div>
							<div className="text-sm font-semibold">Shift+Arrow Keys</div>
							
							<div className="text-sm text-muted-foreground">Multiple Select</div>
							<div className="text-sm font-semibold">Shift+Click</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}


