import { jsonResponse } from './api-error.mjs'

const MAX_BODY_BYTES = 24_000

export async function toWebRequest(nodeRequest) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(nodeRequest.headers || {})) {
    if (Array.isArray(value)) headers.set(name, value.join(', '))
    else if (value !== undefined) headers.set(name, String(value))
  }
  const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0].trim()
  const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0].trim()
  const host = forwardedHost || headers.get('host') || '127.0.0.1:3000'
  const proto = forwardedProto || 'http'
  const url = new URL(nodeRequest.url || '/', `${proto}://${host}`)
  const method = String(nodeRequest.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return new Request(url, { method, headers })

  const chunks = []
  let size = 0
  for await (const chunk of nodeRequest) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413, code: 'request_too_large' })
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)
  return new Request(url, { method, headers, body: body.length ? body : undefined })
}

export async function writeWebResponse(nodeResponse, response, method = 'GET') {
  nodeResponse.statusCode = response.status
  for (const [name, value] of response.headers.entries()) nodeResponse.setHeader(name, value)
  if (method === 'HEAD') return nodeResponse.end()
  return nodeResponse.end(Buffer.from(await response.arrayBuffer()))
}

export function writeBridgeError(nodeResponse, error) {
  const status = Number(error?.status) || 500
  const code = status < 500 ? (error?.code || 'request_rejected') : 'service_unavailable'
  const message = status < 500 ? 'The request could not be processed.' : 'The service is temporarily unavailable.'
  const response = jsonResponse(status, { error: { code, message } })
  for (const [name, value] of response.headers.entries()) nodeResponse.setHeader(name, value)
  nodeResponse.statusCode = status
  nodeResponse.end(JSON.stringify({ error: { code, message } }))
}
