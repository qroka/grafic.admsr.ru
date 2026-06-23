import { BRAND_LOGO_PATH_D, BRAND_LOGO_VIEW_BOX } from '../constants/brand-logo'

const FAVICON_LINK_SELECTOR = 'link[rel="icon"], link[rel="shortcut icon"]'
const DEFAULT_FALLBACK_COLOR = '#00C16A'

function isClient(): boolean {
  return typeof document !== 'undefined'
}

export function resolveIsDark(colorMode: string): boolean {
  if (!isClient())
    return false
  if (colorMode === 'dark')
    return true
  if (colorMode === 'light')
    return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolvePaletteName(primary: string): string {
  return primary === 'neutral' ? 'old-neutral' : primary
}

function resolveCssColor(cssValue: string): string | null {
  if (!cssValue || cssValue.startsWith('var('))
    return null

  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:' + cssValue
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()

  if (resolved && resolved !== 'rgba(0, 0, 0, 0)' && resolved !== 'transparent')
    return resolved

  return cssValue
}

/**
 * Reads primary shade for the selected palette name (not stale `--ui-primary`).
 * Nuxt UI: 500 in light, 400 in dark — same as `text-primary`.
 */
export function readPrimaryColor(primary: string, isDark: boolean): string {
  if (!isClient())
    return DEFAULT_FALLBACK_COLOR

  const shade = isDark ? 400 : 500
  const paletteName = resolvePaletteName(primary)
  const cssVar = `--color-${paletteName}-${shade}`
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()

  if (raw) {
    const resolved = resolveCssColor(raw)
    if (resolved)
      return resolved
  }

  return DEFAULT_FALLBACK_COLOR
}

export function disposePrimaryColorProbe(): void {
  // kept for API compatibility; no persistent probe is used
}

export function buildBrandLogoSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="${BRAND_LOGO_VIEW_BOX}" fill="none"><path fill="${escapeXml(color)}" d="${BRAND_LOGO_PATH_D}"/></svg>`
}

export function recolorSvgMarkup(svg: string, color: string): string {
  const safeColor = escapeXml(color)

  let result = svg
    .replace(/\bfill="(?!none)[^"]*"/gi, `fill="${safeColor}"`)
    .replace(/\bstroke="(?!none)[^"]*"/gi, `stroke="${safeColor}"`)
    .replace(/<svg([^>]*)>/i, (match, attrs: string) => {
      if (/\bfill="/i.test(attrs))
        return match
      return `<svg${attrs} fill="none">`
    })

  if (!/\bfill="/i.test(result)) {
    result = result.replace(/<path/i, `<path fill="${safeColor}"`)
  }

  return result
}

export async function fetchFaviconTemplate(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok)
      return null

    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()

    if (contentType.includes('svg') || text.trimStart().startsWith('<svg'))
      return text

    return null
  } catch {
    return null
  }
}

export async function rasterImageToColoredDataUrl(
  imageUrl: string,
  color: string,
  size = 32,
): Promise<string | null> {
  if (!isClient())
    return null

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(image, 0, 0, size, size)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, size, size)

      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => resolve(null)
    image.src = imageUrl
  })
}

export function svgMarkupToBlobUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return URL.createObjectURL(blob)
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:'))
    URL.revokeObjectURL(url)
}

export function updateFaviconHref(href: string, rel = 'icon'): void {
  if (!isClient())
    return

  let link = document.querySelector<HTMLLinkElement>(FAVICON_LINK_SELECTOR)

  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }

  link.rel = rel
  link.type = href.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml'
  link.href = href
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
