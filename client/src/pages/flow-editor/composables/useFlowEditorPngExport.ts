import type { Ref } from 'vue'

import type { Node, Position } from '@/types'

type UseFlowEditorPngExportOptions = {
  canvasContent: Ref<HTMLElement | null>
  nodes: Ref<Node[]>
  getAbsoluteNodePosition: (node: Node) => Position
  closeDownloadMenu: () => void
}

function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement

  const copyStyles = (source: Element, target: Element) => {
    const computedStyle = getComputedStyle(source)
    const cssText = Array.from(computedStyle)
      .map(prop => `${prop}: ${computedStyle.getPropertyValue(prop)};`)
      .join(' ')

    ;(target as HTMLElement).setAttribute('style', cssText)

    Array.from(source.children).forEach((child, index) => {
      const targetChild = target.children[index]
      if (child instanceof Element && targetChild instanceof Element) {
        copyStyles(child, targetChild)
      }
    })
  }

  copyStyles(element, clone)
  return clone
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

export function useFlowEditorPngExport({
  canvasContent,
  nodes,
  getAbsoluteNodePosition,
  closeDownloadMenu,
}: UseFlowEditorPngExportOptions) {
  async function exportAsPng(): Promise<void> {
    if (!canvasContent.value) return

    const bounds = getContentBounds(nodes.value, getAbsoluteNodePosition)
    const padding = 32
    const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2)
    const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2)
    if (!width || !height) return

    const cloned = cloneWithInlineStyles(canvasContent.value)
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

    const serialized = new XMLSerializer().serializeToString(wrapper)
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${serialized}
        </foreignObject>
      </svg>
    `

    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvasEl = document.createElement('canvas')
        canvasEl.width = width
        canvasEl.height = height
        const ctx = canvasEl.getContext('2d')

        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const link = document.createElement('a')
          link.href = canvasEl.toDataURL('image/png')
          link.download = 'diagram.png'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }

        resolve()
      }
      img.onerror = error => reject(error)
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    })
  }

  async function onDownloadPng(): Promise<void> {
    await exportAsPng()
    closeDownloadMenu()
  }

  return {
    onDownloadPng,
  }
}
