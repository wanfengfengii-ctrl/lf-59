import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Formula,
  FormulaBinding,
  FormulaMatchResult,
  FormulaComparison,
  PyrographySettings,
  LayerType
} from '@/types'
import {
  createDefaultFormulas,
  generateFormulaId,
  matchFormula,
  calculateFormulaComparison,
  createFormulaVersion,
  duplicateFormula,
  applyFormulaToSettings
} from '@/utils/pyrography'
import { MAX_FORMULAS, MAX_FORMULA_VERSIONS, DEFAULT_DEVIATION_WARNING_THRESHOLD } from '@/types'

export const useFormulaStore = defineStore('formula', () => {
  const formulas = ref<Formula[]>([])
  const bindings = ref<FormulaBinding[]>([])
  const selectedFormulaId = ref<string>('')
  const comparisonFormulaIds = ref<string[]>([])
  const lastError = ref<string>('')
  const deviationWarningThreshold = ref(DEFAULT_DEVIATION_WARNING_THRESHOLD)

  const enabledFormulas = computed(() =>
    formulas.value.filter((f) => f.isEnabled)
  )

  const favoriteFormulas = computed(() =>
    formulas.value.filter((f) => f.isFavorite)
  )

  const selectedFormula = computed(() =>
    formulas.value.find((f) => f.id === selectedFormulaId.value) || null
  )

  const comparisonFormulas = computed(() =>
    formulas.value.filter((f) => comparisonFormulaIds.value.includes(f.id))
  )

  const formulaComparisons = computed((): FormulaComparison[] => {
    return calculateFormulaComparison(comparisonFormulas.value)
  })

  function init() {
    if (formulas.value.length === 0) {
      formulas.value = createDefaultFormulas()
      if (formulas.value.length > 0) {
        selectedFormulaId.value = formulas.value[0].id
      }
    }
  }

  function createFormula(
    data: Partial<Formula> & { name: string }
  ): Formula | null {
    if (formulas.value.length >= MAX_FORMULAS) {
      lastError.value = `最多支持 ${MAX_FORMULAS} 个配方`
      return null
    }

    const now = Date.now()
    const formula: Formula = {
      id: generateFormulaId(),
      name: data.name,
      description: data.description || '',
      isFavorite: false,
      isEnabled: true,
      temperatureRange: data.temperatureRange || { min: 150, max: 300, optimal: 220 },
      speedRange: data.speedRange || { min: 5, max: 15, optimal: 10 },
      pressureRange: data.pressureRange || { min: 2, max: 6, optimal: 3 },
      applicableLayerTypes: data.applicableLayerTypes || ['mainline', 'custom'],
      targetColorDepth: data.targetColorDepth ?? 0.5,
      overburnThreshold: data.overburnThreshold || 350,
      createdAt: now,
      updatedAt: now,
      versions: [],
      currentVersion: 1
    }

    formulas.value.push(formula)
    selectedFormulaId.value = formula.id
    lastError.value = ''
    return formula
  }

  function updateFormula(formulaId: string, updates: Partial<Formula>, saveVersion = false, versionNote?: string) {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (!formula) return

    if (saveVersion && formula.versions.length < MAX_FORMULA_VERSIONS) {
      const version = createFormulaVersion(formula, versionNote)
      formula.versions.push(version)
      formula.currentVersion = version.version
    }

    Object.assign(formula, updates)
    formula.updatedAt = Date.now()
    lastError.value = ''
  }

  function deleteFormula(formulaId: string) {
    const idx = formulas.value.findIndex((f) => f.id === formulaId)
    if (idx === -1) return

    formulas.value.splice(idx, 1)

    bindings.value = bindings.value.filter((b) => b.formulaId !== formulaId)

    comparisonFormulaIds.value = comparisonFormulaIds.value.filter((id) => id !== formulaId)

    if (selectedFormulaId.value === formulaId) {
      selectedFormulaId.value = formulas.value[0]?.id || ''
    }

    lastError.value = ''
  }

  function toggleFavorite(formulaId: string) {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (formula) {
      formula.isFavorite = !formula.isFavorite
      formula.updatedAt = Date.now()
    }
  }

  function toggleEnabled(formulaId: string) {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (formula) {
      formula.isEnabled = !formula.isEnabled
      formula.updatedAt = Date.now()
    }
  }

  function copyFormula(formulaId: string): Formula | null {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (!formula) return null
    if (formulas.value.length >= MAX_FORMULAS) {
      lastError.value = `最多支持 ${MAX_FORMULAS} 个配方`
      return null
    }

    const copy = duplicateFormula(formula)
    formulas.value.push(copy)
    selectedFormulaId.value = copy.id
    lastError.value = ''
    return copy
  }

  function restoreVersion(formulaId: string, versionNum: number) {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (!formula) return

    const version = formula.versions.find((v) => v.version === versionNum)
    if (!version) return

    if (formula.versions.length < MAX_FORMULA_VERSIONS) {
      const currentVersion = createFormulaVersion(formula, '还原前自动保存')
      formula.versions.push(currentVersion)
    }

    formula.name = version.name
    formula.description = version.description
    formula.temperatureRange = { ...version.temperatureRange }
    formula.speedRange = { ...version.speedRange }
    formula.pressureRange = { ...version.pressureRange }
    formula.applicableLayerTypes = [...version.applicableLayerTypes]
    formula.targetColorDepth = version.targetColorDepth
    formula.overburnThreshold = version.overburnThreshold
    formula.updatedAt = Date.now()
    formula.currentVersion = versionNum
  }

  function deleteVersion(formulaId: string, versionNum: number) {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (!formula) return

    const idx = formula.versions.findIndex((v) => v.version === versionNum)
    if (idx !== -1) {
      formula.versions.splice(idx, 1)
      formula.updatedAt = Date.now()
    }
  }

  function bindFormulaToLayer(formulaId: string, layerId: string, schemeId: string) {
    const existing = bindings.value.find(
      (b) => b.layerId === layerId && b.schemeId === schemeId
    )
    if (existing) {
      existing.formulaId = formulaId
      existing.boundAt = Date.now()
    } else {
      bindings.value.push({
        formulaId,
        layerId,
        schemeId,
        boundAt: Date.now()
      })
    }
  }

  function unbindFormulaFromLayer(layerId: string, schemeId: string) {
    const idx = bindings.value.findIndex(
      (b) => b.layerId === layerId && b.schemeId === schemeId
    )
    if (idx !== -1) {
      bindings.value.splice(idx, 1)
    }
  }

  function getBoundFormula(layerId: string, schemeId: string): Formula | null {
    const binding = bindings.value.find(
      (b) => b.layerId === layerId && b.schemeId === schemeId
    )
    if (!binding) return null
    return formulas.value.find((f) => f.id === binding.formulaId) || null
  }

  function getBindingsForScheme(schemeId: string): FormulaBinding[] {
    return bindings.value.filter((b) => b.schemeId === schemeId)
  }

  function getRecommendedFormula(
    settings: PyrographySettings,
    layerType?: LayerType
  ): FormulaMatchResult | null {
    return matchFormula(settings, formulas.value, layerType)
  }

  function addToComparison(formulaId: string) {
    if (!comparisonFormulaIds.value.includes(formulaId)) {
      comparisonFormulaIds.value.push(formulaId)
    }
  }

  function removeFromComparison(formulaId: string) {
    comparisonFormulaIds.value = comparisonFormulaIds.value.filter((id) => id !== formulaId)
  }

  function clearComparison() {
    comparisonFormulaIds.value = []
  }

  function toggleComparison(formulaId: string) {
    if (comparisonFormulaIds.value.includes(formulaId)) {
      removeFromComparison(formulaId)
    } else {
      addToComparison(formulaId)
    }
  }

  function applyFormula(formulaId: string): PyrographySettings | null {
    const formula = formulas.value.find((f) => f.id === formulaId)
    if (!formula) return null
    return applyFormulaToSettings(formula)
  }

  function selectFormula(formulaId: string) {
    selectedFormulaId.value = formulaId
  }

  function setDeviationWarningThreshold(threshold: number) {
    deviationWarningThreshold.value = Math.max(0, Math.min(1, threshold))
  }

  function exportFormulas(): string {
    const data = {
      version: '1.0.0',
      formulas: JSON.parse(JSON.stringify(formulas.value)),
      exportedAt: Date.now()
    }
    return JSON.stringify(data, null, 2)
  }

  function importFormulas(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr)
      if (!data.formulas || !Array.isArray(data.formulas)) {
        lastError.value = '导入失败：缺少配方数据'
        return false
      }

      const imported: Formula[] = data.formulas.map((f: Formula) => ({
        ...f,
        id: generateFormulaId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))

      const total = formulas.value.length + imported.length
      if (total > MAX_FORMULAS) {
        lastError.value = `导入后配方数量超过上限 ${MAX_FORMULAS}`
        return false
      }

      formulas.value.push(...imported)
      lastError.value = `成功导入 ${imported.length} 个配方`
      return true
    } catch {
      lastError.value = '导入失败：JSON 格式不正确'
      return false
    }
  }

  function clearError() {
    lastError.value = ''
  }

  return {
    formulas,
    bindings,
    selectedFormulaId,
    selectedFormula,
    comparisonFormulaIds,
    comparisonFormulas,
    formulaComparisons,
    enabledFormulas,
    favoriteFormulas,
    lastError,
    deviationWarningThreshold,
    init,
    createFormula,
    updateFormula,
    deleteFormula,
    toggleFavorite,
    toggleEnabled,
    copyFormula,
    restoreVersion,
    deleteVersion,
    bindFormulaToLayer,
    unbindFormulaFromLayer,
    getBoundFormula,
    getBindingsForScheme,
    getRecommendedFormula,
    addToComparison,
    removeFromComparison,
    clearComparison,
    toggleComparison,
    applyFormula,
    selectFormula,
    setDeviationWarningThreshold,
    exportFormulas,
    importFormulas,
    clearError
  }
})
