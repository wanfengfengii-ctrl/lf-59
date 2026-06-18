<template>
  <div class="stats-panel">
    <h3 class="panel-title">分层烙画训练分析</h3>

    <div v-if="store.currentScore" class="score-section">
      <div class="score-header">
        <div :class="['score-grade', store.currentScore.grade]">
          {{ store.currentScore.grade }}
        </div>
        <div class="score-detail">
          <div class="score-total">{{ store.currentScore.totalScore.toFixed(1) }}</div>
          <div class="score-label">综合评分</div>
        </div>
      </div>

      <div class="score-breakdown">
        <div class="score-bar-item">
          <div class="score-bar-label">过烧控制</div>
          <div class="score-bar-track">
            <div
              class="score-bar-fill"
              :style="{ width: store.currentScore.overburnScore + '%', background: getScoreColor(store.currentScore.overburnScore) }"
            ></div>
          </div>
          <span class="score-bar-value">{{ store.currentScore.overburnScore.toFixed(0) }}</span>
        </div>
        <div class="score-bar-item">
          <div class="score-bar-label">颜色过渡</div>
          <div class="score-bar-track">
            <div
              class="score-bar-fill"
              :style="{ width: store.currentScore.colorTransitionScore + '%', background: getScoreColor(store.currentScore.colorTransitionScore) }"
            ></div>
          </div>
          <span class="score-bar-value">{{ store.currentScore.colorTransitionScore.toFixed(0) }}</span>
        </div>
        <div class="score-bar-item">
          <div class="score-bar-label">线条均匀度</div>
          <div class="score-bar-track">
            <div
              class="score-bar-fill"
              :style="{ width: store.currentScore.lineUniformityScore + '%', background: getScoreColor(store.currentScore.lineUniformityScore) }"
            ></div>
          </div>
          <span class="score-bar-value">{{ store.currentScore.lineUniformityScore.toFixed(0) }}</span>
        </div>
        <div class="score-bar-item">
          <div class="score-bar-label">参数稳定性</div>
          <div class="score-bar-track">
            <div
              class="score-bar-fill"
              :style="{ width: store.currentScore.parameterStabilityScore + '%', background: getScoreColor(store.currentScore.parameterStabilityScore) }"
            ></div>
          </div>
          <span class="score-bar-value">{{ store.currentScore.parameterStabilityScore.toFixed(0) }}</span>
        </div>
      </div>

      <div v-if="store.currentScore.layerScores.length > 0" class="layer-scores">
        <h4 class="sub-title">图层评分</h4>
        <div
          v-for="ls in store.currentScore.layerScores"
          :key="ls.layerId"
          class="layer-score-item"
        >
          <div class="layer-score-name">{{ ls.layerName }}</div>
          <div class="layer-score-bar-track">
            <div
              class="layer-score-bar-fill"
              :style="{ width: ls.score + '%', background: getScoreColor(ls.score) }"
            ></div>
          </div>
          <span class="layer-score-value">{{ ls.score.toFixed(0) }}</span>
        </div>
      </div>

      <div v-if="store.currentScore.suggestions.length > 0" class="suggestions">
        <h4 class="sub-title">训练建议</h4>
        <div
          v-for="(sug, idx) in store.currentScore.suggestions"
          :key="idx"
          :class="['suggestion-item', sug.priority]"
        >
          <div class="suggestion-header">
            <span :class="['suggestion-priority', sug.priority]">
              {{ sug.priority === 'high' ? '🔴' : sug.priority === 'medium' ? '🟡' : '🟢' }}
            </span>
            <span class="suggestion-title">{{ sug.title }}</span>
          </div>
          <p class="suggestion-desc">{{ sug.description }}</p>
        </div>
      </div>
    </div>

    <div v-else class="no-score">
      <p>点击左侧面板的「📊 评分」按钮获取评分和训练建议</p>
    </div>

    <div class="charts-container">
      <div class="chart-card">
        <h4 class="chart-title">过烧风险分析</h4>
        <div ref="riskChartRef" class="chart-content"></div>
      </div>

      <div class="chart-card">
        <h4 class="chart-title">线条均匀度</h4>
        <div ref="uniformityChartRef" class="chart-content"></div>
      </div>

      <div class="chart-card wide">
        <h4 class="chart-title">颜色深浅分布</h4>
        <div ref="distributionChartRef" class="chart-content"></div>
      </div>

      <div class="chart-card wide">
        <h4 class="chart-title">笔画参数概览</h4>
        <div ref="paramsChartRef" class="chart-content"></div>
      </div>

      <div v-if="store.statistics.layerStats.length > 0" class="chart-card wide">
        <h4 class="chart-title">各图层对比</h4>
        <div ref="layerCompareRef" class="chart-content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { usePyrographyStore } from '@/stores/pyrography'
import type { Stroke } from '@/types'

const store = usePyrographyStore()

const riskChartRef = ref<HTMLDivElement | null>(null)
const uniformityChartRef = ref<HTMLDivElement | null>(null)
const distributionChartRef = ref<HTMLDivElement | null>(null)
const paramsChartRef = ref<HTMLDivElement | null>(null)
const layerCompareRef = ref<HTMLDivElement | null>(null)

let riskChart: echarts.ECharts | null = null
let uniformityChart: echarts.ECharts | null = null
let distributionChart: echarts.ECharts | null = null
let paramsChart: echarts.ECharts | null = null
let layerCompareChart: echarts.ECharts | null = null

function getScoreColor(score: number): string {
  if (score >= 80) return '#48bb78'
  if (score >= 60) return '#ecc94b'
  return '#ef4444'
}

function initCharts() {
  if (riskChartRef.value) {
    riskChart = echarts.init(riskChartRef.value)
  }
  if (uniformityChartRef.value) {
    uniformityChart = echarts.init(uniformityChartRef.value)
  }
  if (distributionChartRef.value) {
    distributionChart = echarts.init(distributionChartRef.value)
  }
  if (paramsChartRef.value) {
    paramsChart = echarts.init(paramsChartRef.value)
  }
  if (layerCompareRef.value) {
    layerCompareChart = echarts.init(layerCompareRef.value)
  }
  updateCharts()
}

function getStrokesAnalysis(strokes: Stroke[]) {
  const normalCount = strokes.filter((s) => !s.isOverburned).length
  const overburnedCount = strokes.filter((s) => s.isOverburned).length

  const tempStats = { avg: 0, min: Infinity, max: -Infinity }
  const speedStats = { avg: 0, min: Infinity, max: -Infinity }

  strokes.forEach((s) => {
    tempStats.avg += s.temperature
    tempStats.min = Math.min(tempStats.min, s.temperature)
    tempStats.max = Math.max(tempStats.max, s.temperature)

    speedStats.avg += s.speed
    speedStats.min = Math.min(speedStats.min, s.speed)
    speedStats.max = Math.max(speedStats.max, s.speed)
  })

  if (strokes.length > 0) {
    tempStats.avg /= strokes.length
    speedStats.avg /= strokes.length
  } else {
    tempStats.min = 0
    tempStats.max = 0
    speedStats.min = 0
    speedStats.max = 0
  }

  return { normalCount, overburnedCount, tempStats, speedStats }
}

function updateRiskChart() {
  if (!riskChart) return
  const { normalCount, overburnedCount } = getStrokesAnalysis(store.currentStrokes)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 笔 ({d}%)'
    },
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' }
        },
        data: [
          {
            value: normalCount,
            name: '正常',
            itemStyle: { color: '#48bb78' }
          },
          {
            value: overburnedCount,
            name: '过烧',
            itemStyle: { color: '#ef4444' }
          }
        ]
      }
    ]
  }
  riskChart.setOption(option)
}

function updateUniformityChart() {
  if (!uniformityChart) return
  const stats = store.statistics

  const option: echarts.EChartsOption = {
    tooltip: { formatter: '{b}: {c}%' },
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: stats.uniformity >= 80 ? '#48bb78' : stats.uniformity >= 50 ? '#ecc94b' : '#ef4444'
        },
        progress: { show: true, width: 18 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 18 } },
        axisTick: {
          distance: -24,
          splitNumber: 5,
          lineStyle: { width: 2, color: '#999' }
        },
        splitLine: {
          distance: -28,
          length: 10,
          lineStyle: { width: 3, color: '#666' }
        },
        axisLabel: {
          distance: -16,
          color: '#666',
          fontSize: 9
        },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 36,
          borderRadius: 6,
          offsetCenter: [0, '-15%'],
          fontSize: 24,
          fontWeight: 'bold',
          formatter: '{value}%',
          color: stats.uniformity >= 80 ? '#48bb78' : stats.uniformity >= 50 ? '#ecc94b' : '#ef4444'
        },
        data: [{ value: Number(stats.uniformity.toFixed(1)) }]
      }
    ]
  }
  uniformityChart.setOption(option)
}

function updateDistributionChart() {
  if (!distributionChart) return
  const dist = store.statistics.depthDistribution
  const labels = ['极浅', '浅', '中等', '深', '极深']
  const colors = ['#f6e5b3', '#d4a574', '#8b5a2b', '#5d3a1a', '#2d1810']

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: '{b}: {c} 笔'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '笔画数',
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        type: 'bar',
        data: dist.map((v, i) => ({
          value: v,
          itemStyle: {
            color: colors[i],
            borderRadius: [4, 4, 0, 0]
          }
        })),
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          color: '#666'
        }
      }
    ]
  }
  distributionChart.setOption(option)
}

function updateParamsChart() {
  if (!paramsChart) return
  const strokes = store.currentStrokes

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['温度', '速度'],
      top: 0,
      textStyle: { fontSize: 11 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      name: '笔画序号',
      nameTextStyle: { fontSize: 10 },
      data: strokes.length > 0 ? strokes.map((_, i) => `${i + 1}`) : [],
      axisLabel: { fontSize: 9 }
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 (°C)',
        nameTextStyle: { fontSize: 10 },
        position: 'left',
        axisLabel: { fontSize: 10 }
      },
      {
        type: 'value',
        name: '速度',
        nameTextStyle: { fontSize: 10 },
        position: 'right',
        axisLabel: { fontSize: 10 }
      }
    ],
    series: [
      {
        name: '温度',
        type: 'bar',
        yAxisIndex: 0,
        data: strokes.map((s) => ({
          value: s.temperature,
          itemStyle: {
            color: s.temperature >= 350 ? '#ef4444' : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ff6b35' },
              { offset: 1, color: '#f7c59f' }
            ]),
            borderRadius: [3, 3, 0, 0]
          }
        })),
        barWidth: '35%'
      },
      {
        name: '速度',
        type: 'line',
        yAxisIndex: 1,
        data: strokes.map((s) => s.speed),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#4299e1' },
        itemStyle: { color: '#4299e1' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(66, 153, 225, 0.3)' },
            { offset: 1, color: 'rgba(66, 153, 225, 0.02)' }
          ])
        }
      }
    ]
  }
  paramsChart.setOption(option)
}

function updateLayerCompareChart() {
  if (!layerCompareChart) return
  const layerStats = store.statistics.layerStats
  if (layerStats.length === 0) return

  const names = layerStats.map((ls) => ls.layerName)
  const temps = layerStats.map((ls) => ls.averageTemperature)
  const uniformities = layerStats.map((ls) => ls.uniformity)
  const overburnedCounts = layerStats.map((ls) => ls.overburnedCount)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['平均温度', '均匀度', '过烧数'],
      top: 0,
      textStyle: { fontSize: 11 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        name: '温度/均匀度',
        nameTextStyle: { fontSize: 10 },
        position: 'left',
        axisLabel: { fontSize: 10 }
      },
      {
        type: 'value',
        name: '过烧数',
        nameTextStyle: { fontSize: 10 },
        position: 'right',
        axisLabel: { fontSize: 10 }
      }
    ],
    series: [
      {
        name: '平均温度',
        type: 'bar',
        yAxisIndex: 0,
        data: temps.map((t) => ({
          value: Number(t.toFixed(0)),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ff6b35' },
              { offset: 1, color: '#f7c59f' }
            ]),
            borderRadius: [3, 3, 0, 0]
          }
        })),
        barWidth: '25%'
      },
      {
        name: '均匀度',
        type: 'line',
        yAxisIndex: 0,
        data: uniformities.map((u) => Number(u.toFixed(1))),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#48bb78' },
        itemStyle: { color: '#48bb78' }
      },
      {
        name: '过烧数',
        type: 'bar',
        yAxisIndex: 1,
        data: overburnedCounts.map((c) => ({
          value: c,
          itemStyle: {
            color: '#ef4444',
            borderRadius: [3, 3, 0, 0]
          }
        })),
        barWidth: '20%'
      }
    ]
  }
  layerCompareChart.setOption(option)
}

function updateCharts() {
  updateRiskChart()
  updateUniformityChart()
  updateDistributionChart()
  updateParamsChart()
  updateLayerCompareChart()
}

function handleResize() {
  riskChart?.resize()
  uniformityChart?.resize()
  distributionChart?.resize()
  paramsChart?.resize()
  layerCompareChart?.resize()
}

watch(
  () => [store.currentStrokes, store.statistics, store.currentSchemeId, store.currentScore],
  () => updateCharts(),
  { deep: true }
)

onMounted(() => {
  initCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  riskChart?.dispose()
  uniformityChart?.dispose()
  distributionChart?.dispose()
  paramsChart?.dispose()
  layerCompareChart?.dispose()
})
</script>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.score-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.score-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.score-grade {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.score-grade.A { background: linear-gradient(135deg, #48bb78, #38a169); }
.score-grade.B { background: linear-gradient(135deg, #4299e1, #3182ce); }
.score-grade.C { background: linear-gradient(135deg, #ecc94b, #d69e2e); }
.score-grade.D { background: linear-gradient(135deg, #ed8936, #dd6b20); }
.score-grade.F { background: linear-gradient(135deg, #ef4444, #c53030); }

.score-detail {
  display: flex;
  flex-direction: column;
}

.score-total {
  font-size: 32px;
  font-weight: 800;
  color: #333;
  line-height: 1.1;
}

.score-label {
  font-size: 12px;
  color: #888;
}

.score-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-bar-label {
  font-size: 12px;
  color: #555;
  min-width: 70px;
  white-space: nowrap;
}

.score-bar-track {
  flex: 1;
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s ease;
}

.score-bar-value {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  min-width: 28px;
  text-align: right;
}

.layer-scores {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #555;
  padding-bottom: 6px;
  border-bottom: 1px solid #eee;
}

.layer-score-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.layer-score-name {
  font-size: 12px;
  color: #555;
  min-width: 50px;
}

.layer-score-bar-track {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.layer-score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.layer-score-value {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  min-width: 24px;
  text-align: right;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid #ccc;
  background: #fafafa;
}

.suggestion-item.high {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.suggestion-item.medium {
  border-left-color: #ecc94b;
  background: #fffff0;
}

.suggestion-item.low {
  border-left-color: #48bb78;
  background: #f0fff4;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.suggestion-priority {
  font-size: 10px;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.suggestion-desc {
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.no-score {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 13px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-card {
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
}

.chart-card.wide {
  grid-column: span 2;
}

.chart-title {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.chart-content {
  flex: 1;
  min-height: 160px;
}

.chart-card.wide .chart-content {
  min-height: 200px;
}
</style>
