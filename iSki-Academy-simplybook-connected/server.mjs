import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApiRequest } from './server/app.mjs'
import { toWebRequest, writeBridgeError, writeWebResponse } from './server/http-utils.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT || 3000)
const adminShell = path.join(root, 'admin', 'index.html')

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...headers,
  })
  res.end(body)
}

async function serveAdmin(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
  if (!fs.existsSync(adminShell)) return send(res, 503, 'Admin interface is not ready.')
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'same-origin',
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(adminShell).pipe(res)
}

const server = http.createServer(async (req, res) => {
  let pathname
  try { pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname } catch {
    return send(res, 400, 'Bad Request')
  }
  if (pathname.startsWith('/api/')) {
    try {
      const request = await toWebRequest(req)
      const response = await handleApiRequest(request)
      return await writeWebResponse(res, response, req.method || 'GET')
    } catch (error) {
      return writeBridgeError(res, error)
    }
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return serveAdmin(req, res)
  return send(res, 404, 'Not Found')
})

server.listen(port, '0.0.0.0', () => console.log(`iSki API server listening on ${port}`))
