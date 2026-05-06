export function generateEdgeLabel(
  sourceId: string | null | undefined,
  targetId: string | null | undefined,
  existingLabels: string[],
  getNodeLabel: (nodeId: string) => string,
): string {
  const source = sourceId ? getNodeLabel(String(sourceId)) : 'Источник'
  const target = targetId ? getNodeLabel(String(targetId)) : 'Цель'
  const base = `${source} → ${target}`
  if (!existingLabels.includes(base)) return base

  let index = 2
  let candidate = `${base} (${index})`
  while (existingLabels.includes(candidate)) {
    index += 1
    candidate = `${base} (${index})`
  }

  return candidate
}
