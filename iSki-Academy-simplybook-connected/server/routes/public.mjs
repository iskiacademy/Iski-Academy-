import { jsonResponse, errorResponse } from '../api-error.mjs'
import { getPublicAvailability, getPublicBootstrap } from '../availability.mjs'
import { createPublicBooking } from '../booking-service.mjs'
import { HttpError, readJson, validateBookingInput } from '../validation.mjs'
import { listPublicContent } from '../site-content-service.mjs'

export async function handlePublicRequest(request, pathname) {
  try {
    const method = request.method.toUpperCase()
    if (pathname === '/api/public/content' && method === 'GET') return jsonResponse(200, { items: await listPublicContent() })
    if (pathname === '/api/public/bootstrap' && method === 'GET') return jsonResponse(200, await getPublicBootstrap())
    if (pathname === '/api/public/availability' && method === 'GET') {
      const url = new URL(request.url)
      const result = await getPublicAvailability({
        from: url.searchParams.get('from') || '',
        to: url.searchParams.get('to') || '',
        formatCode: url.searchParams.get('format') || '',
        preferredInstructorId: url.searchParams.get('preferredInstructorId') || null,
      })
      return jsonResponse(200, result)
    }
    if (pathname === '/api/public/bookings' && method === 'POST') {
      const body = validateBookingInput(await readJson(request))
      return jsonResponse(201, { ok: true, booking: await createPublicBooking(request, body) })
    }
    return null
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error)
    const code = error?.code || error?.name || 'unknown_error'
    console.error(`Public booking API failed: ${code}`)
    return errorResponse(new HttpError(500, 'booking_service_unavailable', 'The booking service is temporarily unavailable. Please try again or contact iSki on WhatsApp.'))
  }
}
