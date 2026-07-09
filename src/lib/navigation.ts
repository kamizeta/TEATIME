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
      { href: '/admin/students', label: 'Alumnos', description: 'Asignación de profesor y paquetes' },
      { href: '/admin/crm', label: 'CRM', description: 'Prospectos, WhatsApp y seguimiento' },
      { href: '/admin/incidents', label: 'Incidencias', description: 'Problemas y resolución operativa' },
      { href: '/admin/weekly-closing', label: 'Cierre semanal', description: 'Reemplazo operativo del Excel' },
      { href: '/admin/packages', label: 'Paquetes', description: 'Saldo y movimientos' },
      { href: '/admin/notifications', label: 'Notificaciones', description: 'Mensajes pendientes y reintentos' },
      { href: '/admin/templates', label: 'Plantillas', description: 'Mensajes base por canal' },
      { href: '/admin/users', label: 'Usuarios', description: 'Roles, accesos y permisos' },
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
