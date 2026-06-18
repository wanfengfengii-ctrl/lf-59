import type {
  Point,
  Stroke,
  Statistics,
  LayerStatistics,
  ScoringResult,
  ScoreGrade,
  TrainingSuggestion,
  Layer,
  PlaybackFrame
} from '@/types'
import {
  MIN_POINTS,
  OVERBURN_TEMPERATURE,
  OVERBURN_DWELL_TIME,
  MIN_TEMPERATURE,
  MIN_SPEED,
  MIN_MOVE_DISTANCE
} from '@/types'

export function calculateDwellTime(p1: Point, p2: Point): number {
  return Math.abs(p2.timestamp - p1.timestamp)
}

export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function calculateHeatIntensity(
  temperature: number,
  dwellTime: number,
  speed: number,
  pressure: number
): number {
  if (temperature <= 0 || speed <= 0) return 0
  const normalizedTemp = Math.min(temperature / 500, 1)
  const normalizedDwell = Math.min(dwellTime / 2000, 1)
  const normalizedSpeed = Math.max(1 - speed / 100, 0)
  const normalizedPressure = Math.min(pressure / 10, 1)
  const intensity =
    normalizedTemp * 0.4 +
    normalizedDwell * 0.3 +
    normalizedSpeed * 0.15 +
    normalizedPressure * 0.15
  return Math.min(Math.max(intensity, 0), 1)
}

export function heatToColor(intensity: number, isOverburned: boolean): string {
  if (isOverburned) {
    return '#ff2222'
  }
  const r = Math.round(205 + 50 * (1 - intensity))
  const g = Math.round(180 * (1 - intensity))
  const b = Math.round(150 * (1 - intensity))
  return `rgb(${r}, ${g}, ${b})`
}

export function checkOverburn(
  temperature: number,
  dwellTime: number
): boolean {
  return temperature >= OVERBURN_TEMPERATURE && dwellTime >= OVERBURN_DWELL_TIME
}

export function validateStrokePoints(points: Point[]): boolean {
  return Array.isArray(points) && points.length >= MIN_POINTS
}

export function validateSettings(temperature: number, speed: number): boolean {
  return temperature >= MIN_TEMPERATURE && speed >= MIN_SPEED
}

export function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generateSchemeId(): string {
  return `scheme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function processStroke(
  points: Point[],
  temperature: number,
  speed: number,
  pressure: number,
  layerId: string = ''
): Stroke | null {
  if (!validateStrokePoints(points) || !validateSettings(temperature, speed)) {
    return null
  }

  const overburnedRegions: number[] = []
  let maxIntensity = 0

  const startTime = points[0].timestamp
  const endTime = points[points.length - 1].timestamp

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const dwellTime = calculateDwellTime(p1, p2)
    const distance = calculateDistance(p1, p2)

    const intensity = calculateHeatIntensity(temperature, dwellTime, speed, pressure)
    maxIntensity = Math.max(maxIntensity, intensity)

    if (checkOverburn(temperature, dwellTime)) {
      if (distance < MIN_MOVE_DISTANCE) {
        overburnedRegions.push(i - 1)
      } else {
        overburnedRegions.push(i)
      }
    }
  }

  const isOverburned = overburnedRegions.length > 0
  const color = heatToColor(maxIntensity, isOverburned)

  return {
    id: generateStrokeId(),
    points,
    temperature,
    speed,
    pressure,
    color,
    isOverburned,
    overburnedRegions,
    layerId,
    startTime,
    endTime
  }
}

export function calculateStatistics(strokes: Stroke[], layers: Layer[] = []): Statistics {
  const totalStrokes = strokes.length
  const overburnedCount = strokes.filter((s) => s.isOverburned).length
  const overburnedRisk = totalStrokes > 0 ? (overburnedCount / totalStrokes) * 100 : 0

  let depthSum = 0
  const depthDistribution = [0, 0, 0, 0, 0]
  const colorValues: number[] = []

  strokes.forEach((stroke) => {
    const colorMatch = stroke.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (colorMatch) {
      const r = parseInt(colorMatch[1], 10)
      const g = parseInt(colorMatch[2], 10)
      const b = parseInt(colorMatch[3], 10)
      const depth = 1 - (r + g + b) / (3 * 255)
      depthSum += depth
      colorValues.push(depth)

      const bucket = Math.min(Math.floor(depth * 5), 4)
      depthDistribution[bucket]++
    }
  })

  const averageDepth = totalStrokes > 0 ? depthSum / totalStrokes : 0

  let uniformity = 100
  if (colorValues.length > 1) {
    const mean = averageDepth
    const variance =
      colorValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      colorValues.length
    const stdDev = Math.sqrt(variance)
    uniformity = Math.max(0, 100 - stdDev * 200)
  }

  const layerStats = calculateLayerStatistics(layers)

  const parameterStability = calculateParameterStability(strokes)
  const colorTransitionScore = calculateColorTransitionScore(strokes)

  return {
    totalStrokes,
    overburnedCount,
    overburnedRisk,
    uniformity,
    averageDepth,
    depthDistribution,
    layerStats,
    parameterStability,
    colorTransitionScore
  }
}

export function calculateLayerStatistics(layers: Layer[]): LayerStatistics[] {
  return layers.map((layer) => {
    const strokes = layer.strokes
    const strokeCount = strokes.length
    const overburnedCount = strokes.filter((s) => s.isOverburned).length

    let totalTemp = 0, totalSpeed = 0, totalPressure = 0
    let depthSum = 0
    const colorValues: number[] = []

    strokes.forEach((s) => {
      totalTemp += s.temperature
      totalSpeed += s.speed
      totalPressure += s.pressure
      const match = s.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (match) {
        const depth = 1 - (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / (3 * 255)
        depthSum += depth
        colorValues.push(depth)
      }
    })

    const avgTemp = strokeCount > 0 ? totalTemp / strokeCount : 0
    const avgSpeed = strokeCount > 0 ? totalSpeed / strokeCount : 0
    const avgPressure = strokeCount > 0 ? totalPressure / strokeCount : 0
    const avgDepth = colorValues.length > 0 ? depthSum / colorValues.length : 0

    let layerUniformity = 100
    if (colorValues.length > 1) {
      const mean = avgDepth
      const variance = colorValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / colorValues.length
      layerUniformity = Math.max(0, 100 - Math.sqrt(variance) * 200)
    }

    return {
      layerId: layer.id,
      layerName: layer.name,
      layerType: layer.type,
      strokeCount,
      overburnedCount,
      averageTemperature: avgTemp,
      averageSpeed: avgSpeed,
      averagePressure: avgPressure,
      uniformity: layerUniformity,
      averageDepth: avgDepth
    }
  })
}

export function calculateParameterStability(strokes: Stroke[]): number {
  if (strokes.length < 2) return 100

  const temps = strokes.map((s) => s.temperature)
  const speeds = strokes.map((s) => s.speed)
  const pressures = strokes.map((s) => s.pressure)

  const tempStability = 100 - (standardDeviation(temps) / 250) * 100
  const speedStability = 100 - (standardDeviation(speeds) / 50) * 100
  const pressureStability = 100 - (standardDeviation(pressures) / 5) * 100

  return Math.max(0, Math.min(100, (tempStability * 0.4 + speedStability * 0.3 + pressureStability * 0.3)))
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

export function calculateColorTransitionScore(strokes: Stroke[]): number {
  if (strokes.length < 2) return 100

  const depths = strokes.map((s) => {
    const match = s.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) return 0.5
    return 1 - (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / (3 * 255)
  })

  let abruptChanges = 0
  for (let i = 1; i < depths.length; i++) {
    const diff = Math.abs(depths[i] - depths[i - 1])
    if (diff > 0.3) abruptChanges++
  }

  return Math.max(0, 100 - (abruptChanges / (depths.length - 1)) * 100)
}

export function calculateScore(strokes: Stroke[], layers: Layer[]): ScoringResult {
  const stats = calculateStatistics(strokes, layers)

  const overburnScore = Math.max(0, 100 - stats.overburnedRisk * 2)
  const colorTransitionScore = stats.colorTransitionScore
  const lineUniformityScore = stats.uniformity
  const parameterStabilityScore = stats.parameterStability

  const totalScore =
    overburnScore * 0.3 +
    colorTransitionScore * 0.2 +
    lineUniformityScore * 0.25 +
    parameterStabilityScore * 0.25

  const grade = getGrade(totalScore)

  const suggestions = generateSuggestions(stats, layers)

  const layerScores = layers.map((layer) => {
    const layerStrokes = strokes.filter((s) => s.layerId === layer.id)
    const layerOverburn = Math.max(0, 100 - (layerStrokes.filter((s) => s.isOverburned).length / Math.max(layerStrokes.length, 1)) * 200)

    const layerStat = stats.layerStats.find((ls) => ls.layerId === layer.id)
    const layerUniformity = layerStat?.uniformity ?? 100
    const layerStability = calculateParameterStability(layerStrokes)

    return {
      layerId: layer.id,
      layerName: layer.name,
      overburnScore: layerOverburn,
      uniformityScore: layerUniformity,
      stabilityScore: layerStability,
      score: layerOverburn * 0.3 + layerUniformity * 0.35 + layerStability * 0.35
    }
  })

  return {
    overburnScore,
    colorTransitionScore,
    lineUniformityScore,
    parameterStabilityScore,
    totalScore,
    grade,
    suggestions,
    layerScores,
    evaluatedAt: Date.now()
  }
}

function getGrade(score: number): ScoreGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function generateSuggestions(stats: Statistics, layers: Layer[]): TrainingSuggestion[] {
  const suggestions: TrainingSuggestion[] = []

  if (stats.overburnedRisk > 20) {
    const overburnLayers = layers.filter((l) =>
      l.strokes.some((s) => s.isOverburned)
    )
    suggestions.push({
      category: 'overburn',
      priority: 'high',
      title: '过烧风险偏高',
      description: `当前过烧风险为 ${stats.overburnedRisk.toFixed(1)}%，建议降低温度至 300°C 以下，或提高笔触速度减少停留时间。`,
      relatedLayerIds: overburnLayers.map((l) => l.id)
    })
  }

  if (stats.uniformity < 60) {
    const lowUniformityLayers = stats.layerStats.filter(
      (ls) => ls.uniformity < 60
    )
    suggestions.push({
      category: 'uniformity',
      priority: 'medium',
      title: '线条均匀度不足',
      description: `当前均匀度为 ${stats.uniformity.toFixed(1)}%，建议保持稳定的笔触速度和压力，避免在绘制过程中频繁改变参数。`,
      relatedLayerIds: lowUniformityLayers.map((ls) => ls.layerId)
    })
  }

  if (stats.colorTransitionScore < 70) {
    suggestions.push({
      category: 'transition',
      priority: 'medium',
      title: '颜色过渡不自然',
      description: '检测到较多颜色突变，建议在深浅变化区域使用渐变温度，避免相邻笔触温差过大。',
      relatedLayerIds: layers.map((l) => l.id)
    })
  }

  if (stats.parameterStability < 60) {
    const unstableLayers = stats.layerStats.filter((ls) => {
      const layerStrokes = layers.find((l) => l.id === ls.layerId)?.strokes ?? []
      return calculateParameterStability(layerStrokes) < 60
    })
    suggestions.push({
      category: 'stability',
      priority: 'high',
      title: '参数稳定性较差',
      description: `参数稳定性为 ${stats.parameterStability.toFixed(1)}%，建议在同一图层中保持参数一致，切换图层时再调整参数。`,
      relatedLayerIds: unstableLayers.map((ls) => ls.layerId)
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      category: 'general',
      priority: 'low',
      title: '表现优秀',
      description: '当前烙画质量良好，继续保持稳定的参数和均匀的笔触。',
      relatedLayerIds: []
    })
  }

  return suggestions
}

export function buildPlaybackFrames(strokes: Stroke[]): PlaybackFrame[] {
  const frames: PlaybackFrame[] = []
  const sorted = [...strokes].sort((a, b) => a.startTime - b.startTime)

  for (let si = 0; si < sorted.length; si++) {
    const stroke = sorted[si]
    for (let pi = 0; pi < stroke.points.length; pi++) {
      frames.push({
        strokeIndex: si,
        layerId: stroke.layerId,
        pointIndex: pi,
        timestamp: stroke.points[pi].timestamp
      })
    }
  }

  return frames
}

export function createDefaultLayers(): Layer[] {
  const now = Date.now()
  return [
    {
      id: generateLayerId(),
      name: '底稿',
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [],
      settings: { temperature: 150, speed: 15, pressure: 2 },
      order: 0,
      type: 'draft',
      createdAt: now
    },
    {
      id: generateLayerId(),
      name: '主线',
      visible: true,
      locked: false,
      opacity: 1,
      strokes: [],
      settings: { temperature: 250, speed: 10, pressure: 4 },
      order: 1,
      type: 'mainline',
      createdAt: now + 1
    },
    {
      id: generateLayerId(),
      name: '阴影',
      visible: true,
      locked: false,
      opacity: 0.8,
      strokes: [],
      settings: { temperature: 350, speed: 5, pressure: 3 },
      order: 2,
      type: 'shadow',
      createdAt: now + 2
    }
  ]
}

export function getTemperatureAtPoint(
  x: number,
  y: number,
  presets: { region: { x: number; y: number; width: number; height: number }; temperature: number }[]
): number | null {
  for (const preset of presets) {
    const r = preset.region
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
      return preset.temperature
    }
  }
  return null
}
