import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Stroke,
  Scheme,
  PyrographySettings,
  Point,
  Statistics,
  Layer,
  LayerType,
  TemperaturePreset,
  ScoringResult,
  PlaybackState,
  PlaybackSpeed,
  ExportData
} from '@/types'
import { MAX_LAYERS } from '@/types'
import {
  processStroke,
  calculateStatistics,
  generateSchemeId,
  generateLayerId,
  generatePresetId,
  validateStrokePoints,
  calculateDistance,
  calculateScore,
  createDefaultLayers,
  getTemperatureAtPoint
} from '@/utils/pyrography'
import { POINT_SUPPLEMENT_INTERVAL, MIN_MOVE_DISTANCE } from '@/types'

const DEFAULT_SETTINGS: PyrographySettings = {
  temperature: 200,
  speed: 10,
  pressure: 3
}

export const usePyrographyStore = defineStore('pyrography', () => {
  const settings = ref<PyrographySettings>({ ...DEFAULT_SETTINGS })
  const currentSchemeId = ref<string>('')
  const schemes = ref<Scheme[]>([])
  const history = ref<Stroke[][]>([])
  const currentPoints = ref<Point[]>([])
  const isDrawing = ref(false)
  const lastError = ref<string>('')
  const lastMousePos = ref<{ x: number; y: number } | null>(null)

  const playbackState = ref<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    totalDuration: 0,
    speed: 1,
    progress: 0
  })
  const playbackStrokes = ref<Stroke[]>([])
  const playbackVisibleCount = ref(0)
  const playbackPointCounts = ref<number[]>([])
  let playbackTimer: number | null = null

  const currentScore = ref<ScoringResult | null>(null)

  let supplementTimer: number | null = null

  const currentScheme = computed<Scheme | undefined>(() => {
    return schemes.value.find((s) => s.id === currentSchemeId.value)
  })

  const currentStrokes = computed<Stroke[]>(() => {
    return currentScheme.value?.strokes || []
  })

  const currentLayers = computed<Layer[]>(() => {
    if (!currentScheme.value) return []
    return [...currentScheme.value.layers].sort((a, b) => a.order - b.order)
  })

  const currentLayer = computed<Layer | undefined>(() => {
    if (!currentScheme.value) return undefined
    return currentScheme.value.layers.find(
      (l) => l.id === currentScheme.value!.currentLayerId
    )
  })

  const temperaturePresets = computed<TemperaturePreset[]>(() => {
    return currentScheme.value?.temperaturePresets || []
  })

  const statistics = computed<Statistics>(() => {
    return calculateStatistics(currentStrokes.value, currentLayers.value)
  })

  const canUndo = computed<boolean>(() => {
    return history.value.length > 0
  })

  const isPlaybackMode = computed<boolean>(() => {
    return playbackState.value.isPlaying || playbackState.value.isPaused
  })

  function startSupplementTimer() {
    stopSupplementTimer()
    supplementTimer = window.setInterval(() => {
      if (!isDrawing.value || !lastMousePos.value) return
      const lastPoint = currentPoints.value[currentPoints.value.length - 1]
      if (!lastPoint) return
      const distance = calculateDistance(
        lastPoint,
        { ...lastPoint, x: lastMousePos.value.x, y: lastMousePos.value.y }
      )
      if (distance < MIN_MOVE_DISTANCE) {
        const newPoint: Point = {
          x: lastMousePos.value.x,
          y: lastMousePos.value.y,
          timestamp: Date.now(),
          pressure: settings.value.pressure
        }
        currentPoints.value.push(newPoint)
      }
    }, POINT_SUPPLEMENT_INTERVAL)
  }

  function stopSupplementTimer() {
    if (supplementTimer !== null) {
      clearInterval(supplementTimer)
      supplementTimer = null
    }
  }

  function init() {
    if (schemes.value.length === 0) {
      createScheme('默认方案')
    }
  }

  function saveCurrentSettingsToScheme() {
    if (currentScheme.value) {
      currentScheme.value.settings = { ...settings.value }
    }
  }

  function createScheme(name: string): Scheme {
    saveCurrentSettingsToScheme()
    const defaultLayers = createDefaultLayers()
    const scheme: Scheme = {
      id: generateSchemeId(),
      name,
      strokes: [],
      layers: defaultLayers,
      temperaturePresets: [],
      settings: { ...settings.value },
      currentLayerId: defaultLayers[0].id,
      createdAt: Date.now()
    }
    schemes.value.push(scheme)
    currentSchemeId.value = scheme.id
    history.value = []
    settings.value = { ...defaultLayers[0].settings }
    return scheme
  }

  function switchScheme(schemeId: string) {
    if (isPlaybackMode.value) return
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (!scheme) return
    if (isDrawing.value) {
      endDrawing()
    }
    if (isPlaybackMode.value) {
      stopPlayback()
    }
    saveCurrentSettingsToScheme()
    currentSchemeId.value = schemeId
    settings.value = { ...scheme.settings }
    const activeLayer = scheme.layers.find((l) => l.id === scheme.currentLayerId)
    if (activeLayer) {
      settings.value = { ...activeLayer.settings }
    }
    history.value = []
    lastError.value = ''
    currentScore.value = null
  }

  function deleteScheme(schemeId: string) {
    if (isPlaybackMode.value) return
    const index = schemes.value.findIndex((s) => s.id === schemeId)
    if (index === -1) return
    schemes.value.splice(index, 1)
    if (currentSchemeId.value === schemeId) {
      if (schemes.value.length > 0) {
        currentSchemeId.value = schemes.value[0].id
        settings.value = { ...schemes.value[0].settings }
      } else {
        createScheme('默认方案')
      }
    }
    history.value = []
    currentScore.value = null
  }

  function renameScheme(schemeId: string, name: string) {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (scheme) {
      scheme.name = name
    }
  }

  function updateSettings(newSettings: Partial<PyrographySettings>) {
    if (newSettings.temperature !== undefined && newSettings.temperature <= 0) {
      lastError.value = '烙笔温度必须大于 0'
      return
    }
    if (newSettings.speed !== undefined && newSettings.speed <= 0) {
      lastError.value = '笔触速度必须大于 0'
      return
    }
    lastError.value = ''
    settings.value = { ...settings.value, ...newSettings }
    saveCurrentSettingsToScheme()
    if (currentLayer.value) {
      currentLayer.value.settings = { ...settings.value }
    }
  }

  function addLayer(name: string, type: LayerType): Layer | null {
    if (isPlaybackMode.value) return null
    if (!currentScheme.value) return null
    if (currentScheme.value.layers.length >= MAX_LAYERS) {
      lastError.value = `最多支持 ${MAX_LAYERS} 个图层`
      return null
    }

    const layer: Layer = {
      id: generateLayerId(),
      name,
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [],
      settings: { ...settings.value },
      order: currentScheme.value.layers.length,
      type,
      createdAt: Date.now()
    }

    currentScheme.value.layers.push(layer)
    switchLayer(layer.id)
    return layer
  }

  function deleteLayer(layerId: string) {
    if (isPlaybackMode.value) return
    if (!currentScheme.value) return
    if (currentScheme.value.layers.length <= 1) {
      lastError.value = '至少需要保留一个图层'
      return
    }

    const layerIndex = currentScheme.value.layers.findIndex((l) => l.id === layerId)
    if (layerIndex === -1) return

    currentScheme.value.strokes = currentScheme.value.strokes.filter(
      (s) => s.layerId !== layerId
    )
    currentScheme.value.layers.splice(layerIndex, 1)

    currentScheme.value.layers.forEach((l, i) => {
      l.order = i
    })

    if (currentScheme.value.currentLayerId === layerId) {
      const nextLayer = currentScheme.value.layers[Math.min(layerIndex, currentScheme.value.layers.length - 1)]
      switchLayer(nextLayer.id)
    }

    currentScore.value = null
  }

  function switchLayer(layerId: string) {
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (!layer) return

    if (currentLayer.value) {
      currentLayer.value.settings = { ...settings.value }
    }

    currentScheme.value.currentLayerId = layerId
    settings.value = { ...layer.settings }
    history.value = []
  }

  function toggleLayerVisibility(layerId: string) {
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.visible = !layer.visible
    }
  }

  function toggleLayerLock(layerId: string) {
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.locked = !layer.locked
    }
  }

  function updateLayerOpacity(layerId: string, opacity: number) {
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity))
    }
  }

  function renameLayer(layerId: string, name: string) {
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (layer) {
      layer.name = name
    }
  }

  function reorderLayer(layerId: string, direction: 'up' | 'down') {
    if (!currentScheme.value) return
    const layers = currentScheme.value.layers
    const idx = layers.findIndex((l) => l.id === layerId)
    if (idx === -1) return

    const targetIdx = direction === 'up' ? idx + 1 : idx - 1
    if (targetIdx < 0 || targetIdx >= layers.length) return

    const tempOrder = layers[idx].order
    layers[idx].order = layers[targetIdx].order
    layers[targetIdx].order = tempOrder
  }

  function addTemperaturePreset(name: string, region: { x: number; y: number; width: number; height: number }, temperature: number): TemperaturePreset | null {
    if (!currentScheme.value) return null
    const preset: TemperaturePreset = {
      id: generatePresetId(),
      name,
      region,
      temperature,
      createdAt: Date.now()
    }
    currentScheme.value.temperaturePresets.push(preset)
    return preset
  }

  function deleteTemperaturePreset(presetId: string) {
    if (!currentScheme.value) return
    const idx = currentScheme.value.temperaturePresets.findIndex((p) => p.id === presetId)
    if (idx !== -1) {
      currentScheme.value.temperaturePresets.splice(idx, 1)
    }
  }

  function updateTemperaturePreset(presetId: string, updates: Partial<Pick<TemperaturePreset, 'name' | 'temperature' | 'region'>>) {
    if (!currentScheme.value) return
    const preset = currentScheme.value.temperaturePresets.find((p) => p.id === presetId)
    if (preset) {
      Object.assign(preset, updates)
    }
  }

  function startDrawing(point: Point) {
    if (isPlaybackMode.value) return
    if (currentLayer.value?.locked) {
      lastError.value = '当前图层已锁定，无法绘制'
      return
    }
    stopSupplementTimer()
    isDrawing.value = true
    currentPoints.value = [point]
    lastMousePos.value = { x: point.x, y: point.y }
    startSupplementTimer()
  }

  function addPoint(point: Point) {
    if (!isDrawing.value) return
    lastMousePos.value = { x: point.x, y: point.y }
    currentPoints.value.push(point)
  }

  function endDrawing(): Stroke | null {
    stopSupplementTimer()
    if (!isDrawing.value) return null
    isDrawing.value = false
    lastMousePos.value = null

    if (!validateStrokePoints(currentPoints.value)) {
      lastError.value = '路径点数量不足（至少需要 3 个点）'
      currentPoints.value = []
      return null
    }

    const layerId = currentLayer.value?.id || ''
    const presets = currentScheme.value?.temperaturePresets || []
    const baseTemp = settings.value.temperature

    const segments: { points: Point[]; temperature: number }[] = []
    let currentSegmentPoints: Point[] = []
    let currentSegTemp: number | null = null

    for (const point of currentPoints.value) {
      const presetTemp = getTemperatureAtPoint(point.x, point.y, presets)
      const effectiveTemp = presetTemp !== null ? presetTemp : baseTemp

      if (currentSegTemp === null) {
        currentSegTemp = effectiveTemp
        currentSegmentPoints = [point]
      } else if (effectiveTemp === currentSegTemp) {
        currentSegmentPoints.push(point)
      } else {
        if (currentSegmentPoints.length >= 2) {
          segments.push({ points: [...currentSegmentPoints], temperature: currentSegTemp })
        }
        currentSegmentPoints = [currentSegmentPoints[currentSegmentPoints.length - 1], point]
        currentSegTemp = effectiveTemp
      }
    }

    if (currentSegmentPoints.length >= 2 && currentSegTemp !== null) {
      segments.push({ points: currentSegmentPoints, temperature: currentSegTemp })
    }

    if (segments.length === 0) {
      lastError.value = '路径点数量不足（至少需要 3 个点）'
      currentPoints.value = []
      return null
    }

    lastError.value = ''

    if (currentScheme.value) {
      history.value.push([...currentScheme.value.strokes])
    }

    let primaryStroke: Stroke | null = null

    for (const segment of segments) {
      if (segment.points.length < 2) continue

      const stroke = processStroke(
        segment.points,
        segment.temperature,
        settings.value.speed,
        settings.value.pressure,
        layerId
      )

      if (stroke && currentScheme.value) {
        currentScheme.value.strokes.push(stroke)
        const layer = currentScheme.value.layers.find((l) => l.id === layerId)
        if (layer) {
          layer.strokes.push(stroke)
        }
        if (!primaryStroke) {
          primaryStroke = stroke
        }
      }
    }

    currentPoints.value = []
    currentScore.value = null
    return primaryStroke
  }

  function undo() {
    if (isPlaybackMode.value) return
    if (history.value.length === 0 || !currentScheme.value) return
    const previousState = history.value.pop()
    if (previousState !== undefined) {
      const removedStrokes = currentScheme.value.strokes.filter(
        (_, i) => i >= previousState.length
      )
      currentScheme.value.strokes = previousState
      currentScheme.value.layers.forEach((layer) => {
        layer.strokes = layer.strokes.filter(
          (s) => !removedStrokes.some((rm) => rm.id === s.id)
        )
      })
    }
    currentScore.value = null
  }

  function clearCanvas() {
    if (isPlaybackMode.value) return
    if (!currentScheme.value) return
    history.value.push([...currentScheme.value.strokes])
    currentScheme.value.strokes = []
    currentScheme.value.layers.forEach((layer) => {
      layer.strokes = []
    })
    currentScore.value = null
  }

  function clearLayer(layerId: string) {
    if (isPlaybackMode.value) return
    if (!currentScheme.value) return
    const layer = currentScheme.value.layers.find((l) => l.id === layerId)
    if (!layer) return
    history.value.push([...currentScheme.value.strokes])
    currentScheme.value.strokes = currentScheme.value.strokes.filter(
      (s) => s.layerId !== layerId
    )
    layer.strokes = []
    currentScore.value = null
  }

  function startPlayback() {
    if (!currentScheme.value || currentScheme.value.strokes.length === 0) {
      lastError.value = '没有可回放的笔触数据'
      return
    }
    if (isDrawing.value) return

    playbackStrokes.value = [...currentScheme.value.strokes].sort(
      (a, b) => a.startTime - b.startTime
    )
    playbackVisibleCount.value = 0
    playbackPointCounts.value = []
    playbackState.value = {
      isPlaying: true,
      isPaused: false,
      currentTime: 0,
      totalDuration: 0,
      speed: playbackState.value.speed,
      progress: 0
    }

    if (playbackStrokes.value.length > 0) {
      const firstTime = playbackStrokes.value[0].startTime
      const lastStroke = playbackStrokes.value[playbackStrokes.value.length - 1]
      playbackState.value.totalDuration = lastStroke.endTime - firstTime
      playbackState.value.currentTime = 0
    }

    tickPlayback()
  }

  function tickPlayback() {
    if (!playbackState.value.isPlaying || playbackState.value.isPaused) return

    const speed = playbackState.value.speed
    const interval = 30
    const timeStep = interval * speed

    playbackState.value.currentTime += timeStep

    if (playbackStrokes.value.length === 0) {
      stopPlayback()
      return
    }

    const firstTime = playbackStrokes.value[0].startTime
    const currentTime = firstTime + playbackState.value.currentTime

    const pointCounts: number[] = []
    let visibleCount = 0

    for (let si = 0; si < playbackStrokes.value.length; si++) {
      const stroke = playbackStrokes.value[si]
      if (stroke.startTime > currentTime) break

      let pointIdx = 0
      for (let pi = 0; pi < stroke.points.length; pi++) {
        if (stroke.points[pi].timestamp <= currentTime) {
          pointIdx = pi + 1
        } else {
          break
        }
      }
      pointCounts.push(pointIdx)
      visibleCount = si + 1
    }

    playbackPointCounts.value = pointCounts
    playbackVisibleCount.value = visibleCount

    playbackState.value.progress =
      playbackState.value.totalDuration > 0
        ? Math.min(1, playbackState.value.currentTime / playbackState.value.totalDuration)
        : 0

    if (playbackState.value.currentTime >= playbackState.value.totalDuration) {
      playbackVisibleCount.value = playbackStrokes.value.length
      playbackPointCounts.value = playbackStrokes.value.map((s) => s.points.length)
      stopPlayback()
      return
    }

    playbackTimer = window.setTimeout(() => tickPlayback(), interval)
  }

  function pausePlayback() {
    if (!playbackState.value.isPlaying) return
    playbackState.value.isPaused = true
    if (playbackTimer !== null) {
      clearTimeout(playbackTimer)
      playbackTimer = null
    }
  }

  function resumePlayback() {
    if (!playbackState.value.isPaused) return
    playbackState.value.isPaused = false
    tickPlayback()
  }

  function stopPlayback() {
    playbackState.value.isPlaying = false
    playbackState.value.isPaused = false
    playbackState.value.progress = 0
    playbackState.value.currentTime = 0
    playbackVisibleCount.value = 0
    playbackPointCounts.value = []
    playbackStrokes.value = []
    if (playbackTimer !== null) {
      clearTimeout(playbackTimer)
      playbackTimer = null
    }
  }

  function setPlaybackSpeed(speed: PlaybackSpeed) {
    playbackState.value.speed = speed
  }

  function seekPlayback(progress: number) {
    if (!playbackState.value.isPlaying) return
    playbackState.value.currentTime = progress * playbackState.value.totalDuration
    playbackState.value.progress = progress

    const firstTime = playbackStrokes.value[0]?.startTime ?? 0
    const currentTime = firstTime + playbackState.value.currentTime

    const pointCounts: number[] = []
    let visibleCount = 0

    for (let si = 0; si < playbackStrokes.value.length; si++) {
      const stroke = playbackStrokes.value[si]
      if (stroke.startTime > currentTime) break

      let pointIdx = 0
      for (let pi = 0; pi < stroke.points.length; pi++) {
        if (stroke.points[pi].timestamp <= currentTime) {
          pointIdx = pi + 1
        } else {
          break
        }
      }
      pointCounts.push(pointIdx)
      visibleCount = si + 1
    }

    playbackVisibleCount.value = visibleCount
    playbackPointCounts.value = pointCounts
  }

  function evaluateScore() {
    if (!currentScheme.value) return
    currentScore.value = calculateScore(
      currentScheme.value.strokes,
      currentScheme.value.layers
    )
  }

  function exportProject(): string {
    const data: ExportData = {
      version: '2.0.0',
      schemes: JSON.parse(JSON.stringify(schemes.value)),
      scores: currentScore.value ? [currentScore.value] : [],
      exportedAt: Date.now()
    }
    return JSON.stringify(data, null, 2)
  }

  function importProject(jsonStr: string): boolean {
    try {
      const data: ExportData = JSON.parse(jsonStr)

      if (!data.schemes || !Array.isArray(data.schemes)) {
        lastError.value = '导入失败：缺少方案数据'
        return false
      }

      schemes.value = data.schemes
      if (schemes.value.length > 0) {
        currentSchemeId.value = schemes.value[0].id
        const activeLayer = schemes.value[0].layers?.find(
          (l) => l.id === schemes.value[0].currentLayerId
        )
        settings.value = activeLayer
          ? { ...activeLayer.settings }
          : { ...schemes.value[0].settings }
      }

      if (data.scores && data.scores.length > 0) {
        currentScore.value = data.scores[data.scores.length - 1]
      } else {
        currentScore.value = null
      }

      history.value = []
      lastError.value = `成功导入 ${schemes.value.length} 个方案`
      return true
    } catch {
      lastError.value = '导入失败：JSON 格式不正确'
      return false
    }
  }

  function importStrokes(strokesData: unknown): boolean {
    if (!currentScheme.value || !currentLayer.value) return false

    if (!Array.isArray(strokesData)) {
      lastError.value = '导入失败：路径数据格式不正确'
      return false
    }

    const validStrokes: Stroke[] = []

    for (const strokeData of strokesData) {
      if (
        !strokeData ||
        !Array.isArray(strokeData.points) ||
        !validateStrokePoints(strokeData.points)
      ) {
        continue
      }

      const points: Point[] = strokeData.points.filter(
        (p: Point) =>
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          typeof p.timestamp === 'number'
      )

      if (points.length < 3) continue

      const temperature =
        typeof strokeData.temperature === 'number' && strokeData.temperature > 0
          ? strokeData.temperature
          : settings.value.temperature
      const speed =
        typeof strokeData.speed === 'number' && strokeData.speed > 0
          ? strokeData.speed
          : settings.value.speed
      const pressure =
        typeof strokeData.pressure === 'number'
          ? strokeData.pressure
          : settings.value.pressure
      const layerId = currentLayer.value.id

      const stroke = processStroke(points, temperature, speed, pressure, layerId)
      if (stroke) {
        validStrokes.push(stroke)
      }
    }

    if (validStrokes.length === 0) {
      lastError.value = '导入失败：未找到有效路径数据'
      return false
    }

    history.value.push([...currentScheme.value.strokes])
    currentScheme.value.strokes.push(...validStrokes)
    currentLayer.value.strokes.push(...validStrokes)
    lastError.value = `成功导入 ${validStrokes.length} 条路径`
    currentScore.value = null
    return true
  }

  function clearError() {
    lastError.value = ''
  }

  return {
    settings,
    currentSchemeId,
    schemes,
    currentScheme,
    currentStrokes,
    currentLayers,
    currentLayer,
    temperaturePresets,
    statistics,
    canUndo,
    currentPoints,
    isDrawing,
    lastError,
    playbackState,
    playbackStrokes,
    playbackVisibleCount,
    playbackPointCounts,
    currentScore,
    isPlaybackMode,
    init,
    createScheme,
    switchScheme,
    deleteScheme,
    renameScheme,
    updateSettings,
    addLayer,
    deleteLayer,
    switchLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    updateLayerOpacity,
    renameLayer,
    reorderLayer,
    addTemperaturePreset,
    deleteTemperaturePreset,
    updateTemperaturePreset,
    startDrawing,
    addPoint,
    endDrawing,
    undo,
    clearCanvas,
    clearLayer,
    startPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    setPlaybackSpeed,
    seekPlayback,
    evaluateScore,
    exportProject,
    importProject,
    importStrokes,
    clearError
  }
})
