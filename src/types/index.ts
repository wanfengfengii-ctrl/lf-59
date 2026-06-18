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
  layerId: string
  startTime: number
  endTime: number
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokes: Stroke[]
  settings: PyrographySettings
  order: number
  type: LayerType
  createdAt: number
}

export type LayerType = 'draft' | 'mainline' | 'shadow' | 'custom'

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  draft: '底稿',
  mainline: '主线',
  shadow: '阴影',
  custom: '自定义'
}

export interface TemperaturePreset {
  id: string
  name: string
  region: {
    x: number
    y: number
    width: number
    height: number
  }
  temperature: number
  createdAt: number
}

export interface Scheme {
  id: string
  name: string
  strokes: Stroke[]
  layers: Layer[]
  temperaturePresets: TemperaturePreset[]
  settings: PyrographySettings
  currentLayerId: string
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
  layerStats: LayerStatistics[]
  parameterStability: number
  colorTransitionScore: number
}

export interface LayerStatistics {
  layerId: string
  layerName: string
  layerType: LayerType
  strokeCount: number
  overburnedCount: number
  averageTemperature: number
  averageSpeed: number
  averagePressure: number
  uniformity: number
  averageDepth: number
}

export interface ScoringResult {
  overburnScore: number
  colorTransitionScore: number
  lineUniformityScore: number
  parameterStabilityScore: number
  totalScore: number
  grade: ScoreGrade
  suggestions: TrainingSuggestion[]
  layerScores: LayerScore[]
  evaluatedAt: number
}

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface LayerScore {
  layerId: string
  layerName: string
  overburnScore: number
  uniformityScore: number
  stabilityScore: number
  score: number
}

export interface TrainingSuggestion {
  category: SuggestionCategory
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  relatedLayerIds: string[]
}

export type SuggestionCategory = 'overburn' | 'uniformity' | 'transition' | 'stability' | 'general'

export interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean
  currentTime: number
  totalDuration: number
  speed: PlaybackSpeed
  progress: number
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4

export interface PlaybackFrame {
  strokeIndex: number
  layerId: string
  pointIndex: number
  timestamp: number
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
export const POINT_SUPPLEMENT_INTERVAL = 80
export const MIN_MOVE_DISTANCE = 2

export const DEFAULT_LAYER_OPACITY = 1
export const MAX_LAYERS = 10

export const LAYER_COLORS: Record<LayerType, string> = {
  draft: '#4299e1',
  mainline: '#48bb78',
  shadow: '#9f7aea',
  custom: '#ed8936'
}

export interface ExportData {
  version: string
  schemes: Scheme[]
  scores: ScoringResult[]
  exportedAt: number
}
