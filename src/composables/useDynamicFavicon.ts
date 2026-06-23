import { onScopeDispose, ref, watch } from 'vue'
import { useColorMode } from '@vueuse/core'
import {
  buildBrandLogoSvg,
  disposePrimaryColorProbe,
  fetchFaviconTemplate,
  rasterImageToColoredDataUrl,
  readPrimaryColor,
  recolorSvgMarkup,
  resolveIsDark,
  revokeObjectUrl,
  svgMarkupToBlobUrl,
  updateFaviconHref,
} from '../utils/dynamic-favicon'

export interface UseDynamicFaviconOptions {
  /** Static favicon path from `public/` (SVG preferred). */
  source?: string
  rel?: string
}

function resolvePublicAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const asset = path.replace(/^\//, '')
  if (base === '/' || base === '')
    return `/${asset}`
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}/${asset}`
}

/**
 * Keeps the browser favicon in sync with Nuxt UI primary color (`--ui-primary`).
 * Client-only; safe to call during SSR (no-op until mounted).
 */
export function useDynamicFavicon(options: UseDynamicFaviconOptions = {}) {
  const source = options.source ?? resolvePublicAsset('logoASR.svg')
  const rel = options.rel ?? 'icon'

  const primaryColor = ref<string | null>(null)
  const appConfig = useAppConfig()
  const colorMode = useColorMode()

  let activeObjectUrl: string | null = null
  let svgTemplate: string | null = null
  let templateLoaded = false
  let updateToken = 0

  async function ensureTemplate(): Promise<string | null> {
    if (templateLoaded)
      return svgTemplate

    templateLoaded = true
    svgTemplate = await fetchFaviconTemplate(source)
    return svgTemplate
  }

  async function applyFavicon(color: string): Promise<void> {
    const token = ++updateToken

    let href: string | null = null

    const template = await ensureTemplate()
    if (token !== updateToken)
      return

    if (template) {
      const svg = recolorSvgMarkup(template, color)
      href = svgMarkupToBlobUrl(svg)
    } else {
      const rasterHref = await rasterImageToColoredDataUrl(source, color)
      if (token !== updateToken)
        return

      if (rasterHref) {
        href = rasterHref
      } else {
        href = svgMarkupToBlobUrl(buildBrandLogoSvg(color))
      }
    }

    if (token !== updateToken) {
      revokeObjectUrl(href)
      return
    }

    revokeObjectUrl(activeObjectUrl)
    activeObjectUrl = href.startsWith('blob:') ? href : null
    updateFaviconHref(href, rel)
    primaryColor.value = color
  }

  function scheduleUpdate(primary = appConfig.ui.colors.primary, mode = colorMode.value): void {
    if (typeof window === 'undefined')
      return

    const isDark = resolveIsDark(mode)
    const color = readPrimaryColor(primary, isDark)
    void applyFavicon(color)
  }

  if (typeof window !== 'undefined') {
    watch(
      () => [appConfig.ui.colors.primary, colorMode.value] as const,
      ([primary, mode]) => {
        scheduleUpdate(primary, mode)
      },
      { immediate: true },
    )

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDark.addEventListener('change', () => {
      if (colorMode.value === 'auto')
        scheduleUpdate()
    })

    onScopeDispose(() => {
      prefersDark.removeEventListener('change', scheduleUpdate)
      revokeObjectUrl(activeObjectUrl)
      activeObjectUrl = null
      disposePrimaryColorProbe()
    })
  }

  return {
    primaryColor,
    refresh: scheduleUpdate,
  }
}
