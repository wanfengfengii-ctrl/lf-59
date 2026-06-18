<template>
  <div class="stats-panel">
    <h3 class="panel-title">烙画数据分析</h3>

    <div class="charts-container">
      <div class="chart-card">
        <h4 class="chart-title">过烧风险分析</h4>
        <div ref="riskChartRef" class="chart-content"></div>
      </div>

      <div class="chart-card">
        <h4 class="chart-title">线条均匀度分析</h4>
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

let riskChart: echarts.ECharts | null = null
let uniformityChart: echarts.ECharts | null = null
let distributionChart: echarts.ECharts | null = null
let paramsChart: echarts.ECharts | null = null

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
      textStyle: { fontSize: 12 }
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
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
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
    tooltip: {
      formatter: '{b}: {c}%'
    },
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
        progress: {
          show: true,
          width: 20
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 20
          }
        },
        axisTick: {
          distance: -28,
          splitNumber: 5,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        splitLine: {
          distance: -32,
          length: 12,
          lineStyle: {
            width: 3,
            color: '#666'
          }
        },
        axisLabel: {
          distance: -20,
          color: '#666',
          fontSize: 10
        },
        anchor: {
          show: false
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 40,
          borderRadius: 8,
          offsetCenter: [0, '-15%'],
          fontSize: 28,
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
      axisPointer: {
        type: 'shadow'
      },
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
      axisLabel: {
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      name: '笔画数',
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 11 }
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
          fontSize: 12,
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
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['温度', '速度'],
      top: 0,
      textStyle: { fontSize: 12 }
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
      nameTextStyle: { fontSize: 11 },
      data: strokes.length > 0 ? strokes.map((_, i) => `${i + 1}`) : [],
      axisLabel: { fontSize: 10 }
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 (°C)',
        nameTextStyle: { fontSize: 11 },
        position: 'left',
        axisLabel: { fontSize: 11 }
      },
      {
        type: 'value',
        name: '速度',
        nameTextStyle: { fontSize: 11 },
        position: 'right',
        axisLabel: { fontSize: 11 }
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
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: '#4299e1'
        },
        itemStyle: {
          color: '#4299e1'
        },
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

function updateCharts() {
  updateRiskChart()
  updateUniformityChart()
  updateDistributionChart()
  updateParamsChart()
}

function handleResize() {
  riskChart?.resize()
  uniformityChart?.resize()
  distributionChart?.resize()
  paramsChart?.resize()
}

watch(
  () => [store.currentStrokes, store.statistics, store.currentSchemeId],
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
})
</script>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
}

.chart-card.wide {
  grid-column: span 2;
}

.chart-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.chart-content {
  flex: 1;
  min-height: 180px;
}

.chart-card.wide .chart-content {
  min-height: 220px;
}
</style>
