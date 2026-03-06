export const getSpriteUrl = (file: string): string => {
  if (!file) return file

  const trimmed = file.trim()
  if (!trimmed) return trimmed

  if (
    /^(https?:)?\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  const withoutDotPrefix = trimmed.replace(/^\.\/+/, '')
  if (withoutDotPrefix.startsWith('/')) {
    return withoutDotPrefix
  }
  if (withoutDotPrefix.startsWith('contentMap/')) {
    return `/${withoutDotPrefix}`
  }

  return `/contentMap/${withoutDotPrefix}`
}
