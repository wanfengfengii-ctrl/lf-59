<template>
  <div class="app">
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">
          <span class="title-icon">🎨</span>
          分层烙画训练系统
        </h1>
        <p class="app-subtitle">
          多图层绘制 · 笔触回放 · 评分与训练建议
        </p>
      </div>
    </header>

    <main class="app-main">
      <aside class="sidebar left-sidebar">
        <ControlPanel />
      </aside>

      <section class="canvas-section">
        <div class="canvas-wrapper">
          <GourdCanvas />
        </div>
        <div class="canvas-tips">
          <span class="tip">💡 在画布上拖动鼠标绘制烙画路径</span>
          <span class="tip">⏱ 停留时间越长、温度越高，颜色越深</span>
          <span class="tip">📂 切换图层绘制底稿、主线和阴影</span>
          <span class="tip danger">⚠ 温度 ≥ 350°C 且停留 ≥ 0.5s 会标记为过烧</span>
        </div>
      </section>

      <aside class="sidebar right-sidebar">
        <StatsPanel />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import GourdCanvas from '@/components/GourdCanvas.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import StatsPanel from '@/components/StatsPanel.vue'
import { usePyrographyStore } from '@/stores/pyrography'
import { useFormulaStore } from '@/stores/formula'

const pyrographyStore = usePyrographyStore()
const formulaStore = useFormulaStore()

onMounted(() => {
  pyrographyStore.init()
  formulaStore.init()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
  background: #f0f2f5;
  color: #333;
}

#app {
  width: 100%;
  height: 100%;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  max-width: 1800px;
  margin: 0 auto;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 26px;
}

.app-subtitle {
  font-size: 13px;
  opacity: 0.9;
}

.app-main {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr 420px;
  gap: 16px;
  padding: 16px;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
  min-height: 0;
}

.sidebar {
  min-height: 0;
  overflow: hidden;
}

.canvas-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.canvas-wrapper {
  flex: 1;
  min-height: 0;
}

.canvas-tips {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 10px 16px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.tip {
  font-size: 12px;
  color: #666;
}

.tip.danger {
  color: #ef4444;
  font-weight: 500;
}

@media (max-width: 1400px) {
  .app-main {
    grid-template-columns: 280px 1fr 360px;
  }
}

@media (max-width: 1100px) {
  .app-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    overflow-y: auto;
  }

  .sidebar {
    max-height: none;
  }

  .canvas-wrapper {
    min-height: 500px;
  }
}
</style>
