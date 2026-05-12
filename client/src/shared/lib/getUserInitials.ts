export function getUserInitials(name: string): string {
  const source = name.includes('\\')
    ? name.split('\\').pop() ?? name
    : name

  const parts = source
    .split(/[\s._-]+/)
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return 'OP'
}
