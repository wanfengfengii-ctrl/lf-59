<template>
  <div class="canvas-container" ref="containerRef">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart.prevent="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
    />
    <div v-if="store.isPlaybackMode" class="playback-overlay">
      <span class="playback-badge">回放模式</span>
    </div>
    <div v-if="store.lastError" class="error-toast">{{ store.lastError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { usePyrographyStore } from '@/stores/pyrography'
import type { Point, Layer, TemperaturePreset } from '@/types'
import { LAYER_COLORS } from '@/types'
import { calculateHeatIntensity, heatToColor, calculateDwellTime, getTemperatureAtPoint } from '@/utils/pyrography'

const store = usePyrographyStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
let renderTimer: number | null = null

function startRenderTimer() {
  stopRenderTimer()
  renderTimer = window.setInterval(() => {
    if (store.isDrawing) {
      render()
    }
  }, 50)
}

function stopRenderTimer() {
  if (renderTimer !== null) {
    clearInterval(renderTimer)
    renderTimer = null
  }
}

function getCanvasPoint(clientX: number, clientY: number): Point {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0, timestamp: Date.now(), pressure: store.settings.pressure }
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
    timestamp: Date.now(),
    pressure: store.settings.pressure
  }
}

function handleMouseDown(e: MouseEvent) {
  const point = getCanvasPoint(e.clientX, e.clientY)
  store.startDrawing(point)
  startRenderTimer()
}

function handleMouseMove(e: MouseEvent) {
  if (!store.isDrawing) return
  const point = getCanvasPoint(e.clientX, e.clientY)
  store.addPoint(point)
  render()
}

function handleMouseUp() {
  if (!store.isDrawing) return
  stopRenderTimer()
  store.endDrawing()
  render()
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 0) return
  const touch = e.touches[0]
  const point = getCanvasPoint(touch.clientX, touch.clientY)
  point.pressure = (touch as Touch & { force?: number }).force || store.settings.pressure
  store.startDrawing(point)
  startRenderTimer()
}

function handleTouchMove(e: TouchEvent) {
  if (!store.isDrawing || e.touches.length === 0) return
  const touch = e.touches[0]
  const point = getCanvasPoint(touch.clientX, touch.clientY)
  point.pressure = (touch as Touch & { force?: number }).force || store.settings.pressure
  store.addPoint(point)
  render()
}

function handleTouchEnd() {
  if (!store.isDrawing) return
  stopRenderTimer()
  store.endDrawing()
  render()
}

function drawGourdBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#f4d58d'
  ctx.fillRect(0, 0, width, height)

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(210, 150, 80, 0.15)')
  gradient.addColorStop(0.5, 'rgba(255, 220, 150, 0.05)')
  gradient.addColorStop(1, 'rgba(210, 150, 80, 0.15)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(180, 120, 60, 0.12)'
  ctx.lineWidth = 1
  for (let i = 0; i < width; i += 20) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    for (let j = 0; j < height; j += 10) {
      ctx.lineTo(i + Math.sin(j * 0.02) * 5, j)
    }
    ctx.stroke()
  }

  const centerY = height / 2
  ctx.strokeStyle = 'rgba(139, 69, 19, 0.25)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 4])
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
  ctx.setLineDash([])

  const topY = height * 0.1
  const bottomY = height * 0.9
  ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, topY)
  ctx.lineTo(width, topY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, bottomY)
  ctx.lineTo(width, bottomY)
  ctx.stroke()
}

function drawTemperaturePresets(
  ctx: CanvasRenderingContext2D,
  presets: TemperaturePreset[]
) {
  for (const preset of presets) {
    const { x, y, width, height } = preset.region
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.strokeRect(x, y, width, height)
    ctx.setLineDash([])

    ctx.fillStyle = `rgba(255, ${Math.max(0, 200 - preset.temperature * 0.4)}, 50, 0.08)`
    ctx.fillRect(x, y, width, height)

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(200, 80, 30, 0.8)'
    ctx.fillText(`${preset.name}: ${preset.temperature}°C`, x + 4, y + 16)
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  temperature: number,
  speed: number,
  pressure: number,
  overburnedRegions: number[] = [],
  isPreview: boolean = false,
  layerOpacity: number = 1
) {
  if (points.length < 2) return

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const dwellTime = calculateDwellTime(p1, p2)
    const intensity = calculateHeatIntensity(temperature, dwellTime, speed, pressure)
    const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))

    const isOverburnedSegment = overburnedRegions.includes(i)
    const isOverburnedDwell = overburnedRegions.includes(i - 1) && distance < 5
    const isOverburned = isOverburnedSegment || isOverburnedDwell

    const color = heatToColor(intensity, isOverburned)

    ctx.strokeStyle = color
    const baseWidth = 2 + pressure * 1.5
    const avgPressure = (p1.pressure + p2.pressure) / 2
    ctx.lineWidth = baseWidth * (0.5 + avgPressure * 0.1)

    if (isPreview) {
      ctx.globalAlpha = 0.7 * layerOpacity
    } else {
      ctx.globalAlpha = layerOpacity
    }

    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()

    if (isOverburned && !isPreview) {
      const highlightPoint = isOverburnedDwell ? p1 : p2
      const radius = ctx.lineWidth + 8

      ctx.globalAlpha = layerOpacity
      ctx.beginPath()
      ctx.arc(highlightPoint.x, highlightPoint.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 50, 50, 0.25)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(highlightPoint.x, highlightPoint.y, radius - 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1
  ctx.lineWidth = 1
}

function drawLayerIndicator(
  ctx: CanvasRenderingContext2D,
  layer: Layer
) {
  if (layer.strokes.length === 0) return

  const color = LAYER_COLORS[layer.type] || '#999'

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.fillStyle = color
  ctx.globalAlpha = 0.7

  const firstStroke = layer.strokes[0]
  const lastStroke = layer.strokes[layer.strokes.length - 1]
  if (firstStroke.points.length > 0 && lastStroke.points.length > 0) {
    const indicatorX = 8
    const indicatorY = 20 + layer.order * 18
    ctx.fillText(`● ${layer.name} (${layer.strokes.length})`, indicatorX, indicatorY)
  }

  ctx.globalAlpha = 1
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  drawGourdBackground(ctx, width, height)

  drawTemperaturePresets(ctx, store.temperaturePresets)

  if (store.isPlaybackMode) {
    const visibleStrokes = store.playbackStrokes.slice(0, store.playbackVisibleCount)
    const sortedLayers = [...store.currentLayers].sort((a, b) => a.order - b.order)

    for (const layer of sortedLayers) {
      if (!layer.visible) continue
      const layerStrokes = visibleStrokes.filter((s) => s.layerId === layer.id)
      for (let si = 0; si < layerStrokes.length; si++) {
        const stroke = layerStrokes[si]
        const strokeIdx = visibleStrokes.indexOf(stroke)
        const maxPoints = store.playbackPointCounts[strokeIdx] ?? stroke.points.length
        const visiblePoints = stroke.points.slice(0, maxPoints)
        if (visiblePoints.length < 2) continue
        drawStroke(
          ctx,
          visiblePoints,
          stroke.temperature,
          stroke.speed,
          stroke.pressure,
          stroke.overburnedRegions.filter((r) => r < maxPoints),
          false,
          layer.opacity
        )
      }
    }
  } else {
    const sortedLayers = [...store.currentLayers].sort((a, b) => a.order - b.order)

    for (const layer of sortedLayers) {
      if (!layer.visible) continue
      for (const stroke of layer.strokes) {
        drawStroke(
          ctx,
          stroke.points,
          stroke.temperature,
          stroke.speed,
          stroke.pressure,
          stroke.overburnedRegions,
          false,
          layer.opacity
        )
      }
    }

    if (store.isDrawing && store.currentPoints.length > 0) {
      const currentLayerOpacity = store.currentLayer?.opacity ?? 1
      const presets = store.temperaturePresets
      const baseTemp = store.settings.temperature

      const segments: { points: Point[]; temperature: number }[] = []
      let segPoints: Point[] = []
      let segTemp: number | null = null

      for (const pt of store.currentPoints) {
        const pTemp = getTemperatureAtPoint(pt.x, pt.y, presets)
        const eTemp = pTemp !== null ? pTemp : baseTemp
        if (segTemp === null) {
          segTemp = eTemp
          segPoints = [pt]
        } else if (eTemp === segTemp) {
          segPoints.push(pt)
        } else {
          if (segPoints.length >= 2) segments.push({ points: [...segPoints], temperature: segTemp })
          segPoints = [segPoints[segPoints.length - 1], pt]
          segTemp = eTemp
        }
      }
      if (segPoints.length >= 2 && segTemp !== null) {
        segments.push({ points: segPoints, temperature: segTemp })
      }

      for (const seg of segments) {
        drawStroke(
          ctx,
          seg.points,
          seg.temperature,
          store.settings.speed,
          store.settings.pressure,
          [],
          true,
          currentLayerOpacity
        )
      }
    }

    for (const layer of sortedLayers) {
      if (layer.visible && layer.strokes.length > 0) {
        drawLayerIndicator(ctx, layer)
      }
    }
  }
}

function resizeCanvas() {
  if (!containerRef.value) return
  const container = containerRef.value
  canvasWidth.value = container.clientWidth
  canvasHeight.value = container.clientHeight
  nextTick(() => render())
}

watch(
  () => [store.currentStrokes, store.settings, store.currentLayers],
  () => render(),
  { deep: true }
)

watch(
  () => store.currentSchemeId,
  () => render()
)

watch(
  () => [store.playbackVisibleCount, store.playbackPointCounts, store.playbackState],
  () => {
    if (store.isPlaybackMode) {
      render()
    }
  },
  { deep: true }
)

watch(
  () => store.temperaturePresets,
  () => render(),
  { deep: true }
)

onMounted(() => {
  store.init()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  render()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}

.playback-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  pointer-events: none;
}

.playback-badge {
  display: inline-block;
  background: rgba(102, 126, 234, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.error-toast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.95);
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
