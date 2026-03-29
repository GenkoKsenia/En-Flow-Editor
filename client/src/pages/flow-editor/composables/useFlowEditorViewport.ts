import { useEditorUiStore } from '@/stores'

export function useFlowEditorViewport() {
  const uiStore = useEditorUiStore()

  const zoomIn = () => uiStore.zoomIn()
  const zoomOut = () => uiStore.zoomOut()

  function onCanvasWheel(event: WheelEvent): void {
    const delta = Math.sign(event.deltaY)
    if (delta > 0) zoomOut()
    if (delta < 0) zoomIn()
  }

  return {
    zoomIn,
    zoomOut,
    onCanvasWheel,
  }
}
