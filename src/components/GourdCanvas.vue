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
    <div v-if="store.lastError" class="error-toast">{{ store.lastError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { usePyrographyStore } from '@/stores/pyrography'
import type { Point } from '@/types'
import { calculateHeatIntensity, checkOverburn, heatToColor, calculateDwellTime } from '@/utils/pyrography'

const store = usePyrographyStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)

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
}

function handleMouseMove(e: MouseEvent) {
  if (!store.isDrawing) return
  const point = getCanvasPoint(e.clientX, e.clientY)
  store.addPoint(point)
  render()
}

function handleMouseUp() {
  if (!store.isDrawing) return
  store.endDrawing()
  render()
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 0) return
  const touch = e.touches[0]
  const point = getCanvasPoint(touch.clientX, touch.clientY)
  point.pressure = (touch as Touch & { force?: number }).force || store.settings.pressure
  store.startDrawing(point)
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

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  temperature: number,
  speed: number,
  pressure: number,
  isPreview: boolean = false
) {
  if (points.length < 2) return

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const dwellTime = calculateDwellTime(p1, p2)
    const intensity = calculateHeatIntensity(temperature, dwellTime, speed, pressure)
    const isOverburned = checkOverburn(temperature, dwellTime)
    const color = heatToColor(intensity, isOverburned)

    ctx.strokeStyle = color
    const baseWidth = 2 + pressure * 1.5
    const avgPressure = (p1.pressure + p2.pressure) / 2
    ctx.lineWidth = baseWidth * (0.5 + avgPressure * 0.1)

    if (isPreview) {
      ctx.globalAlpha = 0.7
    } else {
      ctx.globalAlpha = 1
    }

    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()

    if (isOverburned && !isPreview) {
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)'
      ctx.lineWidth = ctx.lineWidth + 6
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
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

  for (const stroke of store.currentStrokes) {
    drawStroke(ctx, stroke.points, stroke.temperature, stroke.speed, stroke.pressure)
  }

  if (store.isDrawing && store.currentPoints.length > 0) {
    drawStroke(
      ctx,
      store.currentPoints,
      store.settings.temperature,
      store.settings.speed,
      store.settings.pressure,
      true
    )
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
  () => [store.currentStrokes, store.settings],
  () => render(),
  { deep: true }
)

watch(
  () => store.currentSchemeId,
  () => render()
)

onMounted(() => {
  store.init()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  render()
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
