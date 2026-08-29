import React, {
  useEffect,
  useState,
  useCallback,
  memo,
  Dispatch,
  SetStateAction,
  useMemo,
} from 'react'
import { Viewport } from 'pixi-viewport'
import { useApplication, extend } from '@pixi/react'
import {
  GRID_SIZE,
  MINOR_GRID_SIZE,
} from './constants'
import Asset from './Asset'
import type { AssetData, ChapterState } from './Asset/assetTypes'
import * as PIXI from 'pixi.js'
import { Graphics } from 'pixi.js'
import useDragInteractions from './hooks/useDragInteractions'
import { getSpriteUrl } from './utils/spriteUrl'

extend({ Viewport, Graphics })

const snapValueToGrid = (value: number, gridSize: number) => Math.round(value / gridSize) * gridSize

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
  onAssetClick?: (asset: AssetData) => void
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
  chapterStates?: Record<number, ChapterState>
  clampToMap?: boolean
  minZoom?: number
  maxZoom?: number
}

// Default boundaries
const DEFAULT_BOUNDARIES = {
  left: -1000,
  right: 1000,
  top: -1000,
  bottom: 1000,
}

const constrainViewportToBounds = (
  viewport: Viewport,
  left: number,
  right: number,
  top: number,
  bottom: number,
) => {
  const scaleX = viewport.scale.x
  const scaleY = viewport.scale.y
  const visibleWidth = viewport.screenWidth / scaleX
  const visibleHeight = viewport.screenHeight / scaleY
  const worldWidth = right - left
  const worldHeight = bottom - top
  let constrainedX = false
  let constrainedY = false

  if (visibleWidth >= worldWidth) {
    const centeredX =
      viewport.screenWidth / 2 - ((left + right) / 2) * scaleX
    if (viewport.x !== centeredX) {
      viewport.x = centeredX
      constrainedX = true
    }
  } else if (viewport.left < left) {
    viewport.x = -left * scaleX
    constrainedX = true
  } else if (viewport.right > right) {
    viewport.x = viewport.screenWidth - right * scaleX
    constrainedX = true
  }

  if (visibleHeight >= worldHeight) {
    const centeredY =
      viewport.screenHeight / 2 - ((top + bottom) / 2) * scaleY
    if (viewport.y !== centeredY) {
      viewport.y = centeredY
      constrainedY = true
    }
  } else if (viewport.top < top) {
    viewport.y = -top * scaleY
    constrainedY = true
  } else if (viewport.bottom > bottom) {
    viewport.y = viewport.screenHeight - bottom * scaleY
    constrainedY = true
  }

  const decelerate = viewport.plugins.get('decelerate') as
    | { x?: number; y?: number }
    | undefined
  if (constrainedX && decelerate) decelerate.x = 0
  if (constrainedY && decelerate) decelerate.y = 0
}

const CanvasViewport: React.FC<CanvasViewportProps> = memo(
  ({
    placedAssets,
    selectedIds,
    onSelectIds,
    onViewportReady,
    onAssetPositionChange,
    onAssetContextMenu,
    onAssetClick,
    onChapterClick,
    readOnly,
    boundaries,
    showGrid = true,
    snapToGrid = true,
    gridGranularity = 5,
    effectiveGridSize,
    chapterStates,
    clampToMap,
    minZoom,
    maxZoom,
  }) => {

    const { app } = useApplication()
    const appCanvas = app?.renderer?.canvas as HTMLCanvasElement | undefined

    const { left, right, top, bottom } = boundaries || DEFAULT_BOUNDARIES

    const worldWidth = Math.abs(right - left)
    const worldHeight = Math.abs(bottom - top)

    const [viewport, setViewport] = useState<Viewport | null>(null)

    const gridSize =
      effectiveGridSize || MINOR_GRID_SIZE * (11 - gridGranularity)

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

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
      onAssetClick,
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
        const containerRect = appCanvas?.parentElement?.getBoundingClientRect()
        const screenWidth =
          containerRect?.width || appCanvas?.clientWidth || window.innerWidth
        const screenHeight =
          containerRect?.height || appCanvas?.clientHeight || window.innerHeight

        node.resize(
          screenWidth,
          screenHeight,
          worldWidth,
          worldHeight,
        )

        if (isNewViewport) {
          node
            .drag({ clampWheel: true, mouseButtons: 'left' })
            .decelerate({ friction: 0.9, bounce: 0, minSpeed: 0.02 })
            .pinch()
            .wheel({ percent: 0.1, smooth: 6 })

          if (readOnly) {
            if (minZoom || maxZoom) {
              const resolvedMin = minZoom ?? 0.1
              const resolvedMax = maxZoom ?? 1
              const safeMin = Math.max(
                0.01,
                Math.min(resolvedMin, resolvedMax),
              )
              const safeMax = Math.max(resolvedMin, resolvedMax)
              node.clampZoom({
                minScale: safeMin,
                maxScale: safeMax,
              })
            } else {
              node.clampZoom({
                minWidth: screenWidth * 0.75,
                maxWidth: screenWidth,
              })
            }
          } else {
            node.clampZoom({
              minWidth: screenWidth * 0.2,
              maxWidth: screenWidth * 3,
            })
          }

          node.fit()
          node.moveCenter((left + right) / 2, (top + bottom) / 2)


          // const zoomBlurFilter = new ZoomBlurFilter({ strength: 0.25, radius: app.renderer.width*1.25, innerRadius: app.renderer.width * 0.55})
          // zoomBlurFilter.centerX = app.renderer.width / 2;
          // zoomBlurFilter.centerY = app.renderer.height / 2;
          // node.filters = [zoomBlurFilter]

          // expose to parent
          setViewport(node)
          onViewportReady?.(node)
        }

        if (readOnly) {
          if (node.plugins.get('clamp')) {
            node.plugins.remove('clamp')
          }
          constrainViewportToBounds(node, left, right, top, bottom)
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
        appCanvas,
        worldWidth,
        worldHeight,
        left,
        right,
        top,
        bottom,
        onViewportReady,
        readOnly,
        clampToMap,
        minZoom,
        maxZoom,
      ]
    )

    useEffect(() => {
      if (!viewport || !readOnly) return

      const constrainViewport = () => {
        constrainViewportToBounds(viewport, left, right, top, bottom)
      }

      constrainViewport()
      viewport.on('moved', constrainViewport)
      viewport.on('zoomed', constrainViewport)
      viewport.on('zoomed-end', constrainViewport)

      return () => {
        viewport.off('moved', constrainViewport)
        viewport.off('zoomed', constrainViewport)
        viewport.off('zoomed-end', constrainViewport)
      }
    }, [viewport, readOnly, left, right, top, bottom])

    useEffect(() => {
      if (!viewport) return

      if (!appCanvas) return
      const container = appCanvas.parentElement
      if (!container) return

      let resizeFrame: number | null = null
      const resizeViewport = () => {
        if (resizeFrame !== null) {
          cancelAnimationFrame(resizeFrame)
        }
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null
          const rect = container.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return
          viewport.resize(rect.width, rect.height, worldWidth, worldHeight)
          if (readOnly) {
            constrainViewportToBounds(viewport, left, right, top, bottom)
          }
        })
      }

      const observer = new ResizeObserver(resizeViewport)
      observer.observe(container)
      resizeViewport()

      return () => {
        observer.disconnect()
        if (resizeFrame !== null) {
          cancelAnimationFrame(resizeFrame)
        }
      }
    }, [
      appCanvas,
      viewport,
      worldWidth,
      worldHeight,
      readOnly,
      left,
      right,
      top,
      bottom,
    ])

    /* ↑ both handlers now come straight from the hook */

    const spriteURL = useCallback(getSpriteUrl, []);

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
              selected={selectedIdSet.has(asset.id)}
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
