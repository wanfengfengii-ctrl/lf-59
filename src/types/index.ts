export interface Point {
  x: number
  y: number
  timestamp: number
  pressure: number
}

export interface Stroke {
  id: string
  points: Point[]
  temperature: number
  speed: number
  pressure: number
  color: string
  isOverburned: boolean
  overburnedRegions: number[]
}

export interface Scheme {
  id: string
  name: string
  strokes: Stroke[]
  createdAt: number
}

export interface PyrographySettings {
  temperature: number
  speed: number
  pressure: number
}

export interface Statistics {
  totalStrokes: number
  overburnedCount: number
  overburnedRisk: number
  uniformity: number
  averageDepth: number
  depthDistribution: number[]
}

export const MIN_TEMPERATURE = 1
export const MAX_TEMPERATURE = 500
export const MIN_SPEED = 0.1
export const MAX_SPEED = 100
export const MIN_PRESSURE = 0.1
export const MAX_PRESSURE = 10
export const MIN_POINTS = 3
export const OVERBURN_TEMPERATURE = 350
export const OVERBURN_DWELL_TIME = 500
