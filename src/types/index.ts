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

export interface Formula {
  id: string
  name: string
  description: string
  isFavorite: boolean
  isEnabled: boolean
  temperatureRange: {
    min: number
    max: number
    optimal: number
  }
  speedRange: {
    min: number
    max: number
    optimal: number
  }
  pressureRange: {
    min: number
    max: number
    optimal: number
  }
  applicableLayerTypes: LayerType[]
  targetColorDepth: number
  overburnThreshold: number
  createdAt: number
  updatedAt: number
  versions: FormulaVersion[]
  currentVersion: number
}

export interface FormulaVersion {
  version: number
  name: string
  description: string
  temperatureRange: Formula['temperatureRange']
  speedRange: Formula['speedRange']
  pressureRange: Formula['pressureRange']
  applicableLayerTypes: LayerType[]
  targetColorDepth: number
  overburnThreshold: number
  createdAt: number
  note?: string
}

export interface FormulaBinding {
  formulaId: string
  layerId: string
  schemeId: string
  boundAt: number
}

export interface FormulaMatchResult {
  formula: Formula
  similarity: number
  deviation: {
    temperature: number
    speed: number
    pressure: number
  }
  isWithinRange: boolean
  warnings: string[]
}

export interface FormulaComparison {
  formulaId: string
  formulaName: string
  colorDepthScore: number
  uniformityScore: number
  overburnRiskScore: number
  parameterStabilityScore: number
  overallScore: number
  temperatureRange: [number, number]
  speedRange: [number, number]
  pressureRange: [number, number]
  applicableLayers: string[]
  targetDepth: number
}

export const MAX_FORMULAS = 50
export const MAX_FORMULA_VERSIONS = 20
export const DEFAULT_DEVIATION_WARNING_THRESHOLD = 0.15

export const MAX_TRIALS_PER_FORMULA = 100
export const CONSECUTIVE_ANOMALY_THRESHOLD = 3
export const OVERBURN_ANOMALY_RISK = 50
export const UNIFORMITY_ANOMALY_THRESHOLD = 40

export interface TrialRecord {
  id: string
  formulaId: string
  schemeId: string
  layerId: string
  layerType: LayerType
  trialNumber: number
  name: string
  note?: string
  temperature: number
  speed: number
  pressure: number
  colorDepth: number
  overburnedCount: number
  totalStrokes: number
  overburnRisk: number
  uniformity: number
  parameterStability: number
  colorTransitionScore: number
  totalScore: number
  grade: ScoreGrade
  strokeCount: number
  appliedAt: number
  evaluatedAt: number
  isAnomaly: boolean
  anomalyReasons: string[]
}

export interface CalibrationSuggestion {
  category: 'temperature' | 'speed' | 'pressure' | 'depth' | 'uniformity' | 'overburn'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  currentValue: number
  recommendedValue: number
  delta: number
  confidentLevel: number
  basedOnTrials: string[]
}

export interface AnomalyAlert {
  id: string
  formulaId: string
  alertType: 'consecutive_overburn' | 'consecutive_low_uniformity' | 'consecutive_low_score' | 'parameter_drift'
  severity: 'warning' | 'danger'
  title: string
  description: string
  consecutiveCount: number
  trialIds: string[]
  triggeredAt: number
  acknowledged: boolean
}

export interface TrialComparison {
  trialIds: string[]
  metrics: {
    temperature: number[]
    speed: number[]
    pressure: number[]
    colorDepth: number[]
    overburnRisk: number[]
    uniformity: number[]
    totalScore: number[]
  }
  trialNames: string[]
}

export interface TrialTrendPoint {
  trialNumber: number
  value: number
  trialId: string
}

export interface TrialTrendData {
  metric: string
  label: string
  unit: string
  points: TrialTrendPoint[]
}

export interface ExportData {
  version: string
  schemes: Scheme[]
  scores: ScoringResult[]
  formulas: Formula[]
  formulaBindings: FormulaBinding[]
  trialRecords: TrialRecord[]
  anomalyAlerts: AnomalyAlert[]
  exportedAt: number
}
