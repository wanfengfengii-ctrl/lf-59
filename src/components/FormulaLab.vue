<template>
  <div class="formula-lab">
    <div class="lab-header">
      <h3 class="lab-title">🧪 烙画工艺配方实验室</h3>
      <p class="lab-subtitle">管理、对比和优化你的烙画配方</p>
    </div>

    <div class="lab-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.key === 'compare' && store.comparisonFormulaIds.length > 0" class="tab-badge">
          {{ store.comparisonFormulaIds.length }}
        </span>
      </button>
    </div>

    <div v-if="activeTab === 'list'" class="tab-content">
      <div class="formula-toolbar">
        <button class="btn btn-primary btn-sm" @click="handleCreateFormula">
          + 新建配方
        </button>
        <div class="filter-group">
          <button
            :class="['filter-btn', { active: filter === 'all' }]"
            @click="filter = 'all'"
          >全部</button>
          <button
            :class="['filter-btn', { active: filter === 'favorite' }]"
            @click="filter = 'favorite'"
          >⭐ 收藏</button>
          <button
            :class="['filter-btn', { active: filter === 'enabled' }]"
            @click="filter = 'enabled'"
          >✓ 启用</button>
        </div>
      </div>

      <div class="formula-list">
        <div
          v-for="formula in filteredFormulas"
          :key="formula.id"
          :class="['formula-card', { selected: formula.id === store.selectedFormulaId }]"
          @click="store.selectFormula(formula.id)"
        >
          <div class="formula-card-header">
            <div class="formula-name-row">
              <span class="formula-name">{{ formula.name }}</span>
              <button
                class="icon-btn favorite-btn"
                :class="{ active: formula.isFavorite }"
                @click.stop="store.toggleFavorite(formula.id)"
                :title="formula.isFavorite ? '取消收藏' : '收藏'"
              >
                {{ formula.isFavorite ? '⭐' : '☆' }}
              </button>
            </div>
            <span :class="['status-badge', formula.isEnabled ? 'enabled' : 'disabled']">
              {{ formula.isEnabled ? '启用' : '停用' }}
            </span>
          </div>

          <p class="formula-desc">{{ formula.description || '暂无描述' }}</p>

          <div class="formula-params">
            <div class="param-item">
              <span class="param-label">温度</span>
              <span class="param-value temp">{{ formula.temperatureRange.optimal }}°C</span>
              <span class="param-range">{{ formula.temperatureRange.min }}-{{ formula.temperatureRange.max }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">速度</span>
              <span class="param-value speed">{{ formula.speedRange.optimal }}</span>
              <span class="param-range">{{ formula.speedRange.min }}-{{ formula.speedRange.max }}</span>
            </div>
            <div class="param-item">
              <span class="param-label">压力</span>
              <span class="param-value pressure">{{ formula.pressureRange.optimal }}</span>
              <span class="param-range">{{ formula.pressureRange.min }}-{{ formula.pressureRange.max }}</span>
            </div>
          </div>

          <div class="formula-meta">
            <span class="meta-item">目标深度: {{ (formula.targetColorDepth * 100).toFixed(0) }}%</span>
            <span class="meta-item">版本: v{{ formula.currentVersion }}</span>
          </div>

          <div class="formula-tags">
            <span v-for="layerType in formula.applicableLayerTypes" :key="layerType" class="layer-tag">
              {{ LAYER_TYPE_LABELS[layerType] }}
            </span>
          </div>

          <div class="formula-actions">
            <button class="btn btn-sm btn-secondary" @click.stop="handleEditFormula(formula.id)">
              ✏️ 编辑
            </button>
            <button class="btn btn-sm btn-primary" @click.stop="handleApplyFormula(formula.id)">
              ✓ 应用到当前图层
            </button>
            <button
              :class="['btn btn-sm', store.comparisonFormulaIds.includes(formula.id) ? 'btn-primary' : 'btn-secondary']"
              @click.stop="store.toggleComparison(formula.id)"
            >
              {{ store.comparisonFormulaIds.includes(formula.id) ? '✓ 对比中' : '📊 对比' }}
            </button>
            <button class="btn btn-sm btn-secondary" @click.stop="handleCopyFormula(formula.id)">
              📋 复制
            </button>
            <button
              :class="['btn btn-sm', formula.isEnabled ? 'btn-secondary' : 'btn-primary']"
              @click.stop="store.toggleEnabled(formula.id)"
            >
              {{ formula.isEnabled ? '⏸ 停用' : '▶ 启用' }}
            </button>
            <button class="btn btn-sm btn-danger" @click.stop="handleDeleteFormula(formula.id)">
              🗑 删除
            </button>
          </div>
        </div>

        <div v-if="filteredFormulas.length === 0" class="empty-state">
          <p>暂无配方</p>
          <button class="btn btn-primary btn-sm" @click="handleCreateFormula">创建第一个配方</button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'edit'" class="tab-content">
      <div v-if="store.selectedFormula" class="formula-editor">
        <div class="editor-header">
          <h4>编辑配方</h4>
          <button class="btn btn-sm btn-secondary" @click="handleCancelEdit">返回列表</button>
        </div>

        <div class="form-group">
          <label>配方名称</label>
          <input
            type="text"
            v-model="editForm.name"
            class="form-input"
            placeholder="输入配方名称"
          />
        </div>

        <div class="form-group">
          <label>配方描述</label>
          <textarea
            v-model="editForm.description"
            class="form-textarea"
            placeholder="描述配方的用途和特点"
            rows="2"
          ></textarea>
        </div>

        <div class="form-section-title">温度区间</div>
        <div class="range-input-group">
          <div class="range-input">
            <label>最低</label>
            <input type="number" v-model.number="editForm.temperatureRange.min" min="1" max="500" />
          </div>
          <div class="range-input">
            <label>最优</label>
            <input type="number" v-model.number="editForm.temperatureRange.optimal" min="1" max="500" />
          </div>
          <div class="range-input">
            <label>最高</label>
            <input type="number" v-model.number="editForm.temperatureRange.max" min="1" max="500" />
          </div>
        </div>

        <div class="form-section-title">速度区间</div>
        <div class="range-input-group">
          <div class="range-input">
            <label>最低</label>
            <input type="number" v-model.number="editForm.speedRange.min" min="0.1" max="100" step="0.1" />
          </div>
          <div class="range-input">
            <label>最优</label>
            <input type="number" v-model.number="editForm.speedRange.optimal" min="0.1" max="100" step="0.1" />
          </div>
          <div class="range-input">
            <label>最高</label>
            <input type="number" v-model.number="editForm.speedRange.max" min="0.1" max="100" step="0.1" />
          </div>
        </div>

        <div class="form-section-title">压力区间</div>
        <div class="range-input-group">
          <div class="range-input">
            <label>最低</label>
            <input type="number" v-model.number="editForm.pressureRange.min" min="0.1" max="10" step="0.1" />
          </div>
          <div class="range-input">
            <label>最优</label>
            <input type="number" v-model.number="editForm.pressureRange.optimal" min="0.1" max="10" step="0.1" />
          </div>
          <div class="range-input">
            <label>最高</label>
            <input type="number" v-model.number="editForm.pressureRange.max" min="0.1" max="10" step="0.1" />
          </div>
        </div>

        <div class="form-group">
          <label>适用图层类型</label>
          <div class="checkbox-group">
            <label v-for="type in layerTypes" :key="type" class="checkbox-item">
              <input
                type="checkbox"
                :checked="editForm.applicableLayerTypes.includes(type)"
                @change="toggleLayerType(type)"
              />
              {{ LAYER_TYPE_LABELS[type] }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>目标颜色深度: {{ (editForm.targetColorDepth * 100).toFixed(0) }}%</label>
          <input
            type="range"
            v-model.number="editForm.targetColorDepth"
            min="0"
            max="1"
            step="0.05"
            class="slider"
          />
        </div>

        <div class="form-group">
          <label>过烧温度阈值: {{ editForm.overburnThreshold }}°C</label>
          <input
            type="range"
            v-model.number="editForm.overburnThreshold"
            min="200"
            max="500"
            step="10"
            class="slider"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="saveVersionOnUpdate" />
            保存当前版本
          </label>
          <input
            v-if="saveVersionOnUpdate"
            type="text"
            v-model="versionNote"
            class="form-input"
            placeholder="版本说明（可选）"
          />
        </div>

        <div class="editor-actions">
          <button class="btn btn-secondary" @click="handleCancelEdit">取消</button>
          <button class="btn btn-primary" @click="handleSaveFormula">保存配方</button>
        </div>

        <div v-if="store.selectedFormula.versions.length > 0" class="version-history">
          <div class="form-section-title">版本历史</div>
          <div class="version-list">
            <div
              v-for="version in [...store.selectedFormula.versions].reverse()"
              :key="version.version"
              class="version-item"
            >
              <div class="version-info">
                <span class="version-num">v{{ version.version }}</span>
                <span class="version-name">{{ version.name }}</span>
                <span class="version-date">{{ formatDate(version.createdAt) }}</span>
              </div>
              <div class="version-actions">
                <button class="btn btn-sm btn-secondary" @click="handleRestoreVersion(version.version)">
                  ↩ 还原
                </button>
                <button class="btn btn-sm btn-danger" @click="handleDeleteVersion(version.version)">
                  🗑
                </button>
              </div>
              <p v-if="version.note" class="version-note">{{ version.note }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>请先选择一个配方</p>
      </div>
    </div>

    <div v-if="activeTab === 'compare'" class="tab-content">
      <div class="compare-header">
        <h4>配方对比</h4>
        <button
          v-if="store.comparisonFormulaIds.length > 0"
          class="btn btn-sm btn-secondary"
          @click="store.clearComparison()"
        >
          清空对比
        </button>
      </div>

      <div v-if="store.formulaComparisons.length > 0" class="compare-content">
        <div class="compare-metrics">
          <div class="compare-metric">
            <span class="metric-label">综合评分</span>
            <div class="metric-bars">
              <div
                v-for="comp in store.formulaComparisons"
                :key="comp.formulaId"
                class="metric-bar-group"
              >
                <div class="metric-bar-fill overall" :style="{ width: comp.overallScore + '%' }"></div>
                <span class="metric-bar-value">{{ comp.overallScore.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="compare-metric">
            <span class="metric-label">颜色深度</span>
            <div class="metric-bars">
              <div
                v-for="comp in store.formulaComparisons"
                :key="comp.formulaId"
                class="metric-bar-group"
              >
                <div class="metric-bar-fill depth" :style="{ width: comp.colorDepthScore + '%' }"></div>
                <span class="metric-bar-value">{{ comp.colorDepthScore.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="compare-metric">
            <span class="metric-label">均匀度</span>
            <div class="metric-bars">
              <div
                v-for="comp in store.formulaComparisons"
                :key="comp.formulaId"
                class="metric-bar-group"
              >
                <div class="metric-bar-fill uniformity" :style="{ width: comp.uniformityScore + '%' }"></div>
                <span class="metric-bar-value">{{ comp.uniformityScore.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="compare-metric">
            <span class="metric-label">过烧风险（越低越好）</span>
            <div class="metric-bars">
              <div
                v-for="comp in store.formulaComparisons"
                :key="comp.formulaId"
                class="metric-bar-group"
              >
                <div class="metric-bar-fill overburn" :style="{ width: comp.overburnRiskScore + '%' }"></div>
                <span class="metric-bar-value">{{ comp.overburnRiskScore.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="compare-metric">
            <span class="metric-label">参数稳定性</span>
            <div class="metric-bars">
              <div
                v-for="comp in store.formulaComparisons"
                :key="comp.formulaId"
                class="metric-bar-group"
              >
                <div class="metric-bar-fill stability" :style="{ width: comp.parameterStabilityScore + '%' }"></div>
                <span class="metric-bar-value">{{ comp.parameterStabilityScore.toFixed(1) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="compare-legend">
          <div
            v-for="(comp, idx) in store.formulaComparisons"
            :key="comp.formulaId"
            :class="['legend-item', `legend-${idx}`]"
          >
            <span class="legend-dot"></span>
            <span class="legend-name">{{ comp.formulaName }}</span>
          </div>
        </div>

        <div class="compare-detail">
          <table class="compare-table">
            <thead>
              <tr>
                <th>指标</th>
                <th v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ comp.formulaName }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>温度区间</td>
                <td v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ comp.temperatureRange[0] }} - {{ comp.temperatureRange[1] }}°C
                </td>
              </tr>
              <tr>
                <td>速度区间</td>
                <td v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ comp.speedRange[0] }} - {{ comp.speedRange[1] }}
                </td>
              </tr>
              <tr>
                <td>压力区间</td>
                <td v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ comp.pressureRange[0] }} - {{ comp.pressureRange[1] }}
                </td>
              </tr>
              <tr>
                <td>目标深度</td>
                <td v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ (comp.targetDepth * 100).toFixed(0) }}%
                </td>
              </tr>
              <tr>
                <td>适用图层</td>
                <td v-for="comp in store.formulaComparisons" :key="comp.formulaId">
                  {{ comp.applicableLayers.join(', ') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>请从列表中选择配方加入对比</p>
        <button class="btn btn-primary btn-sm" @click="activeTab = 'list'">去选择</button>
      </div>
    </div>

    <div v-if="activeTab === 'training'" class="tab-content">
      <TrainingLoop />
    </div>

    <div v-if="activeTab === 'import'" class="tab-content">
      <div class="import-export-section">
        <h4>配方导入导出</h4>

        <div class="import-export-buttons">
          <label class="import-label">
            <span>📂 导入配方</span>
            <input
              type="file"
              accept=".json"
              @change="handleImportFormulas"
              class="import-input"
            />
          </label>
          <button class="btn btn-secondary" @click="handleExportFormulas">
            💾 导出所有配方
          </button>
        </div>

        <div class="info-box">
          <p><strong>💡 提示</strong></p>
          <ul>
            <li>删除配方不会影响已生成的作品数据</li>
            <li>删除试验记录不会影响作品</li>
            <li>切换方案时会保留各方案的配方绑定关系和试验历史</li>
            <li>导入导出项目时会完整保留配方、版本、绑定和试验记录</li>
          </ul>
        </div>

        <div class="current-stats">
          <div class="stat-item">
            <span class="stat-label">配方总数</span>
            <span class="stat-value">{{ store.formulas.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">启用配方</span>
            <span class="stat-value">{{ store.enabledFormulas.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">收藏配方</span>
            <span class="stat-value">{{ store.favoriteFormulas.length }}</span>
          </div>
        </div>
        <div class="current-stats">
          <div class="stat-item">
            <span class="stat-label">试验记录</span>
            <span class="stat-value">{{ trainingStore.trials.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">异常预警</span>
            <span class="stat-value">{{ trainingStore.alerts.filter(a => !a.acknowledged).length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">配方绑定</span>
            <span class="stat-value">{{ store.bindings.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.lastError" class="error-message">
      {{ store.lastError }}
      <button class="close-btn" @click="store.clearError()">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFormulaStore } from '@/stores/formula'
import { usePyrographyStore } from '@/stores/pyrography'
import { useTrainingStore } from '@/stores/training'
import { LAYER_TYPE_LABELS } from '@/types'
import type { Formula, LayerType } from '@/types'
import TrainingLoop from './TrainingLoop.vue'

const store = useFormulaStore()
const pyrographyStore = usePyrographyStore()
const trainingStore = useTrainingStore()

const tabs = [
  { key: 'list', label: '配方列表' },
  { key: 'edit', label: '编辑' },
  { key: 'compare', label: '对比' },
  { key: 'training', label: '🔬 训练回路' },
  { key: 'import', label: '导入导出' }
]

const activeTab = ref('list')
const filter = ref<'all' | 'favorite' | 'enabled'>('all')

const layerTypes: LayerType[] = ['draft', 'mainline', 'shadow', 'custom']

const editForm = ref<Partial<Formula> & {
  name: string
  temperatureRange: Formula['temperatureRange']
  speedRange: Formula['speedRange']
  pressureRange: Formula['pressureRange']
  applicableLayerTypes: LayerType[]
  targetColorDepth: number
  overburnThreshold: number
}>({
  name: '',
  description: '',
  temperatureRange: { min: 150, max: 300, optimal: 220 },
  speedRange: { min: 5, max: 15, optimal: 10 },
  pressureRange: { min: 2, max: 6, optimal: 3 },
  applicableLayerTypes: ['mainline', 'custom'],
  targetColorDepth: 0.5,
  overburnThreshold: 350
})

const saveVersionOnUpdate = ref(false)
const versionNote = ref('')
const isCreating = ref(false)

const filteredFormulas = computed(() => {
  let list = store.formulas
  if (filter.value === 'favorite') {
    list = list.filter((f) => f.isFavorite)
  } else if (filter.value === 'enabled') {
    list = list.filter((f) => f.isEnabled)
  }
  return [...list].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
})

function handleCreateFormula() {
  isCreating.value = true
  editForm.value = {
    name: `新配方 ${store.formulas.length + 1}`,
    description: '',
    temperatureRange: { min: 150, max: 300, optimal: 220 },
    speedRange: { min: 5, max: 15, optimal: 10 },
    pressureRange: { min: 2, max: 6, optimal: 3 },
    applicableLayerTypes: ['mainline', 'custom'],
    targetColorDepth: 0.5,
    overburnThreshold: 350
  }
  activeTab.value = 'edit'
}

function handleEditFormula(formulaId: string) {
  const formula = store.formulas.find((f) => f.id === formulaId)
  if (!formula) return
  isCreating.value = false
  store.selectFormula(formulaId)
  editForm.value = {
    name: formula.name,
    description: formula.description,
    temperatureRange: { ...formula.temperatureRange },
    speedRange: { ...formula.speedRange },
    pressureRange: { ...formula.pressureRange },
    applicableLayerTypes: [...formula.applicableLayerTypes],
    targetColorDepth: formula.targetColorDepth,
    overburnThreshold: formula.overburnThreshold
  }
  saveVersionOnUpdate.value = false
  versionNote.value = ''
  activeTab.value = 'edit'
}

function handleSaveFormula() {
  if (!editForm.value.name.trim()) {
    store.lastError = '请输入配方名称'
    return
  }

  if (isCreating.value) {
    const result = store.createFormula({
      name: editForm.value.name.trim(),
      description: editForm.value.description,
      temperatureRange: editForm.value.temperatureRange,
      speedRange: editForm.value.speedRange,
      pressureRange: editForm.value.pressureRange,
      applicableLayerTypes: editForm.value.applicableLayerTypes,
      targetColorDepth: editForm.value.targetColorDepth,
      overburnThreshold: editForm.value.overburnThreshold
    })
    if (result) {
      activeTab.value = 'list'
      isCreating.value = false
    }
  } else if (store.selectedFormulaId) {
    store.updateFormula(
      store.selectedFormulaId,
      {
        name: editForm.value.name.trim(),
        description: editForm.value.description,
        temperatureRange: editForm.value.temperatureRange,
        speedRange: editForm.value.speedRange,
        pressureRange: editForm.value.pressureRange,
        applicableLayerTypes: editForm.value.applicableLayerTypes,
        targetColorDepth: editForm.value.targetColorDepth,
        overburnThreshold: editForm.value.overburnThreshold
      },
      saveVersionOnUpdate.value,
      versionNote.value || undefined
    )
    activeTab.value = 'list'
  }
}

function handleCancelEdit() {
  activeTab.value = 'list'
  isCreating.value = false
  store.clearError()
}

function handleDeleteFormula(formulaId: string) {
  const formula = store.formulas.find((f) => f.id === formulaId)
  if (!formula) return
  if (confirm(`确定要删除配方"${formula.name}"吗？\n删除后不会影响已生成的作品。`)) {
    store.deleteFormula(formulaId)
  }
}

function handleCopyFormula(formulaId: string) {
  store.copyFormula(formulaId)
}

function handleApplyFormula(formulaId: string) {
  const settings = store.applyFormula(formulaId)
  if (!settings) return

  if (pyrographyStore.currentLayer) {
    pyrographyStore.updateSettings(settings)
    store.bindFormulaToLayer(
      formulaId,
      pyrographyStore.currentLayer.id,
      pyrographyStore.currentSchemeId
    )
  }
}

function toggleLayerType(type: LayerType) {
  const idx = editForm.value.applicableLayerTypes.indexOf(type)
  if (idx === -1) {
    editForm.value.applicableLayerTypes.push(type)
  } else {
    editForm.value.applicableLayerTypes.splice(idx, 1)
  }
}

function handleRestoreVersion(versionNum: number) {
  if (confirm(`确定要还原到 v${versionNum} 版本吗？`)) {
    store.restoreVersion(store.selectedFormulaId, versionNum)
  }
}

function handleDeleteVersion(versionNum: number) {
  if (confirm(`确定要删除 v${versionNum} 版本吗？`)) {
    store.deleteVersion(store.selectedFormulaId, versionNum)
  }
}

function handleImportFormulas(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    store.importFormulas(event.target?.result as string)
  }
  reader.readAsText(file)
  target.value = ''
}

function handleExportFormulas() {
  const jsonStr = store.exportFormulas()
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pyrography_formulas_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
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

watch(
  () => store.selectedFormulaId,
  () => {
    if (store.selectedFormula && activeTab.value === 'edit' && !isCreating.value) {
      handleEditFormula(store.selectedFormulaId)
    }
  }
)
</script>

<style scoped>
.formula-lab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.lab-header {
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.lab-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.lab-subtitle {
  margin: 0;
  font-size: 11px;
  color: #888;
}

.lab-tabs {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 6px;
}

.tab-btn {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.tab-btn.active {
  background: #fff;
  color: #667eea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-badge {
  background: #667eea;
  color: white;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.formula-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  gap: 4px;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.formula-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.formula-card:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.formula-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.04);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.formula-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.formula-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.formula-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.icon-btn:hover {
  opacity: 1;
}

.favorite-btn.active {
  opacity: 1;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.enabled {
  background: #f0fff4;
  color: #38a169;
}

.status-badge.disabled {
  background: #f7fafc;
  color: #a0aec0;
}

.formula-desc {
  font-size: 11px;
  color: #888;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.formula-params {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: #f8f9fa;
  border-radius: 4px;
}

.param-label {
  font-size: 10px;
  color: #999;
}

.param-value {
  font-size: 13px;
  font-weight: 700;
}

.param-value.temp { color: #ff6b35; }
.param-value.speed { color: #4299e1; }
.param-value.pressure { color: #48bb78; }

.param-range {
  font-size: 9px;
  color: #aaa;
}

.formula-meta {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}

.meta-item {
  font-size: 10px;
  color: #999;
}

.formula-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.layer-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: #f0f0f0;
  color: #666;
  border-radius: 4px;
}

.formula-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.formula-actions .btn-sm {
  flex: 1;
  min-width: auto;
  padding: 4px 6px;
  font-size: 10px;
}

.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: #999;
}

.empty-state p {
  margin: 0 0 10px 0;
  font-size: 12px;
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

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: #fff;
  color: #444;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #f5f5f5;
}

.btn-danger {
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-danger:hover:not(:disabled) {
  background: #fef2f2;
}

.formula-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.editor-header h4 {
  margin: 0;
  font-size: 13px;
  color: #333;
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
  padding: 6px 10px;
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

.form-textarea {
  resize: vertical;
}

.form-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #444;
  margin-top: 4px;
  padding-bottom: 2px;
  border-bottom: 1px solid #eee;
}

.range-input-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.range-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-input label {
  font-size: 10px;
  color: #888;
}

.range-input input {
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.range-input input:focus {
  border-color: #667eea;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
}

.slider {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.editor-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.version-history {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #ddd;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.version-item {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.version-num {
  font-size: 11px;
  font-weight: 700;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.version-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.version-date {
  font-size: 10px;
  color: #999;
}

.version-actions {
  display: flex;
  gap: 4px;
}

.version-note {
  font-size: 11px;
  color: #888;
  margin: 4px 0 0 0;
  font-style: italic;
}

.compare-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.compare-header h4 {
  margin: 0;
  font-size: 13px;
  color: #333;
}

.compare-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.compare-metrics {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compare-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-label {
  font-size: 11px;
  color: #555;
  font-weight: 500;
}

.metric-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-bar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-bar-fill {
  height: 18px;
  border-radius: 3px;
  transition: width 0.5s ease;
  flex: 1;
  min-width: 0;
}

.metric-bar-fill.overall {
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.metric-bar-fill.depth {
  background: linear-gradient(90deg, #f6e5b3, #8b5a2b);
}

.metric-bar-fill.uniformity {
  background: linear-gradient(90deg, #4299e1, #90cdf4);
}

.metric-bar-fill.overburn {
  background: linear-gradient(90deg, #48bb78, #9ae6b4);
}

.metric-bar-fill.stability {
  background: linear-gradient(90deg, #9f7aea, #d6bcfa);
}

.metric-bar-value {
  font-size: 11px;
  font-weight: 600;
  color: #333;
  min-width: 35px;
  text-align: right;
}

.compare-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #555;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-0 .legend-dot { background: #667eea; }
.legend-1 .legend-dot { background: #48bb78; }
.legend-2 .legend-dot { background: #f6ad55; }
.legend-3 .legend-dot { background: #9f7aea; }

.compare-detail {
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
  text-align: left;
  border-bottom: 1px solid #eee;
}

.compare-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #555;
  font-size: 10px;
}

.compare-table td {
  color: #444;
}

.import-export-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.import-export-section h4 {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: #333;
}

.import-export-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: #fff;
  border: 2px dashed #ccc;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
}

.import-label:hover {
  border-color: #667eea;
  color: #667eea;
  background: rgba(102, 126, 234, 0.04);
}

.import-input {
  display: none;
}

.info-box {
  padding: 10px 12px;
  background: #f0fff4;
  border-radius: 6px;
  border-left: 3px solid #48bb78;
}

.info-box p {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  color: #38a169;
}

.info-box ul {
  margin: 0;
  padding-left: 18px;
}

.info-box li {
  font-size: 11px;
  color: #555;
  margin-bottom: 2px;
}

.current-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.current-stats .stat-item {
  text-align: center;
  padding: 10px;
  background: #fff;
  border-radius: 6px;
}

.current-stats .stat-label {
  display: block;
  font-size: 10px;
  color: #999;
  margin-bottom: 4px;
}

.current-stats .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
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

.close-btn {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
</style>
