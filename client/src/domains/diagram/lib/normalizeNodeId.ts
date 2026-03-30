export function normalizeNodeId(id: unknown): string | null {
  if (id === null || id === undefined) return null

  const value = String(id)
  return value.startsWith('node-') || value.startsWith('boundary-') ? value : `node-${value}`
}
