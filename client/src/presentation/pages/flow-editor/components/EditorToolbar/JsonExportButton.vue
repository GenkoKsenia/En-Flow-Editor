<template>
  <UiButton block size="sm" variant="outline" @click="exportJson" :aria-label="buttonLabel">
    {{ buttonLabel }}
  </UiButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mapCommentToExportPayload, type CommentsStoreComment } from '@/domains/comments'
import {
  buildConnectionPositionMap,
  buildOrthogonalEdgeSegments,
  getAbsoluteNodePosition as resolveAbsoluteNodePosition,
  getConnectionPoint as resolveConnectionPoint,
  getConnectionPositionFromMap,
} from '@/domains/diagram'
import type { ConnectionSide, DataFlow, Edge, Node, NodeLineStyle, Position, Segment } from '@/domains/graph'
import UiButton from '@/presentation/ui/UiButton.vue'

type ExportBlock = {
  id: string
  name: string
  information: string[]
  informationText?: string
  position: Position
  width: number
  height: number
  parentId: string | null
  borderStyle: Node['borderStyle']
}

type ExportConnection = {
  id: string
  startBlock: string | null
  endBlock: string | null
  startSide: Edge['sourceSide'] | null
  endSide: Edge['targetSide'] | null
  label: string | null
  labelPosition: number | null
  dataKeys: string[]
  through: string[]
  breakpoints: Position[]
  lineStyle: Edge['lineStyle']
}

type ExportStyles = {
  blocks: Array<{
    elementId: string
    color: string
    borderColor: string
    borderWidth: number
    borderRadius: number
    borderStyle: NodeLineStyle
  }>
  connections: Array<{
    elementId: string
    color: string
    width: number
    type: Edge['lineStyle']
  }>
}

type ExportPayload = {
  blocks: ExportBlock[]
  dataFlows: DataFlow[]
  connections: ExportConnection[]
  styles: ExportStyles
  comments?: ExportComment[]
}

type ExportComment = {
  id: string
  /**
   * Encoded target: node:<id>, edge:<id> или canvas
   */
  targetId: string | null
  offset: { x: number; y: number }
  text: string
  author: string
  createdAt: string
}

const props = defineProps<{
  nodes: Node[]
  edges: Edge[]
  dataFlows?: DataFlow[]
  styles?: ExportStyles
  comments?: CommentsStoreComment[]
  fileName?: string
  label?: string
}>()

const emit = defineEmits<{
  exported: []
}>()

const fileName = computed(() => props.fileName ?? 'diagram.json')
const buttonLabel = computed(() => props.label ?? 'Скачать JSON')

import * as DEFAULTS from '@/constants'

function toExportBlock(node: Node): ExportBlock {
  return {
    id: node.id,
    name: node.text,
    information: [...(node.informationIds ?? [])],
    informationText: node.informationText?.trim() || undefined,
    position: { x: node.position.x, y: node.position.y },
    width: node.width,
    height: node.height,
    parentId: node.parentId ?? null,
    borderStyle: node.borderStyle ?? 'solid'
  }
}

function buildThroughMap(nodes: Node[]): Record<string, string[]> {
  return nodes.reduce<Record<string, string[]>>((acc, node) => {
    (node.passThroughEdges ?? []).forEach((edgeId) => {
      if (!acc[edgeId]) acc[edgeId] = []
      acc[edgeId].push(node.id)
    })
    return acc
  }, {})
}

function buildConnectionPositions(nodes: Node[], edges: Edge[]): Record<string, Record<ConnectionSide, string[]>> {
  return buildConnectionPositionMap(nodes, edges)
}

function getConnectionPosition(
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodeId: string,
  side: ConnectionSide,
  connectionId: string
): number {
  return getConnectionPositionFromMap(positions, nodeId, side, connectionId)
}

function getAbsoluteNodePosition(node: Node, nodes: Node[]): Position {
  return resolveAbsoluteNodePosition(nodes, node)
}

function getConnectionPoint(
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodes: Node[],
  nodeId: string,
  side: ConnectionSide,
  connectionId: string
): Position | null {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const absolute = getAbsoluteNodePosition(node, nodes)
  const fraction = getConnectionPosition(positions, nodeId, side, connectionId)
  return resolveConnectionPoint(absolute, node, side, fraction)
}

function getEdgeSegments(
  edge: Edge,
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodes: Node[]
): Segment[] {
  const start = getConnectionPoint(positions, nodes, edge.sourceNodeId, edge.sourceSide, edge.id)
  const end = getConnectionPoint(positions, nodes, edge.targetNodeId, edge.targetSide, edge.id)

  if (!start || !end) return []
  return buildOrthogonalEdgeSegments(edge, start, end)
}

function extractBreakpoints(
  edge: Edge,
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodes: Node[]
): Position[] {
  const segments = getEdgeSegments(edge, positions, nodes)
  if (segments.length < 2) return []
  return segments.slice(0, segments.length - 1).map((segment) => ({
    x: segment.end.x,
    y: segment.end.y
  }))
}

function toExportConnection(
  edge: Edge,
  throughByEdgeId: Record<string, string[]>,
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodes: Node[]
): ExportConnection {
  return {
    id: edge.id,
    startBlock: edge.sourceNodeId ?? null,
    endBlock: edge.targetNodeId ?? null,
    startSide: edge.sourceSide ?? null,
    endSide: edge.targetSide ?? null,
    label: edge.label ?? null,
    labelPosition: typeof edge.labelPosition === 'number' ? edge.labelPosition : null,
    dataKeys: edge.dataKeys ?? [],
    through: throughByEdgeId[edge.id] ?? [],
    breakpoints: extractBreakpoints(edge, positions, nodes),
    lineStyle: edge.lineStyle ?? 'solid'
  }
}

function buildStyles(nodes: Node[], edges: Edge[]): ExportStyles {
  const blockStyles: ExportStyles['blocks'] = nodes.map((node) => ({
    elementId: node.id,
    color: node.color ?? DEFAULTS.DEFAULT_NODE_COLOR,
    borderColor: node.borderColor ?? DEFAULTS.DEFAULT_BORDER_COLOR,
    borderWidth: node.borderWidth ?? DEFAULTS.DEFAULT_BORDER_WIDTH,
    borderRadius: node.borderRadius ?? DEFAULTS.DEFAULT_BORDER_RADIUS,
    borderStyle: node.borderStyle ?? 'solid'
  }))

  const connectionStyles: ExportStyles['connections'] = edges.map((edge) => ({
    elementId: edge.id,
    color: edge.color ?? DEFAULTS.DEFAULT_EDGE_COLOR,
    width: edge.width ?? DEFAULTS.DEFAULT_EDGE_WIDTH,
    type: edge.lineStyle ?? 'solid'
  }))

  return { blocks: blockStyles, connections: connectionStyles }
}

function buildPayload(): ExportPayload {
  const throughByEdgeId = buildThroughMap(props.nodes)
  const connectionPositions = buildConnectionPositions(props.nodes, props.edges)
  const styles = buildStyles(props.nodes, props.edges)

  return {
    blocks: props.nodes.map(toExportBlock),
    dataFlows: props.dataFlows ?? [],
    connections: props.edges.map((edge) => toExportConnection(edge, throughByEdgeId, connectionPositions, props.nodes)),
    styles,
    comments: (props.comments ?? []).map(mapCommentToExportPayload)
  }
}

function exportJson(): void {
  const payload = buildPayload()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.value
  link.click()
  URL.revokeObjectURL(url)
  emit('exported')
}
</script>
