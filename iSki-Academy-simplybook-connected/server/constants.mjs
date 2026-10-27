export const BOOKING_STATUSES = ['New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled']
export const ACTIVE_BOOKING_STATUSES = ['New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed']
export const ROLES = ['owner', 'admin', 'instructor']

export function canManageTeam(role) {
  return role === 'owner' || role === 'admin'
}

export function canManageSettings(role) {
  return role === 'owner' || role === 'admin'
}

export function canSeeAllBookings(role) {
  return role === 'owner' || role === 'admin'
}
