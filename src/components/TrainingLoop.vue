<template>
  <div class="training-loop">
    <div class="loop-header">
      <h3 class="loop-title">🔬 烙画工艺配方训练回路</h3>
      <p class="loop-subtitle">记录试验 · 对比分析 · 智能校准 · 持续优化</p>
    </div>

    <div class="formula-selector">
      <label class="selector-label">选择配方：</label>
      <select
        v-model="currentFormulaId"
        class="formula-select"
        @change="handleFormulaChange"
      >
        <option value="">-- 请选择配方 --</option>
        <option v-for="f in formulaStore.formulas" :key="f.id" :value="f.id">
          {{ f.name }}
        </option>
      </select>
      <span v-if="trainingStore.unacknowledgedAlerts.length > 0" class="alert-badge">
        ⚠ {{ trainingStore.unacknowledgedAlerts.length }}
      </span>
    </div>

    <div class="loop-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: trainingStore.activeTab === tab.key }]"
        @click="trainingStore.activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.key === 'alerts' && trainingStore.unacknowledgedAlerts.length > 0" class="tab-count">
          {{ trainingStore.unacknowledgedAlerts.length }}
        </span>
        <span v-if="tab.key === 'compare' && trainingStore.selectedTrialIds.length > 0" class="tab-count">
          {{ trainingStore.selectedTrialIds.length }}
        </span>
      </button>
    </div>

    <div class="tab-content">
      <div v-if="trainingStore.activeTab === 'records'" class="tab-panel">
        <div class="records-toolbar">
          <button
            class="btn btn-primary btn-sm"
            :disabled="!currentFormulaId || !pyrographyStore.currentStrokes.length"
            @click="showRecordDialog = true"
          >
            📝 记录当前试验
          </button>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="trainingStore.selectedTrialIds.length < 2"
            @click="trainingStore.activeTab = 'compare'"
          >
            📊 对比所选 ({{ trainingStore.selectedTrialIds.length }})
          </button>
          <button
            v-if="trainingStore.selectedTrialIds.length > 0"
            class="btn btn-secondary btn-sm"
            @click="trainingStore.clearTrialSelection()"
          >
            清空选择
          </button>
          <span class="records-count">共 {{ trainingStore.formulaTrials.length }} 条记录</span>
        </div>

        <div class="trial-list">
          <div
            v-for="trial in trainingStore.formulaTrials"
            :key="trial.id"
            :class="['trial-card', { selected: trainingStore.selectedTrialIds.includes(trial.id), anomaly: trial.isAnomaly }]"
          >
            <div class="trial-header" @click="trainingStore.toggleTrialSelection(trial.id)">
              <input
                type="checkbox"
                :checked="trainingStore.selectedTrialIds.includes(trial.id)"
                @click.stop
                @change="trainingStore.toggleTrialSelection(trial.id)"
              />
              <div class="trial-title-row">
                <span class="trial-name">{{ trial.name }}</span>
                <span :class="['grade-badge', `grade-${trial.grade}`]">{{ trial.grade }}</span>
                <span v-if="trial.isAnomaly" class="anomaly-tag">异常</span>
              </div>
              <span class="trial-date">{{ formatDate(trial.appliedAt) }}</span>
            </div>

            <div class="trial-params">
              <div class="param-cell">
                <span class="param-label">温度</span>
                <span class="param-value temp">{{ trial.temperature }}°C</span>
              </div>
              <div class="param-cell">
                <span class="param-label">速度</span>
                <span class="param-value speed">{{ trial.speed }}</span>
              </div>
              <div class="param-cell">
                <span class="param-label">压力</span>
                <span class="param-value pressure">{{ trial.pressure }}</span>
              </div>
              <div class="param-cell">
                <span class="param-label">深度</span>
                <span class="param-value">{{ (trial.colorDepth * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <div class="trial-metrics">
              <div class="metric-cell">
                <span class="metric-label">评分</span>
                <div class="metric-bar">
                  <div class="metric-bar-fill score" :style="{ width: trial.totalScore + '%' }"></div>
                </div>
                <span class="metric-value">{{ trial.totalScore.toFixed(0) }}</span>
              </div>
              <div class="metric-cell">
                <span class="metric-label">过烧</span>
                <div class="metric-bar">
                  <div class="metric-bar-fill overburn" :style="{ width: trial.overburnRisk + '%' }"></div>
                </div>
                <span class="metric-value">{{ trial.overburnRisk.toFixed(0) }}%</span>
              </div>
              <div class="metric-cell">
                <span class="metric-label">均匀度</span>
                <div class="metric-bar">
                  <div class="metric-bar-fill uniformity" :style="{ width: trial.uniformity + '%' }"></div>
                </div>
                <span class="metric-value">{{ trial.uniformity.toFixed(0) }}%</span>
              </div>
            </div>

            <div v-if="trial.anomalyReasons.length > 0" class="anomaly-reasons">
              <span v-for="(reason, idx) in trial.anomalyReasons" :key="idx" class="anomaly-reason">
                ⚠ {{ reason }}
              </span>
            </div>

            <div v-if="trial.note" class="trial-note">
              📌 {{ trial.note }}
            </div>

            <div class="trial-actions">
              <button class="btn btn-xs btn-primary" @click.stop="handleSaveAsVersion(trial.id)">
                💾 保存为版本
              </button>
              <button class="btn btn-xs btn-primary" @click.stop="handleSaveAsBranch(trial.id)">
                🌿 新建分支
              </button>
              <button class="btn btn-xs btn-secondary" @click.stop="handleEditTrial(trial)">
                ✏️
              </button>
              <button class="btn btn-xs btn-danger" @click.stop="handleDeleteTrial(trial.id)">
                🗑
              </button>
            </div>
          </div>

          <div v-if="!currentFormulaId" class="empty-state">
            <p>请先选择一个配方</p>
          </div>
          <div v-else-if="trainingStore.formulaTrials.length === 0" class="empty-state">
            <p>暂无试验记录</p>
            <p class="empty-hint">在画布上绘制后，点击"记录当前试验"保存结果</p>
          </div>
        </div>
      </div>

      <div v-if="trainingStore.activeTab === 'compare'" class="tab-panel">
        <div v-if="trainingStore.trialComparison" class="compare-section">
          <div class="compare-header">
            <h4>试验对比分析</h4>
            <span class="compare-count">对比 {{ trainingStore.selectedTrialIds.length }} 条试验</span>
          </div>
          <div class="compare-table-wrapper">
            <table class="compare-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th v-for="(name, idx) in trainingStore.trialComparison.trialNames" :key="idx">
                    {{ name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>🌡️ 温度 (°C)</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.temperature" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.temperature) }">
                    {{ v }}
                  </td>
                </tr>
                <tr>
                  <td>⚡ 速度</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.speed" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.speed) }">
                    {{ v }}
                  </td>
                </tr>
                <tr>
                  <td>💪 压力</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.pressure" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.pressure) }">
                    {{ v }}
                  </td>
                </tr>
                <tr>
                  <td>🎨 颜色深度 (%)</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.colorDepth" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.colorDepth, false) }">
                    {{ v }}
                  </td>
                </tr>
                <tr>
                  <td>🔥 过烧风险 (%)</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.overburnRisk" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.overburnRisk) }">
                    {{ v }}
                  </td>
                </tr>
                <tr>
                  <td>📐 均匀度 (%)</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.uniformity" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.uniformity, false) }">
                    {{ v }}
                  </td>
                </tr>
                <tr class="total-row">
                  <td>⭐ 综合评分</td>
                  <td v-for="(v, idx) in trainingStore.trialComparison.metrics.totalScore" :key="idx" :class="{ highlight: isExtreme(v, trainingStore.trialComparison.metrics.totalScore, false), 'best-score': v === Math.max(...trainingStore.trialComparison.metrics.totalScore) }">
                    <strong>{{ v }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>请至少选择 2 条试验进行对比</p>
          <button class="btn btn-primary btn-sm" @click="trainingStore.activeTab = 'records'">
            去选择
          </button>
        </div>
      </div>

      <div v-if="trainingStore.activeTab === 'trend'" class="tab-panel">
        <div v-if="trainingStore.formulaTrials.length >= 2" class="trend-section">
          <div class="trend-header">
            <h4>参数与指标趋势图</h4>
            <select v-model="selectedTrendMetric" class="trend-select">
              <option v-for="t in trainingStore.trendData" :key="t.metric" :value="t.metric">
                {{ t.label }} {{ t.unit ? `(${t.unit})` : '' }}
              </option>
            </select>
          </div>
          <div class="trend-chart">
            <v-chart :option="trendChartOption" autoresize style="height: 280px;" />
          </div>
          <div class="trend-stats">
            <div class="trend-stat">
              <span class="stat-label">平均值</span>
              <span class="stat-value">{{ trendStats.avg.toFixed(1) }}{{ currentTrendUnit }}</span>
            </div>
            <div class="trend-stat">
              <span class="stat-label">最高值</span>
              <span class="stat-value">{{ trendStats.max.toFixed(1) }}{{ currentTrendUnit }}</span>
            </div>
            <div class="trend-stat">
              <span class="stat-label">最低值</span>
              <span class="stat-value">{{ trendStats.min.toFixed(1) }}{{ currentTrendUnit }}</span>
            </div>
            <div class="trend-stat">
              <span class="stat-label">趋势</span>
              <span :class="['stat-value', trendStats.direction]">
                {{ trendStats.direction === 'up' ? '📈 上升' : trendStats.direction === 'down' ? '📉 下降' : '➡️ 稳定' }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>至少需要 2 条试验记录才能显示趋势图</p>
        </div>
      </div>

      <div v-if="trainingStore.activeTab === 'calibration'" class="tab-panel">
        <div v-if="trainingStore.calibrationSuggestions.length > 0" class="calibration-section">
          <div class="calibration-header">
            <h4>智能校准建议</h4>
            <span class="suggestion-count">{{ trainingStore.calibrationSuggestions.length }} 条建议</span>
          </div>
          <div class="suggestion-list">
            <div
              v-for="(suggestion, idx) in trainingStore.calibrationSuggestions"
              :key="idx"
              :class="['suggestion-card', `priority-${suggestion.priority}`]"
            >
              <div class="suggestion-header">
                <span :class="['priority-badge', suggestion.priority]">
                  {{ suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低' }}
                </span>
                <span class="suggestion-title">{{ suggestion.title }}</span>
                <span class="confidence-badge">置信度 {{ suggestion.confidentLevel }}%</span>
              </div>
              <p class="suggestion-desc">{{ suggestion.description }}</p>
              <div class="suggestion-values">
                <div class="value-row">
                  <span class="value-label">当前值</span>
                  <span class="value-current">{{ suggestion.currentValue }}{{ getUnit(suggestion.category) }}</span>
                </div>
                <span class="arrow">→</span>
                <div class="value-row">
                  <span class="value-label">建议值</span>
                  <span class="value-recommended">{{ suggestion.recommendedValue }}{{ getUnit(suggestion.category) }}</span>
                </div>
                <span :class="['delta', suggestion.delta > 0 ? 'positive' : 'negative']">
                  {{ suggestion.delta > 0 ? '+' : '' }}{{ suggestion.delta }}{{ getUnit(suggestion.category) }}
                </span>
              </div>
              <button class="btn btn-sm btn-primary" @click="handleApplySuggestion(suggestion)">
                应用到当前设置
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>暂无校准建议</p>
          <p class="empty-hint">至少完成 2 次试验后，系统会自动生成校准建议</p>
        </div>
      </div>

      <div v-if="trainingStore.activeTab === 'alerts'" class="tab-panel">
        <div v-if="trainingStore.unacknowledgedAlerts.length > 0 || allFormulaAlerts.length > 0" class="alerts-section">
          <div class="alerts-header">
            <h4>异常预警</h4>
            <button
              v-if="trainingStore.unacknowledgedAlerts.length > 0"
              class="btn btn-secondary btn-sm"
              @click="trainingStore.acknowledgeAllAlerts(currentFormulaId || undefined)"
            >
              ✓ 全部确认
            </button>
          </div>
          <div class="alert-list">
            <div
              v-for="alert in visibleAlerts"
              :key="alert.id"
              :class="['alert-card', alert.severity, { acknowledged: alert.acknowledged }]"
            >
              <div class="alert-icon">
                {{ alert.severity === 'danger' ? '🚨' : '⚠️' }}
              </div>
              <div class="alert-content">
                <div class="alert-title-row">
                  <span class="alert-title">{{ alert.title }}</span>
                  <span class="alert-count">连续 {{ alert.consecutiveCount }} 次</span>
                </div>
                <p class="alert-desc">{{ alert.description }}</p>
                <span class="alert-time">{{ formatDate(alert.triggeredAt) }}</span>
              </div>
              <button
                v-if="!alert.acknowledged"
                class="btn btn-xs btn-secondary"
                @click="trainingStore.acknowledgeAlert(alert.id)"
              >
                确认
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>🎉 当前没有异常预警</p>
          <p class="empty-hint">继续保持稳定的参数和良好的绘制手法</p>
        </div>
      </div>
    </div>

    <div v-if="showRecordDialog" class="dialog-overlay" @click.self="showRecordDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h4>记录试验结果</h4>
          <button class="close-btn" @click="showRecordDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>试验名称</label>
            <input
              type="text"
              v-model="recordForm.name"
              class="form-input"
              :placeholder="`试验 #${nextTrialNumber}`"
            />
          </div>
          <div class="form-group">
            <label>备注（可选）</label>
            <textarea
              v-model="recordForm.note"
              class="form-textarea"
              rows="2"
              placeholder="记录本次试验的特殊情况或观察"
            ></textarea>
          </div>
          <div class="form-group">
            <label>使用参数</label>
            <div class="current-params">
              <span>🌡️ {{ pyrographyStore.settings.temperature }}°C</span>
              <span>⚡ {{ pyrographyStore.settings.speed }}</span>
              <span>💪 {{ pyrographyStore.settings.pressure }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="showRecordDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleRecordTrial">确认记录</button>
        </div>
      </div>
    </div>

    <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h4>编辑试验记录</h4>
          <button class="close-btn" @click="showEditDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>试验名称</label>
            <input type="text" v-model="editForm.name" class="form-input" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="editForm.note" class="form-textarea" rows="2"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="showEditDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleSaveEdit">保存</button>
        </div>
      </div>
    </div>

    <div v-if="trainingStore.lastError" class="error-message">
      {{ trainingStore.lastError }}
      <button class="close-btn" @click="trainingStore.clearError()">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { useFormulaStore } from '@/stores/formula'
import { usePyrographyStore } from '@/stores/pyrography'
import { useTrainingStore } from '@/stores/training'
import type { TrialRecord, CalibrationSuggestion } from '@/types'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent])

const formulaStore = useFormulaStore()
const pyrographyStore = usePyrographyStore()
const trainingStore = useTrainingStore()

const tabs: { key: 'records' | 'compare' | 'trend' | 'calibration' | 'alerts'; label: string }[] = [
  { key: 'records', label: '试验记录' },
  { key: 'compare', label: '对比分析' },
  { key: 'trend', label: '趋势图' },
  { key: 'calibration', label: '校准建议' },
  { key: 'alerts', label: '异常预警' }
]

const currentFormulaId = ref('')
const selectedTrendMetric = ref<string>('totalScore')
const showRecordDialog = ref(false)
const showEditDialog = ref(false)
const editingTrialId = ref('')

const recordForm = ref({
  name: '',
  note: ''
})

const editForm = ref({
  name: '',
  note: ''
})

const nextTrialNumber = computed(() =>
  currentFormulaId.value ? trainingStore.getNextTrialNumber(currentFormulaId.value) : 1
)

const allFormulaAlerts = computed(() =>
  trainingStore.alerts.filter((a) => a.formulaId === currentFormulaId.value)
)

const visibleAlerts = computed(() => {
  const unacked = trainingStore.unacknowledgedAlerts
  const acked = allFormulaAlerts.value.filter((a) => a.acknowledged)
  return [...unacked, ...acked]
})

const currentTrendData = computed(() =>
  trainingStore.trendData.find((t) => t.metric === selectedTrendMetric.value)
)

const currentTrendUnit = computed(() => currentTrendData.value?.unit || '')

const trendStats = computed(() => {
  const points = currentTrendData.value?.points || []
  if (points.length === 0) {
    return { avg: 0, max: 0, min: 0, direction: 'stable' as const }
  }
  const values = points.map((p) => p.value)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const max = Math.max(...values)
  const min = Math.min(...values)

  let direction: 'up' | 'down' | 'stable' = 'stable'
  if (values.length >= 2) {
    const first = values.slice(0, Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(values.length / 2)
    const second = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / values.slice(Math.floor(values.length / 2)).length
    const diff = second - first
    if (Math.abs(diff) < Math.abs(avg) * 0.05) {
      direction = 'stable'
    } else if (diff > 0) {
      direction = 'up'
    } else {
      direction = 'down'
    }
  }

  return { avg, max, min, direction }
})

const trendChartOption = computed(() => {
  const data = currentTrendData.value
  if (!data) return {}
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const p = params[0] as { axisValue: number; value: number }
        return `试验 #${p.axisValue}<br/>${data.label}: ${p.value}${data.unit}`
      }
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.points.map((p) => `#${p.trialNumber}`),
      name: '试验次数',
      nameLocation: 'middle',
      nameGap: 25,
      axisLabel: { fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: data.unit || data.label,
      nameLocation: 'middle',
      nameGap: 35,
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        type: 'line',
        data: data.points.map((p) => p.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#667eea' },
        itemStyle: { color: '#667eea' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0)' }
            ]
          }
        }
      }
    ]
  }
})

function handleFormulaChange() {
  trainingStore.setSelectedFormula(currentFormulaId.value)
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isExtreme(value: number, arr: number[], isLowBetter = true): boolean {
  if (arr.length < 2) return false
  const sorted = [...arr].sort((a, b) => a - b)
  if (isLowBetter) {
    return value === sorted[0] || value === sorted[sorted.length - 1]
  }
  return value === sorted[sorted.length - 1]
}

function getUnit(category: string): string {
  if (category === 'temperature' || category === 'overburn' || category === 'depth') return '°C'
  if (category === 'speed' || category === 'uniformity') return ''
  if (category === 'pressure') return ''
  return ''
}

function handleRecordTrial() {
  if (!currentFormulaId.value) return
  if (!pyrographyStore.currentLayer || !pyrographyStore.currentScheme) return

  const trial = trainingStore.recordTrial({
    formulaId: currentFormulaId.value,
    schemeId: pyrographyStore.currentSchemeId,
    layerId: pyrographyStore.currentLayer.id,
    layerType: pyrographyStore.currentLayer.type,
    name: recordForm.value.name.trim() || undefined,
    note: recordForm.value.note.trim() || undefined,
    temperature: pyrographyStore.settings.temperature,
    speed: pyrographyStore.settings.speed,
    pressure: pyrographyStore.settings.pressure
  })

  if (trial) {
    showRecordDialog.value = false
    recordForm.value = { name: '', note: '' }
  }
}

function handleEditTrial(trial: TrialRecord) {
  editingTrialId.value = trial.id
  editForm.value.name = trial.name
  editForm.value.note = trial.note || ''
  showEditDialog.value = true
}

function handleSaveEdit() {
  trainingStore.updateTrial(editingTrialId.value, {
    name: editForm.value.name.trim() || '未命名试验',
    note: editForm.value.note.trim() || undefined
  })
  showEditDialog.value = false
}

function handleDeleteTrial(trialId: string) {
  if (confirm('确定删除这条试验记录吗？删除试验不会影响作品数据。')) {
    trainingStore.deleteTrial(trialId)
  }
}

function handleSaveAsVersion(trialId: string) {
  const note = prompt('版本说明（可选）：')
  trainingStore.saveTrialAsFormulaVersion(trialId, note || undefined)
}

function handleSaveAsBranch(trialId: string) {
  const name = prompt('新配方分支名称：')
  if (name !== null) {
    trainingStore.saveTrialAsFormulaBranch(trialId, name.trim() || undefined)
  }
}

function handleApplySuggestion(suggestion: CalibrationSuggestion) {
  trainingStore.applyCalibrationToSettings(suggestion)
}

watch(
  () => formulaStore.selectedFormulaId,
  (id) => {
    if (id && id !== currentFormulaId.value) {
      currentFormulaId.value = id
      handleFormulaChange()
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!currentFormulaId.value && formulaStore.formulas.length > 0) {
    currentFormulaId.value = formulaStore.formulas[0].id
    handleFormulaChange()
  }
})
</script>

<style scoped>
.training-loop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.loop-header {
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.loop-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.loop-subtitle {
  margin: 0;
  font-size: 11px;
  color: #888;
}

.formula-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.selector-label {
  font-size: 11px;
  color: #555;
  font-weight: 500;
}

.formula-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.formula-select:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.alert-badge {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: #ef4444;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.loop-tabs {
  display: flex;
  gap: 2px;
  background: #f0f0f0;
  padding: 3px;
  border-radius: 6px;
  flex-wrap: wrap;
}

.tab-btn {
  flex: 1;
  min-width: 60px;
  padding: 5px 6px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.tab-btn.active {
  background: #fff;
  color: #667eea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-count {
  background: #667eea;
  color: white;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.records-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.records-count {
  margin-left: auto;
  font-size: 10px;
  color: #888;
}

.trial-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trial-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  transition: all 0.2s;
}

.trial-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.04);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.trial-card.anomaly {
  border-color: #fca5a5;
}

.trial-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.trial-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.trial-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.grade-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.grade-A { background: #d1fae5; color: #065f46; }
.grade-B { background: #dbeafe; color: #1e40af; }
.grade-C { background: #fef3c7; color: #92400e; }
.grade-D { background: #fed7aa; color: #9a3412; }
.grade-F { background: #fee2e2; color: #991b1b; }

.anomaly-tag {
  background: #fee2e2;
  color: #dc2626;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 600;
}

.trial-date {
  font-size: 10px;
  color: #999;
  flex-shrink: 0;
}

.trial-params {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.param-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
  background: #f8f9fa;
  border-radius: 4px;
  text-align: center;
}

.param-label {
  font-size: 9px;
  color: #999;
}

.param-value {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.param-value.temp { color: #ff6b35; }
.param-value.speed { color: #4299e1; }
.param-value.pressure { color: #48bb78; }

.trial-metrics {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}

.metric-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-label {
  font-size: 10px;
  color: #666;
  width: 42px;
  flex-shrink: 0;
}

.metric-bar {
  flex: 1;
  height: 6px;
  background: #e5e5e5;
  border-radius: 3px;
  overflow: hidden;
}

.metric-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.metric-bar-fill.score { background: linear-gradient(90deg, #667eea, #764ba2); }
.metric-bar-fill.overburn { background: linear-gradient(90deg, #fbbf24, #ef4444); }
.metric-bar-fill.uniformity { background: linear-gradient(90deg, #48bb78, #9ae6b4); }

.metric-value {
  font-size: 10px;
  font-weight: 600;
  color: #444;
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.anomaly-reasons {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
}

.anomaly-reason {
  font-size: 10px;
  color: #dc2626;
  background: #fef2f2;
  padding: 3px 6px;
  border-radius: 3px;
}

.trial-note {
  font-size: 10px;
  color: #666;
  background: #fffbeb;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  line-height: 1.4;
}

.trial-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm { padding: 4px 8px; font-size: 11px; }
.btn-xs { padding: 3px 6px; font-size: 10px; }

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) { opacity: 0.9; }

.btn-secondary {
  background: #fff;
  color: #444;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) { background: #f5f5f5; }

.btn-danger {
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-danger:hover:not(:disabled) { background: #fef2f2; }

.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: #999;
}

.empty-state p {
  margin: 0 0 6px 0;
  font-size: 12px;
}

.empty-hint {
  font-size: 10px !important;
  color: #bbb;
}

.compare-header,
.trend-header,
.calibration-header,
.alerts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.compare-header h4,
.trend-header h4,
.calibration-header h4,
.alerts-header h4 {
  margin: 0;
  font-size: 13px;
  color: #333;
}

.compare-count,
.suggestion-count {
  font-size: 10px;
  color: #888;
}

.compare-table-wrapper {
  overflow-x: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.compare-table th,
.compare-table td {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.compare-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #555;
  font-size: 10px;
  position: sticky;
  left: 0;
}

.compare-table td:first-child {
  background: #f8f9fa;
  font-weight: 500;
  color: #555;
  text-align: left;
  position: sticky;
  left: 0;
}

.compare-table td.highlight {
  background: #fef3c7;
  font-weight: 600;
}

.compare-table tr.total-row {
  background: #faf5ff;
}

.compare-table tr.total-row td {
  font-size: 12px;
}

.compare-table td.best-score {
  background: #d1fae5 !important;
  color: #065f46;
}

.trend-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  background: #fff;
  outline: none;
}

.trend-chart {
  background: #fff;
  border-radius: 6px;
  padding: 8px;
}

.trend-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.trend-stat {
  background: #fff;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 9px;
  color: #999;
  margin-bottom: 3px;
}

.stat-value {
  font-size: 13px;
  font-weight: 700;
  color: #333;
}

.stat-value.up { color: #ef4444; }
.stat-value.down { color: #48bb78; }

.suggestion-list,
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px;
  border-left: 4px solid;
}

.suggestion-card.priority-high { border-left-color: #ef4444; }
.suggestion-card.priority-medium { border-left-color: #f59e0b; }
.suggestion-card.priority-low { border-left-color: #48bb78; }

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.priority-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
}

.priority-badge.high { background: #fee2e2; color: #dc2626; }
.priority-badge.medium { background: #fef3c7; color: #d97706; }
.priority-badge.low { background: #d1fae5; color: #059669; }

.suggestion-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.confidence-badge {
  font-size: 10px;
  color: #667eea;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 8px;
}

.suggestion-desc {
  font-size: 11px;
  color: #666;
  margin: 0 0 8px 0;
  line-height: 1.5;
}

.suggestion-values {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  flex-wrap: wrap;
}

.value-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.value-label {
  font-size: 9px;
  color: #999;
}

.value-current {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.value-recommended {
  font-size: 12px;
  font-weight: 700;
  color: #667eea;
}

.arrow {
  font-size: 14px;
  color: #aaa;
}

.delta {
  font-size: 11px;
  font-weight: 600;
}

.delta.positive { color: #ef4444; }
.delta.negative { color: #48bb78; }

.alert-card {
  background: #fff;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid;
}

.alert-card.warning { border-color: #fde68a; background: #fffbeb; }
.alert-card.danger { border-color: #fca5a5; background: #fef2f2; }
.alert-card.acknowledged { opacity: 0.6; }

.alert-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.alert-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.alert-count {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 6px;
  border-radius: 8px;
  color: #555;
}

.alert-desc {
  font-size: 11px;
  color: #666;
  margin: 0 0 4px 0;
  line-height: 1.4;
}

.alert-time {
  font-size: 10px;
  color: #999;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.dialog {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e5e5;
}

.dialog-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover { color: #666; }

.dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 11px;
  color: #555;
  font-weight: 500;
}

.form-input,
.form-textarea {
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.form-textarea { resize: vertical; }

.current-params {
  display: flex;
  gap: 12px;
  padding: 8px 10px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  color: #444;
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid #e5e5e5;
}

.error-message {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 1100px) {
  .training-loop {
    max-height: 600px;
  }
}
</style>
