<template>
  <div class="tracing-panel">
    <div class="panel-header">
      <h3 class="panel-title">🎨 葫芦纹样临摹辅助</h3>
      <p class="panel-subtitle">导入参考图 · 调整叠加 · 智能评分</p>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">参考图管理</span>
        <label class="import-btn">
          <span>📥 导入参考图</span>
          <input
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleImportReference"
          />
        </label>
      </div>

      <div v-if="tracingStore.referenceImages.length === 0" class="empty-state">
        <p class="empty-icon">🖼️</p>
        <p class="empty-text">暂无参考图，点击上方按钮导入</p>
        <p class="empty-hint">支持 JPG、PNG、GIF 等常见格式</p>
      </div>

      <div v-else class="reference-list">
        <div
          v-for="ref in tracingStore.referenceImages"
          :key="ref.id"
          class="reference-item"
          :class="{
            active: tracingStore.currentBinding?.referenceId === ref.id,
            bound: isBoundToCurrentScheme(ref.id)
          }"
        >
          <div class="reference-preview" @click="bindToCurrentScheme(ref.id)">
            <img :src="ref.dataUrl" :alt="ref.name" />
          </div>
          <div class="reference-info">
            <div class="reference-name-row">
              <span class="reference-name" :title="ref.name">{{ truncate(ref.name, 14) }}</span>
              <span v-if="isBoundToCurrentScheme(ref.id)" class="bound-badge">已绑定</span>
            </div>
            <div class="reference-meta">
              {{ ref.originalWidth }}×{{ ref.originalHeight }}
            </div>
            <div class="reference-actions">
              <button
                class="mini-btn"
                :class="{ active: tracingStore.currentBinding?.referenceId === ref.id }"
                @click="bindToCurrentScheme(ref.id)"
                title="绑定到当前方案"
              >
                🔗
              </button>
              <button
                class="mini-btn danger"
                @click="handleDeleteReference(ref.id)"
                title="删除参考图"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tracingStore.currentBinding" class="section">
      <div class="section-header">
        <span class="section-title">参考图调整</span>
        <span class="binding-name">{{ currentRefName }}</span>
      </div>

      <div class="tool-modes">
        <button
          class="mode-btn"
          :class="{ active: refMode === 'draw' }"
          @click="setRefMode('draw')"
          title="快捷键: Ctrl+1"
        >
          ✏️ 绘制
        </button>
        <button
          class="mode-btn"
          :class="{ active: refMode === 'move', disabled: isLocked }"
          @click="setRefMode('move')"
          title="快捷键: Ctrl+2 (Shift+拖动也可移动)"
        >
          📐 移动
        </button>
        <button
          class="mode-btn"
          :class="{ active: refMode === 'rotate', disabled: isLocked }"
          @click="setRefMode('rotate')"
          title="快捷键: Ctrl+3"
        >
          🔄 旋转
        </button>
        <button
          class="mode-btn"
          :class="{ active: refMode === 'scale', disabled: isLocked }"
          @click="setRefMode('scale')"
          title="快捷键: Ctrl+4"
        >
          🔍 缩放
        </button>
      </div>

      <div class="slider-group">
        <div class="slider-row">
          <label>透明度</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="opacity"
            @input="handleOpacityChange"
          />
          <span class="slider-value">{{ Math.round(opacity * 100) }}%</span>
        </div>

        <div class="slider-row">
          <label>缩放</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            :value="scaleX"
            :disabled="isLocked"
            @input="handleScaleChange"
          />
          <span class="slider-value">{{ Math.round(scaleX * 100) }}%</span>
        </div>

        <div class="slider-row">
          <label>旋转</label>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            :value="rotation"
            :disabled="isLocked"
            @input="handleRotationChange"
          />
          <span class="slider-value">{{ rotation }}°</span>
        </div>
      </div>

      <div class="coordinate-group">
        <div class="coord-item">
          <label>X 位置</label>
          <input
            type="number"
            :value="Math.round(posX)"
            :disabled="isLocked"
            @input="handlePosXChange"
          />
        </div>
        <div class="coord-item">
          <label>Y 位置</label>
          <input
            type="number"
            :value="Math.round(posY)"
            :disabled="isLocked"
            @input="handlePosYChange"
          />
        </div>
      </div>

      <div class="action-row">
        <button
          class="action-btn"
          @click="tracingStore.toggleReferenceVisible()"
        >
          {{ visible ? '👁️ 隐藏' : '👁️ 显示' }}
        </button>
        <button
          class="action-btn"
          @click="tracingStore.toggleReferenceLocked()"
          :class="{ active: isLocked }"
        >
          {{ isLocked ? '🔒 已锁定' : '🔓 锁定' }}
        </button>
        <button
          class="action-btn"
          :disabled="isLocked"
          @click="handleResetTransform"
        >
          ↩️ 重置
        </button>
        <button
          class="action-btn danger"
          @click="handleUnbind"
        >
          ⛓️ 解绑
        </button>
      </div>

      <div class="keyboard-hints">
        <span class="hint">💡 Ctrl+滚轮缩放</span>
        <span class="hint">Alt+滚轮旋转</span>
        <span class="hint">Shift+滚轮平移</span>
        <span class="hint">R 重置 V 显示 L 锁定</span>
      </div>
    </div>

    <div v-if="tracingStore.currentBinding" class="section">
      <div class="section-header">
        <span class="section-title">临摹评估</span>
      </div>

      <button
        class="evaluate-btn"
        :disabled="tracingStore.isEvaluating || pyrographyStore.currentStrokes.length === 0"
        @click="handleEvaluate"
      >
        {{ tracingStore.isEvaluating ? '⏳ 评估中...' : '📊 开始评估' }}
      </button>

      <div v-if="pyrographyStore.currentStrokes.length === 0" class="hint-box">
        请先绘制一些笔触后再进行评估
      </div>

      <div v-if="tracingStore.currentTracingResult" class="tracing-result">
        <div class="score-card" :class="'grade-' + tracingStore.currentTracingResult.grade">
          <div class="total-score">
            <span class="score-value">{{ tracingStore.currentTracingResult.totalScore.toFixed(1) }}</span>
            <span class="score-unit">分</span>
          </div>
          <div class="grade-badge">{{ tracingStore.currentTracingResult.grade }}</div>
          <div class="score-date">
            {{ formatDate(tracingStore.currentTracingResult.evaluatedAt) }}
          </div>
        </div>

        <div class="metric-cards">
          <div class="metric-card deviation">
            <div class="metric-icon">📏</div>
            <div class="metric-info">
              <div class="metric-name">临摹偏差</div>
              <div class="metric-value">{{ tracingStore.currentTracingResult.totalDeviationScore.toFixed(1) }}</div>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" :style="{ width: tracingStore.currentTracingResult.totalDeviationScore + '%' }"></div>
            </div>
          </div>

          <div class="metric-card overlap">
            <div class="metric-icon">🎯</div>
            <div class="metric-info">
              <div class="metric-name">线条重合度</div>
              <div class="metric-value">{{ tracingStore.currentTracingResult.totalOverlapScore.toFixed(1) }}</div>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" :style="{ width: tracingStore.currentTracingResult.totalOverlapScore + '%' }"></div>
            </div>
          </div>

          <div class="metric-card corner">
            <div class="metric-icon">📐</div>
            <div class="metric-info">
              <div class="metric-name">转折准确率</div>
              <div class="metric-value">{{ tracingStore.currentTracingResult.totalCornerAccuracy.toFixed(1) }}</div>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" :style="{ width: tracingStore.currentTracingResult.totalCornerAccuracy + '%' }"></div>
            </div>
          </div>

          <div class="metric-card rhythm">
            <div class="metric-icon">🎵</div>
            <div class="metric-info">
              <div class="metric-name">节奏稳定性</div>
              <div class="metric-value">{{ tracingStore.currentTracingResult.totalRhythmStability.toFixed(1) }}</div>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" :style="{ width: tracingStore.currentTracingResult.totalRhythmStability + '%' }"></div>
            </div>
          </div>
        </div>

        <div v-if="tracingStore.currentTracingResult.segments.length > 0" class="segments-section">
          <div class="segments-title">分段评分（{{ tracingStore.currentTracingResult.segments.length }} 段）</div>
          <div class="segments-list">
            <div
              v-for="(seg, idx) in tracingStore.currentTracingResult.segments.slice(0, 5)"
              :key="seg.id"
              class="segment-item"
            >
              <span class="segment-index">#{{ idx + 1 }}</span>
              <span class="segment-score" :class="getScoreClass(seg.segmentScore)">
                {{ seg.segmentScore.toFixed(0) }}
              </span>
              <div class="segment-tags">
                <span v-if="seg.deviationScore < 70" class="tag deviation-tag">偏差</span>
                <span v-if="seg.overlapScore < 70" class="tag overlap-tag">重合</span>
                <span v-if="seg.cornerAccuracy < 70" class="tag corner-tag">转折</span>
                <span v-if="seg.rhythmStability < 70" class="tag rhythm-tag">节奏</span>
              </div>
            </div>
          </div>
        </div>

        <div class="suggestions-section">
          <div class="suggestions-title">💡 纠偏提示</div>
          <div class="suggestions-list">
            <div
              v-for="(sug, idx) in tracingStore.currentTracingResult.overallSuggestions"
              :key="idx"
              class="suggestion-item"
              :class="'severity-' + sug.severity"
            >
              <div class="suggestion-header">
                <span class="suggestion-type">{{ getSuggestionIcon(sug.type) }} {{ sug.title }}</span>
                <span class="suggestion-priority" :class="sug.severity">
                  {{ sug.severity === 'high' ? '重点' : sug.severity === 'medium' ? '注意' : '提示' }}
                </span>
              </div>
              <div class="suggestion-desc">{{ sug.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tracingStore.currentSchemeBindings.length > 0" class="section">
      <div class="section-header">
        <span class="section-title">当前方案绑定</span>
      </div>
      <div class="bindings-list">
        <div
          v-for="binding in tracingStore.currentSchemeBindings"
          :key="binding.id"
          class="binding-item"
          :class="{ active: binding.id === tracingStore.currentBindingId }"
          @click="tracingStore.switchBinding(binding.id)"
        >
          <div class="binding-thumb">
            <img
              v-if="getRef(binding.referenceId)"
              :src="getRef(binding.referenceId)!.dataUrl"
              :alt="getRef(binding.referenceId)!.name"
            />
          </div>
          <div class="binding-info">
            <span class="binding-ref-name">{{ truncate(getRef(binding.referenceId)?.name || '', 16) }}</span>
            <span class="binding-status">
              {{ binding.transform.visible ? '👁️' : '🚫' }}
              {{ binding.transform.locked ? '🔒' : '' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePyrographyStore } from '@/stores/pyrography'
import { useTracingStore } from '@/stores/tracing'
import type { ReferenceImage } from '@/types'

const props = defineProps<{
  canvasRef?: {
    setReferenceMode: (mode: 'draw' | 'move' | 'rotate' | 'scale') => void
    getReferenceMode: () => 'draw' | 'move' | 'rotate' | 'scale'
  } | null
}>()

const pyrographyStore = usePyrographyStore()
const tracingStore = useTracingStore()

const refMode = ref<'draw' | 'move' | 'rotate' | 'scale'>('draw')

const currentRefName = computed(() => {
  if (!tracingStore.currentReference) return ''
  return truncate(tracingStore.currentReference.name, 12)
})

const opacity = computed({
  get: () => tracingStore.currentBinding?.transform.opacity ?? 0.5,
  set: (v: number) => {
    if (tracingStore.currentBinding) {
      tracingStore.setReferenceOpacity(v)
    }
  }
})

const scaleX = computed({
  get: () => tracingStore.currentBinding?.transform.scaleX ?? 1,
  set: (v: number) => {
    if (tracingStore.currentBinding) {
      const ratio = v / scaleX.value
      tracingStore.scaleReference(ratio)
    }
  }
})

const rotation = computed({
  get: () => tracingStore.currentBinding?.transform.rotation ?? 0,
  set: (v: number) => {
    if (tracingStore.currentBinding) {
      tracingStore.updateBindingTransform(tracingStore.currentBinding.id, { rotation: v })
    }
  }
})

const posX = computed({
  get: () => tracingStore.currentBinding?.transform.x ?? 400,
  set: (v: number) => {
    if (tracingStore.currentBinding) {
      tracingStore.updateBindingTransform(tracingStore.currentBinding.id, { x: v })
    }
  }
})

const posY = computed({
  get: () => tracingStore.currentBinding?.transform.y ?? 300,
  set: (v: number) => {
    if (tracingStore.currentBinding) {
      tracingStore.updateBindingTransform(tracingStore.currentBinding.id, { y: v })
    }
  }
})

const visible = computed(() => tracingStore.currentBinding?.transform.visible ?? true)
const isLocked = computed(() => tracingStore.currentBinding?.transform.locked ?? false)

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 1) + '…'
}

function isBoundToCurrentScheme(refId: string): boolean {
  return tracingStore.currentSchemeBindings.some(b => b.referenceId === refId)
}

function getRef(refId: string): ReferenceImage | undefined {
  return tracingStore.referenceImages.find(r => r.id === refId)
}

async function handleImportReference(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    const ref = await tracingStore.importReferenceImage(file)
    if (ref) {
      tracingStore.bindReferenceToScheme(ref.id)
    }
  }

  input.value = ''
}

function handleDeleteReference(refId: string) {
  const ref = getRef(refId)
  if (!ref) return

  const usedBindings = tracingStore.referenceBindings.filter(b => b.referenceId === refId)
  let warningMsg = `确定要删除参考图「${ref.name}」吗？`

  if (usedBindings.length > 0) {
    const usedInSchemes: string[] = []
    for (const b of usedBindings) {
      const scheme = pyrographyStore.schemes.find(s => s.id === b.schemeId)
      if (scheme && scheme.strokes.length > 0) {
        usedInSchemes.push(scheme.name)
      }
    }
    if (usedInSchemes.length > 0) {
      alert(`无法删除：该参考图已绑定到方案「${usedInSchemes.join('、')}」，且已有烙画内容。为保护您的作品，请先删除对应方案中的烙画，或删除对应方案后再操作。`)
      return
    }
    warningMsg += `\n该参考图已绑定到 ${usedBindings.length} 个方案，解绑信息将一并删除。`
  }

  if (confirm(warningMsg)) {
    tracingStore.deleteReferenceImage(refId)
  }
}

function bindToCurrentScheme(refId: string) {
  tracingStore.bindReferenceToScheme(refId)
  setRefMode('draw')
}

function handleUnbind() {
  if (!tracingStore.currentBinding) return
  if (confirm('确定要解绑该参考图吗？位置、缩放等设置会丢失，但评分记录会保留。')) {
    tracingStore.unbindReferenceFromScheme(tracingStore.currentBinding.id)
  }
}

function handleOpacityChange(e: Event) {
  const target = e.target as HTMLInputElement
  opacity.value = parseFloat(target.value)
}

function handleScaleChange(e: Event) {
  const target = e.target as HTMLInputElement
  scaleX.value = parseFloat(target.value)
}

function handleRotationChange(e: Event) {
  const target = e.target as HTMLInputElement
  rotation.value = parseFloat(target.value)
}

function handlePosXChange(e: Event) {
  const target = e.target as HTMLInputElement
  posX.value = parseFloat(target.value) || 0
}

function handlePosYChange(e: Event) {
  const target = e.target as HTMLInputElement
  posY.value = parseFloat(target.value) || 0
}

function handleResetTransform() {
  if (tracingStore.currentBinding) {
    tracingStore.resetBindingTransform(tracingStore.currentBinding.id)
  }
}

async function handleEvaluate() {
  await tracingStore.evaluateTracing()
}

function setRefMode(mode: 'draw' | 'move' | 'rotate' | 'scale') {
  refMode.value = mode
  if (props.canvasRef) {
    props.canvasRef.setReferenceMode(mode)
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-high'
  if (score >= 70) return 'score-mid'
  if (score >= 60) return 'score-low'
  return 'score-bad'
}

function getSuggestionIcon(type: string): string {
  switch (type) {
    case 'deviation': return '📏'
    case 'overlap': return '🎯'
    case 'corner': return '📐'
    case 'rhythm': return '🎵'
    default: return '💡'
  }
}

onMounted(() => {
  tracingStore.init()
})
</script>

<style scoped>
.tracing-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header {
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 4px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 2px;
}

.panel-subtitle {
  font-size: 11px;
  color: #6b7280;
}

.section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.binding-name {
  font-size: 11px;
  color: #6366f1;
  font-weight: 500;
}

.hidden-input {
  display: none;
}

.import-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.empty-state {
  text-align: center;
  padding: 20px 10px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 12px;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 10px;
  color: #d1d5db;
}

.reference-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.reference-item {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  transition: all 0.2s;
}

.reference-item:hover {
  border-color: #c7d2fe;
}

.reference-item.active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.reference-item.bound {
  background: linear-gradient(to right, #eef2ff 0%, #ffffff 100%);
}

.reference-preview {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid #e5e7eb;
}

.reference-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reference-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.reference-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reference-name {
  font-size: 12px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bound-badge {
  font-size: 9px;
  padding: 1px 5px;
  background: #d1fae5;
  color: #059669;
  border-radius: 8px;
  font-weight: 500;
  flex-shrink: 0;
}

.reference-meta {
  font-size: 10px;
  color: #9ca3af;
}

.reference-actions {
  display: flex;
  gap: 4px;
}

.mini-btn {
  width: 22px;
  height: 22px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.mini-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.mini-btn.active {
  background: #eef2ff;
  border-color: #6366f1;
}

.mini-btn.danger:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.tool-modes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.mode-btn {
  padding: 6px 4px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  color: #4b5563;
}

.mode-btn:hover:not(.disabled) {
  border-color: #c7d2fe;
  background: #eef2ff;
}

.mode-btn.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-color: transparent;
  font-weight: 500;
}

.mode-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-row label {
  width: 42px;
  font-size: 11px;
  color: #6b7280;
  flex-shrink: 0;
}

.slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}

.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #6366f1;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.slider-row input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-row input[type="range"]:disabled {
  opacity: 0.4;
}

.slider-value {
  width: 38px;
  text-align: right;
  font-size: 10px;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.coordinate-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}

.coord-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.coord-item label {
  font-size: 10px;
  color: #6b7280;
  width: 40px;
}

.coord-item input {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  min-width: 0;
}

.coord-item input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.action-btn {
  padding: 5px 2px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 5px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  color: #4b5563;
}

.action-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.action-btn.active {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.action-btn.danger {
  color: #b91c1c;
}

.action-btn.danger:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.keyboard-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 6px 8px;
  background: #fffbeb;
  border-radius: 4px;
  border: 1px solid #fde68a;
}

.hint {
  font-size: 9px;
  color: #92400e;
}

.evaluate-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 10px;
}

.evaluate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.evaluate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint-box {
  padding: 8px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  font-size: 11px;
  color: #92400e;
  margin-bottom: 10px;
}

.tracing-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
}

.score-card.grade-A { background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #10b981; }
.score-card.grade-B { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-color: #3b82f6; }
.score-card.grade-C { background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%); border-color: #eab308; }
.score-card.grade-D { background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%); border-color: #f97316; }
.score-card.grade-F { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-color: #ef4444; }

.total-score {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.score-value {
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.score-unit {
  font-size: 12px;
  color: #6b7280;
}

.grade-badge {
  padding: 4px 10px;
  background: rgba(255,255,255,0.7);
  border-radius: 6px;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.score-date {
  flex: 1;
  text-align: right;
  font-size: 10px;
  color: #6b7280;
}

.metric-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.metric-card {
  padding: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.metric-card.deviation::before { background: #f59e0b; }
.metric-card.overlap::before { background: #10b981; }
.metric-card.corner::before { background: #6366f1; }
.metric-card.rhythm::before { background: #ec4899; }

.metric-icon {
  font-size: 14px;
  margin-bottom: 2px;
}

.metric-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.metric-name {
  font-size: 10px;
  color: #6b7280;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

.metric-bar {
  height: 3px;
  background: #f3f4f6;
  border-radius: 2px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.segments-section {
  margin-top: 4px;
}

.segments-title {
  font-size: 11px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.segment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 10px;
}

.segment-index {
  color: #9ca3af;
  font-weight: 500;
  width: 24px;
}

.segment-score {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  width: 28px;
}

.segment-score.score-high { color: #059669; }
.segment-score.score-mid { color: #3b82f6; }
.segment-score.score-low { color: #eab308; }
.segment-score.score-bad { color: #ef4444; }

.segment-tags {
  display: flex;
  gap: 3px;
  flex: 1;
  flex-wrap: wrap;
}

.tag {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 500;
}

.deviation-tag { background: #fef3c7; color: #92400e; }
.overlap-tag { background: #d1fae5; color: #065f46; }
.corner-tag { background: #e0e7ff; color: #3730a3; }
.rhythm-tag { background: #fce7f3; color: #9d174d; }

.suggestions-section {
  margin-top: 4px;
}

.suggestions-title {
  font-size: 11px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.suggestion-item {
  padding: 6px 8px;
  border-radius: 5px;
  border-left: 3px solid;
  background: #fafafa;
}

.suggestion-item.severity-high {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.suggestion-item.severity-medium {
  background: #fffbeb;
  border-left-color: #f59e0b;
}

.suggestion-item.severity-low {
  background: #f0fdf4;
  border-left-color: #10b981;
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.suggestion-type {
  font-size: 11px;
  font-weight: 600;
  color: #1f2937;
}

.suggestion-priority {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 500;
}

.suggestion-priority.high {
  background: #fee2e2;
  color: #b91c1c;
}

.suggestion-priority.medium {
  background: #fef3c7;
  color: #92400e;
}

.suggestion-priority.low {
  background: #d1fae5;
  color: #065f46;
}

.suggestion-desc {
  font-size: 10px;
  color: #6b7280;
  line-height: 1.4;
}

.bindings-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.binding-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 0;
}

.binding-item:hover {
  border-color: #c7d2fe;
}

.binding-item.active {
  border-color: #6366f1;
  background: #eef2ff;
}

.binding-thumb {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
}

.binding-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.binding-info {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.binding-ref-name {
  font-size: 11px;
  color: #374151;
  font-weight: 500;
}

.binding-status {
  font-size: 10px;
  flex-shrink: 0;
}
</style>
