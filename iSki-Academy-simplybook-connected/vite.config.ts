import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import iskiApiPlugin from './server/vite-plugin.mjs'

export default defineConfig({
  plugins: [react(), iskiApiPlugin()],
})
