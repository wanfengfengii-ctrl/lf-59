<template>
  <div class="canvas-container" ref="containerRef" @wheel.prevent="handleWheel">
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
    <div v-if="tracingStore.currentBinding && referenceMode !== 'draw'" class="reference-mode-badge">
      <span>{{ referenceMode === 'move' ? '📐 移动参考图' : referenceMode === 'rotate' ? '🔄 旋转参考图' : '🔍 缩放参考图' }}</span>
      <button class="close-btn" @click="referenceMode = 'draw'">×</button>
    </div>
    <div v-if="store.lastError || tracingStore.lastError" class="error-toast">
      {{ store.lastError || tracingStore.lastError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onBeforeUnmount, computed, reactive } from 'vue'
import { usePyrographyStore } from '@/stores/pyrography'
import { useTracingStore } from '@/stores/tracing'
import type { Point, Layer, TemperaturePreset, ReferenceBinding } from '@/types'
import { LAYER_COLORS } from '@/types'
import { calculateHeatIntensity, heatToColor, calculateDwellTime, getTemperatureAtPoint } from '@/utils/pyrography'

const emit = defineEmits<{
  (e: 'mode-change', mode: 'draw' | 'move' | 'rotate' | 'scale'): void
}>()

const store = usePyrographyStore()
const tracingStore = useTracingStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
let renderTimer: number | null = null

const referenceMode = ref<'draw' | 'move' | 'rotate' | 'scale'>('draw')
const referenceImages = reactive<Map<string, HTMLImageElement>>(new Map())
const isDraggingRef = ref(false)
const dragStartPos = reactive({ x: 0, y: 0 })
const dragStartTransform = reactive({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })

const visibleBindings = computed<ReferenceBinding[]>(() => {
  return tracingStore.currentSchemeBindings.filter(b => b.transform.visible)
})

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

function getCanvasPosition(clientX: number, clientY: number): { x: number; y: number } {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  }
}

function isPointInReference(px: number, py: number, binding: ReferenceBinding): boolean {
  const ref = tracingStore.referenceImages.find(r => r.id === binding.referenceId)
  if (!ref) return false

  const t = binding.transform
  const w = ref.originalWidth * t.scaleX
  const h = ref.originalHeight * t.scaleY

  const cos = Math.cos((-t.rotation * Math.PI) / 180)
  const sin = Math.sin((-t.rotation * Math.PI) / 180)
  const dx = px - t.x
  const dy = py - t.y
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  return Math.abs(localX) <= w / 2 + 10 && Math.abs(localY) <= h / 2 + 10
}

function handleMouseDown(e: MouseEvent) {
  const pos = getCanvasPosition(e.clientX, e.clientY)

  if (referenceMode.value === 'move' && tracingStore.currentBinding && !tracingStore.currentBinding.transform.locked) {
    if (isPointInReference(pos.x, pos.y, tracingStore.currentBinding)) {
      isDraggingRef.value = true
      dragStartPos.x = pos.x
      dragStartPos.y = pos.y
      dragStartTransform.x = tracingStore.currentBinding.transform.x
      dragStartTransform.y = tracingStore.currentBinding.transform.y
      return
    }
  }

  if (referenceMode.value === 'rotate' && tracingStore.currentBinding && !tracingStore.currentBinding.transform.locked) {
    isDraggingRef.value = true
    dragStartPos.x = pos.x
    dragStartPos.y = pos.y
    dragStartTransform.rotation = tracingStore.currentBinding.transform.rotation
    return
  }

  if (referenceMode.value === 'scale' && tracingStore.currentBinding && !tracingStore.currentBinding.transform.locked) {
    isDraggingRef.value = true
    dragStartPos.x = pos.x
    dragStartPos.y = pos.y
    dragStartTransform.scaleX = tracingStore.currentBinding.transform.scaleX
    dragStartTransform.scaleY = tracingStore.currentBinding.transform.scaleY
    return
  }

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    if (tracingStore.currentBinding && !tracingStore.currentBinding.transform.locked) {
      if (isPointInReference(pos.x, pos.y, tracingStore.currentBinding)) {
        isDraggingRef.value = true
        dragStartPos.x = pos.x
        dragStartPos.y = pos.y
        dragStartTransform.x = tracingStore.currentBinding.transform.x
        dragStartTransform.y = tracingStore.currentBinding.transform.y
        return
      }
    }
  }

  const point = getCanvasPoint(e.clientX, e.clientY)
  store.startDrawing(point)
  startRenderTimer()
}

function handleMouseMove(e: MouseEvent) {
  const pos = getCanvasPosition(e.clientX, e.clientY)

  if (isDraggingRef.value && tracingStore.currentBinding) {
    if (referenceMode.value === 'move' || (e.buttons === 4 || e.shiftKey)) {
      const deltaX = pos.x - dragStartPos.x
      const deltaY = pos.y - dragStartPos.y
      tracingStore.updateBindingTransform(tracingStore.currentBinding.id, {
        x: dragStartTransform.x + deltaX,
        y: dragStartTransform.y + deltaY
      })
      render()
      return
    }

    if (referenceMode.value === 'rotate') {
      const binding = tracingStore.currentBinding
      const startAngle = Math.atan2(dragStartPos.y - binding.transform.y, dragStartPos.x - binding.transform.x)
      const currentAngle = Math.atan2(pos.y - binding.transform.y, pos.x - binding.transform.x)
      const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI
      let newRotation = dragStartTransform.rotation + deltaDeg
      while (newRotation >= 360) newRotation -= 360
      while (newRotation < 0) newRotation += 360
      tracingStore.updateBindingTransform(binding.id, { rotation: newRotation })
      render()
      return
    }

    if (referenceMode.value === 'scale') {
      const deltaY = pos.y - dragStartPos.y
      const factor = Math.max(0.5, Math.min(2, 1 - deltaY / 200))
      tracingStore.updateBindingTransform(tracingStore.currentBinding.id, {
        scaleX: Math.max(0.1, Math.min(5, dragStartTransform.scaleX * factor)),
        scaleY: Math.max(0.1, Math.min(5, dragStartTransform.scaleY * factor))
      })
      render()
      return
    }
  }

  if (!store.isDrawing) return
  const point = getCanvasPoint(e.clientX, e.clientY)
  store.addPoint(point)
  render()
}

function handleMouseUp() {
  if (isDraggingRef.value) {
    isDraggingRef.value = false
    render()
    return
  }

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

function handleWheel(e: WheelEvent) {
  if (!tracingStore.currentBinding || tracingStore.currentBinding.transform.locked) return

  if (e.ctrlKey || e.metaKey) {
    const pos = getCanvasPosition(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    tracingStore.scaleReference(factor, pos.x, pos.y)
  } else if (e.altKey) {
    const delta = e.deltaY > 0 ? 2 : -2
    tracingStore.rotateReference(delta)
  } else if (e.shiftKey) {
    const deltaX = -e.deltaX * 0.5
    const deltaY = -e.deltaY * 0.5
    tracingStore.moveReference(deltaX, deltaY)
  }

  render()
}

function ensureReferenceImageLoaded(dataUrl: string, refId: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const cached = referenceImages.get(refId)
    if (cached && cached.complete) {
      resolve(cached)
      return
    }
    const img = new Image()
    img.onload = () => {
      referenceImages.set(refId, img)
      resolve(img)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}

function drawReferenceImages(ctx: CanvasRenderingContext2D) {
  for (const binding of visibleBindings.value) {
    const ref = tracingStore.referenceImages.find(r => r.id === binding.referenceId)
    if (!ref) continue

    const img = referenceImages.get(ref.id)
    if (!img) {
      ensureReferenceImageLoaded(ref.dataUrl, ref.id)
        .then(() => render())
        .catch(() => {})
      continue
    }

    const t = binding.transform
    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.scale(t.scaleX, t.scaleY)
    ctx.globalAlpha = t.opacity
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()

    if (referenceMode.value !== 'draw' && tracingStore.currentBindingId === binding.id) {
      drawReferenceHandles(ctx, binding, img.width, img.height)
    }
  }
}

function drawReferenceHandles(
  ctx: CanvasRenderingContext2D,
  binding: ReferenceBinding,
  imgWidth: number,
  imgHeight: number
) {
  const t = binding.transform
  ctx.save()
  ctx.translate(t.x, t.y)
  ctx.rotate((t.rotation * Math.PI) / 180)
  ctx.scale(t.scaleX, t.scaleY)

  ctx.strokeStyle = t.locked ? 'rgba(239, 68, 68, 0.8)' : 'rgba(99, 102, 241, 0.8)'
  ctx.lineWidth = 2 / Math.max(t.scaleX, t.scaleY)
  ctx.setLineDash([6 / t.scaleX, 4 / t.scaleY])
  ctx.strokeRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
  ctx.setLineDash([])

  const handleSize = 10 / Math.max(t.scaleX, t.scaleY)
  ctx.fillStyle = t.locked ? '#ef4444' : '#6366f1'
  const corners = [
    [-imgWidth / 2, -imgHeight / 2],
    [imgWidth / 2, -imgHeight / 2],
    [-imgWidth / 2, imgHeight / 2],
    [imgWidth / 2, imgHeight / 2]
  ]
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
  }

  ctx.restore()
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

  drawReferenceImages(ctx)

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

watch(
  () => [tracingStore.currentSchemeBindings, tracingStore.referenceImages, referenceMode.value],
  () => render(),
  { deep: true }
)

watch(referenceMode, (newMode) => {
  emit('mode-change', newMode)
})

defineExpose({
  setReferenceMode: (mode: 'draw' | 'move' | 'rotate' | 'scale') => {
    referenceMode.value = mode
  },
  getReferenceMode: () => referenceMode.value
})

onMounted(() => {
  store.init()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('keydown', handleKeyDown)
  render()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(e: KeyboardEvent) {
  if (!tracingStore.currentBinding) return

  if (e.key === 'v' || e.key === 'V') {
    tracingStore.toggleReferenceVisible()
    render()
  }
  if (e.key === 'l' || e.key === 'L') {
    tracingStore.toggleReferenceLocked()
    render()
  }
  if (e.key === 'r' || e.key === 'R') {
    tracingStore.resetBindingTransform(tracingStore.currentBinding.id)
    render()
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key === '1') { referenceMode.value = 'draw'; render() }
    if (e.key === '2') { referenceMode.value = 'move'; render() }
    if (e.key === '3') { referenceMode.value = 'rotate'; render() }
    if (e.key === '4') { referenceMode.value = 'scale'; render() }
  }
}
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

.reference-mode-badge {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(99, 102, 241, 0.95);
  color: white;
  padding: 6px 14px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  z-index: 5;
}

.reference-mode-badge .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.reference-mode-badge .close-btn:hover {
  background: rgba(255, 255, 255, 0.35);
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
  max-width: 80%;
  text-align: center;
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
