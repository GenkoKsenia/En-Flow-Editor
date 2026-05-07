import type { Ref } from 'vue'

import type { Node, Position } from '@/domains/graph'
import { cloneElementWithInlineStyles, renderHtmlToPngDataUrl } from '@/shared/lib/renderHtmlToPngDataUrl'

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type UseFlowEditorPngExportOptions = {
  canvasContent: Ref<HTMLElement | null>
  nodes: Ref<Node[]>
  zoom: Ref<number>
  includeComments: Ref<boolean>
  getAbsoluteNodePosition: (node: Node) => Position
  closeDownloadMenu: () => void
}

function getContentBounds(nodes: Node[], getAbsoluteNodePosition: (node: Node) => Position) {
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0

  nodes.forEach(node => {
    const absolute = getAbsoluteNodePosition(node)
    minX = Math.min(minX, absolute.x)
    minY = Math.min(minY, absolute.y)
    maxX = Math.max(maxX, absolute.x + node.width)
    maxY = Math.max(maxY, absolute.y + node.height)
  })

  return {
    minX,
    minY,
    maxX: maxX || 1,
    maxY: maxY || 1,
  }
}

function getCommentBounds(canvasContent: HTMLElement, zoom: number): Bounds | null {
  const comments = Array.from(canvasContent.querySelectorAll<HTMLElement>('.comment-bubble'))
  if (comments.length === 0) return null

  const contentRect = canvasContent.getBoundingClientRect()
  const styles = window.getComputedStyle(canvasContent)
  const paddingLeft = Number.parseFloat(styles.paddingLeft || '0') || 0
  const paddingTop = Number.parseFloat(styles.paddingTop || '0') || 0
  const safeZoom = zoom || 1

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  comments.forEach(comment => {
    const rect = comment.getBoundingClientRect()
    const left = (rect.left - contentRect.left) / safeZoom - paddingLeft
    const top = (rect.top - contentRect.top) / safeZoom - paddingTop
    const width = rect.width / safeZoom
    const height = rect.height / safeZoom

    minX = Math.min(minX, left)
    minY = Math.min(minY, top)
    maxX = Math.max(maxX, left + width)
    maxY = Math.max(maxY, top + height)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

function mergeBounds(primary: Bounds, secondary: Bounds | null): Bounds {
  if (!secondary) return primary

  return {
    minX: Math.min(primary.minX, secondary.minX),
    minY: Math.min(primary.minY, secondary.minY),
    maxX: Math.max(primary.maxX, secondary.maxX),
    maxY: Math.max(primary.maxY, secondary.maxY),
  }
}

export function useFlowEditorPngExport({
  canvasContent,
  nodes,
  zoom,
  includeComments,
  getAbsoluteNodePosition,
  closeDownloadMenu,
}: UseFlowEditorPngExportOptions) {
  async function exportAsPng(): Promise<void> {
    if (!canvasContent.value) return

    const nodeBounds = getContentBounds(nodes.value, getAbsoluteNodePosition)
    const bounds = includeComments.value
      ? mergeBounds(nodeBounds, getCommentBounds(canvasContent.value, zoom.value))
      : nodeBounds
    const padding = 32
    const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2)
    const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2)
    if (!width || !height) return

    const cloned = cloneElementWithInlineStyles(canvasContent.value)
    if (!includeComments.value) {
      cloned.querySelectorAll('.comment-bubble').forEach(comment => comment.remove())
    }
    cloned.style.transform = `translate(${padding - bounds.minX}px, ${padding - bounds.minY}px)`
    cloned.style.transformOrigin = '0 0'
    cloned.style.width = `${width}px`
    cloned.style.height = `${height}px`
    cloned.style.padding = '0'
    cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')

    const wrapper = document.createElement('div')
    wrapper.style.width = `${width}px`
    wrapper.style.height = `${height}px`
    wrapper.style.background = '#fff'
    wrapper.style.position = 'relative'
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    wrapper.appendChild(cloned)

    const pngDataUrl = await renderHtmlToPngDataUrl(wrapper, width, height)
    const link = document.createElement('a')
    link.href = pngDataUrl
    link.download = 'diagram.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function onDownloadPng(): Promise<void> {
    await exportAsPng()
    closeDownloadMenu()
  }

  return {
    onDownloadPng,
  }
}
