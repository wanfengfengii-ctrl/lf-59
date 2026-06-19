import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ReferenceImage,
  ReferenceBinding,
  ReferenceTransform,
  TracingResult,
  Point
} from '@/types'
import { MAX_REFERENCE_IMAGES } from '@/types'
import {
  generateReferenceId,
  generateReferenceBindingId,
  createDefaultTransform,
  loadImageToDataUrl,
  extractReferenceEdges,
  evaluateTracingResult
} from '@/utils/pyrography'
import { usePyrographyStore } from './pyrography'

interface ReferenceEdgeCache {
  [referenceId: string]: {
    points: Point[]
    width: number
    height: number
  }
}

export const useTracingStore = defineStore('tracing', () => {
  const referenceImages = ref<ReferenceImage[]>([])
  const referenceBindings = ref<ReferenceBinding[]>([])
  const tracingResults = ref<TracingResult[]>([])
  const currentBindingId = ref<string>('')
  const isEvaluating = ref(false)
  const lastError = ref<string>('')

  const edgeCache = ref<ReferenceEdgeCache>({})

  const currentSchemeBindings = computed<ReferenceBinding[]>(() => {
    const pyrographyStore = usePyrographyStore()
    const schemeId = pyrographyStore.currentSchemeId
    return referenceBindings.value.filter(b => b.schemeId === schemeId)
  })

  const currentBinding = computed<ReferenceBinding | undefined>(() => {
    return referenceBindings.value.find(b => b.id === currentBindingId.value)
  })

  const currentReference = computed<ReferenceImage | undefined>(() => {
    if (!currentBinding.value) return undefined
    return referenceImages.value.find(r => r.id === currentBinding.value!.referenceId)
  })

  const currentTracingResult = computed<TracingResult | undefined>(() => {
    const pyrographyStore = usePyrographyStore()
    const schemeId = pyrographyStore.currentSchemeId
    if (!currentBinding.value) return undefined
    return tracingResults.value.find(
      r => r.schemeId === schemeId && r.referenceId === currentBinding.value!.referenceId
    )
  })

  function init() {
    // 预留初始化逻辑
  }

  async function importReferenceImage(file: File): Promise<ReferenceImage | null> {
    if (referenceImages.value.length >= MAX_REFERENCE_IMAGES) {
      lastError.value = `最多支持 ${MAX_REFERENCE_IMAGES} 张参考图`
      return null
    }

    try {
      const { dataUrl, width, height } = await loadImageToDataUrl(file)

      const reference: ReferenceImage = {
        id: generateReferenceId(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        dataUrl,
        originalWidth: width,
        originalHeight: height,
        createdAt: Date.now()
      }

      referenceImages.value.push(reference)

      try {
        const edges = await extractReferenceEdges(dataUrl)
        edgeCache.value[reference.id] = edges
      } catch {
        // 边缘提取失败不影响参考图导入
      }

      lastError.value = `成功导入参考图：${reference.name}`
      return reference
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : '参考图导入失败'
      return null
    }
  }

  function deleteReferenceImage(referenceId: string): boolean {
    const usedBindings = referenceBindings.value.filter(b => b.referenceId === referenceId)
    if (usedBindings.length > 0) {
      const pyrographyStore = usePyrographyStore()
      const schemeStrokes: Record<string, number> = {}
      for (const binding of usedBindings) {
        const scheme = pyrographyStore.schemes.find(s => s.id === binding.schemeId)
        if (scheme && scheme.strokes.length > 0) {
          schemeStrokes[binding.schemeId] = scheme.strokes.length
        }
      }

      const hasExistingWork = Object.values(schemeStrokes).some(count => count > 0)
      if (hasExistingWork) {
        const schemeNames = Object.keys(schemeStrokes)
          .map(id => pyrographyStore.schemes.find(s => s.id === id)?.name)
          .filter(Boolean)
          .join('、')
        lastError.value = `该参考图已绑定到方案「${schemeNames}」，且已有烙画内容。为保护作品，不能直接删除。`
        return false
      }
    }

    const idx = referenceImages.value.findIndex(r => r.id === referenceId)
    if (idx === -1) return false

    referenceImages.value.splice(idx, 1)
    delete edgeCache.value[referenceId]

    const bindingsToRemove = referenceBindings.value.filter(b => b.referenceId === referenceId)
    for (const binding of bindingsToRemove) {
      const bIdx = referenceBindings.value.findIndex(b => b.id === binding.id)
      if (bIdx !== -1) {
        referenceBindings.value.splice(bIdx, 1)
      }
      if (currentBindingId.value === binding.id) {
        currentBindingId.value = ''
      }
    }

    tracingResults.value = tracingResults.value.filter(r => r.referenceId !== referenceId)

    lastError.value = '参考图已删除'
    return true
  }

  function renameReferenceImage(referenceId: string, name: string) {
    const ref = referenceImages.value.find(r => r.id === referenceId)
    if (ref) {
      ref.name = name
    }
  }

  function bindReferenceToScheme(
    referenceId: string,
    schemeId?: string,
    initialTransform?: Partial<ReferenceTransform>
  ): ReferenceBinding | null {
    const pyrographyStore = usePyrographyStore()
    const targetSchemeId = schemeId || pyrographyStore.currentSchemeId

    if (!targetSchemeId) {
      lastError.value = '请先选择一个方案'
      return null
    }

    const reference = referenceImages.value.find(r => r.id === referenceId)
    if (!reference) {
      lastError.value = '参考图不存在'
      return null
    }

    const existingBinding = referenceBindings.value.find(
      b => b.schemeId === targetSchemeId && b.referenceId === referenceId
    )
    if (existingBinding) {
      currentBindingId.value = existingBinding.id
      lastError.value = '该参考图已绑定到当前方案'
      return existingBinding
    }

    const defaultTransform = createDefaultTransform()
    if (initialTransform) {
      Object.assign(defaultTransform, initialTransform)
    }

    const binding: ReferenceBinding = {
      id: generateReferenceBindingId(),
      referenceId,
      schemeId: targetSchemeId,
      transform: defaultTransform,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    referenceBindings.value.push(binding)
    currentBindingId.value = binding.id

    if (!edgeCache.value[referenceId]) {
      extractReferenceEdges(reference.dataUrl).then(edges => {
        edgeCache.value[referenceId] = edges
      }).catch(() => {
        // 忽略缓存失败
      })
    }

    lastError.value = `已将「${reference.name}」绑定到当前方案`
    return binding
  }

  function unbindReferenceFromScheme(bindingId: string) {
    const idx = referenceBindings.value.findIndex(b => b.id === bindingId)
    if (idx !== -1) {
      referenceBindings.value.splice(idx, 1)
    }
    if (currentBindingId.value === bindingId) {
      currentBindingId.value = ''
    }
  }

  function switchBinding(bindingId: string) {
    const binding = referenceBindings.value.find(b => b.id === bindingId)
    if (binding) {
      currentBindingId.value = bindingId
    }
  }

  function updateBindingTransform(
    bindingId: string,
    updates: Partial<ReferenceTransform>
  ) {
    const binding = referenceBindings.value.find(b => b.id === bindingId)
    if (binding) {
      Object.assign(binding.transform, updates)
      binding.updatedAt = Date.now()
    }
  }

  function resetBindingTransform(bindingId: string) {
    const binding = referenceBindings.value.find(b => b.id === bindingId)
    if (binding) {
      binding.transform = createDefaultTransform()
      binding.updatedAt = Date.now()
    }
  }

  function moveReference(deltaX: number, deltaY: number) {
    if (!currentBinding.value) return
    if (currentBinding.value.transform.locked) return
    updateBindingTransform(currentBinding.value.id, {
      x: currentBinding.value.transform.x + deltaX,
      y: currentBinding.value.transform.y + deltaY
    })
  }

  function scaleReference(scaleFactor: number, centerX?: number, centerY?: number) {
    if (!currentBinding.value) return
    if (currentBinding.value.transform.locked) return

    const transform = currentBinding.value.transform
    const newScaleX = Math.max(0.1, Math.min(5, transform.scaleX * scaleFactor))
    const newScaleY = Math.max(0.1, Math.min(5, transform.scaleY * scaleFactor))

    if (centerX !== undefined && centerY !== undefined) {
      const cx = transform.x
      const cy = transform.y
      const ratioX = newScaleX / transform.scaleX
      const ratioY = newScaleY / transform.scaleY
      const newX = centerX - (centerX - cx) * ratioX
      const newY = centerY - (centerY - cy) * ratioY

      updateBindingTransform(currentBinding.value.id, {
        scaleX: newScaleX,
        scaleY: newScaleY,
        x: newX,
        y: newY
      })
    } else {
      updateBindingTransform(currentBinding.value.id, {
        scaleX: newScaleX,
        scaleY: newScaleY
      })
    }
  }

  function rotateReference(deltaAngle: number) {
    if (!currentBinding.value) return
    if (currentBinding.value.transform.locked) return
    const transform = currentBinding.value.transform
    let newRotation = transform.rotation + deltaAngle
    while (newRotation >= 360) newRotation -= 360
    while (newRotation < 0) newRotation += 360
    updateBindingTransform(currentBinding.value.id, { rotation: newRotation })
  }

  function setReferenceOpacity(opacity: number) {
    if (!currentBinding.value) return
    updateBindingTransform(currentBinding.value.id, {
      opacity: Math.max(0, Math.min(1, opacity))
    })
  }

  function toggleReferenceVisible() {
    if (!currentBinding.value) return
    updateBindingTransform(currentBinding.value.id, {
      visible: !currentBinding.value.transform.visible
    })
  }

  function toggleReferenceLocked() {
    if (!currentBinding.value) return
    updateBindingTransform(currentBinding.value.id, {
      locked: !currentBinding.value.transform.locked
    })
  }

  async function evaluateTracing(): Promise<TracingResult | null> {
    if (!currentBinding.value || !currentReference.value) {
      lastError.value = '请先选择并绑定一张参考图'
      return null
    }

    const pyrographyStore = usePyrographyStore()
    const scheme = pyrographyStore.currentScheme
    if (!scheme || scheme.strokes.length === 0) {
      lastError.value = '请先绘制一些笔触后再评估'
      return null
    }

    isEvaluating.value = true
    lastError.value = ''

    try {
      let edges = edgeCache.value[currentReference.value.id]
      if (!edges) {
        edges = await extractReferenceEdges(currentReference.value.dataUrl)
        edgeCache.value[currentReference.value.id] = edges
      }

      const result = evaluateTracingResult(
        scheme.strokes,
        edges.points,
        currentBinding.value.transform,
        edges.width,
        edges.height,
        scheme.id,
        currentReference.value.id
      )

      const existingIdx = tracingResults.value.findIndex(
        r => r.schemeId === result.schemeId && r.referenceId === result.referenceId
      )
      if (existingIdx !== -1) {
        tracingResults.value.splice(existingIdx, 1)
      }
      tracingResults.value.push(result)

      isEvaluating.value = false
      lastError.value = `临摹评估完成：综合评分 ${result.totalScore.toFixed(1)} 分 (${result.grade})`
      return result
    } catch (err) {
      isEvaluating.value = false
      lastError.value = err instanceof Error ? err.message : '评估失败'
      return null
    }
  }

  function clearTracingResult(schemeId: string, referenceId: string) {
    const idx = tracingResults.value.findIndex(
      r => r.schemeId === schemeId && r.referenceId === referenceId
    )
    if (idx !== -1) {
      tracingResults.value.splice(idx, 1)
    }
  }

  function getTracingResultsForScheme(schemeId: string): TracingResult[] {
    return tracingResults.value.filter(r => r.schemeId === schemeId)
  }

  function getBindingsForScheme(schemeId: string): ReferenceBinding[] {
    return referenceBindings.value.filter(b => b.schemeId === schemeId)
  }

  function clearError() {
    lastError.value = ''
  }

  function setImportedData(data: {
    referenceImages: ReferenceImage[]
    referenceBindings: ReferenceBinding[]
    tracingResults: TracingResult[]
  }) {
    if (data.referenceImages && Array.isArray(data.referenceImages)) {
      referenceImages.value = data.referenceImages
    }
    if (data.referenceBindings && Array.isArray(data.referenceBindings)) {
      referenceBindings.value = data.referenceBindings
      if (referenceBindings.value.length > 0 && !currentBindingId.value) {
        const pyrographyStore = usePyrographyStore()
        const firstBindingForScheme = referenceBindings.value.find(
          b => b.schemeId === pyrographyStore.currentSchemeId
        )
        if (firstBindingForScheme) {
          currentBindingId.value = firstBindingForScheme.id
        }
      }
    }
    if (data.tracingResults && Array.isArray(data.tracingResults)) {
      tracingResults.value = data.tracingResults
    }
  }

  return {
    referenceImages,
    referenceBindings,
    tracingResults,
    currentBindingId,
    isEvaluating,
    lastError,
    currentSchemeBindings,
    currentBinding,
    currentReference,
    currentTracingResult,
    init,
    importReferenceImage,
    deleteReferenceImage,
    renameReferenceImage,
    bindReferenceToScheme,
    unbindReferenceFromScheme,
    switchBinding,
    updateBindingTransform,
    resetBindingTransform,
    moveReference,
    scaleReference,
    rotateReference,
    setReferenceOpacity,
    toggleReferenceVisible,
    toggleReferenceLocked,
    evaluateTracing,
    clearTracingResult,
    getTracingResultsForScheme,
    getBindingsForScheme,
    clearError,
    setImportedData
  }
})
