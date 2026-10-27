import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, CalendarDays, Check, CircleUserRound, KeyRound, LogOut, Mountain, ShieldCheck, Newspaper } from 'lucide-react'
import { adminRequest, ApiError, type AdminUser } from './api'
import AdminBookingsPage from './BookingsPage'
import AdminDashboardPage from './DashboardPage'
import AdminAvailabilityPage from './AvailabilityPage'
import AdminInstructorsPage from './InstructorsPage'
import AdminSettingsPage from './SettingsPage'
import ContentPage from './ContentPage'
import PasswordChangeDialog from './PasswordChangeDialog'
import './admin.css'

type SessionPayload = { authenticated: boolean; user: AdminUser | null; ownerExists: boolean; setupConfigured: boolean; recoveryConfigured: boolean }
type SessionState = SessionPayload & { ready: boolean }
type CsrfPayload = { token: string; authenticated: boolean }

function StaffBrand() {
  return <div className="admin-brand"><img src="/assets/ski-academy-logo.png" alt="iSKI Academy" /><span>WEBSITE DESK</span></div>
}

function LoginPanel({ session, csrf, onCsrf, onSession }: { session: SessionState; csrf: string; onCsrf: (token: string) => void; onSession: (user: AdminUser) => void }) {
  const [mode, setMode] = useState<'login' | 'setup' | 'recovery' | 'requestReset' | 'resetPassword'>('login')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const showSetup = !session.ownerExists || mode === 'setup'

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('reset') || ''
    if (token) { setResetToken(token); setMode('resetPassword') }
  }, [])

  async function refreshCsrf() {
    const result = await adminRequest<CsrfPayload>('/api/admin/csrf')
    onCsrf(result.token)
    return result.token
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const token = csrf || await refreshCsrf()
      let result: { user?: AdminUser; csrfToken?: string; message?: string }
      if (showSetup) {
        result = await adminRequest('/api/admin/setup', { method: 'POST', csrf: token, body: { setupToken, displayName, email, password } })
        if (result.user) onSession(result.user)
      } else if (mode === 'recovery') {
        result = await adminRequest('/api/admin/recover-owner', { method: 'POST', csrf: token, body: { recoveryToken: recoveryKey, email, newPassword } })
        setNotice(result.message || 'Password updated. Sign in with the new password.')
        setMode('login')
        onCsrf('')
      } else if (mode === 'requestReset') {
        result = await adminRequest('/api/admin/request-password-reset', { method: 'POST', csrf: token, body: { email } })
        setNotice(result.message || 'If the account is eligible, password-reset instructions will be sent.')
        onCsrf('')
      } else if (mode === 'resetPassword') {
        result = await adminRequest('/api/admin/reset-password', { method: 'POST', csrf: token, body: { token: resetToken, newPassword } })
        setNotice(result.message || 'Password updated. Sign in with your new password.')
        setMode('login')
        setNewPassword('')
        onCsrf('')
        window.history.replaceState({}, '', '/admin')
      } else {
        result = await adminRequest('/api/admin/login', { method: 'POST', csrf: token, body: { email, password } })
        if (result.user) onSession(result.user)
      }
      if (result.csrfToken) onCsrf(result.csrfToken)
    } catch (reason) {
      onCsrf('')
      if (reason instanceof ApiError && reason.code === 'csrf_invalid') {
        setError('This page has been open for a while. Refresh the page and try again.')
      } else setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const title = showSetup ? 'Set up the owner account' : mode === 'recovery' ? 'Recover owner access' : mode === 'requestReset' ? 'Reset your password' : mode === 'resetPassword' ? 'Choose a new password' : 'Sign in to iSki'
  return <main className="admin-login-wrap">
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <StaffBrand />
      <div className="admin-login-card__icon"><ShieldCheck size={22} /></div>
      <h1 id="admin-login-title">{title}</h1>
      <p className="admin-login-card__intro">{mode === 'requestReset' ? 'Enter your staff email. If an active account exists, reset instructions will be sent.' : 'Private website editing for the iSki Academy team.'}</p>

      {showSetup && !session.setupConfigured && <div className="admin-alert admin-alert--info"><KeyRound size={18} /><span>First-owner setup is securely locked until the project owner adds <code>ISKI_ADMIN_SETUP_TOKEN</code> in Webdev's protected secret settings.</span></div>}
      {showSetup && session.setupConfigured && <p className="admin-login-card__hint">Use the one-time setup key stored by the project owner. Save the separate owner-recovery key securely before closing this page.</p>}
      {mode === 'recovery' && !session.recoveryConfigured && <div className="admin-alert admin-alert--info"><KeyRound size={18} /><span>Owner recovery is not configured. Add a separate <code>ISKI_ADMIN_RECOVERY_TOKEN</code> in Webdev's protected secret settings.</span></div>}
      {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert--success" role="status"><Check size={17} />{notice}</div>}

      <form onSubmit={submit} className="admin-auth-form">
        {showSetup && <>
          <label>One-time setup key<input required autoComplete="off" type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} /></label>
          <label>Your name<input required autoComplete="name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        </>}
        {mode === 'recovery' && <label>Owner recovery key<input required autoComplete="off" type="password" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} /></label>}
        {mode !== 'resetPassword' && <label>Email address<input required type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {(mode === 'login' || showSetup) && <label>Password<input required type="password" autoComplete={showSetup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>}
        {(mode === 'recovery' || mode === 'resetPassword') && <label>New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>}
        <button type="submit" className="admin-primary-button" disabled={busy || (showSetup && !session.setupConfigured) || (mode === 'recovery' && !session.recoveryConfigured) || (mode === 'resetPassword' && !resetToken)}>{busy ? 'Please wait…' : showSetup ? 'Create owner account' : mode === 'recovery' ? 'Recover account' : mode === 'requestReset' ? 'Send reset link' : mode === 'resetPassword' ? 'Update password' : 'Sign in'} <ArrowLeft className="admin-button-arrow" size={16} /></button>
      </form>

      {!showSetup && <div className="admin-login-links">
        {mode === 'login' && <><button type="button" onClick={() => { setMode('requestReset'); setError(''); setNotice('') }}>Forgot password?</button><button type="button" onClick={() => { setMode('recovery'); setError(''); setNotice('') }}>Owner recovery key</button></>}
        {mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setError(''); setNotice('') }}><ArrowLeft size={14} /> Back to sign in</button>}
      </div>}
      {showSetup && session.ownerExists && <div className="admin-login-links"><button type="button" onClick={() => setMode('login')}><ArrowLeft size={14} /> Back to sign in</button></div>}
      <p className="admin-login-card__footer"><Mountain size={14} /> Kopaonik · Serbia · Europe/Belgrade</p>
    </section>
  </main>
}

function AdminSidebar({ user, path, onNavigate, onLogout, onPasswordChange, mobileOpen, setMobileOpen }: { user: AdminUser; path: string; onNavigate: (href: string) => void; onLogout: () => void; onPasswordChange: () => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const links = useMemo(() => [
    { href: '/admin', label: 'Overview', icon: Mountain, managerOnly: false },
        { href: '/admin/settings', label: 'Business settings', icon: KeyRound, managerOnly: true },
    { href: '/admin/content', label: 'Posts & gallery', icon: Newspaper, managerOnly: true },
  ].filter((item) => !item.managerOnly || ['owner', 'admin'].includes(user.role)), [user.role])

  return <>
    {mobileOpen && <button className="admin-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <StaffBrand />
      <div className="admin-sidebar__label">WEBSITE</div>
      <nav aria-label="Staff navigation">
        {links.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={path === href || (href !== '/admin' && path.startsWith(`${href}/`)) ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onNavigate(href); setMobileOpen(false) }}><Icon size={18} />{label}</a>)}
      </nav>
      <div className="admin-sidebar__bottom">
        <div className="admin-sidebar__user"><span className="admin-user-avatar">{user.displayName.trim().slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><span>{user.role} · {user.email}</span></div></div>
        <button className="admin-logout admin-change-password" onClick={onPasswordChange}><KeyRound size={17} /> Change password</button>
        <button className="admin-logout" onClick={onLogout}><LogOut size={17} /> Sign out</button>
        <a className="admin-back-public" href="/" target="_blank" rel="noreferrer">Open public website <ArrowLeft size={14} /></a>
      </div>
    </aside>
  </>
}

function AdminShell({ user, csrf, onLogout, onCsrf }: { user: AdminUser; csrf: string; onLogout: () => void; onCsrf: (token: string) => void }) {
  const [path, setPath] = useState(() => window.location.pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordRequired, setPasswordRequired] = useState(user.mustChangePassword)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  function navigate(href: string) {
    window.history.pushState({}, '', href)
    setPath(href)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const title = path.startsWith('/admin/content') ? 'Posts & gallery' : path.startsWith('/admin/bookings') ? 'Bookings' : path.startsWith('/admin/availability') ? 'Availability calendar' : path.startsWith('/admin/instructors') ? 'Instructors & availability' : path.startsWith('/admin/settings') ? 'Business settings' : 'Overview'
  let content: ReactNode
  if (passwordRequired) content = <section className="admin-panel"><h2>Set a new password to continue</h2><p>Your staff account was created with a temporary password. Update it before opening booking records or changing schedules.</p></section>
  else if (path.startsWith('/admin/bookings')) content = <AdminBookingsPage user={user} csrf={csrf} />
  else if (path.startsWith('/admin/availability')) content = <AdminAvailabilityPage user={user} csrf={csrf} onNavigate={navigate} />
  else if (path.startsWith('/admin/instructors')) content = <AdminInstructorsPage user={user} csrf={csrf} />
  else if (path.startsWith('/admin/settings')) content = <AdminSettingsPage csrf={csrf} />
  else if (path.startsWith('/admin/content')) content = <ContentPage csrf={csrf} user={user} />
  else content = <AdminDashboardPage user={user} csrf={csrf} onNavigate={navigate} />
  return <div className="admin-app-shell">
    <AdminSidebar user={user} path={path} onNavigate={navigate} onLogout={onLogout} onPasswordChange={() => setPasswordDialogOpen(true)} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    <main className="admin-main">
      <header className="admin-topbar"><button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open staff navigation"><span /><span /><span /></button><div><p>iSKI ACADEMY · STAFF DESK</p><h1>{title}</h1></div><span className="admin-timezone-chip">Europe/Belgrade · 09:00–17:00</span></header>
      <div className="admin-content">{content}</div>
    </main>
    {(passwordDialogOpen || passwordRequired) && <PasswordChangeDialog csrf={csrf} required={passwordRequired} onCsrf={onCsrf} onPasswordChanged={() => { setPasswordRequired(false); setPasswordDialogOpen(false) }} onClose={() => { if (!passwordRequired) setPasswordDialogOpen(false) }} />}
  </div>
}

export default function AdminApp() {
  const [session, setSession] = useState<SessionState>({ ready: false, authenticated: false, user: null, ownerExists: false, setupConfigured: false, recoveryConfigured: false })
  const [csrf, setCsrf] = useState('')
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      adminRequest<SessionPayload>('/api/admin/session'),
      adminRequest<CsrfPayload>('/api/admin/csrf'),
    ]).then(([payload, token]) => {
      if (!active) return
      setSession({ ...payload, ready: true })
      setCsrf(token.token)
    }).catch((reason) => {
      if (active) {
        setSessionError(reason instanceof Error ? reason.message : 'The staff service could not be reached.')
        setSession((current) => ({ ...current, ready: true }))
      }
    })
    const expire = () => { setSession((current) => ({ ...current, authenticated: false, user: null })); setCsrf('') }
    window.addEventListener('iski-admin-expired', expire)
    return () => { active = false; window.removeEventListener('iski-admin-expired', expire) }
  }, [])

  if (!session.ready) return <main className="admin-loading"><div className="admin-loading__mark"><Mountain size={28} /></div><p>Loading secure staff desk…</p></main>
  if (sessionError) return <main className="admin-login-wrap"><section className="admin-login-card"><StaffBrand /><div className="admin-alert admin-alert--error" role="alert">{sessionError}</div><button className="admin-primary-button" onClick={() => window.location.reload()}>Try again</button></section></main>
  if (!session.authenticated || !session.user) return <LoginPanel session={session} csrf={csrf} onCsrf={setCsrf} onSession={(user) => setSession((current) => ({ ...current, authenticated: true, user, ownerExists: true }))} />

  async function logout() {
    try { await adminRequest('/api/admin/logout', { method: 'POST', csrf }) } catch { /* The server session may already have expired. */ }
    setSession((current) => ({ ...current, authenticated: false, user: null }))
    setCsrf('')
  }

  return <AdminShell user={session.user} csrf={csrf} onCsrf={setCsrf} onLogout={logout} />
}
