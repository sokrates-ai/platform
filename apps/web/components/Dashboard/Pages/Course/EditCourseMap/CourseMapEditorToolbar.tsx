"use client"
import { Undo2, Redo2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface CourseMapEditorToolbarProps {
	undo: Function
	redo: Function
	reset: Function
}

export const CourseMapEditorToolbar = (props: CourseMapEditorToolbarProps) => {
	return (
		<div className="flex items-center space-x-2">
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.undo()}>
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
						<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => props.redo()}>
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
		</div>
	)
}

