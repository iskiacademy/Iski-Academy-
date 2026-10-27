import { jsonResponse, errorResponse } from '../api-error.mjs'
import { readSession, requireCsrf } from '../security.mjs'
import { HttpError, readJson } from '../validation.mjs'
import {
  addBookingNote, createException, createStaffUser, deleteException, exportBookingsCsv,
  getAdminSettings, getEmailStatus, getBooking, getDashboardSummary, listBookings, listExceptions,
  listInstructors, listUsers, saveInstructor, saveWeeklyAvailability,
  updateAdminSettings, updateBooking, updateLessonFormat, updateStaffUser,
} from '../admin-service.mjs'
import { deliverBookingOutbox, retryEmailOutbox } from '../mail.mjs'
import { deleteContent, listAdminContent, saveContent } from '../site-content-service.mjs'

const MANAGERS = new Set(['owner', 'admin'])

function requireManager(user) {
  if (!MANAGERS.has(user.role)) throw new HttpError(403, 'manager_required', 'Only an owner or admin can manage this area.')
}

async function requireUser(request, mutate = false) {
  const session = await readSession(request)
  if (!session) throw new HttpError(401, 'login_required', 'Sign in to continue.')
  if (session.user.mustChangePassword) throw new HttpError(403, 'password_change_required', 'Change your temporary password before using the staff desk.')
  if (mutate && !(await requireCsrf(request, { session }))) throw new HttpError(403, 'csrf_invalid', 'Refresh the page and try again.')
  return session.user
}

function matchId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null
  const value = pathname.slice(prefix.length).split('/')[0]
  return /^\d+$/.test(value) ? Number(value) : null
}

function csvResponse(content) {
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="iski-bookings.csv"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}

export async function handleAdminRequest(request, pathname) {
  try {
    const method = request.method.toUpperCase()
    const url = new URL(request.url)
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const user = await requireUser(request, mutating)

    if (pathname === '/api/admin/content' && method === 'GET') { requireManager(user); return jsonResponse(200, { items: await listAdminContent() }) }
    if (pathname === '/api/admin/content' && method === 'POST') { requireManager(user); return jsonResponse(201, { item: await saveContent(await readJson(request), user) }) }
    const contentId = matchId(pathname, '/api/admin/content/')
    if (contentId && method === 'PUT') { requireManager(user); return jsonResponse(200, { item: await saveContent(await readJson(request), user, contentId) }) }
    if (contentId && method === 'DELETE') { requireManager(user); return jsonResponse(200, await deleteContent(contentId)) }
    if (pathname === '/api/admin/dashboard' && method === 'GET') return jsonResponse(200, await getDashboardSummary(user))
    if (pathname === '/api/admin/bookings' && method === 'GET') {
      return jsonResponse(200, { bookings: await listBookings(Object.fromEntries(url.searchParams), user) })
    }
    if (pathname === '/api/admin/export.csv' && method === 'GET') return csvResponse(await exportBookingsCsv(Object.fromEntries(url.searchParams), user))
    if (pathname === '/api/admin/instructors' && method === 'GET') {
      requireManager(user)
      return jsonResponse(200, { instructors: await listInstructors() })
    }
    if (pathname === '/api/admin/instructors' && method === 'POST') {
      requireManager(user)
      return jsonResponse(201, { instructor: await saveInstructor(await readJson(request)) })
    }
    if (pathname === '/api/admin/availability/exceptions' && method === 'GET') {
      const from = url.searchParams.get('from') || ''
      const to = url.searchParams.get('to') || ''
      return jsonResponse(200, { exceptions: await listExceptions(from, to, user) })
    }
    if (pathname === '/api/admin/availability/exceptions' && method === 'POST') {
      requireManager(user)
      return jsonResponse(201, { exception: await createException(await readJson(request), user) })
    }
    const exceptionId = matchId(pathname, '/api/admin/availability/exceptions/')
    if (exceptionId && method === 'DELETE') {
      requireManager(user)
      return jsonResponse(200, await deleteException(exceptionId))
    }
    if (pathname === '/api/admin/settings' && method === 'GET') {
      requireManager(user)
      return jsonResponse(200, await getAdminSettings())
    }
    if (pathname === '/api/admin/email-status' && method === 'GET') {
      requireManager(user)
      return jsonResponse(200, await getEmailStatus())
    }
    if (pathname === '/api/admin/settings' && method === 'PUT') {
      requireManager(user)
      return jsonResponse(200, await updateAdminSettings(await readJson(request)))
    }
    const instructorId = matchId(pathname, '/api/admin/instructors/')
    if (instructorId && pathname.endsWith('/weekly') && method === 'PUT') {
      requireManager(user)
      const body = await readJson(request)
      return jsonResponse(200, await saveWeeklyAvailability(instructorId, body.weeklyAvailability))
    }
    if (instructorId && method === 'PATCH') {
      requireManager(user)
      return jsonResponse(200, { instructor: await saveInstructor(await readJson(request), instructorId) })
    }
    const usersId = matchId(pathname, '/api/admin/users/')
    if (pathname === '/api/admin/users' && method === 'GET') {
      requireManager(user)
      return jsonResponse(200, { users: await listUsers(user) })
    }
    if (pathname === '/api/admin/users' && method === 'POST') {
      requireManager(user)
      return jsonResponse(201, { user: await createStaffUser(await readJson(request), user) })
    }
    if (usersId && method === 'PATCH') {
      requireManager(user)
      return jsonResponse(200, await updateStaffUser(usersId, await readJson(request), user))
    }
    const formatMatch = pathname.match(/^\/api\/admin\/formats\/([a-z0-9-]{1,64})$/i)
    if (formatMatch && method === 'PATCH') {
      requireManager(user)
      return jsonResponse(200, { format: await updateLessonFormat(formatMatch[1], await readJson(request)) })
    }
    const outboxMatch = pathname.match(/^\/api\/admin\/email-outbox\/(\d+)\/retry$/)
    if (outboxMatch && method === 'POST') {
      requireManager(user)
      const result = await retryEmailOutbox(Number(outboxMatch[1]))
      if (!result) throw new HttpError(404, 'email_not_found', 'Notification not found.')
      return jsonResponse(200, { results: result })
    }
    const bookingNotesMatch = pathname.match(/^\/api\/admin\/bookings\/([0-9a-f-]{36})\/notes$/i)
    if (bookingNotesMatch && method === 'POST') {
      return jsonResponse(201, await addBookingNote(bookingNotesMatch[1], (await readJson(request)).note, user))
    }
    const bookingMatch = pathname.match(/^\/api\/admin\/bookings\/([0-9a-f-]{36})$/i)
    if (bookingMatch && method === 'GET') return jsonResponse(200, { booking: await getBooking(bookingMatch[1], user) })
    if (bookingMatch && method === 'PATCH') {
      const result = await updateBooking(bookingMatch[1], await readJson(request), user)
      const emails = result.statusChanged ? await deliverBookingOutbox(result.bookingId).catch(() => []) : []
      return jsonResponse(200, { ...result, emails })
    }
    return null
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error)
    if (error?.code === 'ER_DUP_ENTRY') return errorResponse(new HttpError(409, 'already_exists', 'An account or instructor with those details already exists.'))
    const code = error?.code || error?.name || 'unknown_error'
    console.error(`Admin API failed: ${code}`)
    return errorResponse(new HttpError(500, 'admin_service_unavailable', 'The admin service could not complete this request.'))
  }
}
