"use client"
import { Undo2, Redo2, Trash2, Maximize, Grid, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

export interface CourseMapEditorToolbarProps {
	undo: Function
	redo: Function
	reset: Function
	worldWidth?: number
	worldHeight?: number
	onWorldSizeChange?: (width: number, height: number) => void
	showGrid?: boolean
	onShowGridChange?: (showGrid: boolean) => void
	snapToGrid?: boolean
	onSnapToGridChange?: (snapToGrid: boolean) => void
	gridGranularity?: number
	onGridGranularityChange?: (value: number) => void
	canUndo?: boolean
	canRedo?: boolean
}

export const CourseMapEditorToolbar = (props: CourseMapEditorToolbarProps) => {
	const [width, setWidth] = useState(props.worldWidth?.toString() || "2000")
	const [height, setHeight] = useState(props.worldHeight?.toString() || "2000")

	const handleSizeUpdate = () => {
		const newWidth = parseInt(width)
		const newHeight = parseInt(height)
		if (props.onWorldSizeChange && !isNaN(newWidth) && !isNaN(newHeight)) {
			props.onWorldSizeChange(newWidth, newHeight)
		}
	}

	const handleGridVisibilityChange = (checked: boolean) => {
		if (props.onShowGridChange) {
			props.onShowGridChange(checked)
		}
	}

	const handleSnapToGridChange = (checked: boolean) => {
		if (props.onSnapToGridChange) {
			props.onSnapToGridChange(checked)
		}
	}

	const handleGranularityChange = (value: number[]) => {
		if (props.onGridGranularityChange) {
			props.onGridGranularityChange(value[0])
		}
	}

	return (
		<div className="flex items-center space-x-2 flex-wrap">
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.undo()} disabled={props.canUndo === false}>
							<Undo2 className="h-4 w-4" />
							<span className="sr-only">Undo</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Undo</p>
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
						<p>Redo</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

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

			<div className="flex items-center space-x-2">
				<Label htmlFor="width" className="sr-only">Width</Label>
				<div className="w-20">
					<Input
						id="width"
						value={width}
						onChange={(e) => setWidth(e.target.value)}
						placeholder="Width"
						className="h-8"
					/>
				</div>
				<span>×</span>
				<div className="w-20">
					<Label htmlFor="height" className="sr-only">Height</Label>
					<Input
						id="height"
						value={height}
						onChange={(e) => setHeight(e.target.value)}
						placeholder="Height"
						className="h-8"
					/>
				</div>
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" className="h-8 w-8" onClick={handleSizeUpdate}>
								<Maximize className="h-4 w-4" />
								<span className="sr-only">Update World Size</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Update World Size</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

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
		</div>
	)
}

