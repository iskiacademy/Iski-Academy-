type AnalyticsValue = string | number | boolean | undefined
export type ConversionParams = Record<string, AnalyticsValue>

type DataLayerEntry = { event?: string; [key: string]: unknown }
type DataLayer = Array<DataLayerEntry | unknown[]>
type Gtag = (...args: unknown[]) => void
type FacebookPixel = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; push?: FacebookPixel }

declare global {
  interface Window {
    dataLayer?: DataLayer
    gtag?: Gtag
    fbq?: FacebookPixel
  }
}

const GA4_ID = import.meta.env.VITE_GA4_ID?.trim()
const GTM_ID = import.meta.env.VITE_GTM_ID?.trim()
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim()

function loadScript(id: string, src: string) {
  if (document.querySelector(`script[data-analytics="${id}"]`)) return
  const script = document.createElement('script')
  script.async = true
  script.src = src
  script.dataset.analytics = id
  document.head.appendChild(script)
}

export function initializeAnalytics() {
  if (typeof window === 'undefined') return

  if (GTM_ID) {
    window.dataLayer = window.dataLayer || []
    if (!window.dataLayer.some((entry) => !Array.isArray(entry) && entry.event === 'gtm.js')) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    }
    loadScript('gtm', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`)
  }

  if (GA4_ID) {
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || ((...args: unknown[]) => { window.dataLayer?.push([...args]) })
    loadScript('ga4', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`)
    window.gtag('js', new Date())
    window.gtag('config', GA4_ID, { anonymize_ip: true })
  }

  if (META_PIXEL_ID && !window.fbq) {
    const pixel = ((...args: unknown[]) => {
      if (pixel.callMethod) pixel.callMethod(...args)
      else (pixel.queue = pixel.queue || []).push(args)
    }) as FacebookPixel
    pixel.push = pixel
    pixel.queue = []
    window.fbq = pixel
    loadScript('meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js')
    pixel('init', META_PIXEL_ID)
    pixel('track', 'PageView')
  }
}

export function trackConversion(eventName: string, params: ConversionParams = {}) {
  if (typeof window === 'undefined') return
  const safeParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined))
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: eventName, ...safeParams })
  if (GA4_ID && !GTM_ID) window.gtag?.('event', eventName, safeParams)
  window.fbq?.('trackCustom', eventName, safeParams)
}
