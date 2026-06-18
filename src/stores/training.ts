import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  TrialRecord,
  AnomalyAlert,
  TrialComparison,
  TrialTrendData,
  CalibrationSuggestion,
  LayerType
} from '@/types'
import { MAX_TRIALS_PER_FORMULA, MAX_FORMULA_VERSIONS, MAX_FORMULAS } from '@/types'
import {
  createTrialRecord,
  buildTrialComparison,
  buildTrialTrendData,
  generateCalibrationSuggestions,
  detectConsecutiveAnomalies,
  applyTrialToFormulaVersion,
  createFormulaBranchFromTrial
} from '@/utils/pyrography'
import { useFormulaStore } from './formula'
import { usePyrographyStore } from './pyrography'

export const useTrainingStore = defineStore('training', () => {
  const trials = ref<TrialRecord[]>([])
  const alerts = ref<AnomalyAlert[]>([])
  const selectedFormulaId = ref<string>('')
  const selectedTrialIds = ref<string[]>([])
  const lastError = ref<string>('')
  const activeTab = ref<'records' | 'compare' | 'trend' | 'calibration' | 'alerts'>('records')

  const formulaTrials = computed(() =>
    trials.value
      .filter((t) => t.formulaId === selectedFormulaId.value)
      .sort((a, b) => b.trialNumber - a.trialNumber)
  )

  const selectedTrials = computed(() =>
    trials.value.filter((t) => selectedTrialIds.value.includes(t.id))
  )

  const unacknowledgedAlerts = computed(() =>
    alerts.value.filter((a) => !a.acknowledged && a.formulaId === selectedFormulaId.value)
  )

  const trialComparison = computed((): TrialComparison | null => {
    if (selectedTrials.value.length < 2) return null
    return buildTrialComparison(selectedTrials.value)
  })

  const trendData = computed((): TrialTrendData[] => {
    return buildTrialTrendData(formulaTrials.value)
  })

  const calibrationSuggestions = computed((): CalibrationSuggestion[] => {
    const formulaStore = useFormulaStore()
    const formula = formulaStore.formulas.find((f) => f.id === selectedFormulaId.value)
    if (!formula) return []
    return generateCalibrationSuggestions(formulaTrials.value, formula)
  })

  function setSelectedFormula(formulaId: string) {
    selectedFormulaId.value = formulaId
    selectedTrialIds.value = []
  }

  function getNextTrialNumber(formulaId: string): number {
    const formulaTrialsList = trials.value.filter((t) => t.formulaId === formulaId)
    if (formulaTrialsList.length === 0) return 1
    return Math.max(...formulaTrialsList.map((t) => t.trialNumber)) + 1
  }

  function recordTrial(params: {
    formulaId: string
    schemeId: string
    layerId: string
    layerType: LayerType
    name?: string
    note?: string
    temperature: number
    speed: number
    pressure: number
  }): TrialRecord | null {
    const pyrographyStore = usePyrographyStore()

    if (!pyrographyStore.currentScheme || !pyrographyStore.currentLayers) {
      lastError.value = '缺少当前方案数据'
      return null
    }

    const currentStrokes = pyrographyStore.currentStrokes
    if (currentStrokes.length === 0) {
      lastError.value = '当前方案没有笔触数据，请先绘制'
      return null
    }

    if (!pyrographyStore.currentScore) {
      pyrographyStore.evaluateScore()
    }

    const stats = pyrographyStore.statistics
    const score = pyrographyStore.currentScore
    if (!score) {
      lastError.value = '评分计算失败'
      return null
    }

    const existingCount = trials.value.filter((t) => t.formulaId === params.formulaId).length
    if (existingCount >= MAX_TRIALS_PER_FORMULA) {
      lastError.value = `每个配方最多支持 ${MAX_TRIALS_PER_FORMULA} 条试验记录`
      return null
    }

    const trialNumber = getNextTrialNumber(params.formulaId)

    const trial = createTrialRecord({
      ...params,
      trialNumber,
      statistics: stats,
      scoreResult: score
    })

    trials.value.push(trial)

    const newAlerts = detectConsecutiveAnomalies(trials.value, params.formulaId)
    for (const alert of newAlerts) {
      const existing = alerts.value.find(
        (a) => a.formulaId === alert.formulaId && a.alertType === alert.alertType && !a.acknowledged
      )
      if (!existing) {
        alerts.value.push(alert)
      }
    }

    lastError.value = ''
    return trial
  }

  function updateTrial(trialId: string, updates: Partial<Pick<TrialRecord, 'name' | 'note'>>) {
    const trial = trials.value.find((t) => t.id === trialId)
    if (trial) {
      Object.assign(trial, updates)
    }
  }

  function deleteTrial(trialId: string) {
    const idx = trials.value.findIndex((t) => t.id === trialId)
    if (idx !== -1) {
      trials.value.splice(idx, 1)
      selectedTrialIds.value = selectedTrialIds.value.filter((id) => id !== trialId)
    }
  }

  function deleteAllFormulaTrials(formulaId: string) {
    trials.value = trials.value.filter((t) => t.formulaId !== formulaId)
    selectedTrialIds.value = selectedTrialIds.value.filter(
      (id) => !trials.value.find((t) => t.id === id) || trials.value.find((t) => t.id === id)?.formulaId !== formulaId
    )
  }

  function toggleTrialSelection(trialId: string) {
    const idx = selectedTrialIds.value.indexOf(trialId)
    if (idx === -1) {
      selectedTrialIds.value.push(trialId)
    } else {
      selectedTrialIds.value.splice(idx, 1)
    }
  }

  function clearTrialSelection() {
    selectedTrialIds.value = []
  }

  function applyCalibrationToSettings(suggestion: CalibrationSuggestion) {
    const pyrographyStore = usePyrographyStore()
    const updates: Record<string, number> = {}
    if (suggestion.category === 'temperature' || suggestion.category === 'overburn' || suggestion.category === 'depth') {
      updates.temperature = suggestion.recommendedValue
    } else if (suggestion.category === 'speed' || suggestion.category === 'uniformity') {
      updates.speed = suggestion.recommendedValue
    } else if (suggestion.category === 'pressure') {
      updates.pressure = suggestion.recommendedValue
    }
    if (Object.keys(updates).length > 0) {
      pyrographyStore.updateSettings(updates)
    }
  }

  function saveTrialAsFormulaVersion(trialId: string, note?: string): boolean {
    const formulaStore = useFormulaStore()
    const trial = trials.value.find((t) => t.id === trialId)
    if (!trial) {
      lastError.value = '试验记录不存在'
      return false
    }

    const formula = formulaStore.formulas.find((f) => f.id === trial.formulaId)
    if (!formula) {
      lastError.value = '关联配方不存在'
      return false
    }

    if (formula.versions.length >= MAX_FORMULA_VERSIONS) {
      lastError.value = `最多支持 ${MAX_FORMULA_VERSIONS} 个版本`
      return false
    }

    const updated = applyTrialToFormulaVersion(formula, trial, note)
    formulaStore.updateFormula(formula.id, {
      versions: updated.versions,
      currentVersion: updated.currentVersion,
      temperatureRange: updated.temperatureRange,
      speedRange: updated.speedRange,
      pressureRange: updated.pressureRange,
      targetColorDepth: updated.targetColorDepth,
      overburnThreshold: updated.overburnThreshold
    })
    lastError.value = `已保存为 v${updated.currentVersion} 版本`
    return true
  }

  function saveTrialAsFormulaBranch(trialId: string, branchName?: string): string | null {
    const formulaStore = useFormulaStore()
    const trial = trials.value.find((t) => t.id === trialId)
    if (!trial) {
      lastError.value = '试验记录不存在'
      return null
    }

    const formula = formulaStore.formulas.find((f) => f.id === trial.formulaId)
    if (!formula) {
      lastError.value = '关联配方不存在'
      return null
    }

    if (formulaStore.formulas.length >= MAX_FORMULAS) {
      lastError.value = `最多支持 ${MAX_FORMULAS} 个配方`
      return null
    }

    const newFormula = createFormulaBranchFromTrial(formula, trial, branchName)
    formulaStore.formulas.push(newFormula)
    formulaStore.selectedFormulaId = newFormula.id
    lastError.value = `已创建新配方分支"${newFormula.name}"`
    return newFormula.id
  }

  function acknowledgeAlert(alertId: string) {
    const alert = alerts.value.find((a) => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
    }
  }

  function acknowledgeAllAlerts(formulaId?: string) {
    for (const alert of alerts.value) {
      if (!formulaId || alert.formulaId === formulaId) {
        alert.acknowledged = true
      }
    }
  }

  function clearError() {
    lastError.value = ''
  }

  function exportTrials(formulaId?: string): string {
    const data = {
      version: '1.0.0',
      trials: formulaId
        ? JSON.parse(JSON.stringify(trials.value.filter((t) => t.formulaId === formulaId)))
        : JSON.parse(JSON.stringify(trials.value)),
      alerts: formulaId
        ? JSON.parse(JSON.stringify(alerts.value.filter((a) => a.formulaId === formulaId)))
        : JSON.parse(JSON.stringify(alerts.value)),
      exportedAt: Date.now()
    }
    return JSON.stringify(data, null, 2)
  }

  function importTrials(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr)
      if (!data.trials || !Array.isArray(data.trials)) {
        lastError.value = '导入失败：缺少试验数据'
        return false
      }

      const existingIds = new Set(trials.value.map((t) => t.id))
      const imported = data.trials.filter((t: TrialRecord) => !existingIds.has(t.id))
      trials.value.push(...imported)

      if (data.alerts && Array.isArray(data.alerts)) {
        const existingAlertIds = new Set(alerts.value.map((a) => a.id))
        const importedAlerts = data.alerts.filter((a: AnomalyAlert) => !existingAlertIds.has(a.id))
        alerts.value.push(...importedAlerts)
      }

      lastError.value = `成功导入 ${imported.length} 条试验记录`
      return true
    } catch {
      lastError.value = '导入失败：JSON 格式不正确'
      return false
    }
  }

  function getAllTrialRecords(): TrialRecord[] {
    return [...trials.value]
  }

  function getAllAlerts(): AnomalyAlert[] {
    return [...alerts.value]
  }

  function loadAllData(importedTrials: TrialRecord[], importedAlerts: AnomalyAlert[]) {
    trials.value = [...importedTrials]
    alerts.value = [...importedAlerts]
  }

  return {
    trials,
    alerts,
    selectedFormulaId,
    selectedTrialIds,
    lastError,
    activeTab,
    formulaTrials,
    selectedTrials,
    unacknowledgedAlerts,
    trialComparison,
    trendData,
    calibrationSuggestions,
    setSelectedFormula,
    getNextTrialNumber,
    recordTrial,
    updateTrial,
    deleteTrial,
    deleteAllFormulaTrials,
    toggleTrialSelection,
    clearTrialSelection,
    applyCalibrationToSettings,
    saveTrialAsFormulaVersion,
    saveTrialAsFormulaBranch,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearError,
    exportTrials,
    importTrials,
    getAllTrialRecords,
    getAllAlerts,
    loadAllData
  }
})
