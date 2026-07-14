import type { AppRole } from '@/lib/navigation'

export const LEARNING_CONTENT_VERSION = '2026.07'
export type LearningGuideKey = 'operacion' | 'profesor' | 'alumno'

type LearningLesson = {
  key: string
  title: string
  summary: string
  href: string
  steps: string[]
}

type LearningGuide = {
  key: LearningGuideKey
  title: string
  eyebrow: string
  audience: string
  description: string
  firstSteps: string[]
  lessons: LearningLesson[]
  faqs: Array<{ question: string; answer: string }>
}

export function getLearningGuideKeyForRole(role: AppRole): LearningGuideKey {
  if (role === 'ADMIN' || role === 'STAFF') return 'operacion'
  if (role === 'TEACHER') return 'profesor'
  return 'alumno'
}

export function getLearningGuidePath(guideKey: LearningGuideKey) {
  return `/ayuda/${guideKey}`
}

export const learningGuides: Record<LearningGuideKey, LearningGuide> = {
  operacion: {
    key: 'operacion',
    title: 'Guía de operación académica',
    eyebrow: 'ADMINISTRADOR Y EQUIPO OPERATIVO',
    audience: 'Administrador y Staff',
    description: 'Convierte la operación diaria en un flujo único: CRM, alumnos, paquetes, agenda, seguimiento y cierre.',
    firstSteps: [
      'Revisa el tablero al iniciar el día y resuelve primero las alertas operativas.',
      'Registra cada nuevo contacto en CRM; no uses WhatsApp como fuente única de información.',
      'Antes de reservar una clase, confirma profesor, paquete activo y disponibilidad.',
    ],
    lessons: [
      { key: 'tablero', title: '1. Empieza por el tablero', summary: 'Identifica clases pendientes, incidencias, seguimientos vencidos y saldos próximos a vencer.', href: '/admin/dashboard', steps: ['Abre Tablero.', 'Revisa las alertas y prioriza incidencias o cierres pendientes.', 'Usa los accesos rápidos para ir al calendario, reportes o paquetes.'] },
      { key: 'crm', title: '2. Lleva un prospecto hasta alumno', summary: 'El CRM es el punto de entrada: registra, contacta, agenda demo y convierte sin duplicar datos.', href: '/admin/crm', steps: ['Crea el prospecto con nombre, WhatsApp, correo e idioma.', 'Actualiza el estado y registra el siguiente seguimiento.', 'Cuando compra, conviértelo a alumno y asigna profesor, paquete y fecha de vencimiento.'] },
      { key: 'alumnos-paquetes', title: '3. Asigna profesor y horas', summary: 'Un alumno activo necesita un profesor principal y un paquete válido antes de reservar.', href: '/admin/students', steps: ['Verifica el profesor asignado.', 'Crea o revisa el paquete de horas.', 'Lee el indicador de clases: tomadas / programadas / totales.'] },
      { key: 'calendario', title: '4. Programa y revisa la agenda', summary: 'El calendario centraliza clases, estados, enlaces Meet y conflictos de horario.', href: '/admin/calendar', steps: ['Filtra por semana, profesor o estado.', 'Abre una clase para revisar alumnos, enlace Meet y trazabilidad.', 'Evita programar fuera de disponibilidad o sin saldo de paquete.'] },
      { key: 'asistencia', title: '5. Cierra asistencia y consumo', summary: 'La clase se consume cuando queda cerrada como realizada o como no asistió, según la política.', href: '/admin/weekly-closing', steps: ['Revisa clases pasadas sin cierre.', 'Confirma la asistencia registrada por el profesor y la evidencia disponible.', 'Resuelve discrepancias desde Incidencias antes del cierre semanal.'] },
      { key: 'incidencias', title: '6. Gestiona excepciones', summary: 'Cancelaciones tardías, ausencia, conflicto de calendario y reclamos deben quedar trazados.', href: '/admin/incidents', steps: ['Crea o abre la incidencia correspondiente.', 'Asigna responsable y registra una resolución concreta.', 'No ajustes saldos manualmente sin una nota operativa y auditoría.'] },
      { key: 'configuracion', title: '7. Configura con permisos correctos', summary: 'Ajustes, usuarios y conexión Google Calendar/Meet son funciones de administrador.', href: '/admin/settings', steps: ['Admin: conecta o cambia la cuenta Google autorizada.', 'Admin: crea usuarios, invita o restablece acceso.', 'Staff: opera solo dentro de los permisos otorgados.'] },
    ],
    faqs: [
      { question: '¿Quién puede cambiar reglas o permisos?', answer: 'Solo el Administrador. El equipo Staff opera según los permisos asignados en Usuarios.' },
      { question: '¿Cuándo se consumen las horas?', answer: 'Cuando la clase queda finalizada conforme a la asistencia y política aplicable; programarla solo la deja reservada.' },
      { question: '¿Qué hago con una cancelación fuera de la ventana?', answer: 'Registra la solicitud, aplica la política de cancelación y documenta cualquier excepción en Incidencias.' },
    ],
  },
  profesor: {
    key: 'profesor',
    title: 'Guía para profesores',
    eyebrow: 'PORTAL DOCENTE',
    audience: 'Profesor',
    description: 'Publica disponibilidad, consulta tu agenda, entra a Meet y cierra clases con información confiable.',
    firstSteps: [
      'Publica tu disponibilidad antes de que el alumno reserve.',
      'Consulta la agenda al inicio del día y abre el detalle de cada clase.',
      'Registra asistencia y cierre inmediatamente después de la sesión.',
    ],
    lessons: [
      { key: 'agenda', title: '1. Consulta tu agenda', summary: 'Usa lista o calendario para ver fecha, alumnos, estado y detalle de cada sesión.', href: '/teacher/today', steps: ['Abre Hoy.', 'Cambia entre Lista y Calendario según necesites.', 'Entra al detalle para abrir Meet y consultar participantes.'] },
      { key: 'disponibilidad', title: '2. Publica disponibilidad real', summary: 'Tus bloques publicados son los únicos espacios que los alumnos pueden reservar.', href: '/teacher/availability', steps: ['Crea bloques con día, horario, duración, tipo y cupo.', 'Revisa que no choquen con clases ya programadas.', 'Elimina un bloque si ya no estás disponible.'] },
      { key: 'clase', title: '3. Da y cierra la clase', summary: 'El cierre oportuno evita conciliaciones manuales y mantiene actualizado el paquete del alumno.', href: '/teacher/today', steps: ['Abre el detalle de la clase y entra a Meet.', 'Al finalizar, registra asistencia de cada alumno.', 'Confirma el cierre solo cuando la clase realmente ocurrió.'] },
      { key: 'cancelaciones', title: '4. Gestiona cambios correctamente', summary: 'Una cancelación debe respetar la política y quedar registrada en la plataforma.', href: '/teacher/today', steps: ['Abre el detalle de la clase.', 'Solicita o registra la cancelación con motivo.', 'No cambies la hora solo por WhatsApp: usa la plataforma para mantener la trazabilidad.'] },
    ],
    faqs: [
      { question: '¿Puedo editar una reserva de un alumno?', answer: 'Puedes gestionar disponibilidad y tus clases; las excepciones operativas las resuelve Staff o Admin.' },
      { question: '¿Por qué debo cerrar una clase?', answer: 'El cierre confirma lo ocurrido y permite que la operación y el paquete del alumno reflejen la realidad.' },
      { question: '¿Qué pasa si no puedo dictar una clase?', answer: 'Registra la cancelación o incidencia desde la clase; no dependas únicamente de mensajes externos.' },
    ],
  },
  alumno: {
    key: 'alumno',
    title: 'Guía para alumnos',
    eyebrow: 'PORTAL DEL ALUMNO',
    audience: 'Alumno',
    description: 'Reserva con tu profesor asignado, consulta tu plan y entra a tus clases desde un solo lugar.',
    firstSteps: [
      'Revisa tu profesor asignado y el estado de tus clases.',
      'Reserva solo dentro de los horarios publicados por tu profesor.',
      'Usa la plataforma para cancelar o reprogramar, no solo WhatsApp.',
    ],
    lessons: [
      { key: 'plan', title: '1. Entiende tu plan', summary: 'El indicador muestra horas tomadas / programadas / totales del paquete.', href: '/student/home', steps: ['Abre Inicio.', 'Revisa tu profesor asignado.', 'Lee el estado actual: tomado, programado y total contratado.'] },
      { key: 'reservar', title: '2. Reserva tu próxima clase', summary: 'Los espacios disponibles se calculan usando el horario de tu profesor y tu paquete.', href: '/student/book', steps: ['Abre Reservar.', 'Elige un horario disponible.', 'Confirma la reserva y revisa que aparezca en tu agenda.'] },
      { key: 'meet', title: '3. Entra a clase y consulta detalles', summary: 'Cada reserva tiene fecha, estado y enlace para conectarte por Google Meet.', href: '/student/home', steps: ['Busca la clase en Lista o Calendario.', 'Abre el detalle.', 'Usa Entrar a Meet a la hora de tu clase.'] },
      { key: 'cambios', title: '4. Cancela o reprograma a tiempo', summary: 'La plataforma aplica las reglas de cancelación y deja registro de cada cambio.', href: '/student/home', steps: ['Abre la clase que quieres cambiar.', 'Selecciona Cancelar y reprogramar si está disponible.', 'Lee el resultado: las cancelaciones tardías pueden afectar el paquete.'] },
    ],
    faqs: [
      { question: '¿Qué significan las tres cifras de horas?', answer: 'Muestran horas tomadas / programadas / totales. Una clase programada aún no se ha consumido.' },
      { question: '¿Dónde está el enlace de mi clase?', answer: 'En el detalle de cada clase puedes abrir el enlace de Google Meet cuando esté disponible.' },
      { question: '¿Puedo elegir cualquier profesor?', answer: 'No. Reservas con el profesor que la academia te asignó, dentro de su disponibilidad publicada.' },
    ],
  },
}
