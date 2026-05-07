<template>
  <div class="snapshot-viewer">
    <div class="snapshot-viewer__controls">
      <button type="button" class="snapshot-viewer__control" aria-label="Уменьшить масштаб" @click="zoomOut">-</button>
      <div class="snapshot-viewer__zoom">{{ zoomPercent }}%</div>
      <button type="button" class="snapshot-viewer__control" aria-label="Увеличить масштаб" @click="zoomIn">+</button>
    </div>

    <div v-if="renderError" class="snapshot-viewer__empty snapshot-viewer__empty--error">{{ renderError }}</div>
    <div v-else-if="!graph.nodes.length" class="snapshot-viewer__empty">Нет данных схемы</div>
    <div v-else-if="!imageDataUrl" class="snapshot-viewer__empty">Подготовка снимка схемы...</div>
    <div v-else class="snapshot-viewer__canvas">
      <img
        class="snapshot-viewer__image"
        :src="imageDataUrl"
        alt=""
        draggable="false"
        :style="{ width: `${snapshotWidth * zoom}px`, height: `${snapshotHeight * zoom}px` }"
      />
    </div>

    <div class="snapshot-render-host" aria-hidden="true">
      <div
        ref="snapshotStage"
        class="snapshot-render-stage"
        :style="{ width: `${snapshotWidth}px`, height: `${snapshotHeight}px` }"
      >
        <div
          ref="snapshotContent"
          class="snapshot-render-content"
          :style="{
            width: `${snapshotWidth}px`,
            height: `${snapshotHeight}px`,
            transform: `translate(${snapshotOffsetX}px, ${snapshotOffsetY}px)`,
          }"
        >
          <ArrowDefinitions />

          <GraphEdge
            v-for="edge in graph.edges"
            :key="edge.id"
            :edge="edge"
            :nodes="graph.nodes"
            :get-connection-position="getConnectionPosition"
            :force-three-segments="edgeRequiresPassThrough[edge.id]"
          />

          <GraphNode
            v-for="node in graph.nodes"
            :key="node.id"
            :node="node"
            :all-nodes="graph.nodes"
            :children-count="getChildrenCount(node.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  buildOrthogonalEdgeSegments,
  getAbsoluteNodePosition,
  getConnectionPoint,
  getConnectionPositionFromMap,
} from '@/domains/diagram'
import type { ConnectionSide, Edge, Node, Position, Segment } from '@/domains/graph'
import GraphEdge from '../FlowEditorWorkspace/GraphEdge.vue'
import GraphNode from '../FlowEditorWorkspace/GraphNode.vue'
import ArrowDefinitions from '../FlowEditorWorkspace/ArrowDefinitions.vue'
import { cloneElementWithInlineStyles, renderHtmlToPngDataUrl } from '@/shared/lib/renderHtmlToPngDataUrl'
import { parseVersionSnapshotGraph } from './versionSnapshotGraph'

const props = defineProps<{
  code: unknown
}>()

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const SNAPSHOT_PADDING = 32
const MIN_SNAPSHOT_WIDTH = 1200
const MIN_SNAPSHOT_HEIGHT = 720

const zoom = ref(1)
const imageDataUrl = ref<string | null>(null)
const renderError = ref<string | null>(null)
const snapshotStage = ref<HTMLElement | null>(null)
const snapshotGeneration = ref(0)

const zoomPercent = computed(() => Math.round(zoom.value * 100))
const graph = computed(() => parseVersionSnapshotGraph(props.code))

const connectionMap = computed<Record<string, Record<ConnectionSide, string[]>>>(() => {
  const map: Record<string, Record<ConnectionSide, string[]>> = {}

  graph.value.nodes.forEach(node => {
    map[node.id] = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    }
  })

  graph.value.edges.forEach(edge => {
    map[edge.sourceNodeId]?.[edge.sourceSide].push(edge.id)
    map[edge.targetNodeId]?.[edge.targetSide].push(edge.id)
  })

  return map
})

const edgeSegments = computed(() => {
  const segmentsByEdgeId = new Map<string, Segment[]>()

  graph.value.edges.forEach(edge => {
    const start = getConnectionPointForEdge(edge, edge.sourceNodeId, edge.sourceSide)
    const end = getConnectionPointForEdge(edge, edge.targetNodeId, edge.targetSide)
    if (!start || !end) return
    segmentsByEdgeId.set(edge.id, buildOrthogonalEdgeSegments(edge, start, end))
  })

  return segmentsByEdgeId
})

const bounds = computed(() => {
  if (!graph.value.nodes.length) {
    return {
      minX: 0,
      minY: 0,
      maxX: MIN_SNAPSHOT_WIDTH,
      maxY: MIN_SNAPSHOT_HEIGHT,
    }
  }

  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0

  graph.value.nodes.forEach(node => {
    const absolutePosition = getAbsoluteNodePosition(graph.value.nodes, node)
    minX = Math.min(minX, absolutePosition.x)
    minY = Math.min(minY, absolutePosition.y)
    maxX = Math.max(maxX, absolutePosition.x + node.width)
    maxY = Math.max(maxY, absolutePosition.y + node.height)
  })

  edgeSegments.value.forEach(segments => {
    segments.forEach(segment => {
      minX = Math.min(minX, segment.start.x, segment.end.x)
      minY = Math.min(minY, segment.start.y, segment.end.y)
      maxX = Math.max(maxX, segment.start.x, segment.end.x)
      maxY = Math.max(maxY, segment.start.y, segment.end.y)
    })
  })

  return {
    minX,
    minY,
    maxX: maxX || 1,
    maxY: maxY || 1,
  }
})

const snapshotWidth = computed(() => Math.max(bounds.value.maxX - bounds.value.minX + SNAPSHOT_PADDING * 2, MIN_SNAPSHOT_WIDTH))
const snapshotHeight = computed(() => Math.max(bounds.value.maxY - bounds.value.minY + SNAPSHOT_PADDING * 2, MIN_SNAPSHOT_HEIGHT))
const snapshotOffsetX = computed(() => SNAPSHOT_PADDING - bounds.value.minX)
const snapshotOffsetY = computed(() => SNAPSHOT_PADDING - bounds.value.minY)
const edgeRequiresPassThrough = computed<Record<string, boolean>>(() =>
  graph.value.nodes.reduce<Record<string, boolean>>((acc, node) => {
    ;(node.passThroughEdges ?? []).forEach(edgeId => {
      acc[edgeId] = true
    })
    return acc
  }, {}),
)

function zoomIn(): void {
  zoom.value = Math.min(MAX_ZOOM, +(zoom.value + ZOOM_STEP).toFixed(2))
}

function zoomOut(): void {
  zoom.value = Math.max(MIN_ZOOM, +(zoom.value - ZOOM_STEP).toFixed(2))
}

function getChildrenCount(nodeId: string): number {
  return graph.value.nodes.filter(node => node.parentId === nodeId).length
}

function getConnectionPosition(nodeId: string, side: ConnectionSide, connectionId: string): number {
  return getConnectionPositionFromMap(connectionMap.value, nodeId, side, connectionId)
}

function getConnectionPointForEdge(edge: Edge, nodeId: string, side: ConnectionSide): Position | null {
  const node = graph.value.nodes.find(item => item.id === nodeId)
  if (!node) return null

  const absolutePosition = getAbsoluteNodePosition(graph.value.nodes, node)
  const position = getConnectionPosition(nodeId, side, edge.id)
  return getConnectionPoint(absolutePosition, node, side, position)
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

async function generateSnapshot(): Promise<void> {
  const generationId = ++snapshotGeneration.value

  if (!graph.value.nodes.length) {
    imageDataUrl.value = null
    renderError.value = null
    return
  }

  renderError.value = null
  imageDataUrl.value = null

  await nextTick()
  await waitForFrame()
  await waitForFrame()

  if (generationId !== snapshotGeneration.value) return
  if (!snapshotStage.value) return

  try {
    const clonedStage = cloneElementWithInlineStyles(snapshotStage.value)
    clonedStage.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    imageDataUrl.value = await renderHtmlToPngDataUrl(
      clonedStage,
      snapshotWidth.value,
      snapshotHeight.value,
    )
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : 'Не удалось подготовить снимок схемы'
  }
}

watch(
  () => props.code,
  () => {
    void generateSnapshot()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  snapshotGeneration.value += 1
})
</script>

<style scoped>
.snapshot-viewer {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: #ffffff;
}

.snapshot-viewer__controls {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 0;
}

.snapshot-viewer__control {
  width: 36px;
  height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.snapshot-viewer__control:hover {
  border-color: #0b6bcb;
}

.snapshot-viewer__zoom {
  min-width: 52px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.snapshot-viewer__canvas {
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.snapshot-viewer__image {
  display: block;
  max-width: none;
  background: #ffffff;
  box-shadow: 0 0 0 1px #e2e8f0;
}

.snapshot-viewer__empty {
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 14px;
  min-height: 240px;
  padding: 16px;
}

.snapshot-viewer__empty--error {
  color: #b42318;
}

.snapshot-render-host {
  position: fixed;
  left: -20000px;
  top: 0;
  opacity: 0;
  pointer-events: none;
}

.snapshot-render-stage {
  position: relative;
  overflow: hidden;
  background: #ffffff;
}

.snapshot-render-content {
  position: relative;
  transform-origin: 0 0;
}
</style>
