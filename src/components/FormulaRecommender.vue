<template>
  <div class="formula-recommender">
    <div v-if="recommendedFormula" class="recommend-card" :class="{ 'has-warning': hasSignificantDeviation }">
      <div class="recommend-header">
        <span class="recommend-icon">💡</span>
        <span class="recommend-title">推荐配方</span>
        <span v-if="boundFormula" class="bound-badge">已绑定</span>
      </div>

      <div class="recommend-formula">
        <span class="formula-name">{{ recommendedFormula.formula.name }}</span>
        <span class="similarity">相似度 {{ (recommendedFormula.similarity * 100).toFixed(0) }}%</span>
      </div>

      <div v-if="recommendedFormula.warnings.length > 0" class="deviation-warnings">
        <div v-for="(warning, idx) in recommendedFormula.warnings" :key="idx" class="warning-item">
          ⚠ {{ warning }}
        </div>
      </div>

      <div class="recommend-params">
        <div class="param-row">
          <span class="param-label">温度</span>
          <span class="param-current">{{ currentSettings.temperature }}°C</span>
          <span class="param-optimal">→ {{ recommendedFormula.formula.temperatureRange.optimal }}°C</span>
          <span :class="['param-status', getTempStatus()]">
            {{ getTempStatusText() }}
          </span>
        </div>
        <div class="param-row">
          <span class="param-label">速度</span>
          <span class="param-current">{{ currentSettings.speed.toFixed(1) }}</span>
          <span class="param-optimal">→ {{ recommendedFormula.formula.speedRange.optimal }}</span>
          <span :class="['param-status', getSpeedStatus()]">
            {{ getSpeedStatusText() }}
          </span>
        </div>
        <div class="param-row">
          <span class="param-label">压力</span>
          <span class="param-current">{{ currentSettings.pressure.toFixed(1) }}</span>
          <span class="param-optimal">→ {{ recommendedFormula.formula.pressureRange.optimal }}</span>
          <span :class="['param-status', getPressureStatus()]">
            {{ getPressureStatusText() }}
          </span>
        </div>
      </div>

      <div class="recommend-actions">
        <button class="btn btn-sm btn-primary" @click="handleApplyRecommended">
          ✓ 应用此配方
        </button>
        <button class="btn btn-sm btn-secondary" @click="$emit('openLab')">
          🧪 配方实验室
        </button>
      </div>
    </div>

    <div v-else class="no-recommend">
      <p class="no-recommend-text">
        {{ formulaStore.enabledFormulas.length === 0 ? '暂无启用的配方' : '暂无匹配的配方' }}
      </p>
      <button class="btn btn-sm btn-secondary" @click="$emit('openLab')">
        管理配方
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFormulaStore } from '@/stores/formula'
import { usePyrographyStore } from '@/stores/pyrography'
import type { PyrographySettings } from '@/types'

const emit = defineEmits(['openLab', 'applyFormula'])

const formulaStore = useFormulaStore()
const pyrographyStore = usePyrographyStore()

const currentSettings = computed<PyrographySettings>(() => ({
  temperature: pyrographyStore.settings.temperature,
  speed: pyrographyStore.settings.speed,
  pressure: pyrographyStore.settings.pressure
}))

const recommendedFormula = computed(() => {
  const layerType = pyrographyStore.currentLayer?.type
  return formulaStore.getRecommendedFormula(currentSettings.value, layerType)
})

const boundFormula = computed(() => {
  if (!pyrographyStore.currentLayer || !pyrographyStore.currentSchemeId) return null
  return formulaStore.getBoundFormula(
    pyrographyStore.currentLayer.id,
    pyrographyStore.currentSchemeId
  )
})

const hasSignificantDeviation = computed(() => {
  if (!recommendedFormula.value) return false
  const maxDeviation = Math.max(
    recommendedFormula.value.deviation.temperature,
    recommendedFormula.value.deviation.speed,
    recommendedFormula.value.deviation.pressure
  )
  return maxDeviation > formulaStore.deviationWarningThreshold
})

function getTempStatus(): string {
  if (!recommendedFormula.value) return 'normal'
  const temp = currentSettings.value.temperature
  const range = recommendedFormula.value.formula.temperatureRange
  if (temp < range.min) return 'low'
  if (temp > range.max) return 'high'
  return 'normal'
}

function getTempStatusText(): string {
  const status = getTempStatus()
  if (status === 'low') return '偏低'
  if (status === 'high') return '偏高'
  return '正常'
}

function getSpeedStatus(): string {
  if (!recommendedFormula.value) return 'normal'
  const speed = currentSettings.value.speed
  const range = recommendedFormula.value.formula.speedRange
  if (speed < range.min) return 'low'
  if (speed > range.max) return 'high'
  return 'normal'
}

function getSpeedStatusText(): string {
  const status = getSpeedStatus()
  if (status === 'low') return '偏慢'
  if (status === 'high') return '偏快'
  return '正常'
}

function getPressureStatus(): string {
  if (!recommendedFormula.value) return 'normal'
  const pressure = currentSettings.value.pressure
  const range = recommendedFormula.value.formula.pressureRange
  if (pressure < range.min) return 'low'
  if (pressure > range.max) return 'high'
  return 'normal'
}

function getPressureStatusText(): string {
  const status = getPressureStatus()
  if (status === 'low') return '偏轻'
  if (status === 'high') return '偏重'
  return '正常'
}

function handleApplyRecommended() {
  if (!recommendedFormula.value) return
  const settings = formulaStore.applyFormula(recommendedFormula.value.formula.id)
  if (settings) {
    pyrographyStore.updateSettings(settings)
    if (pyrographyStore.currentLayer && pyrographyStore.currentSchemeId) {
      formulaStore.bindFormulaToLayer(
        recommendedFormula.value.formula.id,
        pyrographyStore.currentLayer.id,
        pyrographyStore.currentSchemeId
      )
    }
    emit('applyFormula', recommendedFormula.value.formula)
  }
}
</script>

<style scoped>
.formula-recommender {
  width: 100%;
}

.recommend-card {
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border: 1px solid #bae6fd;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommend-card.has-warning {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border-color: #fcd34d;
}

.recommend-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recommend-icon {
  font-size: 16px;
}

.recommend-title {
  font-size: 12px;
  font-weight: 600;
  color: #0369a1;
  flex: 1;
}

.has-warning .recommend-title {
  color: #b45309;
}

.bound-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #86efac;
  color: #166534;
  border-radius: 8px;
  font-weight: 500;
}

.recommend-formula {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.formula-name {
  font-size: 13px;
  font-weight: 700;
  color: #0c4a6e;
}

.has-warning .formula-name {
  color: #92400e;
}

.similarity {
  font-size: 11px;
  color: #0284c7;
  font-weight: 600;
}

.has-warning .similarity {
  color: #d97706;
}

.deviation-warnings {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.warning-item {
  font-size: 10px;
  color: #b45309;
  background: rgba(251, 191, 36, 0.2);
  padding: 4px 8px;
  border-radius: 3px;
}

.recommend-params {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.param-label {
  color: #666;
  width: 30px;
}

.param-current {
  color: #333;
  font-weight: 600;
  min-width: 50px;
}

.param-optimal {
  color: #0284c7;
  font-weight: 500;
  min-width: 50px;
}

.param-status {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
}

.param-status.normal {
  background: #dcfce7;
  color: #166534;
}

.param-status.low,
.param-status.high {
  background: #fed7aa;
  color: #9a3412;
}

.recommend-actions {
  display: flex;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.recommend-actions .btn-sm {
  flex: 1;
  padding: 5px 8px;
  font-size: 11px;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 11px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: #fff;
  color: #444;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.no-recommend {
  text-align: center;
  padding: 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px dashed #ddd;
}

.no-recommend-text {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #888;
}
</style>
