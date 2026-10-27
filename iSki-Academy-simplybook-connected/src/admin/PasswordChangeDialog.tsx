import { useState, type FormEvent } from 'react'
import { AlertCircle, Check, KeyRound, X } from 'lucide-react'
import { adminRequest } from './api'

export default function PasswordChangeDialog({ csrf, required = false, onCsrf, onPasswordChanged, onClose }: { csrf: string; required?: boolean; onCsrf: (token: string) => void; onPasswordChanged: () => void; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const result = await adminRequest<{ csrfToken: string }>('/api/admin/change-password', {
        method: 'POST', csrf, body: { currentPassword, newPassword },
      })
      onCsrf(result.csrfToken)
      onPasswordChanged()
      setNotice('Password changed. This device remains signed in with the refreshed session.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (required) onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The password could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!required && event.target === event.currentTarget) onClose() }}>
    <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
      {!required && <button className="admin-dialog__close" type="button" aria-label="Close password dialog" onClick={onClose}><X size={19} /></button>}
      <div className="admin-login-card__icon"><KeyRound size={22} /></div>
      <p className="admin-eyebrow">ACCOUNT SECURITY</p>
      <h2 id="password-dialog-title">{required ? 'Set a new password' : 'Change your password'}</h2>
      <p className="admin-muted-note">{required ? 'A manager created this account with a temporary password. Set a private password of at least 12 characters to continue.' : 'Use at least 12 characters. Existing staff sessions for this account will be signed out.'}</p>
      {error && <div className="admin-alert admin-alert--error" role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && <div className="admin-alert admin-alert--success" role="status"><Check size={16} />{notice}</div>}
      <form className="admin-auth-form" onSubmit={submit}>
        <label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <div className="admin-dialog__actions">{!required && <button className="admin-secondary-button" type="button" onClick={onClose}>Close</button>}<button className="admin-primary-button" type="submit" disabled={busy || !csrf}>{busy ? 'Saving…' : required ? 'Set password & continue' : 'Update password'}</button></div>
      </form>
    </section>
  </div>
}
