import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { inTransaction, withConnection } from './db.mjs'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'iski_admin_session'
const SESSION_HOURS = 12

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function newOpaqueToken() {
  return randomBytes(32).toString('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const N = 32768
  const derived = await scrypt(password, salt, 64, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$8$1$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(password, encoded) {
  const [algorithm, nText, rText, pText, saltHex, expectedHex] = String(encoded || '').split('$')
  if (algorithm !== 'scrypt' || !/^\d+$/.test(nText || '') || !saltHex || !expectedHex) return false
  try {
    const expected = Buffer.from(expectedHex, 'hex')
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(nText), r: Number(rText), p: Number(pText), maxmem: 64 * 1024 * 1024,
    }))
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function cookieValue(request, name = SESSION_COOKIE) {
  const cookies = (request.headers.get('cookie') || '').split(';')
  for (const item of cookies) {
    const [key, ...value] = item.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return ''
}

function localHttpAuthFor(request) {
  let hostname = ''
  try { hostname = new URL(request.url).hostname } catch { /* Keep Secure by default. */ }
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  return loopback && process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH === 'true'
}

export function sessionCookie(request, token, maxAge = SESSION_HOURS * 60 * 60) {
  const flags = localHttpAuthFor(request) ? 'SameSite=Lax' : 'SameSite=None; Secure'
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${flags}; Max-Age=${maxAge}`
}

export function clearSessionCookie(request) {
  const flags = localHttpAuthFor(request) ? 'SameSite=Lax' : 'SameSite=None; Secure'
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; ${flags}; Max-Age=0`
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  if (!origin) return false
  let originUrl
  try { originUrl = new URL(origin) } catch { return false }
  if (!['https:', 'http:'].includes(originUrl.protocol)) return false
  if (referer) {
    try { if (new URL(referer).origin !== originUrl.origin) return false } catch { return false }
  }
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') return false
  return true
}

async function createSessionCsrfToken(tokenHash) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_HOURS * 60 * 60
  const nonce = newOpaqueToken()
  const payload = `${expires}.${nonce}`
  const { createHmac } = await import('node:crypto')
  const signature = createHmac('sha256', tokenHash).update(payload).digest('base64url')
  return `s.${payload}.${signature}`
}

async function verifySessionCsrfToken(token, tokenHash) {
  const [prefix, expiresText, nonce, signature] = String(token || '').split('.')
  const expires = Number(expiresText)
  const now = Math.floor(Date.now() / 1000)
  if (prefix !== 's' || !Number.isSafeInteger(expires) || expires < now || expires > now + SESSION_HOURS * 60 * 60 + 60 || !nonce || !signature) return false
  const payload = `${expires}.${nonce}`
  const { createHmac } = await import('node:crypto')
  const expected = Buffer.from(createHmac('sha256', tokenHash).update(payload).digest('base64url'))
  const actual = Buffer.from(signature)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function issueCsrfToken(request) {
  const session = await readSession(request)
  if (session) return { token: await createSessionCsrfToken(session.tokenHash), authenticated: true }
  const token = newOpaqueToken()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  await withConnection((connection) => connection.execute(
    'INSERT INTO preauth_tokens (token_hash, kind, expires_at) VALUES (?, \'csrf\', ?)', [sha256(token), expiresAt],
  ))
  return { token, authenticated: false }
}

export async function requireCsrf(request, { session = null, consumePreauth = false } = {}) {
  if (!assertSameOrigin(request)) return false
  const token = request.headers.get('x-csrf-token') || ''
  if (token.length < 32) return false
  const tokenHash = sha256(token)
  if (session) return verifySessionCsrfToken(token, session.tokenHash)
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT token_hash FROM preauth_tokens WHERE token_hash = ? AND kind = 'csrf' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE",
      [tokenHash],
    )
    if (!rows.length) return false
    if (consumePreauth) {
      const [result] = await connection.execute('UPDATE preauth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND used_at IS NULL', [tokenHash])
      if (!result.affectedRows) return false
    }
    return true
  })
}

export async function createSession(request, userId) {
  const token = newOpaqueToken()
  const tokenHash = sha256(token)
  const csrfToken = await createSessionCsrfToken(tokenHash)
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  await withConnection((connection) => connection.execute(
    'INSERT INTO admin_sessions (token_hash, csrf_hash, user_id, expires_at) VALUES (?, ?, ?, ?)',
    [tokenHash, sha256(csrfToken), userId, expiresAt],
  ))
  return { cookie: sessionCookie(request, token), csrfToken }
}

export async function readSession(request) {
  const token = cookieValue(request)
  if (!token) return null
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT s.token_hash, s.csrf_hash, s.user_id, s.expires_at,
              u.email, u.display_name, u.role, u.instructor_id, u.active, u.must_change_password
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.active = 1 LIMIT 1`,
      [sha256(token)],
    )
    if (!rows.length) return null
    await connection.execute('UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP(3) WHERE token_hash = ?', [sha256(token)])
    const row = rows[0]
    return {
      tokenHash: row.token_hash,
      csrfHash: row.csrf_hash,
      user: { id: Number(row.user_id), email: row.email, displayName: row.display_name, role: row.role, instructorId: row.instructor_id == null ? null : Number(row.instructor_id), mustChangePassword: Boolean(row.must_change_password) },
    }
  })
}

export async function destroySession(request) {
  const token = cookieValue(request)
  if (!token) return
  await withConnection((connection) => connection.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [sha256(token)]))
}

export async function consumeRateLimit(connection, key, { max = 5, windowMinutes = 15 } = {}) {
  const hash = sha256(key)
  const [rows] = await connection.execute('SELECT attempts, locked_until > UTC_TIMESTAMP(3) AS locked, window_started_at < UTC_TIMESTAMP(3) - INTERVAL ? MINUTE AS expired FROM login_attempts WHERE key_hash = ? FOR UPDATE', [windowMinutes, hash])
  if (rows.length && Boolean(rows[0].locked)) return false
  if (!rows.length) {
    await connection.execute('INSERT INTO login_attempts (key_hash, attempts, window_started_at) VALUES (?, 0, UTC_TIMESTAMP(3))', [hash])
    return true
  }
  if (Boolean(rows[0].expired)) {
    await connection.execute('UPDATE login_attempts SET attempts = 0, window_started_at = UTC_TIMESTAMP(3), locked_until = NULL WHERE key_hash = ?', [hash])
  }
  return true
}

export async function recordLoginFailure(connection, key, { max = 5, windowMinutes = 15 } = {}) {
  const hash = sha256(key)
  await connection.execute(
    `INSERT INTO login_attempts (key_hash, attempts, window_started_at, locked_until)
     VALUES (?, 1, UTC_TIMESTAMP(3), NULL)
     ON DUPLICATE KEY UPDATE
       attempts = IF(window_started_at < UTC_TIMESTAMP(3) - INTERVAL ? MINUTE, 1, attempts + 1),
       window_started_at = IF(window_started_at < UTC_TIMESTAMP(3) - INTERVAL ? MINUTE, UTC_TIMESTAMP(3), window_started_at),
       locked_until = IF(attempts >= ?, UTC_TIMESTAMP(3) + INTERVAL ? MINUTE, locked_until)`,
    [hash, windowMinutes, windowMinutes, max - 1, windowMinutes],
  )
}

export async function clearLoginFailures(connection, key) {
  await connection.execute('DELETE FROM login_attempts WHERE key_hash = ?', [sha256(key)])
}
