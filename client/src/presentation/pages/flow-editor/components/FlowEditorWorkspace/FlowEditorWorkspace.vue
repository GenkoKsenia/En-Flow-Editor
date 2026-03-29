<template>
  <div class="right-panel">
    <EditorToolbar
      :nodes-count="nodes.length"
      :edges-count="edges.length"
      :is-connection-mode="isConnectionMode"
      :is-comment-mode="isCommentMode"
      :is-download-menu-open="isDownloadMenuOpen"
      :is-version-menu-open="isVersionMenuOpen"
      :current-version-label="currentVersionLabel"
      :version-history="versionHistory"
      :nodes="nodes"
      :edges="edges"
      :data-flows="dataFlows"
      :comments="comments"
      @add-node="addNode"
      @start-connection-mode="startConnectionMode"
      @toggle-comment-mode="toggleCommentMode"
      @add-boundary="addBoundary"
      @open-team-modal="openTeamModal"
      @toggle-version-menu="toggleVersionMenu"
      @pin-current-version="pinCurrentVersion"
      @open-version="openVersion"
      @update:current-version-label="setCurrentVersionLabel"
      @toggle-download-menu="toggleDownloadMenu"
      @close-download-menu="closeDownloadMenu"
      @close-version-menu="closeVersionMenu"
      @download-png="onDownloadPng"
    />

    <PropertiesPanel
      :selected-object="selectedObject"
      :edges="edges"
      :nodes="nodes"
      :data-sets="nodeSendableData"
      :data-flows="dataFlows"
      @update:node="updateNode"
      @update:edge="updateEdge"
      @update:dataFlows="updateDataFlows"
      @delete:node="deleteNode"
      @delete:edge="deleteEdge"
      @clear-selection="clearSelection"
    />

    <div
      ref="canvas"
      class="canvas"
      :style="canvasGridStyle"
      @click="onCanvasClick"
      @wheel.prevent="onCanvasWheel"
    >
      <div ref="canvasContent" class="canvas-content" :style="canvasTransformStyle">
        <ArrowDefinitions />

        <GraphEdge
          v-for="edge in edges"
          :key="edge.id"
          :edge="edge"
          :nodes="nodes"
          :is-selected="selectedEdgeId === edge.id"
          :show-drag-handle="showDragHandles"
          :get-connection-position="getConnectionPosition"
          :force-three-segments="edgeRequiresPassThrough[edge.id]"
          :has-pass-through-error="edgePassThroughErrors[edge.id]"
          :is-pass-through="edgeRequiresPassThrough[edge.id]"
          :error-message="edgeErrorMessages[edge.id]"
          :warning-message="edgeWarningMessages[edge.id]"
          @edge-click="onEdgeClick"
          @breakpoint-drag-start="onBreakpointDragStart"
        />

        <GraphNode
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :data-node-id="node.id"
          :selected="selectedNodeId === node.id"
          :is-connection-source="isConnectionSource(node.id)"
          :is-connection-target="isConnectionTarget(node.id)"
          :is-dragging="isDragging && selectedNodeId === node.id"
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
          @node-mousedown="onNodeMouseDown"
          @node-click="onNodeClick"
          @node-hover-side="onNodeHoverSide"
        />

        <CommentBubble
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :style-object="getCommentStyle(comment)"
          @drag-start="startCommentDrag"
          @remove="removeComment"
        />
      </div>

      <div class="canvas-zoom-controls">
        <button type="button" aria-label="Уменьшить масштаб" @click="zoomOut">-</button>
        <div class="zoom-indicator">{{ zoomPercent }}%</div>
        <button type="button" aria-label="Увеличить масштаб" @click="zoomIn">+</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import ArrowDefinitions from './ArrowDefinitions.vue'
import CommentBubble from './CommentBubble.vue'
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
  selectedNodeId,
  selectedEdgeId,
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
  onCanvasClick,
  onCanvasWheel,
  onEdgeClick,
  onBreakpointDragStart,
  onNodeMouseDown,
  onNodeClick,
  onNodeHoverSide,
  startCommentDrag,
  removeComment,
  zoomIn,
  zoomOut,
} = useFlowEditorWorkspace(canvas, canvasContent)

const { onDownloadPng } = useFlowEditorPngExport({
  canvasContent,
  nodes,
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
}

.canvas-content {
  position: relative;
  width: max-content;
  height: max-content;
  transform-origin: 0 0;
  padding: 24px;
}

.canvas-zoom-controls {
  position: absolute;
  top: 16px;
  right: 16px;
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

:deep(.node.potential-parent) {
  box-shadow: 0 0 0 3px #28a745;
  background: rgba(40, 167, 69, 0.1);
}
</style>
