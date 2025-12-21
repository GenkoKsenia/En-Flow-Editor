<template>
  <button class="save-btn" type="button" @click="exportJson" aria-label="Скачать JSON">
    Скачать JSON
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Edge, Node, Position } from '../types'

type ExportBlock = {
  id: string
  name: string
  information: string[]
  position: Position
  width: number
  height: number
  parentId: string | null
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
}

type ExportDataFlow = {
  dataKey: string
  dataName: string
  startBlock: string
  finishBlocks: string[]
}

type ExportStyles = {
  blocks?: unknown
  connections?: unknown
} | null

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
    parentId: node.parentId ?? null
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

function extractBreakpoints(edge: Edge): Position[] {
  if (edge.geometry?.segments?.length) {
    return edge.geometry.segments.slice(0, -1).map((segment) => ({
      x: segment.end.x,
      y: segment.end.y
    }))
  }

  if (typeof edge.breakpointX === 'number' && typeof edge.breakpointY === 'number') {
    return [{ x: edge.breakpointX, y: edge.breakpointY }]
  }

  return []
}

function toExportConnection(
  edge: Edge,
  throughByEdgeId: Record<string, string[]>
): ExportConnection {
  return {
    id: edge.id,
    startBlock: edge.sourceNodeId ?? null,
    endBlock: edge.targetNodeId ?? null,
    startSide: edge.sourceSide ?? null,
    endSide: edge.targetSide ?? null,
    label: edge.label ?? null,
    dataKeys: [],
    through: throughByEdgeId[edge.id] ?? [],
    breakpoints: extractBreakpoints(edge)
  }
}

function buildPayload(): ExportPayload {
  const throughByEdgeId = buildThroughMap(props.nodes)

  return {
    blocks: props.nodes.map(toExportBlock),
    dataFlows: [],
    connections: props.edges.map((edge) => toExportConnection(edge, throughByEdgeId)),
    styles: props.styles ?? { blocks: [], connections: [] }
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
