/// <reference types="vite/client" />

declare module '*.css'

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string
  readonly VITE_GTM_ID?: string
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_EXTERNAL_BOOKING_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
