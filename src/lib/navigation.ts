export type AppRole = 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT'

type NavItem = {
  href: string
  label: string
  description: string
}

export function getDefaultRouteForRole(role: AppRole) {
  if (role === 'ADMIN' || role === 'STAFF') return '/admin/dashboard'
  if (role === 'TEACHER') return '/teacher/today'
  return '/student/home'
}

export function getNavigationForRole(role: AppRole): NavItem[] {
  if (role === 'ADMIN' || role === 'STAFF') {
    return [
      { href: '/admin/dashboard', label: 'Dashboard', description: 'Operación diaria y seguimiento' },
      { href: '/admin/calendar', label: 'Calendario', description: 'Clases, slots y agenda' },
      { href: '/admin/packages', label: 'Paquetes', description: 'Saldo y movimientos' },
      { href: '/admin/reports', label: 'Reportes', description: 'Cierre semanal y exportes' },
      { href: '/admin/settings', label: 'Ajustes', description: 'Reglas, políticas y configuración' },
    ]
  }

  if (role === 'TEACHER') {
    return [
      { href: '/teacher/today', label: 'Hoy', description: 'Tus clases y cierres del día' },
      { href: '/teacher/availability', label: 'Disponibilidad', description: 'Bloques para futuras reservas' },
    ]
  }

  return [
    { href: '/student/home', label: 'Inicio', description: 'Próximas clases y saldo' },
    { href: '/student/book', label: 'Reservar', description: 'Nuevos espacios con tu profesor' },
  ]
}
