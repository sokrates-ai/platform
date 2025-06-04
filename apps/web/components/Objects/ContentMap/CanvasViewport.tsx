import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  Dispatch,
  SetStateAction,
} from 'react'
import { Viewport } from 'pixi-viewport'
import { useApplication, extend } from '@pixi/react'
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GRID_SIZE,
  MINOR_GRID_SIZE,
} from './constants'
import Asset from './Asset'
import type { AssetData } from './Asset'
import * as PIXI from 'pixi.js'
import { Graphics } from 'pixi.js'

extend({ Viewport, Graphics })

const snapValueToGrid = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize

interface DragData {
  id: number
  assetRef: PIXI.Container | PIXI.Sprite
  offsetX: number
  offsetY: number
  selected: boolean
  selectedIds: number[]
  initialPositions: Map<number, { x: number; y: number }>
}

function useZoomLevel() {
  const [zoom, setZoom] = useState(window.devicePixelRatio)

  useEffect(() => {
    const handleResize = () => {
      setZoom(window.devicePixelRatio)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return zoom
}

interface CanvasViewportProps {
  placedAssets: AssetData[]
  selectedIds: number[]
  onSelectIds: Dispatch<SetStateAction<number[]>>
  onViewportReady?: (viewport: Viewport) => void
  onAssetPositionChange: (id: number, x: number, y: number) => void
  onAssetContextMenu?: (
    assetId: number,
    pos: { clientX: number; clientY: number }
  ) => void
  onChapterClick?: (chapterID: number) => void
  readOnly: boolean
  boundaries?: {
    left: number
    right: number
    top: number
    bottom: number
  }
  showGrid?: boolean
  snapToGrid?: boolean
  gridGranularity?: number
  effectiveGridSize?: number
  chapterStates?: Record<number, 'locked' | 'unlocked' | 'finished'>
  clampToMap?: boolean
}

// Default boundaries
const DEFAULT_BOUNDARIES = {
  left: -1000,
  right: 1000,
  top: -1000,
  bottom: 1000,
}

const CanvasViewport: React.FC<CanvasViewportProps> = memo(
  ({
    placedAssets,
    selectedIds,
    onSelectIds,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onChapterClick,
    readOnly,
    boundaries,
    showGrid = true,
    snapToGrid = true,
    gridGranularity = 5,
    effectiveGridSize,
    chapterStates,
    clampToMap,
  }) => {
    const { app } = useApplication()

    const { left, right, top, bottom } = boundaries || DEFAULT_BOUNDARIES

    const worldWidth = Math.abs(right - left)
    const worldHeight = Math.abs(bottom - top)

    const [viewport, setViewport] = useState<Viewport | null>(null)
    const dragDataRef = useRef<DragData | null>(null)
    const canvasElementRef = useRef<HTMLElement | null>(null)
    const zoom = useZoomLevel()
    const [isZoomUpdated, setIsZoomUpdated] = useState<Boolean>(false)

    const gridSize =
      effectiveGridSize || MINOR_GRID_SIZE * (11 - gridGranularity)

    const [temporaryAssetPositions, setTemporaryAssetPositions] = useState<
      Map<number, { x: number; y: number }>
    >(new Map())

    useEffect(() => {
      canvasElementRef.current = document.getElementById('canvas-parent')
    }, [app?.renderer])

    useEffect(() => {
      setIsZoomUpdated(true)
    }, [zoom])

    const viewportRef = useCallback(
      (node: Viewport | null) => {
        if (!node) return

        const isNewViewport = node !== viewport

        node.resize(
          app.renderer.width,
          app.renderer.height,
          worldWidth,
          worldHeight
        )

        if (isZoomUpdated) {
          setIsZoomUpdated(false)
          if (readOnly) {
            node.clampZoom({
              minWidth: worldWidth * 0.75,
              maxWidth: worldWidth * 1,
            })
          } else {
            node.clampZoom({
              minWidth: worldWidth * 0.2,
              maxWidth: worldWidth * 3,
            })
          }
        }

        if (isNewViewport) {
          node
            .drag({ clampWheel: true, mouseButtons: 'left' })
            .decelerate({ friction: 0.9, bounce: 0, minSpeed: 0.02 })
            .pinch()
            .wheel({ percent: 0.15 })

          if (readOnly) {
            node.clampZoom({
              minWidth: worldWidth * 0.75,
              maxWidth: worldWidth * 1,
            })
          } else {
            node.clampZoom({
              minWidth: worldWidth * 0.2,
              maxWidth: worldWidth * 3,
            })
          }

          node.fit()

          // expose to parent
          setViewport(node)
          onViewportReady?.(node)
          node.moveCenter(-60000, -60000)
        }

        if (readOnly) {
          node.clamp({
            left: left,
            right: right,
            top: top,
            bottom: bottom,
            underflow: 'none',
          })
        } else if (clampToMap) {
          const padding = Math.min(worldWidth, worldHeight) * 0.1
          node.clamp({
            left: left - padding,
            right: right + padding,
            top: top - padding,
            bottom: bottom + padding,
            underflow: 'none',
          })
        } else {
          if (node.plugins.get('clamp')) {
            node.plugins.remove('clamp')
          }
        }
      },
      [
        viewport,
        app?.renderer,
        worldWidth,
        worldHeight,
        left,
        right,
        top,
        bottom,
        onViewportReady,
        readOnly,
        clampToMap,
        isZoomUpdated,
      ]
    )

    const onGlobalMove = useCallback(
      (e: PointerEvent) => {
        if (!dragDataRef.current || !viewport) return
        const canvasElement = canvasElementRef.current
        if (!canvasElement) return

        const rect = canvasElement.getBoundingClientRect()
        const localX = e.clientX - rect.left
        const localY = e.clientY - rect.top
        const worldPos = viewport.toWorld(localX, localY)

        const {
          assetRef,
          offsetX,
          offsetY,
          selected,
          selectedIds: dragSelectedIds,
          initialPositions,
        } = dragDataRef.current

        const rawX = worldPos.x - offsetX
        const rawY = worldPos.y - offsetY

        const newX = snapToGrid ? snapValueToGrid(rawX, gridSize) : rawX
        const newY = snapToGrid ? snapValueToGrid(rawY, gridSize) : rawY

        assetRef.x = newX
        assetRef.y = newY

        if (selected && dragSelectedIds.length > 1) {
          const primaryAssetId = dragDataRef.current.id
          const primaryInitialPos = initialPositions.get(primaryAssetId)

          if (primaryInitialPos) {
            const deltaX = newX - primaryInitialPos.x
            const deltaY = newY - primaryInitialPos.y

            const newPositions = new Map<number, { x: number; y: number }>()

            dragSelectedIds.forEach((assetId) => {
              const initialPos = initialPositions.get(assetId)
              if (initialPos) {
                const targetX = snapToGrid
                  ? snapValueToGrid(initialPos.x + deltaX, gridSize)
                  : initialPos.x + deltaX
                const targetY = snapToGrid
                  ? snapValueToGrid(initialPos.y + deltaY, gridSize)
                  : initialPos.y + deltaY

                newPositions.set(assetId, { x: targetX, y: targetY })
              }
            })

            setTemporaryAssetPositions(newPositions)
          }
        }
      },
      [viewport, snapToGrid, gridSize]
    )

    const onGlobalUp = useCallback(() => {
      if (!dragDataRef.current) return
      const {
        id,
        assetRef,
        selected,
        selectedIds: dragSelectedIds,
        initialPositions,
      } = dragDataRef.current

      let finalX = assetRef.x
      let finalY = assetRef.y

      // snap to nearest grid size if enabled
      if (snapToGrid) {
        finalX = snapValueToGrid(assetRef.x, gridSize)
        finalY = snapValueToGrid(assetRef.y, gridSize)
        assetRef.x = finalX
        assetRef.y = finalY
      }

      if (selected && dragSelectedIds.length > 1) {
        // Multi-select case - calculate delta and update all selected items
        const primaryAssetId = id
        const primaryInitialPos = initialPositions.get(primaryAssetId)

        if (primaryInitialPos) {
          const deltaX = finalX - primaryInitialPos.x
          const deltaY = finalY - primaryInitialPos.y

          // Update the data model for all selected assets
          dragSelectedIds.forEach((assetId) => {
            const initialPos = initialPositions.get(assetId)
            if (initialPos) {
              const newX = snapToGrid
                ? snapValueToGrid(initialPos.x + deltaX, gridSize)
                : initialPos.x + deltaX
              const newY = snapToGrid
                ? snapValueToGrid(initialPos.y + deltaY, gridSize)
                : initialPos.y + deltaY

              // Update model with new position
              onAssetPositionChange(assetId, newX, newY)
            }
          })
        }
      } else {
        // Single asset - just update its position
        onAssetPositionChange(id, finalX, finalY)
      }

      // Clear temporary positions
      setTemporaryAssetPositions(new Map())

      dragDataRef.current = null
      window.removeEventListener('pointermove', onGlobalMove)
      window.removeEventListener('pointerup', onGlobalUp)

      viewport?.plugins?.resume('drag')
    }, [onAssetPositionChange, onGlobalMove, viewport, snapToGrid, gridSize])

    const handlePointerDown = useCallback(
      (e: any, asset: AssetData, target: PIXI.Container | PIXI.Sprite) => {
        const orig = e.data?.originalEvent as MouseEvent

        if (orig.button === 2 && !readOnly) {
          orig.preventDefault()
          onAssetContextMenu?.(asset.id, {
            clientX: orig.clientX,
            clientY: orig.clientY,
          })
          return
        }

        if (asset.type.kind === 'chapter' && readOnly && orig.button === 0) {
          onChapterClick?.(asset.type.associatedChapterID!)
          return
        }

        if (orig.button !== 0 || readOnly) return

        const isAlreadySelected = selectedIds.includes(asset.id)

        if (orig.shiftKey) {
          onSelectIds((ids) =>
            ids.includes(asset.id)
              ? ids.filter((id) => id !== asset.id)
              : [...ids, asset.id]
          )
        } else if (!isAlreadySelected) {
          onSelectIds([asset.id])
        }

        const originalEvent = e.data?.originalEvent || e.nativeEvent || e
        if (!originalEvent) return

        viewport?.plugins?.pause('drag')

        const canvasElement = canvasElementRef.current
        if (!canvasElement || !viewport) return

        const rect = canvasElement.getBoundingClientRect()
        const localX = originalEvent.clientX - rect.left
        const localY = originalEvent.clientY - rect.top
        const worldPos = viewport.toWorld(localX, localY)

        const initialPositions = new Map<number, { x: number; y: number }>()

        if (isAlreadySelected && selectedIds.length > 1) {
          placedAssets.forEach((a) => {
            if (selectedIds.includes(a.id)) {
              initialPositions.set(a.id, { x: a.x, y: a.y })
            }
          })
        } else {
          initialPositions.set(asset.id, { x: asset.x, y: asset.y })
        }

        dragDataRef.current = {
          id: asset.id,
          assetRef: target,
          offsetX: worldPos.x - asset.x,
          offsetY: worldPos.y - asset.y,
          selected: isAlreadySelected,
          selectedIds: isAlreadySelected ? [...selectedIds] : [asset.id],
          initialPositions,
        }

        window.addEventListener('pointermove', onGlobalMove)
        window.addEventListener('pointerup', onGlobalUp)
      },
      [
        onAssetContextMenu,
        onChapterClick,
        onGlobalMove,
        onGlobalUp,
        readOnly,
        onSelectIds,
        selectedIds,
        viewport,
        placedAssets,
      ]
    )

    const spriteURL = useCallback((file: string) => `/contentMap/${file}`, [])

    if (!app || !app.renderer) return null

    return (
      // @ts-expect-error
      <viewport
        ref={viewportRef}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        events={app.renderer.events}
        sortableChildren={true}
        onPointerDown={(e: PIXI.FederatedPointerEvent) => {
          const orig = e as MouseEvent
          if (e.target === e.currentTarget && !readOnly && !orig.shiftKey) {
            onSelectIds([])
          }
        }}
      >
        {!readOnly && showGrid && (
          <>
            {/* Combined Grid (Minor + Major Emphasis) */}
            <graphics
              draw={(g) => {
                g.clear()
                const majorGridInterval = GRID_SIZE // Interval for emphasis

                // Draw vertical lines
                for (
                  let x = Math.ceil(left / gridSize) * gridSize;
                  x <= right;
                  x += gridSize
                ) {
                  const roundedX = snapValueToGrid(x, gridSize)
                  // Check if the snapped coordinate is close to a multiple of the major interval
                  const isMajorLine =
                    Math.abs(roundedX % majorGridInterval) < 1e-6 ||
                    Math.abs(
                      (roundedX % majorGridInterval) - majorGridInterval
                    ) < 1e-6
                  const alpha = isMajorLine ? 0.8 : 0.2
                  const px = Math.round(x) + 0.5

                  g.moveTo(px, top)
                  g.lineTo(px, bottom)
                  g.stroke({ color: 0xffffff, alpha: alpha, pixelLine: true })
                }

                // Draw horizontal lines
                for (
                  let y = Math.ceil(top / gridSize) * gridSize;
                  y <= bottom;
                  y += gridSize
                ) {
                  const roundedY = snapValueToGrid(y, gridSize)
                  // Check if the snapped coordinate is close to a multiple of the major interval
                  const isMajorLine =
                    Math.abs(roundedY % majorGridInterval) < 1e-6 ||
                    Math.abs(
                      (roundedY % majorGridInterval) - majorGridInterval
                    ) < 1e-6
                  const alpha = isMajorLine ? 0.8 : 0.2
                  const py = Math.round(y) + 0.5

                  g.moveTo(left, py)
                  g.lineTo(right, py)
                  g.stroke({ color: 0xffffff, alpha: alpha, pixelLine: true })
                }
              }}
            />
          </>
        )}

        {placedAssets.map((asset, idx) => {
          const tempPos = temporaryAssetPositions.get(asset.id)
          const effectiveAsset = tempPos
            ? { ...asset, x: tempPos.x, y: tempPos.y }
            : asset

          return (
            <Asset
              key={asset.id}
              asset={effectiveAsset}
              layer={idx}
              spriteURL={spriteURL}
              onPointerDown={handlePointerDown}
              selected={selectedIds.includes(asset.id)}
              chapterState={
                asset.type.kind === 'chapter' &&
                asset.type.associatedChapterID !== undefined &&
                chapterStates
                  ? chapterStates[asset.type.associatedChapterID]
                  : undefined
              }
              assetId={asset.id}
            />
          )
        })}

        {!readOnly && (
          <>
            {/* Boundary */}
            <graphics
              draw={(g) => {
                g.clear()
                g.rect(left, top, worldWidth, worldHeight)
                g.stroke({ width: 4, color: 0xffffff, alpha: 0.8 })
              }}
            />

            {/* Origin */}
            <graphics
              draw={(g) => {
                g.clear()
                g.circle(0, 0, 10)
                g.fill({ color: 0xffffff, alpha: 0.8 })
              }}
            />
          </>
        )}
        {/* @ts-expect-error */}
      </viewport>
    )
  }
)

CanvasViewport.displayName = 'CanvasViewport'

export default CanvasViewport
