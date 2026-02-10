<template>
  <button class="save-btn" type="button" @click="exportJson" aria-label="Скачать JSON">
    Скачать JSON
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConnectionSide, Edge, Node, Position, Segment, NodeLineStyle } from '../types'

type ExportBlock = {
  id: string
  name: string
  information: string[]
  position: Position
  width: number
  height: number
  parentId: string | null
  borderStyle: Node['borderStyle']
  dataTargetId?: string | null
  dataTargetSetManually?: boolean
}

type ExportConnection = {
  id: string
  startBlock: string | null
  endBlock: string | null
  startSide: Edge['sourceSide'] | null
  endSide: Edge['targetSide'] | null
  label: string | null
  dataKeys: string[]
  through: string[]
  breakpoints: Position[]
  lineStyle: Edge['lineStyle']
}

type ExportDataFlow = {
  dataKey: string
  dataName: string
  startBlock: string
  finishBlocks: string[]
}

type ExportStyles = {
  blocks: Array<{
    element_id: string
    element_type: 'block'
    color: string
    border_color: string
    border_width: number
    border_radius: number
    border_style: NodeLineStyle
  }>
  connections: Array<{
    element_id: string
    element_type: 'connection'
    color: string
    width: number
    type: Edge['lineStyle']
  }>
}

type ExportPayload = {
  blocks: ExportBlock[]
  dataFlows: ExportDataFlow[]
  connections: ExportConnection[]
  styles: ExportStyles
}

const props = defineProps<{
  nodes: Node[]
  edges: Edge[]
  styles?: ExportStyles
  fileName?: string
}>()

const fileName = computed(() => props.fileName ?? 'diagram.json')

import * as DEFAULTS from '../constants'

function extractInformation(meta?: Record<string, unknown> | null): string[] {
  if (!meta || typeof meta !== 'object') return []
  const info = (meta as Record<string, unknown>).information
  if (Array.isArray(info)) {
    return info.filter((item): item is string => typeof item === 'string')
  }
  if (typeof info === 'string') {
    return [info]
  }
  return []
}

function toExportBlock(node: Node): ExportBlock {
  return {
    id: node.id,
    name: node.text,
    information: extractInformation(node.meta),
    position: { x: node.position.x, y: node.position.y },
    width: node.width,
    height: node.height,
    parentId: node.parentId ?? null,
    borderStyle: node.borderStyle ?? 'solid',
    dataTargetId: node.dataTargetId ?? null,
    dataTargetSetManually: node.dataTargetSetManually ?? false
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
  const positions: Record<string, Record<ConnectionSide, string[]>> = {}

  nodes.forEach((node) => {
    positions[node.id] = { top: [], right: [], bottom: [], left: [] }
  })

  edges.forEach((edge) => {
    positions[edge.sourceNodeId]?.[edge.sourceSide]?.push(edge.id)
    positions[edge.targetNodeId]?.[edge.targetSide]?.push(edge.id)
  })

  return positions
}

function getConnectionPosition(
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodeId: string,
  side: ConnectionSide,
  connectionId: string
): number {
  const sideConnections = positions[nodeId]?.[side] || []
  const index = sideConnections.indexOf(connectionId)
  if (index === -1) return 0.5
  return (index + 1) / (sideConnections.length + 1)
}

function getAbsoluteNodePosition(node: Node, nodes: Node[]): Position {
  if (!node.parentId) return node.position
  const parent = nodes.find((n) => n.id === node.parentId)
  if (!parent) return node.position
  const parentAbsolute = getAbsoluteNodePosition(parent, nodes)
  return {
    x: parentAbsolute.x + node.position.x,
    y: parentAbsolute.y + node.position.y
  }
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

  switch (side) {
    case 'top':
      return { x: absolute.x + node.width * fraction, y: absolute.y }
    case 'right':
      return { x: absolute.x + node.width, y: absolute.y + node.height * fraction }
    case 'bottom':
      return { x: absolute.x + node.width * fraction, y: absolute.y + node.height }
    case 'left':
      return { x: absolute.x, y: absolute.y + node.height * fraction }
    default:
      return null
  }
}

function needsThreeSegments(edge: Edge): boolean {
  const { sourceSide, targetSide } = edge
  return (
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right')
  )
}

function getEdgeSegments(
  edge: Edge,
  positions: Record<string, Record<ConnectionSide, string[]>>,
  nodes: Node[]
): Segment[] {
  const start = getConnectionPoint(positions, nodes, edge.sourceNodeId, edge.sourceSide, edge.id)
  const end = getConnectionPoint(positions, nodes, edge.targetNodeId, edge.targetSide, edge.id)

  if (!start || !end) return []

  const segments: Segment[] = []
  let current = start
  const useThreeSegments = needsThreeSegments(edge) || edge.breakpointX !== undefined || edge.breakpointY !== undefined
  const breakpointX = edge.breakpointX ?? (start.x + end.x) / 2
  const breakpointY = edge.breakpointY ?? (start.y + end.y) / 2

  if (useThreeSegments) {
    if (edge.sourceSide === 'left' || edge.sourceSide === 'right') {
      const point1 = { x: breakpointX, y: start.y }
      const point2 = { x: breakpointX, y: end.y }
      segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: current, end: point1 })
      current = point1
      segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: current, end: point2 })
      current = point2
      segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: current, end })
    } else {
      const point1 = { x: start.x, y: breakpointY }
      const point2 = { x: end.x, y: breakpointY }
      segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: current, end: point1 })
      current = point1
      segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: current, end: point2 })
      current = point2
      segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: current, end })
    }
  } else {
    const bendPoint =
      edge.sourceSide === 'left' || edge.sourceSide === 'right'
        ? { x: end.x, y: start.y }
        : { x: start.x, y: end.y }
    segments.push({ id: `${edge.id}-segment-1`, type: 'line', start, end: bendPoint })
    segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: bendPoint, end })
  }

  return segments
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
    dataKeys: edge.dataKeys ?? [],
    through: throughByEdgeId[edge.id] ?? [],
    breakpoints: extractBreakpoints(edge, positions, nodes),
    lineStyle: edge.lineStyle ?? 'solid'
  }
}

function buildStyles(nodes: Node[], edges: Edge[]): ExportStyles {
  const blockStyles: ExportStyles['blocks'] = nodes.map((node) => ({
    element_id: node.id,
    element_type: 'block',
    color: DEFAULTS.DEFAULT_NODE_COLOR,
    border_color: DEFAULTS.DEFAULT_BORDER_COLOR,
    border_width: DEFAULTS.DEFAULT_BORDER_WIDTH,
    border_radius: DEFAULTS.DEFAULT_BORDER_RADIUS,
    border_style: node.borderStyle ?? 'solid'
  }))

  const connectionStyles: ExportStyles['connections'] = edges.map((edge) => ({
    element_id: edge.id,
    element_type: 'connection',
    color: DEFAULTS.DEFAULT_EDGE_COLOR,
    width: DEFAULTS.DEFAULT_EDGE_WIDTH,
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
    dataFlows: props.nodes
      .filter(node => !!node.dataTargetId)
      .map(node => ({
        dataKey: node.id,
        dataName: node.text,
        startBlock: node.id,
        finishBlocks: [node.dataTargetId as string]
      })),
    connections: props.edges.map((edge) => toExportConnection(edge, throughByEdgeId, connectionPositions, props.nodes)),
    styles
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
}
</script>
