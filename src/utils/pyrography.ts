import type { Point, Stroke, Statistics } from '@/types'
import {
  MIN_POINTS,
  OVERBURN_TEMPERATURE,
  OVERBURN_DWELL_TIME,
  MIN_TEMPERATURE,
  MIN_SPEED
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

export function processStroke(
  points: Point[],
  temperature: number,
  speed: number,
  pressure: number
): Stroke | null {
  if (!validateStrokePoints(points) || !validateSettings(temperature, speed)) {
    return null
  }

  const overburnedRegions: number[] = []
  let maxIntensity = 0
  let totalDwellTime = 0

  for (let i = 1; i < points.length; i++) {
    const dwellTime = calculateDwellTime(points[i - 1], points[i])
    totalDwellTime += dwellTime
    const intensity = calculateHeatIntensity(temperature, dwellTime, speed, pressure)
    maxIntensity = Math.max(maxIntensity, intensity)
    if (checkOverburn(temperature, dwellTime)) {
      overburnedRegions.push(i)
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
    overburnedRegions
  }
}

export function calculateStatistics(strokes: Stroke[]): Statistics {
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

  return {
    totalStrokes,
    overburnedCount,
    overburnedRisk,
    uniformity,
    averageDepth,
    depthDistribution
  }
}
