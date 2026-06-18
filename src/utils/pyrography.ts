import type {
  Point,
  Stroke,
  Statistics,
  LayerStatistics,
  ScoringResult,
  ScoreGrade,
  TrainingSuggestion,
  Layer,
  PlaybackFrame,
  Formula,
  FormulaVersion,
  FormulaMatchResult,
  FormulaComparison,
  PyrographySettings,
  LayerType,
  TrialRecord,
  TrialComparison,
  TrialTrendData,
  CalibrationSuggestion,
  AnomalyAlert
} from '@/types'
import {
  MIN_POINTS,
  OVERBURN_TEMPERATURE,
  OVERBURN_DWELL_TIME,
  MIN_TEMPERATURE,
  MIN_SPEED,
  MIN_MOVE_DISTANCE,
  OVERBURN_ANOMALY_RISK,
  UNIFORMITY_ANOMALY_THRESHOLD,
  CONSECUTIVE_ANOMALY_THRESHOLD
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

export function generateFormulaId(): string {
  return `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function createDefaultFormulas(): Formula[] {
  const now = Date.now()
  return [
    {
      id: generateFormulaId(),
      name: '淡色底稿配方',
      description: '适用于底稿层的淡色勾勒，温度较低，不易过烧',
      isFavorite: true,
      isEnabled: true,
      temperatureRange: { min: 120, max: 180, optimal: 150 },
      speedRange: { min: 12, max: 20, optimal: 15 },
      pressureRange: { min: 1.5, max: 3, optimal: 2 },
      applicableLayerTypes: ['draft'],
      targetColorDepth: 0.2,
      overburnThreshold: 320,
      createdAt: now,
      updatedAt: now,
      versions: [],
      currentVersion: 1
    },
    {
      id: generateFormulaId(),
      name: '标准主线配方',
      description: '适用于主线层的中等深度线条，平衡清晰度与过烧风险',
      isFavorite: true,
      isEnabled: true,
      temperatureRange: { min: 220, max: 280, optimal: 250 },
      speedRange: { min: 8, max: 14, optimal: 10 },
      pressureRange: { min: 3, max: 5, optimal: 4 },
      applicableLayerTypes: ['mainline', 'custom'],
      targetColorDepth: 0.5,
      overburnThreshold: 350,
      createdAt: now + 1,
      updatedAt: now + 1,
      versions: [],
      currentVersion: 1
    },
    {
      id: generateFormulaId(),
      name: '深色阴影配方',
      description: '适用于阴影层的深色渲染，温度较高，需注意控制速度',
      isFavorite: false,
      isEnabled: true,
      temperatureRange: { min: 320, max: 400, optimal: 350 },
      speedRange: { min: 3, max: 8, optimal: 5 },
      pressureRange: { min: 2, max: 4.5, optimal: 3 },
      applicableLayerTypes: ['shadow'],
      targetColorDepth: 0.75,
      overburnThreshold: 420,
      createdAt: now + 2,
      updatedAt: now + 2,
      versions: [],
      currentVersion: 1
    }
  ]
}

export function matchFormula(
  settings: PyrographySettings,
  formulas: Formula[],
  layerType?: LayerType
): FormulaMatchResult | null {
  const enabledFormulas = formulas.filter((f) => f.isEnabled)
  if (enabledFormulas.length === 0) return null

  let bestMatch: FormulaMatchResult | null = null

  for (const formula of enabledFormulas) {
    if (layerType && !formula.applicableLayerTypes.includes(layerType)) {
      continue
    }

    const tempDeviation = calculateNormalizedDeviation(
      settings.temperature,
      formula.temperatureRange.optimal,
      formula.temperatureRange.min,
      formula.temperatureRange.max
    )
    const speedDeviation = calculateNormalizedDeviation(
      settings.speed,
      formula.speedRange.optimal,
      formula.speedRange.min,
      formula.speedRange.max
    )
    const pressureDeviation = calculateNormalizedDeviation(
      settings.pressure,
      formula.pressureRange.optimal,
      formula.pressureRange.min,
      formula.pressureRange.max
    )

    const similarity = 1 - (tempDeviation * 0.4 + speedDeviation * 0.35 + pressureDeviation * 0.25)

    const isWithinRange =
      settings.temperature >= formula.temperatureRange.min &&
      settings.temperature <= formula.temperatureRange.max &&
      settings.speed >= formula.speedRange.min &&
      settings.speed <= formula.speedRange.max &&
      settings.pressure >= formula.pressureRange.min &&
      settings.pressure <= formula.pressureRange.max

    const warnings: string[] = []
    if (settings.temperature < formula.temperatureRange.min) {
      warnings.push(`温度低于配方下限 ${formula.temperatureRange.min}°C`)
    } else if (settings.temperature > formula.temperatureRange.max) {
      warnings.push(`温度高于配方上限 ${formula.temperatureRange.max}°C`)
    }
    if (settings.speed < formula.speedRange.min) {
      warnings.push(`速度低于配方下限 ${formula.speedRange.min}`)
    } else if (settings.speed > formula.speedRange.max) {
      warnings.push(`速度高于配方上限 ${formula.speedRange.max}`)
    }
    if (settings.pressure < formula.pressureRange.min) {
      warnings.push(`压力低于配方下限 ${formula.pressureRange.min}`)
    } else if (settings.pressure > formula.pressureRange.max) {
      warnings.push(`压力高于配方上限 ${formula.pressureRange.max}`)
    }

    const result: FormulaMatchResult = {
      formula,
      similarity: Math.max(0, similarity),
      deviation: {
        temperature: tempDeviation,
        speed: speedDeviation,
        pressure: pressureDeviation
      },
      isWithinRange,
      warnings
    }

    if (!bestMatch || result.similarity > bestMatch.similarity) {
      bestMatch = result
    }
  }

  return bestMatch
}

function calculateNormalizedDeviation(
  value: number,
  optimal: number,
  min: number,
  max: number
): number {
  const range = max - min
  if (range === 0) return value === optimal ? 0 : 1
  return Math.abs(value - optimal) / range
}

export function calculateFormulaComparison(formulas: Formula[]): FormulaComparison[] {
  return formulas.map((formula) => {
    const tempRange = formula.temperatureRange.max - formula.temperatureRange.min
    const speedRange = formula.speedRange.max - formula.speedRange.min
    const pressureRange = formula.pressureRange.max - formula.pressureRange.min

    const tempOptimal = formula.temperatureRange.optimal
    const threshold = formula.overburnThreshold

    const tempOverburnRisk = Math.max(0, Math.min(1, (tempOptimal - 200) / 300))
    const thresholdPenalty = Math.max(0, Math.min(1, (400 - threshold) / 300))
    const overburnRiskScore = Math.max(
      0,
      100 - (tempOverburnRisk * 60 + thresholdPenalty * 40)
    )

    const uniformityScore = Math.max(
      0,
      100 - (tempRange / 500) * 30 - (speedRange / 100) * 40 - (pressureRange / 10) * 30
    )
    const colorDepthScore = Math.min(
      100,
      (formula.targetColorDepth / 1) * 100
    )
    const parameterStabilityScore = Math.max(
      0,
      100 - (tempRange / 500) * 40 - (speedRange / 100) * 35 - (pressureRange / 10) * 25
    )

    const overallScore =
      colorDepthScore * 0.25 +
      uniformityScore * 0.25 +
      overburnRiskScore * 0.25 +
      parameterStabilityScore * 0.25

    return {
      formulaId: formula.id,
      formulaName: formula.name,
      colorDepthScore,
      uniformityScore,
      overburnRiskScore,
      parameterStabilityScore,
      overallScore,
      temperatureRange: [formula.temperatureRange.min, formula.temperatureRange.max],
      speedRange: [formula.speedRange.min, formula.speedRange.max],
      pressureRange: [formula.pressureRange.min, formula.pressureRange.max],
      applicableLayers: formula.applicableLayerTypes,
      targetDepth: formula.targetColorDepth
    }
  })
}

export function createFormulaVersion(formula: Formula, note?: string): FormulaVersion {
  return {
    version: formula.versions.length + 1,
    name: formula.name,
    description: formula.description,
    temperatureRange: { ...formula.temperatureRange },
    speedRange: { ...formula.speedRange },
    pressureRange: { ...formula.pressureRange },
    applicableLayerTypes: [...formula.applicableLayerTypes],
    targetColorDepth: formula.targetColorDepth,
    overburnThreshold: formula.overburnThreshold,
    createdAt: Date.now(),
    note
  }
}

export function duplicateFormula(formula: Formula): Formula {
  const now = Date.now()
  return {
    ...formula,
    id: generateFormulaId(),
    name: `${formula.name} 副本`,
    createdAt: now,
    updatedAt: now,
    versions: [],
    currentVersion: 1,
    isFavorite: false
  }
}

export function applyFormulaToSettings(formula: Formula): PyrographySettings {
  return {
    temperature: formula.temperatureRange.optimal,
    speed: formula.speedRange.optimal,
    pressure: formula.pressureRange.optimal
  }
}

export interface FormulaValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFormula(formula: Partial<Formula> & {
  name: string
  temperatureRange: Formula['temperatureRange']
  speedRange: Formula['speedRange']
  pressureRange: Formula['pressureRange']
  targetColorDepth: number
  overburnThreshold: number
}): FormulaValidationResult {
  const errors: string[] = []

  if (!formula.name.trim()) {
    errors.push('请输入配方名称')
  }

  const { temperatureRange, speedRange, pressureRange } = formula

  if (temperatureRange.min > temperatureRange.max) {
    errors.push('温度区间错误：最小值不能大于最大值')
  }
  if (temperatureRange.optimal < temperatureRange.min || temperatureRange.optimal > temperatureRange.max) {
    errors.push('温度最优值必须在区间范围内')
  }

  if (speedRange.min > speedRange.max) {
    errors.push('速度区间错误：最小值不能大于最大值')
  }
  if (speedRange.optimal < speedRange.min || speedRange.optimal > speedRange.max) {
    errors.push('速度最优值必须在区间范围内')
  }

  if (pressureRange.min > pressureRange.max) {
    errors.push('压力区间错误：最小值不能大于最大值')
  }
  if (pressureRange.optimal < pressureRange.min || pressureRange.optimal > pressureRange.max) {
    errors.push('压力最优值必须在区间范围内')
  }

  if (formula.targetColorDepth < 0 || formula.targetColorDepth > 1) {
    errors.push('目标颜色深度必须在 0~1 之间')
  }

  if (formula.overburnThreshold <= 0) {
    errors.push('允许过烧阈值必须为正数')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function generateTrialId(): string {
  return `trial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function detectTrialAnomaly(
  trial: { overburnRisk: number; uniformity: number; totalScore: number }
): { isAnomaly: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (trial.overburnRisk >= OVERBURN_ANOMALY_RISK) {
    reasons.push(`过烧风险过高（${trial.overburnRisk.toFixed(1)}%）`)
  }
  if (trial.uniformity <= UNIFORMITY_ANOMALY_THRESHOLD) {
    reasons.push(`均匀度过低（${trial.uniformity.toFixed(1)}%）`)
  }
  if (trial.totalScore < 60) {
    reasons.push(`综合评分不合格（${trial.totalScore.toFixed(1)}分）`)
  }

  return {
    isAnomaly: reasons.length > 0,
    reasons
  }
}

export function createTrialRecord(params: {
  formulaId: string
  schemeId: string
  layerId: string
  layerType: LayerType
  trialNumber: number
  name?: string
  note?: string
  temperature: number
  speed: number
  pressure: number
  statistics: Statistics
  scoreResult: ScoringResult
}): TrialRecord {
  const { statistics, scoreResult } = params
  const anomaly = detectTrialAnomaly({
    overburnRisk: statistics.overburnedRisk,
    uniformity: statistics.uniformity,
    totalScore: scoreResult.totalScore
  })

  return {
    id: generateTrialId(),
    formulaId: params.formulaId,
    schemeId: params.schemeId,
    layerId: params.layerId,
    layerType: params.layerType,
    trialNumber: params.trialNumber,
    name: params.name || `试验 #${params.trialNumber}`,
    note: params.note,
    temperature: params.temperature,
    speed: params.speed,
    pressure: params.pressure,
    colorDepth: statistics.averageDepth,
    overburnedCount: statistics.overburnedCount,
    totalStrokes: statistics.totalStrokes,
    overburnRisk: statistics.overburnedRisk,
    uniformity: statistics.uniformity,
    parameterStability: statistics.parameterStability,
    colorTransitionScore: statistics.colorTransitionScore,
    totalScore: scoreResult.totalScore,
    grade: scoreResult.grade,
    strokeCount: statistics.totalStrokes,
    appliedAt: Date.now(),
    evaluatedAt: Date.now(),
    isAnomaly: anomaly.isAnomaly,
    anomalyReasons: anomaly.reasons
  }
}

export function buildTrialComparison(trials: TrialRecord[]): TrialComparison {
  return {
    trialIds: trials.map((t) => t.id),
    trialNames: trials.map((t) => t.name),
    metrics: {
      temperature: trials.map((t) => t.temperature),
      speed: trials.map((t) => t.speed),
      pressure: trials.map((t) => t.pressure),
      colorDepth: trials.map((t) => Math.round(t.colorDepth * 100)),
      overburnRisk: trials.map((t) => Math.round(t.overburnRisk)),
      uniformity: trials.map((t) => Math.round(t.uniformity)),
      totalScore: trials.map((t) => Math.round(t.totalScore))
    }
  }
}

export function buildTrialTrendData(trials: TrialRecord[]): TrialTrendData[] {
  const sorted = [...trials].sort((a, b) => a.trialNumber - b.trialNumber)

  const buildPoints = (getValue: (t: TrialRecord) => number) =>
    sorted.map((t) => ({
      trialNumber: t.trialNumber,
      value: getValue(t),
      trialId: t.id
    }))

  return [
    {
      metric: 'temperature',
      label: '温度',
      unit: '°C',
      points: buildPoints((t) => t.temperature)
    },
    {
      metric: 'speed',
      label: '速度',
      unit: '',
      points: buildPoints((t) => t.speed)
    },
    {
      metric: 'pressure',
      label: '压力',
      unit: '',
      points: buildPoints((t) => t.pressure)
    },
    {
      metric: 'colorDepth',
      label: '颜色深度',
      unit: '%',
      points: buildPoints((t) => Math.round(t.colorDepth * 100))
    },
    {
      metric: 'overburnRisk',
      label: '过烧风险',
      unit: '%',
      points: buildPoints((t) => Math.round(t.overburnRisk))
    },
    {
      metric: 'uniformity',
      label: '均匀度',
      unit: '%',
      points: buildPoints((t) => Math.round(t.uniformity))
    },
    {
      metric: 'totalScore',
      label: '综合评分',
      unit: '分',
      points: buildPoints((t) => Math.round(t.totalScore))
    }
  ]
}

export function generateCalibrationSuggestions(
  trials: TrialRecord[],
  formula: Formula
): CalibrationSuggestion[] {
  const suggestions: CalibrationSuggestion[] = []
  if (trials.length < 2) return suggestions

  const recentTrials = [...trials]
    .sort((a, b) => b.trialNumber - a.trialNumber)
    .slice(0, Math.min(5, trials.length))

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const avgTemp = avg(recentTrials.map((t) => t.temperature))
  const avgSpeed = avg(recentTrials.map((t) => t.speed))
  const avgPressure = avg(recentTrials.map((t) => t.pressure))
  const avgDepth = avg(recentTrials.map((t) => t.colorDepth))
  const avgOverburn = avg(recentTrials.map((t) => t.overburnRisk))
  const avgUniformity = avg(recentTrials.map((t) => t.uniformity))

  const trialIds = recentTrials.map((t) => t.id)
  const confidentLevel = Math.min(100, recentTrials.length * 20)

  const targetDepth = formula.targetColorDepth
  const optimalTemp = formula.temperatureRange.optimal
  const optimalSpeed = formula.speedRange.optimal
  const optimalPressure = formula.pressureRange.optimal

  if (avgOverburn > 30) {
    const recommendedTemp = Math.max(
      formula.temperatureRange.min,
      Math.round(avgTemp - 30)
    )
    suggestions.push({
      category: 'overburn',
      priority: 'high',
      title: '降低温度以减少过烧',
      description: `近期平均过烧风险为 ${avgOverburn.toFixed(1)}%，建议降低温度。`,
      currentValue: Math.round(avgTemp),
      recommendedValue: recommendedTemp,
      delta: recommendedTemp - Math.round(avgTemp),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  if (avgUniformity < 60) {
    const recommendedSpeed = Math.max(
      formula.speedRange.min,
      Math.min(formula.speedRange.max, Math.round(avgSpeed * 1.2))
    )
    suggestions.push({
      category: 'uniformity',
      priority: 'high',
      title: '调整速度以提升均匀度',
      description: `近期平均均匀度仅 ${avgUniformity.toFixed(1)}%，建议提高速度并保持稳定。`,
      currentValue: Math.round(avgSpeed),
      recommendedValue: recommendedSpeed,
      delta: recommendedSpeed - Math.round(avgSpeed),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  if (Math.abs(avgDepth - targetDepth) > 0.1) {
    const diff = targetDepth - avgDepth
    const recommendedTemp = Math.max(
      formula.temperatureRange.min,
      Math.min(formula.temperatureRange.max, Math.round(avgTemp + diff * 200))
    )
    suggestions.push({
      category: 'depth',
      priority: 'medium',
      title: '调整温度以匹配目标颜色深度',
      description: `目标深度 ${(targetDepth * 100).toFixed(0)}%，当前平均 ${(avgDepth * 100).toFixed(0)}%。`,
      currentValue: Math.round(avgTemp),
      recommendedValue: recommendedTemp,
      delta: recommendedTemp - Math.round(avgTemp),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  if (Math.abs(avgTemp - optimalTemp) > 30) {
    suggestions.push({
      category: 'temperature',
      priority: 'medium',
      title: '温度偏离配方最优值',
      description: `配方最优温度 ${optimalTemp}°C，近期平均 ${avgTemp.toFixed(0)}°C。`,
      currentValue: Math.round(avgTemp),
      recommendedValue: optimalTemp,
      delta: optimalTemp - Math.round(avgTemp),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  if (Math.abs(avgSpeed - optimalSpeed) > 3) {
    suggestions.push({
      category: 'speed',
      priority: 'medium',
      title: '速度偏离配方最优值',
      description: `配方最优速度 ${optimalSpeed}，近期平均 ${avgSpeed.toFixed(1)}。`,
      currentValue: Math.round(avgSpeed),
      recommendedValue: optimalSpeed,
      delta: optimalSpeed - Math.round(avgSpeed),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  if (Math.abs(avgPressure - optimalPressure) > 1.5) {
    suggestions.push({
      category: 'pressure',
      priority: 'low',
      title: '压力偏离配方最优值',
      description: `配方最优压力 ${optimalPressure}，近期平均 ${avgPressure.toFixed(1)}。`,
      currentValue: Number(avgPressure.toFixed(1)),
      recommendedValue: optimalPressure,
      delta: Number((optimalPressure - avgPressure).toFixed(1)),
      confidentLevel,
      basedOnTrials: trialIds
    })
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function detectConsecutiveAnomalies(
  trials: TrialRecord[],
  formulaId: string
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = []
  const sorted = [...trials]
    .filter((t) => t.formulaId === formulaId)
    .sort((a, b) => a.trialNumber - b.trialNumber)

  if (sorted.length < CONSECUTIVE_ANOMALY_THRESHOLD) return alerts

  const checkConsecutive = (
    condition: (t: TrialRecord) => boolean,
    alertType: AnomalyAlert['alertType'],
    severity: AnomalyAlert['severity'],
    title: string,
    buildDesc: (count: number) => string
  ) => {
    let consecutive = 0
    let consecutiveIds: string[] = []

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (condition(sorted[i])) {
        consecutive++
        consecutiveIds.unshift(sorted[i].id)
        if (consecutive >= CONSECUTIVE_ANOMALY_THRESHOLD) {
          alerts.push({
            id: generateAlertId(),
            formulaId,
            alertType,
            severity,
            title,
            description: buildDesc(consecutive),
            consecutiveCount: consecutive,
            trialIds: [...consecutiveIds],
            triggeredAt: Date.now(),
            acknowledged: false
          })
          break
        }
      } else {
        break
      }
    }
  }

  checkConsecutive(
    (t) => t.overburnRisk >= OVERBURN_ANOMALY_RISK,
    'consecutive_overburn',
    'danger',
    '连续过烧风险预警',
    (count) => `最近连续 ${count} 次试验过烧风险超过阈值，建议立即降低温度或提高速度。`
  )

  checkConsecutive(
    (t) => t.uniformity <= UNIFORMITY_ANOMALY_THRESHOLD,
    'consecutive_low_uniformity',
    'warning',
    '连续低均匀度预警',
    (count) => `最近连续 ${count} 次试验均匀度低于阈值，建议保持稳定的笔触速度和压力。`
  )

  checkConsecutive(
    (t) => t.totalScore < 60,
    'consecutive_low_score',
    'warning',
    '连续低评分预警',
    (count) => `最近连续 ${count} 次试验综合评分不合格，建议检查参数设置和绘制手法。`
  )

  const recent5 = sorted.slice(-5)
  if (recent5.length >= 4) {
    const temps = recent5.map((t) => t.temperature)
    const speeds = recent5.map((t) => t.speed)
    const tempDrift = Math.abs(temps[temps.length - 1] - temps[0]) > 80
    const speedDrift = Math.abs(speeds[speeds.length - 1] - speeds[0]) > 8
    if (tempDrift || speedDrift) {
      alerts.push({
        id: generateAlertId(),
        formulaId,
        alertType: 'parameter_drift',
        severity: 'warning',
        title: '参数漂移预警',
        description: '近期试验参数波动较大，建议固定参数后再进行试验对比。',
        consecutiveCount: recent5.length,
        trialIds: recent5.map((t) => t.id),
        triggeredAt: Date.now(),
        acknowledged: false
      })
    }
  }

  return alerts
}

export function applyTrialToFormulaVersion(
  formula: Formula,
  trial: TrialRecord,
  note?: string
): Formula {
  const newVersion: FormulaVersion = {
    version: formula.versions.length + 1,
    name: `${formula.name} - 试验版`,
    description: `基于试验 #${trial.trialNumber} 自动生成：${trial.name}`,
    temperatureRange: {
      min: Math.max(formula.temperatureRange.min, trial.temperature - 30),
      max: Math.min(500, trial.temperature + 30),
      optimal: trial.temperature
    },
    speedRange: {
      min: Math.max(0.1, trial.speed - 3),
      max: Math.min(100, trial.speed + 3),
      optimal: trial.speed
    },
    pressureRange: {
      min: Math.max(0.1, trial.pressure - 1),
      max: Math.min(10, trial.pressure + 1),
      optimal: trial.pressure
    },
    applicableLayerTypes: [...formula.applicableLayerTypes],
    targetColorDepth: Number(trial.colorDepth.toFixed(2)),
    overburnThreshold: Math.max(200, trial.temperature + 20),
    createdAt: Date.now(),
    note: note || `试验得分 ${trial.totalScore.toFixed(1)} (${trial.grade})`
  }

  return {
    ...formula,
    versions: [...formula.versions, newVersion],
    currentVersion: newVersion.version,
    updatedAt: Date.now()
  }
}

export function createFormulaBranchFromTrial(
  formula: Formula,
  trial: TrialRecord,
  branchName?: string
): Formula {
  const now = Date.now()
  return {
    id: generateFormulaId(),
    name: branchName || `${formula.name} - 分支 (试验${trial.trialNumber})`,
    description: `从试验 #${trial.trialNumber} 分叉的新配方：${trial.name}`,
    isFavorite: false,
    isEnabled: true,
    temperatureRange: {
      min: Math.max(1, trial.temperature - 30),
      max: Math.min(500, trial.temperature + 30),
      optimal: trial.temperature
    },
    speedRange: {
      min: Math.max(0.1, trial.speed - 3),
      max: Math.min(100, trial.speed + 3),
      optimal: trial.speed
    },
    pressureRange: {
      min: Math.max(0.1, trial.pressure - 1),
      max: Math.min(10, trial.pressure + 1),
      optimal: trial.pressure
    },
    applicableLayerTypes: [...formula.applicableLayerTypes],
    targetColorDepth: Number(trial.colorDepth.toFixed(2)),
    overburnThreshold: Math.max(200, trial.temperature + 20),
    createdAt: now,
    updatedAt: now,
    versions: [],
    currentVersion: 1
  }
}
