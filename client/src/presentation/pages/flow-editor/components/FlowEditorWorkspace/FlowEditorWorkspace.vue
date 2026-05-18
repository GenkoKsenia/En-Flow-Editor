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

    <VersionBrowserModal
      v-if="isVersionsDialogOpen"
      :from="versionFilterFrom"
      :to="versionFilterTo"
      :versions="filteredVersions"
      :loading="isLoadingVersions"
      :error="versionsError"
      :has-requested="hasRequestedVersions"
      @close="closeVersionsDialog"
      @submit="requestVersions"
      @update:from="versionFilterFrom = $event"
      @update:to="versionFilterTo = $event"
      @open-version="openComparison"
    />

    <VersionComparisonModal
      v-if="isComparisonDialogOpen && selectedVersion"
      :selected-version="selectedVersion"
      :latest-version="latestVersion"
      :changes="comparisonChanges"
      :loading="isLoadingComparison"
      :error="comparisonError"
      @close="closeComparison"
    />

    <div class="workspace-shell">
      <div
        v-if="hasSidePanels"
        class="side-panels"
        :class="{ 'side-panels--split': showDiagnosticsPanel && hasPropertiesPanel }"
        @wheel.stop
      >
        <div
          v-if="showDiagnosticsPanel"
          class="side-panels__item side-panels__item--diagnostics"
          @wheel.stop
        >
          <DiagnosticsPanel
            :diagnostics="schemeDiagnostics"
            @toggle-collapse="collapseDiagnosticsPanel"
          />
        </div>

        <div
          v-if="hasPropertiesPanel"
          class="side-panels__item side-panels__item--properties"
          @wheel.stop
        >
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

      <button
        v-if="hasDiagnosticsPanel && isDiagnosticsCollapsed"
        type="button"
        class="diagnostics-restore-btn"
        :class="{
          'diagnostics-restore-btn--with-properties': hasPropertiesPanel,
          'diagnostics-restore-btn--error': hasDiagnosticsErrors,
          'diagnostics-restore-btn--warning': !hasDiagnosticsErrors && hasDiagnosticsWarnings,
        }"
        aria-label="Развернуть панель ошибок"
        title="Развернуть панель ошибок"
        @click="expandDiagnosticsPanel"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path
            d="M8 5.5v4.1"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.6"
          />
          <circle cx="8" cy="12" r="1" fill="currentColor" />
        </svg>
      </button>

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

        <div class="canvas-content-sizer" :style="canvasContentSizerStyle">
          <div ref="canvasContent" class="canvas-content" :style="canvasContentStyle">
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
              :is-dragging="draggedEdgeIds.has(edge.id)"
              :is-comment-target-highlighted="highlightedCommentTarget?.type === 'edge' && highlightedCommentTarget.id === edge.id"
              :show-drag-handle="showDragHandles"
              :get-connection-position="getConnectionPosition"
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
              :is-comment-target-highlighted="highlightedCommentTarget?.type === 'node' && highlightedCommentTarget.id === node.id"
              :is-connection-source="isConnectionSource(node.id)"
              :is-connection-target="isConnectionTarget(node.id)"
              :is-dragging="draggedNodeIds.has(node.id)"
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
              :show-target-jump="comment.targetType !== 'canvas' && Boolean(comment.targetId)"
              :style-object="getCommentStyle(comment)"
              :is-editable="canEditComment(comment)"
              :show-actions="showCommentActions(comment.id)"
              :auto-focus="comment.status === 'draft' || comment.status === 'error'"
              :is-resolved="isCommentResolved(comment.id)"
              :show-resolve-toggle="canResolveComment(comment)"
              @mouseenter="setCommentTargetHighlight(comment.targetType, comment.targetId)"
              @mouseleave="clearCommentTargetHighlight"
              @drag-start="startCommentDrag"
              @update:text="updateCommentText"
              @save="submitComment"
              @cancel="cancelComment"
              @delete="deleteComment"
              @toggle-resolved="toggleCommentResolved"
              @focus-target="focusCommentTarget(comment)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { CommentsStoreComment } from '@/domains/comments'

import ArrowDefinitions from './ArrowDefinitions.vue'
import CommentBubble from './CommentBubble.vue'
import DiagnosticsPanel from './DiagnosticsPanel.vue'
import GraphEdge from './GraphEdge.vue'
import GraphNode from './GraphNode.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import VersionBrowserModal from '../Versioning/VersionBrowserModal.vue'
import VersionComparisonModal from '../Versioning/VersionComparisonModal.vue'
import EditorToolbar from '../EditorToolbar/EditorToolbar.vue'
import { useFlowEditorPngExport } from '../../composables/useFlowEditorPngExport'
import { useFlowEditorVersions } from '../../composables/useFlowEditorVersions'
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
  canEditComment,
  showCommentActions,
  canResolveComment,
  getAbsoluteNodePosition,
  getDescendantNodes,
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
  cancelComment,
  deleteComment,
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
const isDiagnosticsCollapsed = ref(false)
const highlightedCommentTarget = ref<{ type: 'node' | 'edge'; id: string } | null>(null)
const visibleComments = computed(() => (commentsVisible.value ? comments.value : []))
const hasDiagnosticsPanel = computed(() => schemeDiagnostics.value.length > 0)
const hasDiagnosticsErrors = computed(() => schemeDiagnostics.value.some(item => item.level === 'error'))
const hasDiagnosticsWarnings = computed(() => schemeDiagnostics.value.some(item => item.level === 'warning'))
const showDiagnosticsPanel = computed(() => hasDiagnosticsPanel.value && !isDiagnosticsCollapsed.value)
const hasPropertiesPanel = computed(() => Boolean(selectedObject.value))
const hasSidePanels = computed(() => showDiagnosticsPanel.value || hasPropertiesPanel.value)
const draggedNodeIds = computed(() => {
  if (!isDragging.value) return new Set<string>()

  const ids = new Set<string>()
  selectedNodeIds.value.forEach(nodeId => {
    ids.add(nodeId)
    getDescendantNodes(nodeId).forEach(descendant => ids.add(descendant.id))
  })

  return ids
})
const draggedEdgeIds = computed(() => {
  if (!isDragging.value) return new Set<string>()

  const nodeIds = draggedNodeIds.value
  const ids = new Set<string>()

  edges.value.forEach(edge => {
    if (nodeIds.has(edge.sourceNodeId) || nodeIds.has(edge.targetNodeId)) {
      ids.add(edge.id)
    }
  })

  nodes.value.forEach(node => {
    if (!nodeIds.has(node.id)) return
    ;(node.passThroughEdges ?? []).forEach(edgeId => ids.add(edgeId))
  })

  return ids
})
const CANVAS_CONTENT_PADDING = 24
const CANVAS_GROWTH_BUFFER = 480
const MIN_CANVAS_LOGICAL_WIDTH = 2400
const MIN_CANVAS_LOGICAL_HEIGHT = 1600
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
    width: Math.max(
      maxRight + CANVAS_CONTENT_PADDING * 2 + CANVAS_GROWTH_BUFFER,
      MIN_CANVAS_LOGICAL_WIDTH,
    ),
    height: Math.max(
      maxBottom + CANVAS_CONTENT_PADDING * 2 + CANVAS_GROWTH_BUFFER,
      MIN_CANVAS_LOGICAL_HEIGHT,
    ),
  }
})
const canvasContentSizerStyle = computed(() => ({
  width: `${Math.max(canvasContentLogicalSize.value.width * zoom.value, 1)}px`,
  height: `${Math.max(canvasContentLogicalSize.value.height * zoom.value, 1)}px`,
}))
const canvasContentStyle = computed(() => ({
  ...canvasTransformStyle.value,
  width: `${canvasContentLogicalSize.value.width}px`,
  height: `${canvasContentLogicalSize.value.height}px`,
}))
const {
  isVersionsDialogOpen,
  versionFilterFrom,
  versionFilterTo,
  hasRequestedVersions,
  isLoadingVersions,
  versionsError,
  filteredVersions,
  latestVersion,
  selectedVersion,
  isComparisonDialogOpen,
  comparisonChanges,
  isLoadingComparison,
  comparisonError,
  closeVersionsDialog,
  requestVersions,
  openComparison,
  closeComparison,
} = useFlowEditorVersions()
let zoomFlashTimeout: number | null = null
let commentTargetFlashTimeout: number | null = null

watch(zoomPercent, (_, previousValue) => {
  if (typeof previousValue === 'undefined') return

  revealZoomControl()
})

watch(hasDiagnosticsPanel, value => {
  if (!value) {
    isDiagnosticsCollapsed.value = false
  }
})

onBeforeUnmount(() => {
  clearZoomHideTimeout()
  clearCommentTargetHideTimeout()
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

function collapseDiagnosticsPanel(): void {
  isDiagnosticsCollapsed.value = true
}

function expandDiagnosticsPanel(): void {
  isDiagnosticsCollapsed.value = false
}

function clearCommentTargetHideTimeout(): void {
  if (commentTargetFlashTimeout !== null) {
    window.clearTimeout(commentTargetFlashTimeout)
    commentTargetFlashTimeout = null
  }
}

function setCommentTargetHighlight(
  targetType: CommentsStoreComment['targetType'],
  targetId: string | null,
): void {
  if ((targetType !== 'node' && targetType !== 'edge') || !targetId) {
    return
  }

  clearCommentTargetHideTimeout()
  highlightedCommentTarget.value = {
    type: targetType,
    id: targetId,
  }
}

function clearCommentTargetHighlight(): void {
  clearCommentTargetHideTimeout()
  highlightedCommentTarget.value = null
}

function flashCommentTarget(
  targetType: CommentsStoreComment['targetType'],
  targetId: string | null,
  delay = 1800,
): void {
  setCommentTargetHighlight(targetType, targetId)
  clearCommentTargetHideTimeout()

  commentTargetFlashTimeout = window.setTimeout(() => {
    highlightedCommentTarget.value = null
    commentTargetFlashTimeout = null
  }, delay)
}

function scrollCanvasToRect(targetRect: DOMRect): void {
  if (!canvas.value) return

  const canvasRect = canvas.value.getBoundingClientRect()
  const deltaX = (targetRect.left + targetRect.width / 2) - (canvasRect.left + canvas.value.clientWidth / 2)
  const deltaY = (targetRect.top + targetRect.height / 2) - (canvasRect.top + canvas.value.clientHeight / 2)

  canvas.value.scrollLeft += deltaX
  canvas.value.scrollTop += deltaY
}

function focusCommentTarget(comment: CommentsStoreComment): void {
  if (!canvas.value || !comment.targetId) return

  if (comment.targetType === 'node') {
    const targetNode = canvas.value.querySelector<HTMLElement>(`[data-node-id="${comment.targetId}"]`)
    if (!targetNode) return

    scrollCanvasToRect(targetNode.getBoundingClientRect())
    flashCommentTarget(comment.targetType, comment.targetId)
    return
  }

  if (comment.targetType === 'edge') {
    const targetEdgePath = canvas.value.querySelector<SVGPathElement>(`[data-edge-path-id="${comment.targetId}"]`)
    if (!targetEdgePath) return

    scrollCanvasToRect(targetEdgePath.getBoundingClientRect())
    flashCommentTarget(comment.targetType, comment.targetId)
  }
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

.workspace-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.canvas {
  width: 100%;
  height: 100%;
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
  right: 24px;
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
  min-height: 0;
}

.side-panels--split .side-panels__item--diagnostics {
  flex: 0 1 auto;
  max-height: calc(50% - 6px);
}

.side-panels--split .side-panels__item--properties {
  flex: 1 1 0;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  padding: 24px;
  box-sizing: border-box;
}

.canvas-content-sizer {
  position: relative;
  min-width: 100%;
  min-height: 100%;
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
  border-radius: 8px;
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

.diagnostics-restore-btn {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 8;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  color: #495057;
  width: 44px;
  height: 44px;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.diagnostics-restore-btn:hover {
  border-color: #0b6bcb;
  color: #0b6bcb;
}

.diagnostics-restore-btn--error {
  border-color: rgba(217, 72, 95, 0.38);
  color: #d9485f;
  background: rgba(217, 72, 95, 0.08);
}

.diagnostics-restore-btn--error:hover {
  border-color: #d9485f;
  color: #d9485f;
}

.diagnostics-restore-btn--warning {
  border-color: rgba(234, 179, 8, 0.4);
  color: #eab308;
  background: rgba(234, 179, 8, 0.1);
}

.diagnostics-restore-btn--warning:hover {
  border-color: #eab308;
  color: #eab308;
}

.diagnostics-restore-btn--with-properties {
  right: 356px;
}

.diagnostics-restore-btn svg {
  width: 22px;
  height: 22px;
}

@media (max-width: 768px) {
  .diagnostics-restore-btn--with-properties {
    right: 16px;
    top: 60px;
  }
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
  box-shadow: 0 0 0 3px #1f9d55;
  background: rgba(31, 157, 85, 0.1);
}
</style>
