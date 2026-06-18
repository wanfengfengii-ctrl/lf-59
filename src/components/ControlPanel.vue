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
      <h3 class="section-title">操作</h3>
      <div class="action-buttons">
        <button class="btn btn-secondary" :disabled="!store.canUndo" @click="handleUndo">
          ↩ 撤销
        </button>
        <button class="btn btn-secondary" @click="handleClear">
          🗑 清空画布
        </button>
      </div>
    </div>

    <div class="panel-section">
      <h3 class="section-title">方案管理</h3>
      <div class="scheme-actions">
        <button class="btn btn-primary" @click="handleCreateScheme">
          + 新建方案
        </button>
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
          <span class="scheme-count">{{ scheme.strokes.length }} 笔</span>
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
      <h3 class="section-title">导入路径</h3>
      <div class="import-area">
        <label class="import-label">
          <span>📂 选择 JSON 文件</span>
          <input
            type="file"
            accept=".json"
            @change="handleImportFile"
            class="import-input"
          />
        </label>
        <p class="import-hint">支持包含 strokes 数组的 JSON 文件</p>
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
          <span class="stat-label">过烧风险</span>
          <span :class="['stat-value', store.statistics.overburnedRisk > 30 ? 'danger' : '']">
            {{ store.statistics.overburnedRisk.toFixed(1) }}%
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">均匀度</span>
          <span class="stat-value">{{ store.statistics.uniformity.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePyrographyStore } from '@/stores/pyrography'
import {
  MIN_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_SPEED,
  MAX_SPEED,
  MIN_PRESSURE,
  MAX_PRESSURE,
  OVERBURN_TEMPERATURE
} from '@/types'

const store = usePyrographyStore()

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
  gap: 20px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-header label {
  font-size: 13px;
  color: #555;
}

.param-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
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
  width: 18px;
  height: 18px;
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
  font-size: 11px;
  color: #999;
}

.slider-labels .danger {
  color: #ef4444;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.scheme-actions {
  margin-bottom: 8px;
}

.scheme-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scheme-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
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
  font-size: 13px;
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
  font-size: 11px;
  color: #888;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.scheme-delete {
  width: 22px;
  height: 22px;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scheme-delete:hover {
  background: #ef4444;
  color: #fff;
}

.import-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #fff;
  border: 2px dashed #ccc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
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

.import-hint {
  margin: 0;
  font-size: 11px;
  color: #999;
  text-align: center;
}

.stats-preview {
  background: linear-gradient(135deg, #f6f8fb, #eef2f7);
  padding: 16px;
  border-radius: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: #888;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.stat-value.danger {
  color: #ef4444;
}
</style>
