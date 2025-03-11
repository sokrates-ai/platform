import { useCallback, useRef, useState } from 'react';
import { Point } from 'pixi.js';

export interface Position {
	x: number;
	y: number;
}

export const useDrag = (
	initial: Position,
	id: number,
	positionUpdateCallback: Function,
	readOnly?: boolean,
) => {
	const spriteRef = useRef<any>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [position, setPosition] = useState({ x: initial.x, y: initial.y });
	const stageRef = useRef<any>(null);
	const isDraggingRef = useRef(false);
	const positionRef = useRef(initial)

	const setPositionWrapper = (newPos: Position) => {
		positionRef.current = newPos
		setPosition(newPos)
	};

	const setIsDraggingWrapper = (value: boolean) => {
		isDraggingRef.current = value;
		setIsDragging(value);
	};

	const onGlobalMove = useCallback((e: PointerEvent) => {
		if (!spriteRef.current || !stageRef.current) return;
		const canvasElement = document.getElementById('canvas-parent');
		if (canvasElement) {
			const canvasBounds = canvasElement.getBoundingClientRect();
			const relativeX = e.clientX - canvasBounds.left;
			const relativeY = e.clientY - canvasBounds.top;
			const localPos = stageRef.current.toLocal(new Point(relativeX, relativeY));
			setPositionWrapper({ x: localPos.x, y: localPos.y });
		}
	}, []);

	const onGlobalUp = useCallback(() => {
		setIsDraggingWrapper(false);
		window.removeEventListener('pointermove', onGlobalMove);
		window.removeEventListener('pointerup', onGlobalUp);
		positionUpdateCallback(positionRef.current, id)
	}, [onGlobalMove]);

	const onDown = useCallback((e: any) => {
		if (e.button !== 0 || readOnly) return;
		setIsDraggingWrapper(true);
		stageRef.current = spriteRef.current?.parent;
		window.addEventListener('pointermove', onGlobalMove);
		window.addEventListener('pointerup', onGlobalUp);
	}, [onGlobalMove, onGlobalUp, readOnly]);

	const onMove = useCallback((e: any) => {
		if (isDraggingRef.current && spriteRef.current) {
			const newPos = e.data.getLocalPosition(spriteRef.current.parent);
			setPositionWrapper({ x: newPos.x, y: newPos.y });
		}
	}, []);

	return {
		ref: spriteRef,
		interactive: !readOnly,
		pointerdown: onDown,
		pointermove: onMove,
		alpha: isDragging ? 0.5 : 1,
		anchor: 0.5,
		position,
	};
};
