<template>
  <div class="control-panel">
    <div class="panel-section">
      <h3 class="section-title">烙笔参数</h3>

      <div class="param-group">
        <div class="param-header">
          <label>温度 (°C)</label>
          <span class="param-value">{{ store.settings.temperature }}</span>
        </div>
        <input
          type="range"
          :min="MIN_TEMPERATURE"
          :max="MAX_TEMPERATURE"
          :value="store.settings.temperature"
          @input="handleTemperatureChange"
          class="slider temp-slider"
        />
        <div class="slider-labels">
          <span>低温</span>
          <span :class="{ danger: store.settings.temperature >= OVERBURN_TEMPERATURE }">
            {{ store.settings.temperature >= OVERBURN_TEMPERATURE ? '⚠ 过烧风险' : '高温' }}
          </span>
        </div>
      </div>

      <div class="param-group">
        <div class="param-header">
          <label>笔触速度</label>
          <span class="param-value">{{ store.settings.speed.toFixed(1) }}</span>
        </div>
        <input
          type="range"
          :min="MIN_SPEED"
          :max="MAX_SPEED"
          step="0.1"
          :value="store.settings.speed"
          @input="handleSpeedChange"
          class="slider speed-slider"
        />
        <div class="slider-labels">
          <span>慢</span>
          <span>快</span>
        </div>
      </div>

      <div class="param-group">
        <div class="param-header">
          <label>压力</label>
          <span class="param-value">{{ store.settings.pressure.toFixed(1) }}</span>
        </div>
        <input
          type="range"
          :min="MIN_PRESSURE"
          :max="MAX_PRESSURE"
          step="0.1"
          :value="store.settings.pressure"
          @input="handlePressureChange"
          class="slider pressure-slider"
        />
        <div class="slider-labels">
          <span>轻</span>
          <span>重</span>
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">
        🧪 配方推荐
        <button class="link-btn" @click="showFormulaLab = true">配方实验室 →</button>
      </h3>
      <FormulaRecommender @open-lab="showFormulaLab = true" />
    </div>

    <div class="panel-section">
      <h3 class="section-title">图层管理</h3>
      <div class="layer-actions">
        <button class="btn btn-primary btn-sm" :disabled="store.isPlaybackMode" @click="handleAddLayer">+ 新建图层</button>
      </div>
      <div class="layer-list">
        <div
          v-for="layer in store.currentLayers"
          :key="layer.id"
          :class="['layer-item', { active: layer.id === store.currentLayer?.id }]"
        >
          <div class="layer-main" @click="handleSwitchLayer(layer.id)">
            <button
              :class="['layer-toggle', { off: !layer.visible }]"
              @click.stop="handleToggleVisibility(layer.id)"
              :title="layer.visible ? '隐藏图层' : '显示图层'"
            >
              {{ layer.visible ? '👁' : '👁‍🗨' }}
            </button>
            <span :class="['layer-type-dot', layer.type]"></span>
            <input
              type="text"
              class="layer-name"
              :value="layer.name"
              @click.stop
              @change="handleRenameLayer(layer.id, $event)"
            />
            <span class="layer-count">{{ layer.strokes.length }}</span>
            <button
              class="layer-lock"
              @click.stop="handleToggleLock(layer.id)"
              :title="layer.locked ? '解锁图层' : '锁定图层'"
            >
              {{ layer.locked ? '🔒' : '🔓' }}
            </button>
          </div>
          <div class="layer-controls" v-if="layer.id === store.currentLayer?.id">
            <div class="layer-control-row">
              <label>不透明度</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="layer.opacity"
                @input="handleLayerOpacity(layer.id, $event)"
                class="slider mini-slider"
              />
              <span class="mini-value">{{ Math.round(layer.opacity * 100) }}%</span>
            </div>
            <div class="layer-control-row">
              <button class="btn btn-sm btn-secondary" :disabled="store.isPlaybackMode" @click="handleReorderLayer(layer.id, 'up')">↑ 上移</button>
              <button class="btn btn-sm btn-secondary" :disabled="store.isPlaybackMode" @click="handleReorderLayer(layer.id, 'down')">↓ 下移</button>
              <button class="btn btn-sm btn-danger" :disabled="store.isPlaybackMode" @click="handleClearLayer(layer.id)">清空</button>
              <button
                v-if="store.currentLayers.length > 1"
                class="btn btn-sm btn-danger"
                :disabled="store.isPlaybackMode"
                @click="handleDeleteLayer(layer.id)"
              >删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">区域温度预设</h3>
      <div class="preset-actions">
        <button class="btn btn-primary btn-sm" @click="handleAddPreset">+ 新增预设</button>
      </div>
      <div class="preset-list">
        <div
          v-for="preset in store.temperaturePresets"
          :key="preset.id"
          class="preset-item"
        >
          <div class="preset-info">
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-temp">{{ preset.temperature }}°C</span>
          </div>
          <div class="preset-region">
            {{ Math.round(preset.region.x) }},{{ Math.round(preset.region.y) }}
            {{ Math.round(preset.region.width) }}×{{ Math.round(preset.region.height) }}
          </div>
          <button class="preset-delete" @click="handleDeletePreset(preset.id)">×</button>
        </div>
        <div v-if="store.temperaturePresets.length === 0" class="preset-empty">
          暂无温度预设
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">回放控制</h3>
      <div class="playback-controls">
        <button
          v-if="!store.isPlaybackMode"
          class="btn btn-primary"
          :disabled="store.currentStrokes.length === 0"
          @click="handleStartPlayback"
        >
          ▶ 开始回放
        </button>
        <template v-else>
          <div class="playback-buttons">
            <button
              class="btn btn-sm"
              :class="store.playbackState.isPaused ? 'btn-primary' : 'btn-secondary'"
              @click="handleTogglePause"
            >
              {{ store.playbackState.isPaused ? '▶ 继续' : '⏸ 暂停' }}
            </button>
            <button class="btn btn-sm btn-secondary" @click="handleStopPlayback">⏹ 停止</button>
          </div>
          <div class="playback-progress">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="store.playbackState.progress"
              @input="handleSeekPlayback"
              class="slider"
            />
            <span class="progress-label">{{ Math.round(store.playbackState.progress * 100) }}%</span>
          </div>
          <div class="playback-speed">
            <label>速度</label>
            <div class="speed-options">
              <button
                v-for="spd in [0.5, 1, 2, 4]"
                :key="spd"
                :class="['speed-btn', { active: store.playbackState.speed === spd }]"
                @click="handleSetSpeed(spd as PlaybackSpeed)"
              >
                {{ spd }}x
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">操作</h3>
      <div class="action-buttons">
        <button class="btn btn-secondary" :disabled="!store.canUndo || store.isPlaybackMode" @click="handleUndo">
          ↩ 撤销
        </button>
        <button class="btn btn-secondary" :disabled="store.isPlaybackMode" @click="handleClear">
          🗑 清空
        </button>
        <button class="btn btn-primary" @click="handleEvaluate">
          📊 评分
        </button>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">方案管理</h3>
      <div class="scheme-actions">
        <button class="btn btn-primary btn-sm" :disabled="store.isPlaybackMode" @click="handleCreateScheme">+ 新建方案</button>
      </div>
      <div class="scheme-list">
        <div
          v-for="scheme in store.schemes"
          :key="scheme.id"
          :class="['scheme-item', { active: scheme.id === store.currentSchemeId }]"
          @click="handleSwitchScheme(scheme.id)"
        >
          <input
            type="text"
            class="scheme-name"
            :value="scheme.name"
            @click.stop
            @change="handleRenameScheme(scheme.id, $event)"
          />
          <span class="scheme-count">{{ scheme.strokes.length }} 笔 · {{ scheme.layers.length }} 层</span>
          <button
            v-if="store.schemes.length > 1"
            class="scheme-delete"
            @click.stop="handleDeleteScheme(scheme.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">导入导出</h3>
      <div class="import-export-area">
        <label class="import-label">
          <span>📂 导入项目</span>
          <input
            type="file"
            accept=".json"
            @change="handleImportProject"
            class="import-input"
          />
        </label>
        <button class="btn btn-secondary" @click="handleExportProject">💾 导出项目</button>
        <label class="import-label secondary">
          <span>📝 导入路径</span>
          <input
            type="file"
            accept=".json"
            @change="handleImportFile"
            class="import-input"
          />
        </label>
      </div>
    </div>

    <div class="panel-section stats-preview">
      <h3 class="section-title">实时统计</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总笔画</span>
          <span class="stat-value">{{ store.statistics.totalStrokes }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">过烧数量</span>
          <span class="stat-value danger">{{ store.statistics.overburnedCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">均匀度</span>
          <span class="stat-value">{{ store.statistics.uniformity.toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">参数稳定性</span>
          <span class="stat-value">{{ store.statistics.parameterStability.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showFormulaLab" class="modal-overlay" @click.self="showFormulaLab = false">
        <div class="modal-content formula-lab-modal">
          <div class="modal-header">
            <h3>🧪 烙画工艺配方实验室</h3>
            <button class="modal-close" @click="showFormulaLab = false">×</button>
          </div>
          <div class="modal-body">
            <FormulaLab />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePyrographyStore } from '@/stores/pyrography'
import type { LayerType, PlaybackSpeed } from '@/types'
import {
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_SPEED,
  MAX_SPEED,
  MIN_PRESSURE,
  MAX_PRESSURE,
  OVERBURN_TEMPERATURE
} from '@/types'
import FormulaRecommender from './FormulaRecommender.vue'
import FormulaLab from './FormulaLab.vue'

const store = usePyrographyStore()
const showFormulaLab = ref(false)

function handleTemperatureChange(e: Event) {
  const target = e.target as HTMLInputElement
  store.updateSettings({ temperature: Number(target.value) })
}

function handleSpeedChange(e: Event) {
  const target = e.target as HTMLInputElement
  store.updateSettings({ speed: Number(target.value) })
}

function handlePressureChange(e: Event) {
  const target = e.target as HTMLInputElement
  store.updateSettings({ pressure: Number(target.value) })
}

function handleUndo() {
  store.undo()
}

function handleClear() {
  if (store.currentStrokes.length === 0) return
  if (confirm('确定要清空当前画布吗？此操作可撤销。')) {
    store.clearCanvas()
  }
}

function handleAddLayer() {
  const name = prompt('请输入图层名称：', `图层 ${store.currentLayers.length + 1}`)
  if (!name || !name.trim()) return
  const typeInput = prompt('请输入图层类型（draft/mainline/shadow/custom）：', 'custom')
  const type: LayerType = ['draft', 'mainline', 'shadow', 'custom'].includes(typeInput || '')
    ? (typeInput as LayerType)
    : 'custom'
  store.addLayer(name.trim(), type)
}

function handleSwitchLayer(layerId: string) {
  store.switchLayer(layerId)
}

function handleToggleVisibility(layerId: string) {
  store.toggleLayerVisibility(layerId)
}

function handleToggleLock(layerId: string) {
  store.toggleLayerLock(layerId)
}

function handleLayerOpacity(layerId: string, e: Event) {
  const target = e.target as HTMLInputElement
  store.updateLayerOpacity(layerId, Number(target.value))
}

function handleReorderLayer(layerId: string, direction: 'up' | 'down') {
  store.reorderLayer(layerId, direction)
}

function handleRenameLayer(layerId: string, e: Event) {
  const target = e.target as HTMLInputElement
  const name = target.value.trim()
  if (name) {
    store.renameLayer(layerId, name)
  } else {
    const layer = store.currentLayers.find((l) => l.id === layerId)
    target.value = layer?.name || ''
  }
}

function handleClearLayer(layerId: string) {
  const layer = store.currentLayers.find((l) => l.id === layerId)
  if (!layer || layer.strokes.length === 0) return
  if (confirm(`确定要清空图层"${layer.name}"吗？`)) {
    store.clearLayer(layerId)
  }
}

function handleDeleteLayer(layerId: string) {
  if (store.currentLayers.length <= 1) return
  const layer = store.currentLayers.find((l) => l.id === layerId)
  if (confirm(`确定要删除图层"${layer?.name}"吗？删除后不可恢复。`)) {
    store.deleteLayer(layerId)
  }
}

function handleAddPreset() {
  const name = prompt('预设名称：', `区域 ${store.temperaturePresets.length + 1}`)
  if (!name?.trim()) return
  const x = Number(prompt('区域 X 坐标：', '100')) || 100
  const y = Number(prompt('区域 Y 坐标：', '100')) || 100
  const width = Number(prompt('区域宽度：', '200')) || 200
  const height = Number(prompt('区域高度：', '150')) || 150
  const temperature = Number(prompt('预设温度 (°C)：', '300')) || 300
  store.addTemperaturePreset(name.trim(), { x, y, width, height }, temperature)
}

function handleDeletePreset(presetId: string) {
  store.deleteTemperaturePreset(presetId)
}

function handleStartPlayback() {
  store.startPlayback()
}

function handleTogglePause() {
  if (store.playbackState.isPaused) {
    store.resumePlayback()
  } else {
    store.pausePlayback()
  }
}

function handleStopPlayback() {
  store.stopPlayback()
}

function handleSeekPlayback(e: Event) {
  const target = e.target as HTMLInputElement
  store.seekPlayback(Number(target.value))
}

function handleSetSpeed(speed: PlaybackSpeed) {
  store.setPlaybackSpeed(speed)
}

function handleEvaluate() {
  store.evaluateScore()
}

function handleCreateScheme() {
  const name = prompt('请输入方案名称：', `方案 ${store.schemes.length + 1}`)
  if (name && name.trim()) {
    store.createScheme(name.trim())
  }
}

function handleSwitchScheme(schemeId: string) {
  store.switchScheme(schemeId)
}

function handleDeleteScheme(schemeId: string) {
  if (store.schemes.length <= 1) return
  if (confirm('确定要删除此方案吗？')) {
    store.deleteScheme(schemeId)
  }
}

function handleRenameScheme(schemeId: string, e: Event) {
  const target = e.target as HTMLInputElement
  const name = target.value.trim()
  if (name) {
    store.renameScheme(schemeId, name)
  } else {
    target.value = store.schemes.find((s) => s.id === schemeId)?.name || ''
  }
}

function handleImportProject(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      store.importProject(event.target?.result as string)
    } catch {
      store.clearError()
      store.importProject('')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

function handleExportProject() {
  const jsonStr = store.exportProject()
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pyrography_project_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target?.result as string)
      const strokesData = Array.isArray(data) ? data : data.strokes
      store.importStrokes(strokesData)
    } catch {
      store.importStrokes(null)
    }
  }
  reader.readAsText(file)
  target.value = ''
}
</script>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e5e5;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-header label {
  font-size: 12px;
  color: #555;
}

.param-value {
  font-size: 13px;
  font-weight: 600;
  color: #333;
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
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.temp-slider::-webkit-slider-thumb {
  background: linear-gradient(135deg, #ff6b35, #f7c59f);
}

.speed-slider::-webkit-slider-thumb {
  background: linear-gradient(135deg, #4299e1, #90cdf4);
}

.pressure-slider::-webkit-slider-thumb {
  background: linear-gradient(135deg, #48bb78, #9ae6b4);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.temp-slider::-moz-range-thumb {
  background: linear-gradient(135deg, #ff6b35, #f7c59f);
}

.speed-slider::-moz-range-thumb {
  background: linear-gradient(135deg, #4299e1, #90cdf4);
}

.pressure-slider::-moz-range-thumb {
  background: linear-gradient(135deg, #48bb78, #9ae6b4);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #999;
}

.slider-labels .danger {
  color: #ef4444;
  font-weight: 600;
}

.mini-slider {
  flex: 1;
  height: 4px;
}

.mini-slider::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
}

.mini-value {
  font-size: 11px;
  color: #666;
  min-width: 32px;
  text-align: right;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 11px;
  flex: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #fff;
  color: #444;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.btn-danger {
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-danger:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.layer-actions {
  margin-bottom: 4px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.layer-item {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  overflow: hidden;
  transition: all 0.2s;
}

.layer-item:hover {
  border-color: #667eea;
}

.layer-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.04);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.12);
}

.layer-main {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
}

.layer-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.layer-toggle:hover {
  opacity: 1;
}

.layer-toggle.off {
  opacity: 0.4;
}

.layer-type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.layer-type-dot.draft { background: #4299e1; }
.layer-type-dot.mainline { background: #48bb78; }
.layer-type-dot.shadow { background: #9f7aea; }
.layer-type-dot.custom { background: #ed8936; }

.layer-name {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #333;
  outline: none;
  padding: 2px 4px;
  border-radius: 3px;
  min-width: 0;
}

.layer-name:focus {
  background: #fff;
  box-shadow: 0 0 0 1px #667eea;
}

.layer-count {
  font-size: 10px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 8px;
}

.layer-lock {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
}

.layer-lock:hover {
  opacity: 1;
}

.layer-controls {
  padding: 6px 10px 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-control-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.layer-control-row label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.layer-control-row .btn-sm {
  flex: 1;
  text-align: center;
}

.preset-actions {
  margin-bottom: 4px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preset-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.preset-temp {
  font-size: 11px;
  color: #ff6b35;
  font-weight: 600;
}

.preset-region {
  font-size: 10px;
  color: #999;
  font-family: monospace;
}

.preset-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-delete:hover {
  background: #ef4444;
  color: #fff;
}

.preset-empty {
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 8px;
}

.playback-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playback-buttons {
  display: flex;
  gap: 8px;
}

.playback-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playback-progress .slider {
  flex: 1;
}

.progress-label {
  font-size: 11px;
  color: #666;
  min-width: 32px;
  text-align: right;
}

.playback-speed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.playback-speed label {
  font-size: 11px;
  color: #666;
}

.speed-options {
  display: flex;
  gap: 4px;
}

.speed-btn {
  padding: 3px 8px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.speed-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.speed-btn:hover:not(.active) {
  border-color: #667eea;
  color: #667eea;
}

.scheme-actions {
  margin-bottom: 4px;
}

.scheme-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scheme-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.scheme-item:hover {
  border-color: #667eea;
}

.scheme-item.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.08);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.scheme-name {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #333;
  outline: none;
  padding: 2px 4px;
  border-radius: 3px;
}

.scheme-name:focus {
  background: #fff;
  box-shadow: 0 0 0 1px #667eea;
}

.scheme-count {
  font-size: 10px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
}

.scheme-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scheme-delete:hover {
  background: #ef4444;
  color: #fff;
}

.import-export-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.import-label.secondary {
  border-style: dotted;
  padding: 8px;
  font-size: 11px;
}

.import-input {
  display: none;
}

.stats-preview {
  background: linear-gradient(135deg, #f6f8fb, #eef2f7);
  padding: 12px;
  border-radius: 6px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: #888;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.stat-value.danger {
  color: #ef4444;
}

.link-btn {
  background: none;
  border: none;
  color: #667eea;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  float: right;
}

.link-btn:hover {
  text-decoration: underline;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.formula-lab-modal {
  width: 100%;
  max-width: 520px;
  height: 85vh;
  max-height: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.modal-close:hover {
  opacity: 1;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  background: #fafafa;
}
</style>
