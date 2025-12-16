import React, {
  useEffect,
  useState,
  useCallback,
  memo,
  Dispatch,
  SetStateAction,
} from 'react'
import { Viewport } from 'pixi-viewport'
import { useApplication, extend } from '@pixi/react'
import {
  GRID_SIZE,
  MINOR_GRID_SIZE,
} from './constants'
import Asset from './Asset'
import type { AssetData } from './Asset/assetTypes'
import * as PIXI from 'pixi.js'
import { Graphics } from 'pixi.js'
import { ZoomBlurFilter } from 'pixi-filters'
import useDragInteractions from './hooks/useDragInteractions'

extend({ Viewport, Graphics })

const snapValueToGrid = (value: number, gridSize: number) => Math.round(value / gridSize) * gridSize

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
    const zoom = useZoomLevel()

    const gridSize =
      effectiveGridSize || MINOR_GRID_SIZE * (11 - gridGranularity)

    /* All pointer / drag / multi-select bookkeeping lives in this hook now */
    const {
      temporaryAssetPositions,
      handlePointerDown,
      handlePointerUp,
    } = useDragInteractions({
      placedAssets,
      selectedIds,
      onSelectIds,
      onAssetPositionChange,
      onAssetContextMenu,
      onChapterClick,
      readOnly,
      viewport,
      snapToGrid,
      gridSize,
    })


    const viewportRef = useCallback(
      (node: Viewport | null) => {
        if (!node) return

        const isNewViewport = node !== viewport

        node.resize(
          app.renderer.width,
          app.renderer.height,
          worldWidth,
          worldHeight,
        )

        if (isNewViewport) {
          node
            .drag({ clampWheel: true, mouseButtons: 'left' })
            .decelerate({ friction: 0.9, bounce: 0, minSpeed: 0.02 })
            .pinch()
            .wheel({ percent: 0.15 })

          if (readOnly) {
            node.clampZoom({
              minWidth: app.renderer.width * 0.75,
              maxWidth: app.renderer.width * 1,
            })
          } else {
            node.clampZoom({
              minWidth: app.renderer.width * 0.2,
              maxWidth: app.renderer.width * 3,
            })
          }

          node.fit()


          // const zoomBlurFilter = new ZoomBlurFilter({ strength: 0.25, radius: app.renderer.width*1.25, innerRadius: app.renderer.width * 0.55})
          // zoomBlurFilter.centerX = app.renderer.width / 2;
          // zoomBlurFilter.centerY = app.renderer.height / 2;
          // node.filters = [zoomBlurFilter]

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
      ]
    )

    /* ↑ both handlers now come straight from the hook */

    const spriteURL = useCallback((file: string) => {
        if (/^(https?:)?\/\//i.test(file) || file.startsWith('data:') || file.startsWith('blob:')) {
            return file;
        }
        return `/contentMap/${file}`;
    }, []);

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
              onPointerUp={handlePointerUp}
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
