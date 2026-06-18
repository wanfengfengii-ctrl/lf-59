import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Stroke, Scheme, PyrographySettings, Point, Statistics } from '@/types'
import { processStroke, calculateStatistics, generateSchemeId, validateStrokePoints } from '@/utils/pyrography'

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

  const currentScheme = computed<Scheme | undefined>(() => {
    return schemes.value.find((s) => s.id === currentSchemeId.value)
  })

  const currentStrokes = computed<Stroke[]>(() => {
    return currentScheme.value?.strokes || []
  })

  const statistics = computed<Statistics>(() => {
    return calculateStatistics(currentStrokes.value)
  })

  const canUndo = computed<boolean>(() => {
    return history.value.length > 0
  })

  function init() {
    if (schemes.value.length === 0) {
      createScheme('默认方案')
    }
  }

  function createScheme(name: string): Scheme {
    const scheme: Scheme = {
      id: generateSchemeId(),
      name,
      strokes: [],
      createdAt: Date.now()
    }
    schemes.value.push(scheme)
    currentSchemeId.value = scheme.id
    history.value = []
    return scheme
  }

  function switchScheme(schemeId: string) {
    const scheme = schemes.value.find((s) => s.id === schemeId)
    if (scheme) {
      currentSchemeId.value = schemeId
      history.value = []
    }
  }

  function deleteScheme(schemeId: string) {
    const index = schemes.value.findIndex((s) => s.id === schemeId)
    if (index === -1) return
    schemes.value.splice(index, 1)
    if (currentSchemeId.value === schemeId) {
      if (schemes.value.length > 0) {
        currentSchemeId.value = schemes.value[0].id
      } else {
        createScheme('默认方案')
      }
    }
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
  }

  function startDrawing(point: Point) {
    isDrawing.value = true
    currentPoints.value = [point]
  }

  function addPoint(point: Point) {
    if (!isDrawing.value) return
    currentPoints.value.push(point)
  }

  function endDrawing(): Stroke | null {
    if (!isDrawing.value) return null
    isDrawing.value = false

    if (!validateStrokePoints(currentPoints.value)) {
      lastError.value = `路径点数量不足（至少需要 3 个点）`
      currentPoints.value = []
      return null
    }

    const stroke = processStroke(
      currentPoints.value,
      settings.value.temperature,
      settings.value.speed,
      settings.value.pressure
    )

    if (!stroke) {
      lastError.value = '无法生成有效烙痕，请检查参数设置'
      currentPoints.value = []
      return null
    }

    lastError.value = ''

    if (currentScheme.value) {
      history.value.push([...currentScheme.value.strokes])
      currentScheme.value.strokes.push(stroke)
    }

    currentPoints.value = []
    return stroke
  }

  function undo() {
    if (history.value.length === 0 || !currentScheme.value) return
    const previousState = history.value.pop()
    if (previousState !== undefined) {
      currentScheme.value.strokes = previousState
    }
  }

  function clearCanvas() {
    if (!currentScheme.value) return
    history.value.push([...currentScheme.value.strokes])
    currentScheme.value.strokes = []
  }

  function importStrokes(strokesData: unknown): boolean {
    if (!currentScheme.value) return false

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

      const stroke = processStroke(points, temperature, speed, pressure)
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
    lastError.value = `成功导入 ${validStrokes.length} 条路径`
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
    statistics,
    canUndo,
    currentPoints,
    isDrawing,
    lastError,
    init,
    createScheme,
    switchScheme,
    deleteScheme,
    renameScheme,
    updateSettings,
    startDrawing,
    addPoint,
    endDrawing,
    undo,
    clearCanvas,
    importStrokes,
    clearError
  }
})
