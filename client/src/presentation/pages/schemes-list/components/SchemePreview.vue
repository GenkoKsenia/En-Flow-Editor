<template>
  <div class="preview-surface">
    <svg
      v-if="preview.hasContent"
      class="preview-svg"
      viewBox="0 0 360 180"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g>
        <polyline
          v-for="connection in preview.connections"
          :key="connection.id"
          :points="toPoints(connection.points)"
          :stroke="connection.color"
          :stroke-width="connection.width"
          :stroke-dasharray="connection.dasharray"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
        />

        <rect
          v-for="block in preview.blocks"
          :key="block.id"
          :x="block.x"
          :y="block.y"
          :width="block.width"
          :height="block.height"
          :rx="block.radius"
          :fill="block.fill"
          :stroke="block.stroke"
          :stroke-width="block.strokeWidth"
        />
      </g>
    </svg>

    <div v-else class="preview-placeholder">{{ isLoading ? 'Загрузка...' : 'Нет превью' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getSchemeById, type SchemeVersion } from '@/domains/schemes'

type Point = {
  x: number
  y: number
}

type PreviewBlock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  radius: number
}

type PreviewConnection = {
  id: string
  points: Point[]
  color: string
  width: number
  dasharray?: string
}

type NormalizedBlock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  radius: number
}

type NormalizedConnection = {
  id: string
  startBlockId: string
  endBlockId: string
  breakpoint: Point | null
  color: string
  width: number
  dasharray?: string
}

type PreviewModel = {
  hasContent: boolean
  blocks: PreviewBlock[]
  connections: PreviewConnection[]
}

const previewCodeCache = new Map<string, unknown | null>()
const previewRequestCache = new Map<string, Promise<unknown | null>>()

const props = defineProps<{
  schemeId: string
  code: unknown
}>()

const VIEWBOX_WIDTH = 360
const VIEWBOX_HEIGHT = 180
const PADDING = 16
const resolvedCode = ref<unknown | null>(props.code ?? null)
const isLoading = ref(false)

watch(
  () => [props.schemeId, props.code] as const,
  ([schemeId, code]) => {
    if (code !== null && code !== undefined) {
      resolvedCode.value = code
      previewCodeCache.set(schemeId, code)
      return
    }

    resolvedCode.value = previewCodeCache.get(schemeId) ?? null
    void ensurePreviewCode(schemeId)
  },
  { immediate: true },
)

const preview = computed<PreviewModel>(() => {
  const normalized = normalizeDiagram(resolvedCode.value)
  if (!normalized || normalized.blocks.length === 0) {
    return {
      hasContent: false,
      blocks: [],
      connections: [],
    }
  }

  const bounds = getBounds(normalized.blocks, normalized.connections)
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const availableWidth = VIEWBOX_WIDTH - PADDING * 2
  const availableHeight = VIEWBOX_HEIGHT - PADDING * 2
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight)
  const offsetX = (VIEWBOX_WIDTH - contentWidth * scale) / 2
  const offsetY = (VIEWBOX_HEIGHT - contentHeight * scale) / 2

  return {
    hasContent: true,
    blocks: normalized.blocks.map((block) => ({
      id: block.id,
      x: offsetX + (block.x - bounds.minX) * scale,
      y: offsetY + (block.y - bounds.minY) * scale,
      width: block.width * scale,
      height: block.height * scale,
      fill: block.fill,
      stroke: block.stroke,
      strokeWidth: clamp(block.strokeWidth * Math.max(scale, 0.65), 1, 3),
      radius: clamp(block.radius * scale, 3, 16),
    })),
    connections: normalized.connections.map((connection) => ({
      id: connection.id,
      points: buildConnectionPoints(connection, normalized.blocks).map((point) => ({
        x: offsetX + (point.x - bounds.minX) * scale,
        y: offsetY + (point.y - bounds.minY) * scale,
      })),
      color: connection.color,
      width: clamp(connection.width * Math.max(scale, 0.65), 1.25, 3.5),
      dasharray: connection.dasharray,
    })),
  }
})

async function ensurePreviewCode(schemeId: string): Promise<void> {
  if (!schemeId) return

  if (previewCodeCache.has(schemeId)) {
    resolvedCode.value = previewCodeCache.get(schemeId) ?? null
    return
  }

  const pendingRequest = previewRequestCache.get(schemeId)
  if (pendingRequest) {
    isLoading.value = true
    try {
      resolvedCode.value = await pendingRequest
    } finally {
      isLoading.value = false
    }
    return
  }

  isLoading.value = true

  const request = getSchemeById(schemeId)
    .then((scheme) => getLatestVersionCode(scheme.versions))
    .catch(() => null)
    .then((code) => {
      const normalizedCode = code ?? null
      previewCodeCache.set(schemeId, normalizedCode)
      return normalizedCode
    })
    .finally(() => {
      previewRequestCache.delete(schemeId)
    })

  previewRequestCache.set(schemeId, request)

  try {
    const loadedCode = await request
    if (props.schemeId === schemeId && (props.code === null || props.code === undefined)) {
      resolvedCode.value = loadedCode
    }
  } finally {
    if (props.schemeId === schemeId) {
      isLoading.value = false
    }
  }
}

function getLatestVersionCode(versions: SchemeVersion[]): unknown | null {
  const latestVersion = versions.reduce<SchemeVersion | null>((latest, version) => {
    if (!latest) return version
    return new Date(version.date).getTime() > new Date(latest.date).getTime() ? version : latest
  }, null)

  return latestVersion?.code ?? null
}

function normalizeDiagram(code: unknown): {
  blocks: NormalizedBlock[]
  connections: NormalizedConnection[]
} | null {
  const diagram = toRecord(parseCode(code))
  if (!diagram) return null

  const blocks = normalizeBlocks(
    readArrayKey(diagram, ['blocks', 'Blocks']),
    readBlockStyleMap(readStyles(diagram)),
  )

  if (blocks.length === 0) return null

  const blockIds = new Set(blocks.map((block) => block.id))
  const connections = normalizeConnections(
    readArrayKey(diagram, ['connections', 'Connections']),
    readConnectionStyleMap(readStyles(diagram)),
    blockIds,
  )

  return { blocks, connections }
}

function normalizeBlocks(blocksInput: unknown[], styleMap: Map<string, ReturnType<typeof normalizeBlockStyle>>): NormalizedBlock[] {
  return blocksInput.flatMap((blockInput) => {
    const block = toRecord(blockInput)
    if (!block) return []

    const id = readStringKey(block, ['id', 'Id'])
    const position = readPosition(block)
    if (!id || !position) return []

    const width = clamp(readNumberKey(block, ['width', 'Width']) ?? 132, 72, 320)
    const height = clamp(readNumberKey(block, ['height', 'Height']) ?? 72, 44, 220)
    const style = styleMap.get(id)

    return [{
      id,
      x: position.x,
      y: position.y,
      width,
      height,
      fill: style?.fill ?? '#f4f5f7',
      stroke: style?.stroke ?? '#5f6570',
      strokeWidth: style?.strokeWidth ?? 1.5,
      radius: style?.radius ?? 10,
    }]
  })
}

function normalizeConnections(
  connectionsInput: unknown[],
  styleMap: Map<string, ReturnType<typeof normalizeConnectionStyle>>,
  blockIds: Set<string>,
): NormalizedConnection[] {
  return connectionsInput.flatMap((connectionInput) => {
    const connection = toRecord(connectionInput)
    if (!connection) return []

    const id = readStringKey(connection, ['id', 'Id']) ?? crypto.randomUUID()
    const startBlockId = readStringKey(connection, ['startBlock', 'StartBlock'])
    const endBlockId = readStringKey(connection, ['endBlock', 'EndBlock'])
    if (!startBlockId || !endBlockId) return []
    if (!blockIds.has(startBlockId) || !blockIds.has(endBlockId)) return []

    const style = styleMap.get(id)

    return [{
      id,
      startBlockId,
      endBlockId,
      breakpoint: readFirstBreakpoint(connection),
      color: style?.color ?? '#69707d',
      width: style?.width ?? 1.75,
      dasharray: style?.dasharray,
    }]
  })
}

function readStyles(diagram: Record<string, unknown>): Record<string, unknown> | null {
  return toRecord(readUnknownKey(diagram, ['styles', 'Styles']))
}

function readBlockStyleMap(styles: Record<string, unknown> | null): Map<string, ReturnType<typeof normalizeBlockStyle>> {
  const styleMap = new Map<string, ReturnType<typeof normalizeBlockStyle>>()

  for (const styleInput of readArrayKey(styles, ['blocks', 'Blocks'])) {
    const style = normalizeBlockStyle(styleInput)
    if (!style) continue
    styleMap.set(style.id, style)
  }

  return styleMap
}

function normalizeBlockStyle(styleInput: unknown) {
  const style = toRecord(styleInput)
  if (!style) return null

  const id = readStringKey(style, ['element_id', 'elementId', 'ElementID', 'ElementId'])
  if (!id) return null

  return {
    id,
    fill: readStringKey(style, ['color', 'Color']) ?? '#f4f5f7',
    stroke: readStringKey(style, ['border_color', 'borderColor', 'BorderColor']) ?? '#5f6570',
    strokeWidth: clamp(readNumberKey(style, ['border_width', 'borderWidth', 'BorderWidth']) ?? 1.5, 1, 4),
    radius: clamp(readNumberKey(style, ['border_radius', 'borderRadius', 'BorderRadius']) ?? 10, 0, 24),
  }
}

function readConnectionStyleMap(styles: Record<string, unknown> | null): Map<string, ReturnType<typeof normalizeConnectionStyle>> {
  const styleMap = new Map<string, ReturnType<typeof normalizeConnectionStyle>>()

  for (const styleInput of readArrayKey(styles, ['connections', 'Connections'])) {
    const style = normalizeConnectionStyle(styleInput)
    if (!style) continue
    styleMap.set(style.id, style)
  }

  return styleMap
}

function normalizeConnectionStyle(styleInput: unknown) {
  const style = toRecord(styleInput)
  if (!style) return null

  const id = readStringKey(style, ['element_id', 'elementId', 'ElementID', 'ElementId'])
  if (!id) return null

  const lineType = readStringKey(style, ['type', 'Type'])

  return {
    id,
    color: readStringKey(style, ['color', 'Color']) ?? '#69707d',
    width: clamp(readNumberKey(style, ['width', 'Width']) ?? 1.75, 1, 4),
    dasharray: lineType === 'dashed' ? '8 5' : undefined,
  }
}

function buildConnectionPoints(
  connection: NormalizedConnection,
  blocks: NormalizedBlock[],
): Point[] {
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const startBlock = blockById.get(connection.startBlockId)
  const endBlock = blockById.get(connection.endBlockId)
  if (!startBlock || !endBlock) return []

  const points = [getBlockCenter(startBlock)]
  if (connection.breakpoint) points.push(connection.breakpoint)
  points.push(getBlockCenter(endBlock))
  return points
}

function getBounds(blocks: NormalizedBlock[], connections: NormalizedConnection[]) {
  const blockById = new Map(blocks.map((block) => [block.id, block]))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const block of blocks) {
    minX = Math.min(minX, block.x)
    minY = Math.min(minY, block.y)
    maxX = Math.max(maxX, block.x + block.width)
    maxY = Math.max(maxY, block.y + block.height)
  }

  for (const connection of connections) {
    const startBlock = blockById.get(connection.startBlockId)
    const endBlock = blockById.get(connection.endBlockId)
    if (!startBlock || !endBlock) continue

    for (const point of buildConnectionPoints(connection, blocks)) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  return { minX, minY, maxX, maxY }
}

function getBlockCenter(block: Pick<NormalizedBlock, 'x' | 'y' | 'width' | 'height'>): Point {
  return {
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
  }
}

function readPosition(source: Record<string, unknown>): Point | null {
  const nested = toRecord(readUnknownKey(source, ['position', 'Position']))
  const positionSource = nested ?? source

  const x = readNumberKey(positionSource, ['x', 'X'])
  const y = readNumberKey(positionSource, ['y', 'Y'])

  if (x === null || y === null) return null

  return { x, y }
}

function readFirstBreakpoint(source: Record<string, unknown>): Point | null {
  const breakpoints = readArrayKey(source, ['breakpoints', 'Breakpoints'])
  for (const breakpointInput of breakpoints) {
    const breakpoint = toRecord(breakpointInput)
    if (!breakpoint) continue
    const point = readPosition(breakpoint)
    if (point) return point
  }

  return null
}

function parseCode(code: unknown): unknown {
  if (typeof code !== 'string') return code

  try {
    return JSON.parse(code)
  } catch {
    return null
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readArrayKey(source: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!source) return []

  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) return value
  }

  return []
}

function readUnknownKey(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key]
  }

  return null
}

function readStringKey(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return null
}

function readNumberKey(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }

  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toPoints(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}
</script>

<style scoped>
.preview-surface {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 42%),
    linear-gradient(135deg, #eef3f7 0%, #f6f8fb 55%, #edf2f8 100%);
}

.preview-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #8a909b;
}
</style>
