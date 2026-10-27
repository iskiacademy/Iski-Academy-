import { handleApiRequest } from './app.mjs'
import { toWebRequest, writeBridgeError, writeWebResponse } from './http-utils.mjs'

function installApi(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!String(req.url || '').startsWith('/api/')) return next()
    try {
      const request = await toWebRequest(req)
      const response = await handleApiRequest(request)
      await writeWebResponse(res, response, req.method || 'GET')
    } catch (error) {
      writeBridgeError(res, error)
    }
  })
}

export default function iskiApiPlugin() {
  return {
    name: 'iski-same-origin-api',
    configureServer: installApi,
    configurePreviewServer: installApi,
  }
}
