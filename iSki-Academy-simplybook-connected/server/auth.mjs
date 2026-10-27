import { inTransaction, withConnection } from './db.mjs'
import { jsonResponse, errorResponse } from './api-error.mjs'
import { createSession, destroySession, hashPassword, newOpaqueToken, readSession, requireCsrf, sessionCookie, clearSessionCookie, verifyPassword, recordLoginFailure, clearLoginFailures, sha256 } from './security.mjs'
import { cleanText, HttpError, normalizeEmail, readJson, validatePassword } from './validation.mjs'
import { sendPasswordResetEmail } from './mail.mjs'

let dummyPasswordHash
async function getDummyPasswordHash() {
  if (!dummyPasswordHash) dummyPasswordHash = await hashPassword('not-a-real-iSki-password')
  return dummyPasswordHash
}

function constantTimeMatch(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  let difference = 0
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i]
  return difference === 0
}

async function firstOwnerExists(connection) {
  const [rows] = await connection.execute("SELECT id FROM admin_users WHERE role = 'owner' LIMIT 1")
  return rows.length > 0
}

function protectedActionKey(request, action) {
  const address = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  return `${action}:${String(address).trim().slice(0, 64)}`
}

async function beginProtectedAction(request, action) {
  const key = protectedActionKey(request, action)
  const { consumeRateLimit } = await import('./security.mjs')
  const allowed = await inTransaction((connection) => consumeRateLimit(connection, key, { max: 5, windowMinutes: 15 }))
  if (!allowed) throw new HttpError(429, 'setup_rate_limited', 'Too many protected account attempts. Please wait 15 minutes before trying again.')
  return key
}

async function failProtectedAction(key) {
  await inTransaction((connection) => recordLoginFailure(connection, key, { max: 5, windowMinutes: 15 }))
}

async function userSummary(connection, id) {
  const [rows] = await connection.execute(
    'SELECT id, email, display_name, role, instructor_id, must_change_password FROM admin_users WHERE id = ? AND active = 1 LIMIT 1', [id],
  )
  if (!rows.length) return null
  const row = rows[0]
  return { id: Number(row.id), email: row.email, displayName: row.display_name, role: row.role, instructorId: row.instructor_id == null ? null : Number(row.instructor_id), mustChangePassword: Boolean(row.must_change_password) }
}

async function getAdminUserCount() {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM admin_users')
    return Number(rows[0]?.total || 0)
  })
}

async function createOwner(request, body) {
  const setupToken = process.env.ISKI_ADMIN_SETUP_TOKEN || ''
  if (setupToken.length < 32) throw new HttpError(503, 'setup_disabled', 'Owner setup requires a 32-character or longer protected key.')
  const rateKey = await beginProtectedAction(request, 'owner-setup')
  if (!constantTimeMatch(body.setupToken, setupToken)) {
    await failProtectedAction(rateKey)
    throw new HttpError(403, 'invalid_setup_token', 'The setup key is not valid.')
  }
  const displayName = cleanText(body.displayName, 120, 'name', { required: true })
  const email = normalizeEmail(body.email)
  const password = validatePassword(body.password)
  const passwordHash = await hashPassword(password)

  const userId = await inTransaction(async (connection) => {
    await connection.execute('SELECT id FROM app_settings WHERE id = 1 FOR UPDATE')
    if (await firstOwnerExists(connection)) throw new HttpError(409, 'owner_already_created', 'The first owner account has already been created.')
    const [result] = await connection.execute(
      "INSERT INTO admin_users (email, display_name, password_hash, role, active) VALUES (?, ?, ?, 'owner', 1)",
      [email, displayName, passwordHash],
    )
    await connection.execute('UPDATE app_settings SET setup_completed_at = UTC_TIMESTAMP(3), public_booking_enabled = 0 WHERE id = 1')
    return Number(result.insertId)
  })
  await withConnection((connection) => clearLoginFailures(connection, rateKey))
  const session = await createSession(request, userId)
  const user = await withConnection((connection) => userSummary(connection, userId))
  return jsonResponse(201, { ok: true, user, csrfToken: session.csrfToken }, { 'Set-Cookie': session.cookie })
}

async function login(request, body) {
  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || password.length > 256) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.')
  const key = `login:${email}`
  const allowed = await withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT locked_until > UTC_TIMESTAMP(3) AS locked FROM login_attempts WHERE key_hash = SHA2(?, 256) LIMIT 1', [key])
    return !rows.length || !Boolean(rows[0].locked)
  })
  if (!allowed) throw new HttpError(429, 'login_rate_limited', 'Too many attempts. Please wait before trying again.')

  const [users] = await withConnection((connection) => connection.execute(
    'SELECT id, email, display_name, password_hash, role, instructor_id, active, must_change_password FROM admin_users WHERE email = ? LIMIT 1', [email],
  ))
  const candidate = users[0]
  const validPassword = await verifyPassword(password, candidate?.password_hash || await getDummyPasswordHash())
  if (!candidate || !candidate.active || !validPassword) {
    await withConnection(async (connection) => {
      await recordLoginFailure(connection, key)
    })
    throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.')
  }
  await withConnection((connection) => clearLoginFailures(connection, key))
  const session = await createSession(request, Number(candidate.id))
  const user = { id: Number(candidate.id), email: candidate.email, displayName: candidate.display_name, role: candidate.role, instructorId: candidate.instructor_id == null ? null : Number(candidate.instructor_id), mustChangePassword: Boolean(candidate.must_change_password) }
  return jsonResponse(200, { ok: true, user, csrfToken: session.csrfToken }, { 'Set-Cookie': session.cookie })
}

async function changePassword(request, session, body) {
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = validatePassword(body.newPassword)
  const [rows] = await withConnection((connection) => connection.execute('SELECT password_hash FROM admin_users WHERE id = ? AND active = 1 LIMIT 1', [session.user.id]))
  if (!rows.length || !(await verifyPassword(currentPassword, rows[0].password_hash))) throw new HttpError(401, 'current_password_invalid', 'The current password is incorrect.')
  const passwordHash = await hashPassword(newPassword)
  await withConnection((connection) => connection.execute('UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, session.user.id]))
  await withConnection((connection) => connection.execute('DELETE FROM admin_sessions WHERE user_id = ?', [session.user.id]))
  const next = await createSession(request, session.user.id)
  return jsonResponse(200, { ok: true, user: { ...session.user, mustChangePassword: false }, csrfToken: next.csrfToken }, { 'Set-Cookie': next.cookie })
}

async function recoverOwner(request, body) {
  const recoveryToken = process.env.ISKI_ADMIN_RECOVERY_TOKEN || ''
  if (recoveryToken.length < 32) throw new HttpError(503, 'recovery_disabled', 'Owner recovery requires a separate 32-character or longer protected key.')
  const rateKey = await beginProtectedAction(request, 'owner-recovery')
  if (!constantTimeMatch(body.recoveryToken, recoveryToken)) {
    await failProtectedAction(rateKey)
    throw new HttpError(403, 'invalid_recovery_token', 'The owner recovery key is not valid.')
  }
  const email = normalizeEmail(body.email)
  const passwordHash = await hashPassword(validatePassword(body.newPassword))
  const userId = await inTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT id FROM admin_users WHERE email = ? AND role = 'owner' AND active = 1 FOR UPDATE", [email])
    if (!rows.length) throw new HttpError(401, 'recovery_failed', 'The owner recovery request could not be completed.')
    const id = Number(rows[0].id)
    await connection.execute('UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, id])
    await connection.execute('DELETE FROM admin_sessions WHERE user_id = ?', [id])
    return id
  })
  await withConnection((connection) => clearLoginFailures(connection, rateKey))
  return jsonResponse(200, { ok: true, message: 'Password updated. Sign in with the new password.' })
}

async function requestPasswordReset(request, body) {
  const email = normalizeEmail(body.email)
  const address = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const keyHash = sha256(`password-reset:${email}:${address.trim().slice(0, 64)}`)
  const allowed = await inTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO login_attempts (key_hash, attempts, window_started_at, locked_until)
       VALUES (?, 1, UTC_TIMESTAMP(3), NULL)
       ON DUPLICATE KEY UPDATE
         attempts = IF(window_started_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR, 1, attempts + 1),
         locked_until = IF(window_started_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR, NULL,
           IF(attempts >= 3, UTC_TIMESTAMP(3) + INTERVAL 1 HOUR, locked_until)),
         window_started_at = IF(window_started_at < UTC_TIMESTAMP(3) - INTERVAL 1 HOUR, UTC_TIMESTAMP(3), window_started_at)`,
      [keyHash],
    )
    const [rows] = await connection.execute('SELECT locked_until > UTC_TIMESTAMP(3) AS locked FROM login_attempts WHERE key_hash = ? LIMIT 1', [keyHash])
    return !Boolean(rows[0]?.locked)
  })

  const genericMessage = 'If an active account matches that address and email delivery is configured, password-reset instructions will be sent.'
  if (!allowed) return jsonResponse(202, { ok: true, message: genericMessage })
  const [users] = await withConnection((connection) => connection.execute(
    'SELECT id, display_name FROM admin_users WHERE email = ? AND active = 1 LIMIT 1', [email],
  ))
  const user = users[0]
  if (user) {
    const token = newOpaqueToken()
    await withConnection(async (connection) => {
      await connection.execute("UPDATE preauth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND kind = 'password_reset' AND used_at IS NULL", [user.id])
      await connection.execute(
        "INSERT INTO preauth_tokens (token_hash, kind, user_id, expires_at) VALUES (?, 'password_reset', ?, UTC_TIMESTAMP(3) + INTERVAL 30 MINUTE)",
        [sha256(token), user.id],
      )
    })
    const origin = request.headers.get('origin')
    try {
      const result = origin ? await sendPasswordResetEmail({ to: email, displayName: user.display_name, token, origin }) : { status: 'not_configured', errorCode: 'origin_missing' }
      if (result.status !== 'sent') console.error(`Password reset email deferred: ${result.errorCode || result.status}`)
    } catch (error) {
      console.error(`Password reset email deferred: ${error?.code || error?.name || 'provider_unavailable'}`)
    }
  }
  return jsonResponse(202, { ok: true, message: genericMessage })
}

async function resetPassword(body) {
  const token = typeof body.token === 'string' ? body.token : ''
  if (token.length < 32 || token.length > 128) throw new HttpError(400, 'invalid_reset_token', 'This password-reset link is invalid or expired.')
  const passwordHash = await hashPassword(validatePassword(body.newPassword))
  await inTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT token_hash, user_id FROM preauth_tokens WHERE token_hash = ? AND kind = 'password_reset' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE",
      [sha256(token)],
    )
    if (!rows.length) throw new HttpError(400, 'invalid_reset_token', 'This password-reset link is invalid or expired.')
    const userId = Number(rows[0].user_id)
    await connection.execute('UPDATE preauth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE token_hash = ?', [rows[0].token_hash])
    await connection.execute('UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND active = 1', [passwordHash, userId])
    await connection.execute('DELETE FROM admin_sessions WHERE user_id = ?', [userId])
  })
  return jsonResponse(200, { ok: true, message: 'Password updated. Sign in with your new password.' })
}

export async function handleAuthRequest(request, pathname) {
  try {
    const method = request.method.toUpperCase()
    if (pathname === '/api/admin/csrf' && method === 'GET') {
      const csrf = await import('./security.mjs').then(({ issueCsrfToken }) => issueCsrfToken(request))
      return jsonResponse(200, csrf)
    }
    if (pathname === '/api/admin/session' && method === 'GET') {
      const session = await readSession(request)
      const ownerExists = await withConnection((connection) => firstOwnerExists(connection))
      return jsonResponse(200, {
        authenticated: Boolean(session), user: session?.user || null, ownerExists,
        setupConfigured: (process.env.ISKI_ADMIN_SETUP_TOKEN || '').length >= 32,
        recoveryConfigured: (process.env.ISKI_ADMIN_RECOVERY_TOKEN || '').length >= 32,
      })
    }
    if (pathname === '/api/admin/setup' && method === 'POST') {
      if (!(await requireCsrf(request, { consumePreauth: true }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await createOwner(request, await readJson(request))
    }
    if (pathname === '/api/admin/login' && method === 'POST') {
      if (!(await requireCsrf(request, { consumePreauth: true }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await login(request, await readJson(request))
    }
    if (pathname === '/api/admin/logout' && method === 'POST') {
      const session = await readSession(request)
      if (!session || !(await requireCsrf(request, { session }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      await destroySession(request)
      return jsonResponse(200, { ok: true }, { 'Set-Cookie': clearSessionCookie(request) })
    }
    if (pathname === '/api/admin/change-password' && method === 'POST') {
      const session = await readSession(request)
      if (!session) throw new HttpError(401, 'login_required', 'Sign in to continue.')
      if (!(await requireCsrf(request, { session }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await changePassword(request, session, await readJson(request))
    }
    if (pathname === '/api/admin/recover-owner' && method === 'POST') {
      if (!(await requireCsrf(request, { consumePreauth: true }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await recoverOwner(request, await readJson(request))
    }
    if (pathname === '/api/admin/request-password-reset' && method === 'POST') {
      if (!(await requireCsrf(request, { consumePreauth: true }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await requestPasswordReset(request, await readJson(request))
    }
    if (pathname === '/api/admin/reset-password' && method === 'POST') {
      if (!(await requireCsrf(request, { consumePreauth: true }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
      return await resetPassword(await readJson(request))
    }
    return null
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error)
    const code = error?.code || error?.name || 'unknown_error'
    console.error(`Auth request failed: ${code}`)
    return errorResponse(new HttpError(500, 'auth_unavailable', 'The staff sign-in service is temporarily unavailable.'))
  }
}
