# Product Requirements Document

## 1. Summary

- App name: Asistencia Teatime
- One-line concept: Sistema de control de asistencia para clases de idiomas con agenda de Google Calendar/Meet, reglas de cancelación y operación orientada a profesor + admin.
- Product type: Web app interna (SaaS interno para academia)
- Target launch version: MVP v1
- Document status: Assumptive v1.0

## 2. Problem and Opportunity

La academia agenda clases en Google Calendar y Meet, pero hoy no hay una forma confiable y unificada para:
- saber asistencia real en tiempo real,
- aplicar reglas de cancelación de forma consistente,
- llevar un control de consumo de paquetes de horas,
- operar ausencias/cancelaciones sin discusiones.

El problema actual genera errores de cobro, reclamos, sobrecarga administrativa y baja visibilidad para dirección.

## 3. Target Users

- Primary users:
  - Admin académico: configura profesores, alumnos, paquetes y reglas, valida asistencia y facturación.
  - Profesor: consulta agenda, marca asistencia y cancelaciones, gestiona incidencias.
  - Alumno (solo consulta): ve próximas clases, estado de asistencia y saldo restante.
- Secondary users: soporte operativo de la academia.
- Buyer: el dueño/gerente de academia.

## 4. Goals and Success Metrics

Business goals:
- Reducir en 50% el tiempo administrativo semanal dedicado a conciliación de asistencia.
- Reducir reclamos por asistencia/pago en 40% al mes.
- Disminuir casos de ausencias no justificadas sin control.

User goals:
- Ver en una sola pantalla: clase, profesor, estado de asistencia y saldo.
- Registrar asistencia en < 10 segundos por clase.

Success metrics (MVP):
- 100% de clases agendadas por Google Calendar con estado asociado en app.
- >90% de clases con asistencia registrada (profesor o sistema) dentro de 30 min.
- 95% de cancelaciones ejecutadas con regla correcta.

## 5. MVP Scope

### In Scope

- Sincronización de eventos de Google Calendar (clases) y Meet join URLs.
- Registro de asistencia de alumnos y profesores.
- Reglas automáticas de cancelación con umbral de 6 horas.
- Gestión de paquetes de horas por alumno (saldo, consumo, historial).
- Dashboard operativo para admin.
- Reportes básicos: clases dictadas, asistencia, ausencias y saldo.
- Notificaciones WhatsApp por plantilla para cambios/cancelaciones.
- Login por correo para admin y profesor, acceso limitado por rol.

### Out of Scope

- App móvil nativa.
- Cobro automático en línea y conciliación con bancos.
- Portal avanzado para padres/familiares.
- Integración con múltiples academias en una sola cuenta (multi-tenant).

## 6. User Roles and Permissions

- Admin
  - Crear/editar alumnos, profesores, grupos y paquetes.
  - Conectar Google Calendar de la academia.
  - Definir reglas operativas.
  - Editar y validar asistencia.
  - Ver y exportar reportes.
- Profesor
  - Ver agenda propia semanal.
  - Marcar asistencia de clase.
  - Solicitar/registrar cancelación.
  - Ver saldo de sus clases asignadas.
- Alumno
  - Ingresar con enlace de autenticación simple.
  - Ver próximas clases, historial y saldo.
  - Ver motivo de cambios y estado de asistencia.

## 7. Core User Journeys

### Journey 1: Crear y sincronizar clase desde Google Calendar
- Trigger: Evento de Google Calendar etiquetado como clase.
- Steps: el sistema detecta evento -> lo normaliza -> lo muestra en calendario interno.
- Completion: clase visible con profesor, alumno, paquete y estado inicial "Programada".
- Edge cases: evento sin Meet link, evento duplicado, cambio de horario.

Acceptance criteria:
- Evento sincronizado en menos de 5 min.
- Clase sin Meet link se marca como "Pendiente configuración" y no rompe flujo.

### Journey 2: Cancelación dentro de 6 horas (prohibida)
- Trigger: cancelación solicitada por profesor/alumno.
- Steps: usuario intenta cancelar -> sistema valida horas restantes -> muestra opción de justificación o bloqueo.
- Completion: si aplica, estado cambia a "Cancelada" + notificación enviada.
- Edge cases: cancelación cruzando zona horaria.

Acceptance criteria:
- Para cancelaciones < 6h: bloqueo automático + mensaje de bloqueo obligatorio.
- Para >= 6h: se restaura/sale saldo según política definida (ver reglas).

### Journey 3: Registro de asistencia al momento de clase
- Trigger: hora de clase.
- Steps: profesor abre clase -> marca asistencia alumno(s) y propia asistencia.
- Completion: estado final "Asistió" o "Ausente".
- Edge cases: no conexión, llegada tardía, reingreso.

Acceptance criteria:
- El estado final se guarda con timestamp y usuario.

### Journey 4: Control de paquete de horas
- Trigger: clase marcada como completada.
- Steps: sistema descuenta una hora por alumno participante.
- Completion: saldo actualizado y visible.
- Edge cases: no asistencia -> no consumir saldo (MVP rule: no se consume por ausencia no justificada con reembolso posterior manual).

Acceptance criteria:
- Cero clases completadas con consumo negativo.

### Journey 5: Consulta diaria del admin
- Trigger: inicio de jornada.
- Steps: abrir dashboard -> filtros por fecha/profesor/alumno -> revisar anomalías.
- Completion: visibilidad de incidencias.

Acceptance criteria:
- Carga en <3 segundos para 1,000 clases/mes.

## 8. Functional Map - Three-Layer Extraction

### Nouns - Data Entities
- Academia, Usuario, Rol, Profesor, Alumno, PaqueteHoras, Clase, ReservaClase, AsistenciaAlumno, AsistenciaProfesor, Cancelacion, NotificacionWhatsApp, EventoCalendar, Auditoria

### Verbs - Backend Actions
- SincronizarEventos, ImportarAgenda, ValidarClase, MarcarAsistencia, RegistrarCancelacion, AplicarReglaCancelacion, ConsumirHora, ConsultarSaldo, GenerarReporte, EnviarNotificacionWhatsApp, RecalcularSaldo, RevisarIncidencias

### Moments of Contact - Frontend Screens
- Login
- Dashboard Admin
- Calendario Operativo
- Detalle de Clase
- Lista de Incidencias
- Gestión de Paquetes
- Reportes
- Ajustes de Reglas
- Panel Profesor
- Vista Alumno

## 9. Functional Requirements

1. Agenda & Sincronización (Must)
- Importar eventos de Google Calendar cada 5 min.
- Asociar evento a alumno/profesor y Meet link.

2. Asistencia (Must)
- Registro manual por profesor.
- Estado de asistencia por alumno y por profesor.
- Auditoría de cambios.

3. Reglas de cancelación (Must)
- Bloqueo automático de cancelación menor a 6h.
- Registro de motivo.

4. Paquetes de horas (Must)
- Saldo por alumno.
- Descuento al completar clase con asistencia efectiva.

5. Notificaciones (Must)
- Notificar por WhatsApp cambios de estado críticos.

6. Reportes (Should)
- Exportar CSV.
- Ranking de asistencia por profesor.

7. Administración (Should)
- Ajustes de políticas y ventanas de gracia.

8. Alertas (Could)
- Avisos de inactividad del sistema de sync.

## 10. Content and Data Requirements

- Datos manuales: alumnos, profesores, paquetes, asignaciones.
- Datos de agenda: fecha/hora, duración, Meet link, evento-id de Google.
- Datos operativos: asistencia, cancelaciones, saldo, auditoría.
- Formatos de salida: CSV de reportes y PDF básico de asistencia.

## 11. Notifications and Communication

- Estado de notificación: pendiente, enviado, reintentado, fallido.
- Eventos: cancelación aprobada, cancelación bloqueada, clase marcada.
- Canales: WhatsApp (principal), correo opcional para admin.

## 12. Non-Functional Requirements

- Seguridad: autenticación por email + contraseña, hashes seguros.
- Disponibilidad: 99% mensual objetivo.
- Rendimiento: dashboard <3s, reporte mensual <10s.
- Localización: Español (Colombia), huso America/Bogota.
- Accesibilidad: contraste AA y navegación por teclado en acciones críticas.
- Trazabilidad: log de cambios con usuario y timestamp.

## 13. Analytics

- Eventos: clase_programada, asistencia_registrada, cancelacion_intentada, cancelacion_aprobada, paquete_consumido.
- Dashboard KPIs: tasa de asistencia, tasa de cancelaciones tardías, saldo promedio de paquete.

## 14. Assumptions

- La academia usa una cuenta de Google Calendar principal y Meet por clase.
- El profesor es la fuente principal de verdad para asistencia.
- Los alumnos no modifican agenda.
- La política por defecto no aplica descuentos en ausencias, salvo ajuste manual posterior.
- WhatsApp puede enviarse mediante proveedor externo con plantillas aprobadas.

## 15. Risks and Open Questions

- Riesgo de datos inconsistencia entre Google Calendar y ajustes manuales del profesor.
- Riesgo legal/contractual por notificaciones WhatsApp no entregadas.
- Riesgo de fraude interno en ajustes de asistencia sin doble validación.
- Riesgo abierto: si el alumno llega con retraso > 15 min, ¿cuenta como asistencia?
- Riesgo abierto: reglas de reembolso por cancelación de última hora no incluidas en MVP.

## 16. Roadmap

- MVP (2-4 semanas): sincronización, asistencia, cancelaciones 6h, paquetes, dashboard, reportes.
- Iteración 2 (2 semanas): reglas de asistencia automática por join de Meet.
- Iteración 3 (2 semanas): panel de soporte y app móvil ligera (PWA).

## 17. Handoff to Design

- Audiencia de uso intenso: admin y profesor en desktop, alumno en móvil.
- Pantallas críticas de alta densidad: Calendario Operativo + Dashboard Admin + Detalle Clase.
- Prioridad visual: claridad operativa, baja ambigüedad, estados muy visibles y acciones con confirmación para cambios sensibles.
