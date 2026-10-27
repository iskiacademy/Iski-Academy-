export function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...extraHeaders,
    },
  })
}

export function errorResponse(error) {
  const status = Number(error?.status) || 500
  const code = error?.code || 'internal_error'
  const message = status < 500 ? (error?.message || 'The request could not be completed.') : 'The service could not complete this request. Please try again.'
  const body = { error: { code, message } }
  if (error?.details && status < 500) body.error.details = error.details
  return jsonResponse(status, body)
}
