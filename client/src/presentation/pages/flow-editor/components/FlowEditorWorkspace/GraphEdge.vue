<template>
  <svg
    class="edge"
    :class="{
      'comment-target-highlighted': isCommentTargetHighlighted,
      'locked-self': lockState === 'self',
      'locked-other': lockState === 'other',
    }"
    :style="{ zIndex: edgeZIndex }"
  >
    <path
      :d="pathData"
      stroke="transparent"
      stroke-width="16"
      fill="none"
      @mousedown="onPathMouseDown"
      class="edge-hit-area"
    />

    <path
      v-if="sourceHandlePath"
      :d="sourceHandlePath"
      stroke="transparent"
      stroke-width="18"
      fill="none"
      class="endpoint-drag-handle"
      :style="{ cursor: sourceHandleCursor }"
      @mousedown="onSourceHandleMouseDown"
    />

    <path
      v-if="targetHandlePath"
      :d="targetHandlePath"
      stroke="transparent"
      stroke-width="18"
      fill="none"
      class="endpoint-drag-handle"
      :style="{ cursor: targetHandleCursor }"
      @mousedown="onTargetHandleMouseDown"
    />

    <path
      v-for="handle in draggableSegments"
      :key="`${edge.id}-drag-${handle.index}`"
      :d="handle.path"
      class="drag-handle-indicator"
      :style="{ cursor: handle.cursor }"
    />

    <path
      v-for="handle in draggableSegments"
      :key="`${edge.id}-drag-hit-${handle.index}`"
      :d="handle.path"
      stroke="transparent"
      stroke-width="20"
      fill="none"
      class="drag-handle"
      :style="{ cursor: handle.cursor }"
      @mousedown="event => onDragHandleMouseDown(handle.index, event)"
    />

    <path
      :d="pathData"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      fill="none"
      :stroke-dasharray="dashPattern || undefined"
      :stroke-linecap="strokeLinecap"
      :marker-end="markerUrl || undefined"
      :data-edge-path-id="edge.id"
      @mousedown="onPathMouseDown"
      :class="{
        selected: isSelected,
        'comment-target-highlighted': isCommentTargetHighlighted,
        'pass-through-error': hasPassThroughError,
        'locked-self': lockState === 'self',
        'locked-other': lockState === 'other',
      }"
    >
      <title v-if="edgeTitle">{{ edgeTitle }}</title>
    </path>

    <g
      v-if="edgeLabel && labelPosition && labelBox"
      class="edge-label-group"
      :transform="`translate(${labelPosition.x}, ${labelPosition.y})`"
      @mousedown="onLabelMouseDown"
    >
      <rect
        class="edge-label-hitbox"
        :x="labelBox.x"
        :y="labelBox.y"
        :width="labelBox.width"
        :height="labelBox.height"
        :rx="6"
        :ry="6"
      />
      <text
        class="edge-label"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        <tspan
          v-for="(line, index) in edgeLabelLines"
          :key="`${edge.id}-label-line-${index}`"
          x="0"
          :dy="index === 0 ? firstLabelLineDy : labelLineHeight"
        >
          {{ line || ' ' }}
        </tspan>
      </text>
    </g>

    <text
      v-if="lockBadgeLabel && labelPosition"
      :x="labelPosition.x"
      :y="(labelPosition.y ?? 0) - 18"
      class="edge-lock-label"
      :class="`edge-lock-label--${lockState}`"
      text-anchor="middle"
      dominant-baseline="middle"
      pointer-events="none"
    >
      {{ lockBadgeLabel }}
    </text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  buildOrthogonalEdgeSegments,
  clampEdgeLabelPosition,
  getAbsoluteNodePosition,
  getConnectionPoint,
  getPointAtSegmentLength,
} from '@/domains/diagram'
import type { ConnectionSide, Edge, EdgeGeometry, Node, Position, Segment } from '@/domains/graph'

interface Props {
  edge: Edge
  nodes: Node[]
  type?: 'default' | 'selected' | 'error'
  isSelected?: boolean
  isDragging?: boolean
  showDragHandle?: boolean
  getConnectionPosition?: (nodeId: string, side: ConnectionSide, connectionId: string) => number
  forceThreeSegments?: boolean
  hasPassThroughError?: boolean
  isPassThrough?: boolean
  isCommentTargetHighlighted?: boolean
  errorMessage?: string | null
  warningMessage?: string | null
  lockedBy?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  isSelected: false,
  isDragging: false,
  showDragHandle: false,
  getConnectionPosition: () => 0.5,
  forceThreeSegments: false,
  hasPassThroughError: false,
  isPassThrough: false,
  isCommentTargetHighlighted: false,
  errorMessage: null,
  warningMessage: null,
  lockedBy: null,
})

const emit = defineEmits<{
  'edge-click': [edgeId: string, event: MouseEvent]
  'breakpoint-drag-start': [edgeId: string, segmentIndex: number, event: MouseEvent]
  'endpoint-order-drag-start': [edgeId: string, endpoint: 'source' | 'target', event: MouseEvent]
  'label-drag-start': [edgeId: string, event: MouseEvent]
}>()

const lockState = computed<'self' | 'other' | null>(() => {
  if (props.lockedBy === 'self') return 'self'
  if (props.lockedBy) return 'other'
  return null
})
const lockBadgeLabel = computed(() => {
  if (lockState.value === 'self') return 'Вы'
  if (lockState.value === 'other') {
    return props.lockedBy === 'locked' ? 'Занято' : props.lockedBy
  }
  return null
})

const edgeTitle = computed(() => {
  if (props.errorMessage) return props.errorMessage
  if (props.warningMessage) return props.warningMessage
  if (lockState.value === 'other') {
    return props.lockedBy && props.lockedBy !== 'locked'
      ? `Занято: ${props.lockedBy}`
      : 'Занято другим пользователем'
  }
  if (lockState.value === 'self') return 'Заблокировано вами'
  return props.edge.label?.trim() ?? ''
})
const edgeLabel = computed(() => props.edge.label?.trim() ?? '')
const edgeLabelLines = computed(() => edgeLabel.value.split(/\r?\n/))
const labelLineHeight = 16
const firstLabelLineDy = computed(() => (
  edgeLabelLines.value.length > 1
    ? -((edgeLabelLines.value.length - 1) * labelLineHeight) / 2
    : 0
))
const labelBox = computed(() => {
  if (!edgeLabel.value) return null

  const longestLineLength = edgeLabelLines.value.reduce((max, line) => Math.max(max, line.length), 1)
  const width = Math.max(42, longestLineLength * 7.2 + 16)
  const height = Math.max(22, edgeLabelLines.value.length * labelLineHeight + 8)

  return {
    x: -width / 2,
    y: -height / 2,
    width,
    height,
  }
})

const markerUrl = computed(() => {
  const markerType = props.edge.markerType ?? 'triangle'
  if (markerType === 'none') return ''
  const markers: Record<'triangle', Record<'default' | 'selected' | 'error', string>> = {
    triangle: {
      default: 'arrowhead',
      selected: 'arrowhead-selected',
      error: 'arrowhead-error',
    },
  }
  const markerId = markers[markerType]?.[props.type] ?? 'arrowhead'
  return `url(#${markerId})`
})

const strokeColor = computed(() => {
  const base = props.edge.color ?? '#666'
  const selectedColor = '#0b6bcb'
  const colors = {
    default: props.isSelected ? selectedColor : base,
    selected: selectedColor,
    error: '#dc3545',
  }
  return colors[props.type]
})

const strokeWidth = computed(() => props.edge.width ?? 2)

const dashPattern = computed(() => {
  const styles: Record<string, string> = {
    solid: '',
    dashed: '8 4',
    dotted: '8 4 2 4',
  }
  const lineStyle = props.edge.lineStyle ?? 'solid'
  return styles[lineStyle]
})

const strokeLinecap = computed(() => props.edge.lineStyle === 'dotted' ? 'round' : 'butt')

const startPoint = computed(() => getEdgeConnectionPoint(props.edge.sourceNodeId, props.edge.sourceSide))
const endPoint = computed(() => getEdgeConnectionPoint(props.edge.targetNodeId, props.edge.targetSide))

function getEdgeConnectionPoint(nodeId: string, side: ConnectionSide): Position {
  const node = props.nodes.find(item => item.id === nodeId)
  if (!node) return { x: 0, y: 0 }

  const absolutePosition = getAbsoluteNodePosition(props.nodes, node)
  const position = props.getConnectionPosition(nodeId, side, props.edge.id)
  return getConnectionPoint(absolutePosition, node, side, position) ?? { x: 0, y: 0 }
}

const sourceDepth = computed(() => getNodeDepth(props.edge.sourceNodeId))
const targetDepth = computed(() => getNodeDepth(props.edge.targetNodeId))
const edgeLayer = computed(() => Math.max(sourceDepth.value, targetDepth.value))
const edgeZIndex = computed(() => {
  const base = edgeLayer.value * 100 + 40
  const withPassThrough = props.isPassThrough ? base + 1000 : base
  return props.isDragging ? withPassThrough + 1000 : withPassThrough
})

const edgeGeometry = computed((): EdgeGeometry => {
  const start = startPoint.value
  const end = endPoint.value
  const segments = buildOrthogonalEdgeSegments(props.edge, start, end)

  if (!segments.length) {
    return {
      segments: [],
      totalLength: 0,
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    }
  }

  return calculateEdgeGeometry(segments)
})

const pathData = computed(() => {
  const geometry = edgeGeometry.value
  if (!geometry.segments.length) return ''

  let path = `M ${geometry.segments[0].start.x} ${geometry.segments[0].start.y}`
  geometry.segments.forEach(segment => {
    path += ` L ${segment.end.x} ${segment.end.y}`
  })

  return path
})

const draggableSegments = computed(() => {
  if (!props.showDragHandle || lockState.value === 'other') {
    return []
  }

  return edgeGeometry.value.segments
    .map((segment, index) => {
      const isVertical = Math.abs(segment.start.x - segment.end.x) <= 0.01
      const isFirst = index === 0
      const isLast = index === edgeGeometry.value.segments.length - 1
      const cursor = isFirst
        ? (props.edge.sourceSide === 'left' || props.edge.sourceSide === 'right' ? 'row-resize' : 'col-resize')
        : isLast
          ? (props.edge.targetSide === 'left' || props.edge.targetSide === 'right' ? 'row-resize' : 'col-resize')
          : (isVertical ? 'col-resize' : 'row-resize')

      if (edgeGeometry.value.segments.length === 1) return null

      return {
        index,
        path: `M ${segment.start.x} ${segment.start.y} L ${segment.end.x} ${segment.end.y}`,
        cursor,
      }
    })
    .filter((segment): segment is { index: number; path: string; cursor: string } => Boolean(segment))
})

const labelPosition = computed<Position | null>(() => {
  const geometry = edgeGeometry.value
  if (!geometry.totalLength || !geometry.segments.length || !edgeLabel.value) return null

  const ratio = clampEdgeLabelPosition(props.edge.labelPosition)
  return getPointAtSegmentLength(geometry.segments, geometry.totalLength * ratio)
})

function distance(start: Position, end: Position): number {
  return Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
}

function getHandlePath(start: Position, end: Position, maxLength = 32): string {
  const segmentLength = distance(start, end)
  if (!segmentLength) return ''

  const ratio = Math.min(maxLength / segmentLength, 1)
  const handleEnd = {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  }

  return `M ${start.x} ${start.y} L ${handleEnd.x} ${handleEnd.y}`
}

const sourceHandlePath = computed(() => {
  const firstSegment = edgeGeometry.value.segments[0]
  if (!firstSegment) return ''
  return getHandlePath(firstSegment.start, firstSegment.end)
})

const targetHandlePath = computed(() => {
  const lastSegment = edgeGeometry.value.segments[edgeGeometry.value.segments.length - 1]
  if (!lastSegment) return ''
  return getHandlePath(lastSegment.end, lastSegment.start)
})

const sourceHandleCursor = computed(() => (
  props.edge.sourceSide === 'left' || props.edge.sourceSide === 'right' ? 'ns-resize' : 'ew-resize'
))
const targetHandleCursor = computed(() => (
  props.edge.targetSide === 'left' || props.edge.targetSide === 'right' ? 'ns-resize' : 'ew-resize'
))

function calculateEdgeGeometry(segments: Segment[]): EdgeGeometry {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let totalLength = 0

  segments.forEach(segment => {
    minX = Math.min(minX, segment.start.x, segment.end.x)
    minY = Math.min(minY, segment.start.y, segment.end.y)
    maxX = Math.max(maxX, segment.start.x, segment.end.x)
    maxY = Math.max(maxY, segment.start.y, segment.end.y)

    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  })

  return {
    segments,
    totalLength,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  }
}

function onPathMouseDown(event: MouseEvent): void {
  emit('edge-click', props.edge.id, event)
}

function onDragHandleMouseDown(segmentIndex: number, event: MouseEvent): void {
  emit('breakpoint-drag-start', props.edge.id, segmentIndex, event)
  event.stopPropagation()
}

function onSourceHandleMouseDown(event: MouseEvent): void {
  emit('endpoint-order-drag-start', props.edge.id, 'source', event)
  event.stopPropagation()
}

function onTargetHandleMouseDown(event: MouseEvent): void {
  emit('endpoint-order-drag-start', props.edge.id, 'target', event)
  event.stopPropagation()
}

function onLabelMouseDown(event: MouseEvent): void {
  emit('label-drag-start', props.edge.id, event)
  event.stopPropagation()
}

function getNodeDepth(nodeId: string, nodes: Node[] = props.nodes, depth = 0): number {
  const node = nodes.find(item => item.id === nodeId)
  if (!node || !node.parentId) {
    return depth
  }
  return getNodeDepth(node.parentId, nodes, depth + 1)
}
</script>

<style scoped>
.edge {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  transform: translate(var(--drag-dx, 0px), var(--drag-dy, 0px));
}

.edge path {
  pointer-events: all;
}

.edge path.pass-through-error {
  filter:
    drop-shadow(0 0 0 rgba(217, 72, 95))
    drop-shadow(0 0 3px rgba(217, 72, 95));
}

.edge-hit-area {
  pointer-events: all;
}

.edge path.selected {
  stroke: #0b6bcb;
  stroke-width: 3;
}

.edge path.comment-target-highlighted {
  stroke: #0b6bcb;
  stroke-width: 4;
  filter: drop-shadow(0 0 4px rgba(11, 107, 203, 0.42));
}

.edge path.locked-self {
  stroke: #0b6bcb;
  filter: drop-shadow(0 0 4px rgba(11, 107, 203, 0.38));
}

.edge path.locked-other,
.edge.locked-other .drag-handle {
  stroke: #d9485f;
  cursor: not-allowed;
  filter: drop-shadow(0 0 4px rgba(217, 72, 95, 0.38));
}

.drag-handle {
  pointer-events: all;
}

.drag-handle-indicator {
  stroke: rgba(11, 107, 203, 0.32);
  stroke-width: 6;
  stroke-linecap: round;
  fill: none;
  pointer-events: none;
}

.edge-label-group {
  pointer-events: all;
  cursor: grab;
}

.edge-label-hitbox {
  fill: rgba(255, 255, 255, 0.001);
  stroke: none;
}

.edge.selected .edge-label-group,
.edge-label-group:active {
  cursor: grabbing;
}

.edge-label {
  fill: #333;
  font-size: 12px;
  font-family: Arial, sans-serif;
  paint-order: stroke;
  stroke: white;
  stroke-width: 2px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.edge-lock-label {
  font-size: 11px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
  user-select: none;
  -webkit-user-select: none;
}

.edge-lock-label--self {
  fill: #0b6bcb;
}

.edge-lock-label--other {
  fill: #d9485f;
}
</style>
