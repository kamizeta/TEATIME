export const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  STAFF: 'Equipo operativo',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
}

export const classStatusLabels: Record<string, string> = {
  SCHEDULED: 'Programada',
  RESERVED: 'Reservada',
  COMPLETED: 'Finalizada',
  CANCELED: 'Cancelada',
}

export const enrollmentStatusLabels: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
}

export const attendanceStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  attended: 'Asistió',
  late: 'Llegó tarde',
  absent: 'Ausente',
  no_show: 'No asistió',
}

export const packageStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  EXPIRED: 'Vencido',
  CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado',
}

export const contactStatusLabels: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  TRIAL_SCHEDULED: 'Clase de prueba agendada',
  ACTIVE_STUDENT: 'Alumno activo',
  LOST: 'Perdido',
}
