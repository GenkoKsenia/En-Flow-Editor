function copyComputedStyles(source: Element, target: Element): void {
  const computedStyle = getComputedStyle(source)
  const cssText = Array.from(computedStyle)
    .map(property => `${property}: ${computedStyle.getPropertyValue(property)};`)
    .join(' ')

  ;(target as HTMLElement).setAttribute('style', cssText)

  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children[index]
    if (child instanceof Element && targetChild instanceof Element) {
      copyComputedStyles(child, targetChild)
    }
  })
}

export function cloneElementWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement
  copyComputedStyles(element, clone)
  return clone
}

export async function renderHtmlToPngDataUrl(
  element: HTMLElement,
  width: number,
  height: number,
): Promise<string> {
  const serialized = new XMLSerializer().serializeToString(element)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${serialized}
      </foreignObject>
    </svg>
  `

  return await new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Не удалось подготовить canvas для снимка схемы'))
        return
      }

      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('Не удалось подготовить изображение схемы'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
