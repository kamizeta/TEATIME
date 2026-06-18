# Architecture

## 1. Technical Summary

Aplicación web operativa para gestión de asistencia de academia de idiomas con integración principal a Google Calendar/Meet y WhatsApp. MVP orientado a uso interno (admin/profesor) y consulta de alumno.

## 2. Scope Classification and Architecture Options

Project classification: Medium.

### Option A - Fullstack monolito (recomendado para v1)
- Stack: Next.js (App Router), Postgres (Supabase), Prisma, Auth de Supabase, Tailwind, CRON jobs simples.
- Pros: rápido MVP, menos operaciones, deploy simple.
- Contras: menor control extremo sobre colas pesadas.
- Costo: bajo-medio.
- Compliance: adecuado para PII básica con RBAC y logs.
- Selected.

### Option B - App + workers dedicados
- Stack: Next.js + BullMQ/Redis + Worker separado.
- Pros: robusto para picos y reintentos WhatsApp.
- Contras: mayor complejidad inicial.
- Costo: medio-alto.

### Option C - Microservicios
- Stack: API separada + web + worker + message queue.
- Pros: escalabilidad máxima.
- Contras: sobredimensionado para MVP.

## 3. Recommended Stack

- Frontend: Next.js + React + Tailwind.
- Backend/API: Next.js Server Actions + Route Handlers.
- DB: PostgreSQL (Supabase).
- Auth: Supabase Auth (email/password y roles custom JWT claims).
- Integraciones: Google Calendar API + Meet links, WhatsApp API provider (Twilio API opcional).
- Jobs: Cron de sincronización (Vercel cron o scheduled task).
- Observabilidad: Sentry + logs estructurados.
- Testing: Vitest + Playwright (flujo crítico), Supertest.

## 4. Traceability from PRD

### Nouns to Data Model
- Academia -> organizations (single row MVP)
- Usuario -> users
- Rol -> roles
- Profesor -> users + profesor metadata
- Alumno -> students
- PaqueteHoras -> hour_packages
- Clase -> class_events
- ReservaClase -> class_enrollments
- AsistenciaAlumno -> attendance_records
- AsistenciaProfesor -> instructor_attendances
- Cancelacion -> cancellations
- NotificacionWhatsApp -> notification_attempts
- EventoCalendar -> calendar_sync_events
- Auditoria -> audit_logs

### Verbs to Backend Behavior
- SincronizarEventos -> cron + endpoint de webhook
- ImportarAgenda -> parser Google API -> upsert de class_events
- ValidarClase -> reglas antes de cambios
- MarcarAsistencia -> mutation por profesor
- RegistrarCancelacion -> mutation + validations
- AplicarReglaCancelacion -> service function
- ConsumirHora -> post-processing class close
- ConsultarSaldo -> query agregada por student
- GenerarReporte -> export endpoint
- EnviarNotificacionWhatsApp -> worker + retry
- RecalcularSaldo -> admin action/job
- RevisarIncidencias -> admin dashboard query

### Moments of Contact to Frontend Routes
- Login -> /login
- Dashboard Admin -> /admin/dashboard
- Calendario Operativo -> /admin/calendar
- Detalle de Clase -> /admin/classes/[id]
- Lista de Incidencias -> /admin/incidents
- Gestión de Paquetes -> /admin/packages
- Reportes -> /admin/reports
- Ajustes de Reglas -> /admin/settings
- Panel Profesor -> /teacher/dashboard
- Vista Alumno -> /student/overview

## 5. System Context

- Clients: navegador web (desktop, móvil).
- App: Next.js service + API routes.
- DB: Postgres.
- External: Google Calendar API, WhatsApp API.
- Admin: panel interno.

## 6. Application Modules

- Auth & Access
- Calendar Sync Service
- Class & Attendance Service
- Package Service
- Notification Service
- Reporting Service
- Audit & Settings Service

## 7. Data Model

- users
  - id, name, email, role (admin|teacher|student), phone_e164, is_active, created_at
- teachers
  - id, user_id, timezone
- students
  - id, user_id, student_code, notes
- hour_packages
  - id, student_id, total_hours, used_hours, valid_from, valid_to, status
- class_events
  - id, google_event_id, title, start_at, end_at, timezone, meet_url, status
- class_enrollments
  - id, class_event_id, student_id, package_id, status
- attendance_records
  - id, class_event_id, student_id, status(attended|absent|late|no_show), marked_by, marked_at
- instructor_attendances
  - id, class_event_id, instructor_id, present, marked_at
- cancellations
  - id, class_event_id, requested_by, request_time, reason, was_allowed, rule_window_hours
- notification_attempts
  - id, target_type, target_id, channel, status, provider_id, payload_json
- calendar_sync_events
  - id, source, event_id, status, payload, synced_at
- audit_logs
  - id, actor_id, action, entity_type, entity_id, before_json, after_json, created_at

Índices: by teacher/date, student/date, class_event_id, google_event_id(unique), status.

### Retention

- Audit min 12 meses, logs de notificaciones 12 meses.

## 8. Authentication and Authorization

- Roles: admin, teacher, student.
- Auth por email/password (MVP).
- RBAC en server actions y middleware de rutas.
- Admin-only para cambios sensibles.

## 9. API and Server Actions

- POST /api/integrations/calendar/sync -> dispara sync manual.
- GET /api/classes -> lista con filtros.
- GET /api/classes/{id} -> detalle.
- PATCH /api/classes/{id}/attendance -> marcar asistencias.
- POST /api/classes/{id}/cancel -> solicitar cancelación.
- GET /api/packages -> consulta paquetes.
- PATCH /api/packages/{id}/adjust -> ajuste manual.
- GET /api/reports/attendance -> métricas y export.
- POST /api/reports/attendance/export -> descarga CSV.
- GET /api/settings -> reglas.
- PATCH /api/settings -> actualizar reglas (admin).

Errores clave: 403 permiso, 409 conflicto de regla, 410 evento vencido, 422 campo inválido.

## 10. Frontend Architecture

- Enrutamiento por carpetas Next.js.
- Estado local con React Query.
- Formularios con validación en cliente y servidor.
- Notificaciones de estado de mutaciones.
- Posible polling cada 30s en dashboard y clase activa; websocket opcional en fase 2.

## 11. Integrations

- Google Calendar API:
  - Autenticación OAuth2 para cuenta institucional.
  - Filtro por etiquetas de evento o calendario específico.
  - Reintentos con backoff.
- WhatsApp API:
  - Plantillas aprobadas para cancelación y estado de clase.
  - Retry exponencial x3 antes de fallido.

## 12. Background Jobs and Notifications

- Cron de sync cada 5 minutos.
- Job nocturna para reconciliar saldos y clases antiguas.
- Queue simple para notificaciones.

## 13. File and Media Handling

- No carga de archivos en MVP.
- Solo URLs de Meet y campos de texto.

## 14. Security, Privacy, and Compliance

- Validación de entrada estricta en cada endpoint.
- Secrets en variables de entorno.
- Logs sin datos sensibles completos.
- Encriptación en tránsito HTTPS y en reposo en DB cloud.
- Auditoría de cambios sensibles.

## 15. Observability and Analytics

- Logs de sync, errores de API externa y cambios de asistencia.
- Sentry para errores frontend/backend.
- KPIs operativos en dashboard:
  - asistencia diaria, clases sin registro, cancelaciones tardías.

## 16. Testing Strategy

- Unit: cálculo de reglas y transformaciones de agenda.
- Integration: endpoints de asistencia y cancelación.
- E2E: flujo de clase completa.
- Regression: import/cron sync.

## 17. Deployment Plan

- Env: local, staging, production.
- CI mínimo: lint + tests + build.
- Database migration + seed de roles.
- Rollback: snapshot DB + redeploy commit previo.

## 18. Implementation Phases

Fase 1 (MVP)
- Auth + roles
- Sync Google Calendar
- UI Admin + Profesor + Alumno básico
- Regla 6 horas + asistencia
- Paquetes y reportes iniciales

Fase 2
- QA UX, mejoras de performance, export avanzado.

Fase 3
- Alertas proactivas y ajuste automático de reembolsos.

## 19. Risks and Open Technical Decisions

Confirmed decisions:
- Monolito Next.js + Supabase para MVP.
- Regla 6h fija por defecto.

Open:
- Definir proveedor exacto de WhatsApp en implementación.
- Definir si atraso máximo cuenta como asistencia.
- Definir límite de paquetes en simultáneo por alumno.

## 20. Claude Code Build Handoff

Build order:
1) Autenticación y modelos de datos (migrations + seed).
2) Integración Google Calendar y entidad class_events.
3) Reglas de asistencia y cancelación.
4) Módulos de paquetes y reportes.
5) Vistas Admin/Teacher/Student y notificaciones.
6) Pruebas + hardening.

Acceptance checks iniciales:
- Crear/leer clase desde sync.
- Marcar asistencia y cancelar con regla 6h.
- Consumir saldo correctamente.
- Enviar/registrar intento de WhatsApp.
