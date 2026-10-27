import { jsonResponse, errorResponse } from './api-error.mjs'
import { handleAuthRequest } from './auth.mjs'
import { ensureDatabaseReady } from './db.mjs'
import { handleAdminRequest } from './routes/admin.mjs'
import { handlePublicRequest } from './routes/public.mjs'
import { HttpError } from './validation.mjs'

let readyPromise
async function ensureReadyOnce() {
  if (!readyPromise) readyPromise = ensureDatabaseReady().catch((error) => {
    readyPromise = undefined
    throw error
  })
  return readyPromise
}

async function handleApiRequestInternal(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  if (pathname === '/api/health' && (request.method === 'GET' || request.method === 'HEAD')) {
    try {
      await ensureReadyOnce()
      return jsonResponse(200, { ok: true, service: 'iski-booking-api' })
    } catch (error) {
      const code = error?.code || error?.name || 'database_unavailable'
      console.error(`Health check failed: ${code}`)
      return jsonResponse(503, { ok: false, service: 'iski-booking-api', error: 'database_unavailable' })
    }
  }
  if (!pathname.startsWith('/api/')) return null
  try {
    await ensureReadyOnce()
  } catch (error) {
    const code = error?.code || error?.name || 'database_unavailable'
    console.error(`Database initialization failed: ${code}`)
    return errorResponse(new HttpError(503, 'database_unavailable', 'The booking service is starting. Please try again shortly.'))
  }
  const authResponse = await handleAuthRequest(request, pathname)
  if (authResponse) return authResponse
  const publicResponse = await handlePublicRequest(request, pathname)
  if (publicResponse) return publicResponse
  const adminResponse = await handleAdminRequest(request, pathname)
  if (adminResponse) return adminResponse
  return errorResponse(new HttpError(404, 'api_route_not_found', 'API route not found.'))
}

export async function handleApiRequest(request) {
  try {
    return await handleApiRequestInternal(request)
  } catch (error) {
    const code = error?.code || error?.name || 'unknown_error'
    console.error(`API router failed: ${code}`)
    return errorResponse(new HttpError(500, 'service_unavailable', 'The service could not complete this request.'))
  }
}
