<template>
  <div class="right-panel">
    <EditorToolbar
      :is-connection-mode="isConnectionMode"
      :is-comment-mode="isCommentMode"
      :is-comments-visible="commentsVisible"
      :is-download-menu-open="isDownloadMenuOpen"
      :is-version-menu-open="isVersionMenuOpen"
      :current-version-label="currentVersionLabel"
      :version-history="versionHistory"
      :nodes="nodes"
      :edges="edges"
      :data-flows="dataFlows"
      :comments="comments"
      :include-comments-in-png="includeCommentsInPng"
      @add-node="addNode"
      @start-connection-mode="startConnectionMode"
      @toggle-comment-mode="toggleCommentMode"
      @toggle-comments-visibility="commentsVisible = !commentsVisible"
      @add-boundary="addBoundary"
      @open-team-modal="openTeamModal"
      @toggle-version-menu="toggleVersionMenu"
      @pin-current-version="pinCurrentVersion"
      @open-version="openVersion"
      @update:current-version-label="setCurrentVersionLabel"
      @toggle-download-menu="toggleDownloadMenu"
      @close-download-menu="closeDownloadMenu"
      @close-version-menu="closeVersionMenu"
      @update:include-comments-in-png="includeCommentsInPng = $event"
      @download-png="onDownloadPng"
    />

    <div
      ref="canvas"
      class="canvas"
      :style="canvasGridStyle"
      @mousedown="onCanvasMouseDown"
      @click="onCanvasClick"
      @wheel.prevent="onCanvasWheel"
    >
      <div
        v-if="showZoomControl"
        class="canvas-zoom-controls canvas-zoom-controls--floating"
        @mouseenter="onZoomControlMouseEnter"
        @mouseleave="onZoomControlMouseLeave"
      >
        <button type="button" aria-label="Уменьшить масштаб" @click="zoomOut">-</button>
        <div class="zoom-indicator">{{ zoomPercent }}%</div>
        <button type="button" aria-label="Увеличить масштаб" @click="zoomIn">+</button>
      </div>

      <div
        v-if="hasSidePanels"
        class="side-panels"
        :class="{ 'side-panels--split': hasDiagnosticsPanel && hasPropertiesPanel }"
        @wheel.stop
      >
        <div v-if="hasDiagnosticsPanel" class="side-panels__item" @wheel.stop>
          <DiagnosticsPanel :diagnostics="schemeDiagnostics" />
        </div>

        <div v-if="hasPropertiesPanel" class="side-panels__item" @wheel.stop>
          <PropertiesPanel
            :selected-object="selectedObject"
            :edges="edges"
            :nodes="nodes"
            :data-sets="nodeSendableData"
            :data-flows="dataFlows"
            :is-locked="isSelectedObjectLockedByOther"
            :lock-message="selectedObjectLockMessage"
            @update:node="updateNode"
            @update:edge="updateEdge"
            @update:dataFlows="updateDataFlows"
            @delete:node="deleteNode"
            @delete:edge="deleteEdge"
            @clear-selection="clearSelection"
          />
        </div>
      </div>

      <div class="canvas-content-sizer" :style="canvasContentSizerStyle">
        <div ref="canvasContent" class="canvas-content" :style="canvasTransformStyle">
          <div
            v-if="isMarqueeSelecting && marqueeRect"
            class="marquee-selection"
            :style="{
              left: `${marqueeRect.x}px`,
              top: `${marqueeRect.y}px`,
              width: `${marqueeRect.width}px`,
              height: `${marqueeRect.height}px`,
            }"
          />

          <ArrowDefinitions />

          <GraphEdge
            v-for="edge in edges"
            :key="edge.id"
            :edge="edge"
            :data-edge-id="edge.id"
            :nodes="nodes"
            :is-selected="selectedEdgeIds.includes(edge.id)"
            :show-drag-handle="showDragHandles"
            :get-connection-position="getConnectionPosition"
            :force-three-segments="edgeRequiresPassThrough[edge.id]"
            :has-pass-through-error="edgePassThroughErrors[edge.id]"
            :is-pass-through="edgeRequiresPassThrough[edge.id]"
            :error-message="edgeErrorMessages[edge.id]"
            :warning-message="edgeWarningMessages[edge.id]"
            :locked-by="lockedEdgeOwners[edge.id]"
            @edge-click="onEdgeClick"
            @breakpoint-drag-start="onBreakpointDragStart"
          />

          <GraphNode
            v-for="node in nodes"
            :key="node.id"
            :node="node"
            :data-node-id="node.id"
            :selected="selectedNodeIds.includes(node.id)"
            :is-connection-source="isConnectionSource(node.id)"
            :is-connection-target="isConnectionTarget(node.id)"
            :is-dragging="isDragging && selectedNodeIds.includes(node.id)"
            :show-connection-hints="showConnectionHints"
            :children-count="getChildrenCount(node.id)"
            :is-potential-parent="potentialParentId === node.id"
            :all-nodes="nodes"
            :has-pass-through-error="nodePassThroughErrors[node.id]"
            :has-data-error="nodeDataErrors[node.id]"
            :has-missing-target="nodeMissingTarget[node.id]"
            :has-forbidden-outgoing="nodeForbiddenOutgoing[node.id]"
            :error-message="nodeErrorMessages[node.id]"
            :warning-message="nodeWarningMessages[node.id]"
            :locked-by="lockedNodeOwners[node.id]"
            @node-mousedown="onNodeMouseDown"
            @node-click="onNodeClick"
            @node-hover-side="onNodeHoverSide"
          />

          <CommentBubble
            v-for="comment in visibleComments"
            :key="comment.id"
            :comment="comment"
            :show-delete="canDeleteComment(comment)"
            :style-object="getCommentStyle(comment)"
            :is-editable="comment.status !== 'sending'"
            :show-actions="comment.status === 'draft' || comment.status === 'error'"
            :auto-focus="comment.status === 'draft' || comment.status === 'error'"
            :is-resolved="isCommentResolved(comment.id)"
            :show-resolve-toggle="comment.status === 'synced'"
            @drag-start="startCommentDrag"
            @update:text="updateCommentText"
            @save="submitComment"
            @cancel="removeComment"
            @delete="removeComment"
            @toggle-resolved="toggleCommentResolved"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ArrowDefinitions from './ArrowDefinitions.vue'
import CommentBubble from './CommentBubble.vue'
import DiagnosticsPanel from './DiagnosticsPanel.vue'
import GraphEdge from './GraphEdge.vue'
import GraphNode from './GraphNode.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import EditorToolbar from '../EditorToolbar/EditorToolbar.vue'
import { useFlowEditorPngExport } from '../../composables/useFlowEditorPngExport'
import { useFlowEditorWorkspace } from '../../composables/useFlowEditorWorkspace'

const canvas = ref<HTMLElement | null>(null)
const canvasContent = ref<HTMLElement | null>(null)

const {
  nodes,
  edges,
  dataFlows,
  comments,
  selectedObject,
  selectedNodeIds,
  selectedEdgeIds,
  selectedNodeId,
  selectedEdgeId,
  isMarqueeSelecting,
  marqueeRect,
  lockedNodeOwners,
  lockedEdgeOwners,
  isSelectedObjectLockedByOther,
  selectedObjectLockMessage,
  isDragging,
  potentialParentId,
  isConnectionMode,
  isCommentMode,
  isDownloadMenuOpen,
  isVersionMenuOpen,
  versionHistory,
  currentVersionLabel,
  showDragHandles,
  showConnectionHints,
  zoom,
  zoomPercent,
  canvasTransformStyle,
  canvasGridStyle,
  edgeRequiresPassThrough,
  edgePassThroughErrors,
  edgeErrorMessages,
  edgeWarningMessages,
  nodePassThroughErrors,
  nodeDataErrors,
  nodeMissingTarget,
  nodeForbiddenOutgoing,
  nodeErrorMessages,
  nodeWarningMessages,
  schemeDiagnostics,
  nodeSendableData,
  isConnectionSource,
  isConnectionTarget,
  getChildrenCount,
  getConnectionPosition,
  getCommentStyle,
  getAbsoluteNodePosition,
  addNode,
  startConnectionMode,
  toggleCommentMode,
  addBoundary,
  openTeamModal,
  toggleVersionMenu,
  pinCurrentVersion,
  openVersion,
  setCurrentVersionLabel,
  toggleDownloadMenu,
  closeDownloadMenu,
  closeVersionMenu,
  updateNode,
  updateEdge,
  updateDataFlows,
  deleteNode,
  deleteEdge,
  clearSelection,
  onCanvasMouseDown,
  onCanvasClick,
  onCanvasWheel,
  onEdgeClick,
  onBreakpointDragStart,
  onNodeMouseDown,
  onNodeClick,
  onNodeHoverSide,
  startCommentDrag,
  updateCommentText,
  submitComment,
  removeComment,
  isCommentResolved,
  toggleCommentResolved,
  canDeleteComment,
  zoomIn,
  zoomOut,
} = useFlowEditorWorkspace(canvas, canvasContent)

const includeCommentsInPng = ref(false)
const commentsVisible = ref(true)
const showZoomControl = ref(false)
const isZoomControlHovered = ref(false)
const visibleComments = computed(() => (commentsVisible.value ? comments.value : []))
const hasDiagnosticsPanel = computed(() => schemeDiagnostics.value.length > 0)
const hasPropertiesPanel = computed(() => Boolean(selectedObject.value))
const hasSidePanels = computed(() => hasDiagnosticsPanel.value || hasPropertiesPanel.value)
const CANVAS_CONTENT_PADDING = 24
const COMMENT_WIDTH_ESTIMATE = 260
const COMMENT_HEIGHT_ESTIMATE = 160
const canvasContentLogicalSize = computed(() => {
  let maxRight = 0
  let maxBottom = 0

  nodes.value.forEach(node => {
    const absolutePosition = getAbsoluteNodePosition(node)
    maxRight = Math.max(maxRight, absolutePosition.x + node.width)
    maxBottom = Math.max(maxBottom, absolutePosition.y + node.height)
  })

  edges.value.forEach(edge => {
    if (typeof edge.breakpointX === 'number') {
      maxRight = Math.max(maxRight, edge.breakpointX)
    }

    if (typeof edge.breakpointY === 'number') {
      maxBottom = Math.max(maxBottom, edge.breakpointY)
    }
  })

  visibleComments.value.forEach(comment => {
    const style = getCommentStyle(comment)
    const left = Number.parseFloat(style.left ?? '0') || 0
    const top = Number.parseFloat(style.top ?? '0') || 0

    maxRight = Math.max(maxRight, left + COMMENT_WIDTH_ESTIMATE)
    maxBottom = Math.max(maxBottom, top + COMMENT_HEIGHT_ESTIMATE)
  })

  return {
    width: Math.max(maxRight + CANVAS_CONTENT_PADDING * 2, CANVAS_CONTENT_PADDING * 2 + 1),
    height: Math.max(maxBottom + CANVAS_CONTENT_PADDING * 2, CANVAS_CONTENT_PADDING * 2 + 1),
  }
})
const canvasContentSizerStyle = computed(() => ({
  width: `${Math.max(canvasContentLogicalSize.value.width * zoom.value, 1)}px`,
  height: `${Math.max(canvasContentLogicalSize.value.height * zoom.value, 1)}px`,
}))
let zoomFlashTimeout: number | null = null

watch(zoomPercent, (_, previousValue) => {
  if (typeof previousValue === 'undefined') return

  revealZoomControl()
})

onBeforeUnmount(() => {
  clearZoomHideTimeout()
})

function clearZoomHideTimeout(): void {
  if (zoomFlashTimeout !== null) {
    window.clearTimeout(zoomFlashTimeout)
    zoomFlashTimeout = null
  }
}

function scheduleZoomControlHide(delay = 1600): void {
  clearZoomHideTimeout()

  zoomFlashTimeout = window.setTimeout(() => {
    if (isZoomControlHovered.value) return

    showZoomControl.value = false
    zoomFlashTimeout = null
  }, delay)
}

function revealZoomControl(): void {
  showZoomControl.value = true
  scheduleZoomControlHide(1800)
}

function onZoomControlMouseEnter(): void {
  isZoomControlHovered.value = true
  clearZoomHideTimeout()
}

function onZoomControlMouseLeave(): void {
  isZoomControlHovered.value = false
  scheduleZoomControlHide(900)
}

const { onDownloadPng } = useFlowEditorPngExport({
  canvasContent,
  nodes,
  zoom,
  includeComments: includeCommentsInPng,
  getAbsoluteNodePosition,
  closeDownloadMenu,
})
</script>

<style scoped>
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.canvas {
  flex: 1;
  position: relative;
  background:
    linear-gradient(90deg, #f0f0f0 1px, transparent 1px),
    linear-gradient(#f0f0f0 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: auto;
  cursor: default;
  z-index: 1;
  min-height: 0;
}

.side-panels {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 6;
  pointer-events: none;
}

.side-panels__item {
  min-height: 0;
  pointer-events: auto;
  overscroll-behavior: contain;
}

.side-panels--split .side-panels__item {
  flex: 1;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  height: max-content;
  transform-origin: 0 0;
  padding: 24px;
}

.canvas-content-sizer {
  position: relative;
  min-width: 1px;
  min-height: 1px;
  overflow: hidden;
}

.marquee-selection {
  position: absolute;
  border: 1px solid #066664;
  background: rgba(6, 102, 100, 0.12);
  pointer-events: none;
  z-index: 2;
}

.canvas-zoom-controls {
  position: absolute;
  left: 16px;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 4px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 5;
}

.canvas-zoom-controls--floating {
  animation: zoom-control-enter 0.24s ease;
  z-index: 7;
}

.canvas-zoom-controls button {
  padding: 8px 12px;
  background: #ffffff;
  color: #000000;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  transition: background 0.2s;
}

.canvas-zoom-controls button:hover {
  background: #08a180;
}

.canvas-zoom-controls .zoom-indicator {
  font-weight: 700;
  color: #343a40;
}

.canvas-zoom-controls .zoom-indicator {
  font-size: 14px;
  color: #343a40;
}

@keyframes zoom-control-enter {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.node.potential-parent) {
  box-shadow: 0 0 0 3px #28a745;
  background: rgba(40, 167, 69, 0.1);
}
</style>
