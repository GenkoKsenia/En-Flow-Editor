import {
  buildDslNodeIdMaps,
  findFreeLeftPlacement,
  generateEdgeLabel,
  getAbsoluteNodePosition,
  normalizeConnectionEndpointOrders,
  parseInternalDiagramNodeId,
  getRequiredParentSize,
  normalizeBorderStyle,
  normalizeConnectionSide,
  normalizeLineStyle,
  resolveDslNodeId,
  roundCoord,
} from '@/domains/diagram/lib'
import type { DiagramDto } from '@/domains/diagram/api'
import {
  normalizeConnectionSideForBorderStyle,
  type ConnectionSide,
  type DataFlow,
  type Edge,
  type Node,
} from '@/domains/graph'

import type { DiagramContext } from './diagram.context'

type DiagramDslDependencies = {
  applyParsedDiagram: (parsed: DiagramDto) => void
  applyJson: (raw: string) => void
}

type BlockEntry = {
  id: string
  order: number
  name?: string
  parentId?: string | null
  props: {
    info?: string
    color?: string
    borderColor?: string
    borderWidth?: number
    borderRadius?: number
    borderStyle?: string
    x?: number
    y?: number
    width?: number
    height?: number
  }
}

type ConnectionEntry = {
  order: number
  sourceId: string
  targetId: string
  kind: 'simple' | 'label' | 'data'
  label?: string | null
  dataKeys: string[]
  through: string[]
  props: {
    label?: string
    through?: string[]
    color?: string
    width?: number
    type?: string
    sourceSide?: string
    targetSide?: string
    sourceOrder?: number
    targetOrder?: number
    breakpoints?: Array<{ x: number; y: number }>
    breakpointX?: number
    breakpointY?: number
  }
}

type FlowEntry = {
  id: string
  order: number
  name?: string
  finishBlocks?: string[]
  finishBlocksDefined?: boolean
}

type ParsedDsl = {
  blocks: Map<string, BlockEntry>
  blockOrder: string[]
  connections: ConnectionEntry[]
  flows: Map<string, FlowEntry>
  flowOrder: string[]
}

type DslNodeIdMaps = ReturnType<typeof buildDslNodeIdMaps>

const ROOT_NODE_POSITION = { x: 100, y: 100 }
const DEFAULT_NODE_WIDTH = 120
const DEFAULT_NODE_HEIGHT = 60
const DEFAULT_PARENT_WIDTH = 180
const DEFAULT_PARENT_HEIGHT = 150
const PARENT_PADDING = 24
const PARENT_TITLE_CLEARANCE = 28
const CHILD_VERTICAL_GAP = 16
const DSL_ID_PATTERN = '[A-Za-z0-9_][\\w-]*'
const ID_PATTERN = new RegExp(`^${DSL_ID_PATTERN}$`)
const CONNECTION_ENDPOINT_PATTERN = `(${DSL_ID_PATTERN})(?:\\[([^\\]]+)\\])?`

function quoteDsl(value: string): string {
  return JSON.stringify(value)
}

function parseQuoted(value: string): string {
  try {
    return JSON.parse(value)
  } catch {
    return value.slice(1, -1)
  }
}

function tokenizeDsl(line: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  let escaped = false

  for (const char of line) {
    if (inQuotes) {
      current += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inQuotes = false
      }
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
    if (char === '"') {
      inQuotes = true
    }
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

function normalizeColor(value: string): string {
  const trimmed = value.trim()
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return `#${trimmed}`
  }
  return trimmed
}

function normalizeColorForComparison(value: string): string {
  const normalized = normalizeColor(value).toLowerCase()
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized

  if (/^[0-9a-f]{3}$/.test(hex) || /^[0-9a-f]{4}$/.test(hex)) {
    return `#${hex.split('').map(char => `${char}${char}`).join('')}`
  }

  if (/^[0-9a-f]{6}$/.test(hex) || /^[0-9a-f]{8}$/.test(hex)) {
    return `#${hex}`
  }

  return normalized
}

function colorsEqual(left: string, right: string): boolean {
  return normalizeColorForComparison(left) === normalizeColorForComparison(right)
}

function parseNumber(value: string): number | null {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function parseKeyValue(token: string): { key: string; rawValue: string } | null {
  const separatorIndex = token.indexOf('=')
  if (separatorIndex === -1) return null

  return {
    key: token.slice(0, separatorIndex),
    rawValue: token.slice(separatorIndex + 1),
  }
}

function parsePropertyValue(rawValue: string): string {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return parseQuoted(rawValue)
  }

  return rawValue
}

function buildConnectionSignature(
  sourceId: string,
  targetId: string,
  label: string | null,
  dataKeys: string[],
  through: string[],
): string {
  return [
    sourceId,
    targetId,
    label ?? '',
    dataKeys.join(','),
    through.join(','),
  ].join('|')
}

function uniquePush(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value)
  }
}

function parseEndpointSide(id: string, rawSide?: string): ConnectionSide | undefined {
  if (rawSide === undefined) {
    return undefined
  }

  if (rawSide === 'top' || rawSide === 'right' || rawSide === 'bottom' || rawSide === 'left') {
    return rawSide
  }

  throw new Error(`Некорректная сторона связи у блока ${id}: ${rawSide}`)
}

function formatConnectionEndpoint(id: string, side?: ConnectionSide): string {
  return `${id}[${side ?? 'right'}]`
}

function formatBreakpoints(points: Array<{ x: number; y: number }>): string {
  return points
    .map(point => `${roundCoord(point.x)}:${roundCoord(point.y)}`)
    .join(',')
}

function parseBreakpointsValue(value: string): Array<{ x: number; y: number }> {
  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (!items.length) {
    return []
  }

  return items.map(item => {
    const [rawX, rawY] = item.split(':')
    const x = parseNumber(rawX ?? '')
    const y = parseNumber(rawY ?? '')

    if (x === null || y === null) {
      throw new Error(`Некорректная точка маршрута связи: ${item}`)
    }

    return {
      x: roundCoord(x),
      y: roundCoord(y),
    }
  })
}

function serializeDiagramBreakpoints(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length !== 1) {
    return points
  }

  const point = points[0]
  return [
    { x: point.x, y: point.y },
    { x: point.x, y: point.y },
  ]
}

export function createDiagramDslUseCases(
  context: DiagramContext,
  dependencies: DiagramDslDependencies,
) {
  function getDslNodeIdMaps(): DslNodeIdMaps {
    return buildDslNodeIdMaps(context.nodes.value.map(node => node.id))
  }

  function toDslNodeId(id: string, maps: DslNodeIdMaps): string {
    return maps.toDsl[id] ?? id
  }

  function isBoundaryLikeBlock(
    entry: BlockEntry | undefined,
    childCounts: Record<string, number>,
    existingInternalId?: string,
  ): boolean {
    if (existingInternalId) {
      return parseInternalDiagramNodeId(existingInternalId)?.kind === 'boundary'
    }

    if (!entry) {
      return false
    }

    if ((childCounts[entry.id] ?? 0) > 0) {
      return true
    }

    if (!entry.parentId && entry.props.borderStyle === 'dashed') {
      return true
    }

    return (entry.name ?? '').trim().startsWith('Область ')
  }

  function resolveParsedDslIds(parsed: ParsedDsl): ParsedDsl {
    const maps = getDslNodeIdMaps()
    const childCounts = parsed.blockOrder.reduce<Record<string, number>>((acc, id) => {
      const parentId = parsed.blocks.get(id)?.parentId
      if (parentId) {
        acc[parentId] = (acc[parentId] || 0) + 1
      }
      return acc
    }, {})
    const idMap = new Map<string, string>()
    const resolvedOwners = new Map<string, string>()

    parsed.blockOrder.forEach(dslId => {
      const entry = parsed.blocks.get(dslId)
      const existingInternalId = maps.toInternal[dslId]
      const internalId = resolveDslNodeId(
        dslId,
        isBoundaryLikeBlock(entry, childCounts, existingInternalId) ? 'boundary' : 'node',
        maps.toInternal,
      )
      const owner = resolvedOwners.get(internalId)

      if (owner && owner !== dslId) {
        throw new Error(`Несколько идентификаторов ссылаются на один блок: ${owner} и ${dslId}`)
      }

      resolvedOwners.set(internalId, dslId)
      idMap.set(dslId, internalId)
    })

    const resolvedBlocks = new Map<string, BlockEntry>()
    parsed.blockOrder.forEach(dslId => {
      const entry = parsed.blocks.get(dslId)
      const internalId = idMap.get(dslId)
      if (!entry || !internalId) return

      resolvedBlocks.set(internalId, {
        ...entry,
        id: internalId,
        parentId: entry.parentId ? (idMap.get(entry.parentId) ?? entry.parentId) : entry.parentId,
      })
    })

    return {
      ...parsed,
      blocks: resolvedBlocks,
      blockOrder: parsed.blockOrder.map(id => idMap.get(id) ?? id),
      connections: parsed.connections.map(connection => ({
        ...connection,
        sourceId: idMap.get(connection.sourceId) ?? connection.sourceId,
        targetId: idMap.get(connection.targetId) ?? connection.targetId,
        through: connection.through.map(id => idMap.get(id) ?? id),
        props: {
          ...connection.props,
          through: connection.props.through?.map(id => idMap.get(id) ?? id),
        },
      })),
      flows: new Map(
        parsed.flowOrder.map(flowId => {
          const entry = parsed.flows.get(flowId)
          return [flowId, {
            ...entry,
            finishBlocks: entry?.finishBlocks?.map(id => idMap.get(id) ?? id),
          } satisfies FlowEntry]
        }),
      ),
    }
  }

  function serializeConnection(edge: Edge, through: string[], maps: DslNodeIdMaps): string {
    const source = formatConnectionEndpoint(toDslNodeId(edge.sourceNodeId, maps), edge.sourceSide)
    const target = formatConnectionEndpoint(toDslNodeId(edge.targetNodeId, maps), edge.targetSide)
    const base = edge.dataKeys?.length
      ? `${source} =>[${edge.dataKeys.join(', ')}] ${target}`
      : edge.label
        ? `${source} -[${edge.label}]-> ${target}`
        : `${source} -> ${target}`

    const props: string[] = []

    if (edge.dataKeys?.length && edge.label) {
      props.push(`label=${quoteDsl(edge.label)}`)
    }

    if (through.length) {
      props.push(`through=${through.map(id => toDslNodeId(id, maps)).join(',')}`)
    }

    if (!colorsEqual(edge.color ?? context.defaults.DEFAULT_EDGE_COLOR, context.defaults.DEFAULT_EDGE_COLOR)) {
      props.push(`color=${normalizeColor(edge.color ?? context.defaults.DEFAULT_EDGE_COLOR)}`)
    }
    if ((edge.width ?? context.defaults.DEFAULT_EDGE_WIDTH) !== context.defaults.DEFAULT_EDGE_WIDTH) {
      props.push(`width=${edge.width ?? context.defaults.DEFAULT_EDGE_WIDTH}`)
    }
    if ((edge.lineStyle ?? 'solid') !== 'solid') {
      props.push(`type=${edge.lineStyle ?? 'solid'}`)
    }
    if (edge.breakpoints?.length) {
      props.push(`breakpoints=${formatBreakpoints(edge.breakpoints)}`)
    } else if (typeof edge.breakpointX === 'number') {
      props.push(`breakpointX=${edge.breakpointX}`)
    }
    if (!edge.breakpoints?.length && typeof edge.breakpointY === 'number') {
      props.push(`breakpointY=${edge.breakpointY}`)
    }

    return props.length ? `${base} ${props.join(' ')}` : base
  }

  function buildThroughMap(): Record<string, string[]> {
    return context.nodes.value.reduce<Record<string, string[]>>((acc, node) => {
      ;(node.passThroughEdges ?? []).forEach(edgeId => {
        if (!acc[edgeId]) {
          acc[edgeId] = []
        }
        acc[edgeId].push(node.id)
      })
      return acc
    }, {})
  }

  function serializeDsl(): string {
    const lines: string[] = []
    const dslIdMaps = getDslNodeIdMaps()
    const childMap = context.nodes.value.reduce<Record<string, Node[]>>((acc, node) => {
      if (!node.parentId) return acc
      if (!acc[node.parentId]) {
        acc[node.parentId] = []
      }
      acc[node.parentId].push(node)
      return acc
    }, {})
    const roots = context.nodes.value.filter(node => !node.parentId)
    const throughByEdgeId = buildThroughMap()

    const emitNodeTree = (node: Node, depth = 0) => {
      const indent = '  '.repeat(depth)
      const children = childMap[node.id] ?? []
      const dslId = toDslNodeId(node.id, dslIdMaps)
      const declaration = `${indent}${dslId} ${quoteDsl(node.text || dslId)}`

      if (children.length) {
        lines.push(`${declaration} {`)
        children.forEach(child => emitNodeTree(child, depth + 1))
        lines.push(`${indent}}`)
        return
      }

      lines.push(declaration)
    }

    lines.push('# Блоки')
    roots.forEach(node => emitNodeTree(node))

    if (context.dataFlows.value.length) {
      lines.push('')
      lines.push('# Потоки данных')
      context.dataFlows.value.forEach(flow => {
        const finishBlocks = (flow.finishBlocks ?? [])
          .map(blockId => toDslNodeId(blockId, dslIdMaps))
          .join(',')
        lines.push(`flow ${flow.dataKey} ${quoteDsl(flow.dataName || flow.dataKey)} finish=${finishBlocks}`)
      })
    }

    if (context.edges.value.length) {
      lines.push('')
      lines.push('# Связи')
      context.edges.value.forEach(edge => {
        lines.push(serializeConnection(edge, throughByEdgeId[edge.id] ?? [], dslIdMaps))
      })
    }

    const infoNodes = context.nodes.value.filter(node => node.informationText?.trim())
    if (infoNodes.length) {
      lines.push('')
      lines.push('# Дополнительный текст')
      infoNodes.forEach(node => {
        lines.push(`${toDslNodeId(node.id, dslIdMaps)} info=${quoteDsl(node.informationText?.trim() ?? '')}`)
      })
    }

    const blockStyleLines = context.nodes.value
      .map(node => {
        const props: string[] = []

        if (!colorsEqual(node.color ?? context.defaults.DEFAULT_NODE_COLOR, context.defaults.DEFAULT_NODE_COLOR)) {
          props.push(`color=${normalizeColor(node.color ?? context.defaults.DEFAULT_NODE_COLOR)}`)
        }
        if (!colorsEqual(node.borderColor ?? context.defaults.DEFAULT_BORDER_COLOR, context.defaults.DEFAULT_BORDER_COLOR)) {
          props.push(`borderColor=${normalizeColor(node.borderColor ?? context.defaults.DEFAULT_BORDER_COLOR)}`)
        }
        if ((node.borderWidth ?? context.defaults.DEFAULT_BORDER_WIDTH) !== context.defaults.DEFAULT_BORDER_WIDTH) {
          props.push(`borderWidth=${node.borderWidth ?? context.defaults.DEFAULT_BORDER_WIDTH}`)
        }
        if ((node.borderRadius ?? context.defaults.DEFAULT_BORDER_RADIUS) !== context.defaults.DEFAULT_BORDER_RADIUS) {
          props.push(`radius=${node.borderRadius ?? context.defaults.DEFAULT_BORDER_RADIUS}`)
        }
        if ((node.borderStyle ?? 'solid') !== 'solid') {
          props.push(`borderStyle=${node.borderStyle ?? 'solid'}`)
        }

        return props.length ? `${toDslNodeId(node.id, dslIdMaps)} ${props.join(' ')}` : null
      })
      .filter((line): line is string => line !== null)

    if (blockStyleLines.length) {
      lines.push('')
      lines.push('# Стили блоков')
      lines.push(...blockStyleLines)
    }

    const blockSizeLines = context.nodes.value
      .map(node => {
        const children = childMap[node.id] ?? []
        const defaultSize = children.length
          ? getRequiredParentSize(
            { width: DEFAULT_PARENT_WIDTH, height: DEFAULT_PARENT_HEIGHT },
            children,
            PARENT_PADDING,
          )
          : { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }
        const props: string[] = []

        if (node.width !== defaultSize.width) {
          props.push(`width=${node.width}`)
        }
        if (node.height !== defaultSize.height) {
          props.push(`height=${node.height}`)
        }

        return props.length ? `${toDslNodeId(node.id, dslIdMaps)} ${props.join(' ')}` : null
      })
      .filter((line): line is string => line !== null)

    if (blockSizeLines.length) {
      lines.push('')
      lines.push('# Размеры блоков')
      lines.push(...blockSizeLines)
    }

    lines.push('')
    lines.push('# Позиции блоков')
    context.nodes.value.forEach(node => {
      lines.push(`${toDslNodeId(node.id, dslIdMaps)} x=${node.position.x} y=${node.position.y}`)
    })

    return lines.join('\n')
  }

  function syncDslFromState(): void {
    const serialized = serializeDsl()

    if (context.isEditorFocused.value && context.dslBuffer.value !== serialized) {
      return
    }

    context.isUpdatingFromDsl.value = true
    context.dslBuffer.value = serialized
    context.isUpdatingFromDsl.value = false
  }

  function ensureBlockEntry(parsed: ParsedDsl, id: string): BlockEntry {
    const existing = parsed.blocks.get(id)
    if (existing) {
      return existing
    }

    const entry: BlockEntry = {
      id,
      order: parsed.blockOrder.length,
      props: {},
    }
    parsed.blocks.set(id, entry)
    parsed.blockOrder.push(id)
    return entry
  }

  function ensureFlowEntry(parsed: ParsedDsl, id: string): FlowEntry {
    const existing = parsed.flows.get(id)
    if (existing) {
      return existing
    }

    const entry: FlowEntry = {
      id,
      order: parsed.flowOrder.length,
    }
    parsed.flows.set(id, entry)
    parsed.flowOrder.push(id)
    return entry
  }

  function applyFlowProperty(entry: FlowEntry, key: string, rawValue: string): void {
    const value = parsePropertyValue(rawValue)

    switch (key) {
      case 'finish':
      case 'finishes':
      case 'finishBlocks':
      case 'targets':
      case 'to':
        entry.finishBlocks = value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
        entry.finishBlocksDefined = true
        return
      default:
        throw new Error(`Неизвестное свойство потока: ${key}`)
    }
  }

  function parseFlowLine(parsed: ParsedDsl, line: string): boolean {
    if (!line.startsWith('flow ')) {
      return false
    }

    const tokens = tokenizeDsl(line)
    if (tokens.length < 3 || tokens[0] !== 'flow') {
      throw new Error(`Не удалось разобрать строку потока: ${line}`)
    }

    const id = tokens[1] ?? ''
    if (!ID_PATTERN.test(id)) {
      throw new Error(`Некорректный идентификатор потока: ${id}`)
    }

    const flow = ensureFlowEntry(parsed, id)
    let nameParsed = false

    tokens.slice(2).forEach(token => {
      const property = parseKeyValue(token)
      if (property) {
        applyFlowProperty(flow, property.key, property.rawValue)
        return
      }

      if (!nameParsed && token.startsWith('"') && token.endsWith('"')) {
        flow.name = parseQuoted(token)
        nameParsed = true
        return
      }

      throw new Error(`Не удалось разобрать строку потока: ${line}`)
    })

    if (!nameParsed) {
      throw new Error(`У потока ${id} должно быть указано имя`)
    }

    return true
  }

  function applyBlockProperty(entry: BlockEntry, key: string, rawValue: string): void {
    const value = parsePropertyValue(rawValue)

    switch (key) {
      case 'info':
        entry.props.info = value
        return
      case 'color':
        entry.props.color = normalizeColor(value)
        return
      case 'borderColor':
        entry.props.borderColor = normalizeColor(value)
        return
      case 'borderWidth': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.borderWidth = parsed
        return
      }
      case 'radius':
      case 'borderRadius': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.borderRadius = parsed
        return
      }
      case 'borderStyle':
        entry.props.borderStyle = value
        return
      case 'x': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.x = parsed
        return
      }
      case 'y': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.y = parsed
        return
      }
      case 'width': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.width = parsed
        return
      }
      case 'height': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.height = parsed
        return
      }
      default:
        throw new Error(`Неизвестное свойство блока: ${key}`)
    }
  }

  function applyConnectionProperty(entry: ConnectionEntry, key: string, rawValue: string): void {
    const value = parsePropertyValue(rawValue)

    switch (key) {
      case 'label':
        entry.props.label = value
        return
      case 'through':
        entry.props.through = value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
        return
      case 'color':
        entry.props.color = normalizeColor(value)
        return
      case 'width': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.width = parsed
        return
      }
      case 'type':
        entry.props.type = value
        return
      case 'sourceSide':
      case 'startSide':
        entry.props.sourceSide = value
        return
      case 'targetSide':
      case 'endSide':
        entry.props.targetSide = value
        return
      case 'sourceOrder':
      case 'startOrder': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.sourceOrder = parsed
        return
      }
      case 'targetOrder':
      case 'endOrder': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.targetOrder = parsed
        return
      }
      case 'breakpointX': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.breakpointX = parsed
        return
      }
      case 'breakpointY': {
        const parsed = parseNumber(value)
        if (parsed !== null) entry.props.breakpointY = parsed
        return
      }
      case 'breakpoints':
        entry.props.breakpoints = parseBreakpointsValue(value)
        return
      default:
        throw new Error(`Неизвестное свойство связи: ${key}`)
    }
  }

  function parseBlockLine(parsed: ParsedDsl, line: string, parentStack: string[]): void {
    const opensGroup = line.endsWith('{')
    const source = opensGroup ? line.slice(0, -1).trimEnd() : line
    const tokens = tokenizeDsl(source)
    if (!tokens.length) {
      throw new Error('Пустое объявление блока')
    }

    const id = tokens.shift() ?? ''
    if (!ID_PATTERN.test(id)) {
      throw new Error(`Некорректный идентификатор блока: ${id}`)
    }

    const entry = ensureBlockEntry(parsed, id)
    if (parentStack.length && entry.parentId === undefined) {
      entry.parentId = parentStack[parentStack.length - 1]
    }

    tokens.forEach(token => {
      const property = parseKeyValue(token)
      if (property) {
        applyBlockProperty(entry, property.key, property.rawValue)
        return
      }

      if (token.startsWith('"') && token.endsWith('"')) {
        entry.name = parseQuoted(token)
        return
      }

      throw new Error(`Не удалось разобрать строку блока: ${line}`)
    })

    if (opensGroup) {
      parentStack.push(id)
    }
  }

  function parseConnectionRemainder(entry: ConnectionEntry, remainder: string): void {
    const trimmed = remainder.trim()
    if (!trimmed) return

    if (trimmed.startsWith('through ')) {
      entry.through = trimmed.slice('through '.length)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      return
    }

    tokenizeDsl(trimmed).forEach(token => {
      const property = parseKeyValue(token)
      if (!property) {
        throw new Error(`Не удалось разобрать свойства связи: ${trimmed}`)
      }
      applyConnectionProperty(entry, property.key, property.rawValue)
    })

    if (entry.props.through?.length) {
      entry.through = entry.props.through
    }
  }

  function parseDsl(raw: string): ParsedDsl {
    const parsed: ParsedDsl = {
      blocks: new Map(),
      blockOrder: [],
      connections: [],
      flows: new Map(),
      flowOrder: [],
    }
    const parentStack: string[] = []

    raw.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return
      }

      if (trimmed === '}') {
        if (!parentStack.length) {
          throw new Error(`Лишняя закрывающая скобка на строке ${index + 1}`)
        }
        parentStack.pop()
        return
      }

      if (parseFlowLine(parsed, trimmed)) {
        return
      }

      const dataMatch = trimmed.match(new RegExp(`^${CONNECTION_ENDPOINT_PATTERN}\\s*=>\\s*\\[([^\\]]*)\\]\\s*${CONNECTION_ENDPOINT_PATTERN}(.*)$`))
      if (dataMatch) {
        const [, sourceId, sourceSide, rawDataKeys, targetId, targetSide, remainder] = dataMatch
        ensureBlockEntry(parsed, sourceId)
        ensureBlockEntry(parsed, targetId)
        const connection: ConnectionEntry = {
          order: parsed.connections.length,
          sourceId,
          targetId,
          kind: 'data',
          dataKeys: rawDataKeys.split(',').map(item => item.trim()).filter(Boolean),
          through: [],
          props: {
            sourceSide: parseEndpointSide(sourceId, sourceSide),
            targetSide: parseEndpointSide(targetId, targetSide),
          },
        }
        parseConnectionRemainder(connection, remainder)
        parsed.connections.push(connection)
        return
      }

      const labeledMatch = trimmed.match(new RegExp(`^${CONNECTION_ENDPOINT_PATTERN}\\s*-\\[([^\\]]*)\\]->\\s*${CONNECTION_ENDPOINT_PATTERN}(.*)$`))
      if (labeledMatch) {
        const [, sourceId, sourceSide, label, targetId, targetSide, remainder] = labeledMatch
        ensureBlockEntry(parsed, sourceId)
        ensureBlockEntry(parsed, targetId)
        const connection: ConnectionEntry = {
          order: parsed.connections.length,
          sourceId,
          targetId,
          kind: 'label',
          label: label.trim(),
          dataKeys: [],
          through: [],
          props: {
            sourceSide: parseEndpointSide(sourceId, sourceSide),
            targetSide: parseEndpointSide(targetId, targetSide),
          },
        }
        parseConnectionRemainder(connection, remainder)
        parsed.connections.push(connection)
        return
      }

      const simpleMatch = trimmed.match(new RegExp(`^${CONNECTION_ENDPOINT_PATTERN}\\s*->\\s*${CONNECTION_ENDPOINT_PATTERN}(.*)$`))
      if (simpleMatch) {
        const [, sourceId, sourceSide, targetId, targetSide, remainder] = simpleMatch
        ensureBlockEntry(parsed, sourceId)
        ensureBlockEntry(parsed, targetId)
        const connection: ConnectionEntry = {
          order: parsed.connections.length,
          sourceId,
          targetId,
          kind: 'simple',
          dataKeys: [],
          through: [],
          props: {
            sourceSide: parseEndpointSide(sourceId, sourceSide),
            targetSide: parseEndpointSide(targetId, targetSide),
          },
        }
        parseConnectionRemainder(connection, remainder)
        parsed.connections.push(connection)
        return
      }

      parseBlockLine(parsed, trimmed, parentStack)
    })

    if (parentStack.length) {
      throw new Error('Не закрыты все блоки группировки')
    }

    const directionalPairs = new Set<string>()
    parsed.connections.forEach(connection => {
      const pairKey = `${connection.sourceId}->${connection.targetId}`
      if (directionalPairs.has(pairKey)) {
        throw new Error(`Нельзя создавать несколько стрелок в одном направлении между ${connection.sourceId} и ${connection.targetId}`)
      }
      directionalPairs.add(pairKey)
    })

    return parsed
  }

  function compileDsl(parsed: ParsedDsl): DiagramDto {
    parsed.connections.forEach(connection => {
      ensureBlockEntry(parsed, connection.sourceId)
      ensureBlockEntry(parsed, connection.targetId)
      connection.through.forEach(throughId => ensureBlockEntry(parsed, throughId))
      connection.props.through?.forEach(throughId => ensureBlockEntry(parsed, throughId))
    })

    const existingNodes = new Map(context.nodes.value.map(node => [node.id, node]))
    const existingFlows = new Map(context.dataFlows.value.map(flow => [flow.dataKey, flow]))
    const existingThroughByEdgeId = buildThroughMap()
    const edgeCandidates = new Map<string, Edge[]>()

    context.edges.value.forEach(edge => {
      const signature = buildConnectionSignature(
        edge.sourceNodeId,
        edge.targetNodeId,
        edge.label ?? null,
        edge.dataKeys ?? [],
        existingThroughByEdgeId[edge.id] ?? [],
      )
      if (!edgeCandidates.has(signature)) {
        edgeCandidates.set(signature, [])
      }
      edgeCandidates.get(signature)?.push(edge)
    })

    const childCounts = parsed.blockOrder.reduce<Record<string, number>>((acc, id) => {
      const parentId = parsed.blocks.get(id)?.parentId
      if (parentId) {
        acc[parentId] = (acc[parentId] || 0) + 1
      }
      return acc
    }, {})

    const resolvedNodes: Node[] = []
    const siblingOffsets: Record<string, number> = {}

    parsed.blockOrder.forEach(id => {
      const entry = parsed.blocks.get(id)
      if (!entry) return

      const existing = existingNodes.get(id)
      const hasChildren = (childCounts[id] || 0) > 0
      const width = entry.props.width
        ?? existing?.width
        ?? (hasChildren ? DEFAULT_PARENT_WIDTH : DEFAULT_NODE_WIDTH)
      const height = entry.props.height
        ?? existing?.height
        ?? (hasChildren ? DEFAULT_PARENT_HEIGHT : DEFAULT_NODE_HEIGHT)
      const parentId = entry.parentId ?? undefined

      let positionX = entry.props.x
      let positionY = entry.props.y

      if (parentId) {
        if (positionX === undefined && existing?.parentId === parentId) {
          positionX = existing.position.x
        }
        if (positionY === undefined && existing?.parentId === parentId) {
          positionY = existing.position.y
        }

        if (positionX === undefined || positionY === undefined) {
          const siblingIndex = siblingOffsets[parentId] || 0
          siblingOffsets[parentId] = siblingIndex + 1
          positionX = positionX ?? PARENT_PADDING
          positionY = positionY ?? roundCoord(
            PARENT_PADDING + PARENT_TITLE_CLEARANCE + siblingIndex * (height + CHILD_VERTICAL_GAP),
          )
        }
      } else {
        const existingAbsolute = existing
          ? getAbsoluteNodePosition(context.nodes.value, existing)
          : null
        if (positionX === undefined) {
          positionX = existingAbsolute?.x
        }
        if (positionY === undefined) {
          positionY = existingAbsolute?.y
        }

        if (positionX === undefined || positionY === undefined) {
          const placement = findFreeLeftPlacement(
            resolvedNodes,
            { width, height },
            { defaultPosition: ROOT_NODE_POSITION },
          )
          positionX = positionX ?? placement.x
          positionY = positionY ?? placement.y
        }
      }

      resolvedNodes.push({
        id,
        text: entry.name ?? existing?.text ?? id,
        position: {
          x: roundCoord(positionX ?? 0),
          y: roundCoord(positionY ?? 0),
        },
        width,
        height,
        parentId,
        passThroughEdges: [],
        color: entry.props.color ?? context.defaults.DEFAULT_NODE_COLOR,
        borderColor: entry.props.borderColor ?? context.defaults.DEFAULT_BORDER_COLOR,
        borderWidth: entry.props.borderWidth ?? context.defaults.DEFAULT_BORDER_WIDTH,
        borderRadius: entry.props.borderRadius ?? context.defaults.DEFAULT_BORDER_RADIUS,
        borderStyle: normalizeBorderStyle(entry.props.borderStyle),
        informationText: entry.props.info ?? '',
        informationIds: [],
      })
    })

    resolvedNodes.forEach(node => {
      const children = resolvedNodes.filter(item => item.parentId === node.id)
      if (!children.length) return

      const required = getRequiredParentSize(node, children, PARENT_PADDING)
      node.width = Math.max(node.width, required.width)
      node.height = Math.max(node.height, required.height)
    })
    const nodeBorderStyles = new Map(resolvedNodes.map(node => [node.id, node.borderStyle]))

    const declaredFlowMap = new Map<string, DataFlow>()
    parsed.flowOrder.forEach(flowId => {
      const entry = parsed.flows.get(flowId)
      const existing = existingFlows.get(flowId)
      declaredFlowMap.set(flowId, {
        dataKey: flowId,
        dataName: entry?.name ?? existing?.dataName ?? flowId,
        startBlock: existing?.startBlock,
        finishBlocks: entry?.finishBlocksDefined
          ? [...(entry.finishBlocks ?? [])]
          : [...(existing?.finishBlocks ?? [])],
      })
    })

    const usedEdgeIds = new Set<string>()
    const edgeLabelHistory: string[] = []
    const resolvedEdges: Edge[] = parsed.connections.map((connection, index) => {
      const label = connection.kind === 'label'
        ? (connection.label?.trim() || null)
        : (connection.props.label?.trim() || null)
      const dataKeys = connection.kind === 'data'
        ? connection.dataKeys
        : []
      const through = connection.props.through?.length
        ? connection.props.through
        : connection.through

      const signature = buildConnectionSignature(
        connection.sourceId,
        connection.targetId,
        label,
        dataKeys,
        through,
      )
      const matchedEdge = (edgeCandidates.get(signature) ?? []).find(edge => !usedEdgeIds.has(edge.id)) ?? null
      if (matchedEdge) {
        usedEdgeIds.add(matchedEdge.id)
      }

      dataKeys.forEach(dataKey => {
        const existing = declaredFlowMap.get(dataKey) ?? existingFlows.get(dataKey)
        const declaredEntry = parsed.flows.get(dataKey)
        const nextFlow: DataFlow = existing
          ? { ...existing }
          : { dataKey, dataName: dataKey, finishBlocks: [] }

        if (!nextFlow.startBlock) {
          nextFlow.startBlock = connection.sourceId
        } else if (nextFlow.startBlock !== connection.sourceId) {
          throw new Error(`Поток ${dataKey} не может начинаться в нескольких блоках`)
        }

        if (!declaredEntry?.finishBlocksDefined) {
          const finishBlocks = new Set(nextFlow.finishBlocks ?? [])
          finishBlocks.add(connection.targetId)
          nextFlow.finishBlocks = Array.from(finishBlocks)
        }
        declaredFlowMap.set(dataKey, nextFlow)
      })

      const edgeLabel = label ?? generateEdgeLabel(
        connection.sourceId,
        connection.targetId,
        edgeLabelHistory,
        nodeId => resolvedNodes.find(node => node.id === nodeId)?.text?.trim() || nodeId,
      )
      edgeLabelHistory.push(edgeLabel)

      return {
        id: matchedEdge?.id ?? `edge-${index + 1}-${connection.sourceId}-${connection.targetId}`,
        sourceNodeId: connection.sourceId,
        targetNodeId: connection.targetId,
        sourceSide: normalizeConnectionSideForBorderStyle(
          normalizeConnectionSide(connection.props.sourceSide ?? matchedEdge?.sourceSide),
          nodeBorderStyles.get(connection.sourceId),
        ),
        targetSide: normalizeConnectionSideForBorderStyle(
          normalizeConnectionSide(connection.props.targetSide ?? matchedEdge?.targetSide),
          nodeBorderStyles.get(connection.targetId),
        ),
        sourceOrder: connection.props.sourceOrder ?? matchedEdge?.sourceOrder,
        targetOrder: connection.props.targetOrder ?? matchedEdge?.targetOrder,
        label: edgeLabel,
        color: connection.props.color ?? matchedEdge?.color ?? context.defaults.DEFAULT_EDGE_COLOR,
        width: connection.props.width ?? matchedEdge?.width ?? context.defaults.DEFAULT_EDGE_WIDTH,
        lineStyle: normalizeLineStyle(connection.props.type ?? matchedEdge?.lineStyle),
        markerType: matchedEdge?.markerType ?? 'triangle',
        breakpoints: connection.props.breakpoints?.map(point => ({ ...point }))
          ?? matchedEdge?.breakpoints?.map(point => ({ ...point })),
        breakpointX: connection.props.breakpointX ?? matchedEdge?.breakpointX,
        breakpointY: connection.props.breakpointY ?? matchedEdge?.breakpointY,
        breakpointLocked: matchedEdge?.breakpointLocked ?? false,
        geometry: matchedEdge?.geometry,
        dataKeys,
      } satisfies Edge
    })
    normalizeConnectionEndpointOrders(resolvedEdges)

    const flowList = Array.from(declaredFlowMap.values())
      .map(flow => ({
        ...flow,
        startBlock: flow.startBlock && parsed.blocks.has(flow.startBlock)
          ? flow.startBlock
          : undefined,
        finishBlocks: (flow.finishBlocks ?? []).filter(blockId => parsed.blocks.has(blockId)),
      }))

    const infoByNode = flowList.reduce<Record<string, string[]>>((acc, flow) => {
      if (!flow.startBlock) return acc
      if (!acc[flow.startBlock]) {
        acc[flow.startBlock] = []
      }
      acc[flow.startBlock].push(flow.dataKey)
      return acc
    }, {})

    const throughByEdgeId = resolvedEdges.reduce<Record<string, string[]>>((acc, edge, edgeIndex) => {
      acc[edge.id] = parsed.connections[edgeIndex]?.props.through?.length
        ? parsed.connections[edgeIndex].props.through ?? []
        : parsed.connections[edgeIndex]?.through ?? []
      return acc
    }, {})

    const blockDtos = resolvedNodes.map(node => ({
      id: node.id,
      name: node.text,
      information: infoByNode[node.id] ?? [],
      informationText: node.informationText?.trim() || undefined,
      position: node.position,
      width: node.width,
      height: node.height,
      parentId: node.parentId ?? null,
    }))

    const connectionDtos = resolvedEdges.map(edge => ({
      id: edge.id,
      startBlock: edge.sourceNodeId,
      endBlock: edge.targetNodeId,
      startSide: edge.sourceSide,
      endSide: edge.targetSide,
      startOrder: edge.sourceOrder ?? null,
      endOrder: edge.targetOrder ?? null,
      label: edge.label ?? null,
      dataKeys: edge.dataKeys ?? [],
      through: throughByEdgeId[edge.id] ?? [],
      breakpoints: edge.breakpoints?.length
        ? serializeDiagramBreakpoints(edge.breakpoints.map(point => ({ x: point.x, y: point.y })))
        : (typeof edge.breakpointX === 'number' && typeof edge.breakpointY === 'number'
          ? [{ x: edge.breakpointX, y: edge.breakpointY }]
          : []),
    }))

    return {
      blocks: blockDtos,
      dataFlows: flowList,
      connections: connectionDtos,
      styles: {
        blocks: resolvedNodes.map(node => ({
          elementId: node.id,
          color: node.color ?? context.defaults.DEFAULT_NODE_COLOR,
          borderColor: node.borderColor ?? context.defaults.DEFAULT_BORDER_COLOR,
          borderWidth: node.borderWidth ?? context.defaults.DEFAULT_BORDER_WIDTH,
          borderRadius: node.borderRadius ?? context.defaults.DEFAULT_BORDER_RADIUS,
          borderStyle: node.borderStyle ?? 'solid',
        })),
        connections: resolvedEdges.map(edge => ({
          elementId: edge.id,
          color: edge.color ?? context.defaults.DEFAULT_EDGE_COLOR,
          width: edge.width ?? context.defaults.DEFAULT_EDGE_WIDTH,
          type: edge.lineStyle ?? 'solid',
        })),
      },
    }
  }

  function applyDsl(raw: string): void {
    context.dslError.value = null

    const trimmed = raw.trim()
    if (!trimmed) {
      return
    }

    if (trimmed.startsWith('{')) {
      dependencies.applyJson(raw)
      return
    }

    try {
      const parsed = resolveParsedDslIds(parseDsl(raw))
      const compiled = compileDsl(parsed)
      dependencies.applyParsedDiagram(compiled)
    } catch (error) {
      context.dslError.value = error instanceof Error ? error.message : 'Не удалось разобрать код схемы'
    }
  }

  function debounceApplyFromDsl(): void {
    if (context.applyTimeout.value) {
      clearTimeout(context.applyTimeout.value)
    }

    context.applyTimeout.value = window.setTimeout(() => {
      context.applyTimeout.value = null
      applyDsl(context.dslBuffer.value)
    }, 400)
  }

  return {
    serializeDsl,
    syncDslFromState,
    applyDsl,
    debounceApplyFromDsl,
  }
}
