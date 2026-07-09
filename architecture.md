# architecture.md

# Architecture

## 1. Technical Summary

`TEATIME Ops` sera un monolito web orientado a operacion academica, con cuatro capacidades nucleares:

- backoffice admin/staff;
- portal de profesor;
- portal de alumno;
- self-scheduling controlado.

El MVP debe resolver primero el problema operativo: clases, disponibilidad, reservas, asistencia, cancelaciones, saldo y reportes. Las integraciones externas clave son Google Calendar/Meet y un canal transaccional de notificaciones. La arquitectura debe ser barata, mantenible por un equipo pequeno y desplegable fuera de Wix.

## 2. Scope Classification and Architecture Options

Clasificacion: `Medium`.

### Opcion A: Monolito Next.js + Postgres

- Stack: Next.js App Router, Prisma, PostgreSQL, auth por credenciales, cron para sync, colas ligeras en DB.
- Pros: velocidad de entrega, menos moving parts, coste bajo, mas facil para un solo agente de codigo.
- Contras: jobs y notificaciones intensivas quedan menos desacoplados.
- Complejidad/costo: bajo a medio.
- Compliance: suficiente para datos operativos y PII basica con auditoria y backups.
- Estado: `seleccionada`.

### Opcion B: Web app + worker separado

- Stack: Next.js, PostgreSQL, Redis/BullMQ, worker de sync/notificaciones.
- Pros: mejor manejo de reintentos y procesos asincronos.
- Contras: agrega complejidad operativa demasiado pronto.
- Complejidad/costo: medio.
- Compliance: buena, pero con mas superficie operativa.

### Opcion C: Backend API separado + frontend separado

- Stack: NestJS/Fastify + Next.js + queue + observabilidad completa.
- Pros: escalabilidad y separacion mas limpias.
- Contras: sobredimensionado para el estado actual del negocio.
- Complejidad/costo: medio-alto.
- Compliance: mejor base para largo plazo, innecesaria en MVP.

### Criterio de seleccion

Se elige la opcion A porque el problema principal no es escala tecnica sino desorden operativo. La prioridad correcta es `llegar a una fuente de verdad confiable rapido`, incluyendo un motor de reservas suficientemente estricto.

## 3. Recommended Stack

- Frontend: `Next.js 14` + `React` + `TypeScript`
- Styling: `Tailwind CSS`
- Data fetching: `TanStack Query`
- Backend: `Route Handlers` + `Server Actions` para casos simples
- Database: `PostgreSQL`
- ORM: `Prisma`
- Validation: `Zod`
- Auth: `Better Auth` o `NextAuth` con credenciales y roles persistidos en DB
- Background jobs: cron simple + tabla de jobs/notificaciones
- Email transaccional: `Resend` o `Postmark`
- WhatsApp transaccional: adaptador intercambiable, preferiblemente `Meta Cloud API` o `Twilio`
- Hosting: `VPS con Docker` o `Railway/Render/Fly`, bajo subdominio recomendado como `administracion.teatimeacademy.com`
- Error tracking: `Sentry`
- Logs: `Pino`
- Analytics operativos: consultas internas + eventos basicos
- Testing: `Vitest`, `Playwright`

### Alternativas descartadas

- Wix como runtime principal: no sirve para esta app.
- Firebase-only: complica trazabilidad relacional y reportes operativos.
- Microservicios: no justificados.

## 4. Traceability from PRD

### Nouns to Data Model

- Academia -> `academies`
- Usuario -> `users`
- Rol -> enum `user_role`
- Profesor -> `teachers`
- Alumno -> `students`
- Asignacion alumno-profesor -> `student_teacher_assignments`
- Lead -> `crm_contacts`
- Paquete -> `packages`
- Clase -> `classes`
- Serie de clases -> `class_series`
- Tipo de clase -> enum `class_type`
- Duracion de clase -> campo `duration_minutes` y reglas por paquete
- Disponibilidad -> `teacher_availability_blocks`
- Asistencia alumno -> `student_attendance`
- Asistencia profesor -> `teacher_attendance`
- Cancelacion -> `cancellations`
- Reprogramacion -> `reschedules`
- Incidencia -> `incidents`
- Regla de operacion -> `operation_rules`
- Notificacion -> `notification_jobs`
- Calendario externo -> `calendar_connections`
- Enlace Meet -> campo `meet_url` en `classes`
- Contacto CRM -> `crm_contacts`
- Nota CRM -> `crm_notes`
- Slot reservable -> vista computada desde `teacher_availability_blocks` + `teacher_availability_exceptions` + `classes` + `booking_rules`
- Reserva -> `classes` con estado `reserved` o `scheduled`
- Auditoria -> `audit_logs`

### Verbs to Backend Behavior

- registrar lead -> `POST /api/crm/contacts`
- clasificar alumno -> `POST /api/students/intake`
- asignar profesor -> `POST /api/classes/assignment`
- vincular alumno a profesor -> `POST /api/students/:id/teacher-assignment`
- conectar calendario -> `POST /api/integrations/google/connect`
- sincronizar eventos -> cron + `POST /api/integrations/google/sync`
- crear clase -> `POST /api/classes`
- publicar disponibilidad -> `PUT /api/teachers/:id/availability`
- reservar slot -> `POST /api/booking/slots/:slotId/book`
- liberar reserva -> `POST /api/classes/:id/release`
- reprogramar clase -> `POST /api/classes/:id/reschedule`
- cancelar clase -> `POST /api/classes/:id/cancel`
- validar politica -> service `CancellationPolicyEngine`
- marcar asistencia -> `POST /api/classes/:id/attendance`
- cerrar clase -> `POST /api/classes/:id/close`
- descontar horas -> job/service `PackageConsumptionService`
- ajustar saldo -> `POST /api/packages/:id/adjustments`
- registrar incidente -> `POST /api/incidents`
- notificar cambio -> `NotificationDispatcher`
- exportar reporte -> `GET /api/reports/*.csv`
- cerrar semana -> `POST /api/weekly-closing/run`

### Moments of Contact to Frontend Routes

- Login -> `/login`
- Dashboard operativo -> `/admin/dashboard`
- Calendario maestro -> `/admin/calendar`
- Agenda del profesor -> `/teacher/today`
- Disponibilidad del profesor -> `/teacher/availability`
- Reserva de clase -> `/student/book`
- Detalle de clase -> `/classes/[classId]`
- Modal de cancelacion/reprogramacion -> modal dentro de `/classes/[classId]`
- Gestion de paquetes -> `/admin/packages`
- CRM -> `/admin/crm`
- Centro de incidencias -> `/admin/incidents`
- Reportes -> `/admin/reports`
- Ajustes -> `/admin/settings`
- Portal de alumno -> `/student/home`

## 5. System Context

### Clientes

- Navegador desktop para admin/staff.
- Navegador movil/desktop para teacher.
- Navegador movil/desktop simple para student.

### Servicios internos

- App web Next.js.
- Motor de politicas.
- Scheduler de sincronizacion.
- Dispatcher de notificaciones.

### Sistemas externos

- Google Calendar API
- Google OAuth
- Meta Cloud API o Twilio para WhatsApp saliente
- Email transaccional

### Entornos

- local
- staging
- production

## 6. Application Modules

### Auth and Access

- login, sesiones, permisos, guards por rol.

### Academic Operations

- clases, series, asignaciones, estados, cierres.

### Scheduling

- disponibilidad, slots, reservas, conflictos, buffers.

### Attendance

- registro de asistencia, cierres, excepciones.

### Package Ledger

- saldo, consumo, ajustes, vigencias.

### CRM

- contacto, clasificacion, notas, seguimiento.

### Incidents

- problemas operativos, ownership, resolucion.

### Integrations

- calendarios, Meet, email, WhatsApp.

### Reporting

- agregados operativos, filtros, exportaciones.

### Audit and Settings

- auditoria, reglas, plantillas, configuraciones.

## 7. Data Model

### Core entities

- `academies`
  - `id`, `name`, `timezone`, `default_locale`, `is_active`

- `users`
  - `id`, `academy_id`, `role`, `name`, `email`, `password_hash`, `phone_e164`, `locale`, `is_active`, `last_login_at`

- `teachers`
  - `id`, `user_id`, `bio_short`, `is_available`, `notes`

- `students`
  - `id`, `user_id`, `current_level`, `status`, `classification_notes`, `preferred_timezone`

- `student_teacher_assignments`
  - `id`, `student_id`, `teacher_id`, `assigned_by_user_id`, `is_primary`, `starts_at`, `ends_at`, `notes`

- `crm_contacts`
  - `id`, `academy_id`, `kind` (`lead`, `student`), `full_name`, `email`, `phone_e164`, `source`, `stage`, `owner_user_id`, `preferred_language`, `converted_student_id`

- `crm_notes`
  - `id`, `contact_id`, `author_user_id`, `body`, `created_at`

- `packages`
  - `id`, `student_id`, `name`, `hours_total`, `hours_consumed`, `hours_reserved`, `status`, `valid_from`, `valid_until`, `sold_at`, `notes`, `allowed_class_types`, `allowed_duration_minutes`

- `class_series`
  - `id`, `academy_id`, `student_id`, `teacher_id`, `title`, `frequency_rule`, `source`, `status`, `class_type`, `duration_minutes`

- `classes`
  - `id`, `series_id`, `academy_id`, `teacher_id`, `status`, `class_type`, `duration_minutes`, `starts_at`, `ends_at`, `timezone`, `meet_url`, `google_event_id`, `source_calendar_id`, `closure_status`, `cancelled_at`, `booked_by_user_id`, `booking_source`

- `class_students`
  - `id`, `class_id`, `student_id`, `package_id`, `attendance_expected`, `hours_reserved`, `hours_consumed`

- `student_attendance`
  - `id`, `class_id`, `student_id`, `status`, `marked_by_user_id`, `marked_at`, `reason`

- `teacher_attendance`
  - `id`, `class_id`, `teacher_id`, `status`, `marked_by_user_id`, `marked_at`, `reason`

- `cancellations`
  - `id`, `class_id`, `requested_by_user_id`, `request_role`, `hours_before_start`, `policy_result`, `reason`, `approved_by_user_id`, `created_at`

- `reschedules`
  - `id`, `class_id`, `requested_by_user_id`, `old_start_at`, `new_start_at`, `new_end_at`, `status`, `reason`

- `teacher_availability_blocks`
  - `id`, `teacher_id`, `weekday`, `start_local_time`, `end_local_time`, `timezone`, `is_active`

- `teacher_availability_exceptions`
  - `id`, `teacher_id`, `starts_at`, `ends_at`, `type`, `reason`

- `booking_rules`
  - `id`, `academy_id`, `minimum_notice_hours`, `maximum_notice_days`, `default_duration_minutes`, `buffer_minutes`, `allow_student_reschedule`, `allow_teacher_reschedule`, `allow_staff_override`, `first_booking_staff_assisted`

- `calendar_connections`
  - `id`, `academy_id`, `provider`, `google_account_email`, `calendar_id`, `sync_mode`, `status`, `last_synced_at`, `sync_cursor`

- `notification_jobs`
  - `id`, `channel`, `template_key`, `recipient_ref`, `payload_json`, `status`, `attempt_count`, `last_error`, `scheduled_at`, `sent_at`

- `incidents`
  - `id`, `class_id`, `type`, `severity`, `status`, `owner_user_id`, `summary`, `resolution_notes`, `resolved_at`

- `operation_rules`
  - `id`, `academy_id`, `rule_key`, `rule_json`, `updated_by_user_id`, `updated_at`

- `audit_logs`
  - `id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `created_at`, `request_id`

### Relaciones clave

- un `academy` tiene muchos `users`, `calendar_connections`, `classes`, `operation_rules`.
- un `teacher` puede tener muchas `class_series`, `classes` y `availability_blocks`.
- un `student` puede tener una o varias `student_teacher_assignments`, pero solo una primaria activa en MVP.
- un `teacher` puede tener muchas `availability_exceptions`.
- un `student` puede tener muchos `packages`, `classes` y registros CRM.
- una `class` puede tener muchos `class_students`, incidentes y notificaciones.

### Indices

- `classes(teacher_id, starts_at)`
- `classes(booked_by_user_id, starts_at)`
- `classes(status, starts_at)`
- `classes(google_event_id)` unique nullable
- `student_attendance(class_id, student_id)` unique
- `student_teacher_assignments(student_id, is_primary)`
- `teacher_availability_blocks(teacher_id, weekday, start_local_time, end_local_time)`
- `teacher_availability_exceptions(teacher_id, starts_at, ends_at)`
- `packages(student_id, status)`
- `notification_jobs(status, scheduled_at)`
- `incidents(status, severity)`

### Retencion

- auditoria: minimo 12 meses
- incidentes: 24 meses
- jobs de notificacion: 6-12 meses

## 8. Authentication and Authorization

### Flujo de auth

- login por email/password.
- cookie de sesion httpOnly.
- middleware para proteger rutas por rol.

### Roles

- `ADMIN`
- `STAFF`
- `TEACHER`
- `STUDENT`

### Reglas de autorizacion

- `ADMIN`: acceso total.
- `STAFF`: opera casi todo excepto reglas globales y acciones destructivas mayores.
- `TEACHER`: solo clases y alumnos relacionados.
- `STUDENT`: solo su informacion y sus acciones de reserva/reprogramacion permitidas.

### Controles adicionales

- doble confirmacion para ajustes manuales de saldo.
- motivo obligatorio para override de politica.
- auditoria obligatoria en acciones sensibles.

## 9. API and Server Actions

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Students and CRM

- `GET /api/crm/contacts`
- `POST /api/crm/contacts`
- `POST /api/crm/contacts/:id/notes`
- `POST /api/students/intake`
- `GET /api/students/:id`
- `POST /api/students/:id/teacher-assignment`

### Teachers and availability

- `GET /api/teachers`
- `POST /api/teachers`
- `GET /api/teachers/:id/availability`
- `PUT /api/teachers/:id/availability`
- `POST /api/teachers/:id/availability/exceptions`

### Calendar integrations

- `POST /api/integrations/google/connect`
- `GET /api/integrations/google/status`
- `POST /api/integrations/google/sync`

### Classes

- `GET /api/classes`
- `POST /api/classes`
- `GET /api/classes/:id`
- `PATCH /api/classes/:id`
- `POST /api/classes/:id/cancel`
- `POST /api/classes/:id/reschedule`
- `POST /api/classes/:id/attendance`
- `POST /api/classes/:id/close`

### Booking

- `GET /api/booking/slots`
- `POST /api/booking/slots/:slotId/book`
- `POST /api/classes/:id/release`
- `POST /api/classes/:id/request-change`
- `POST /api/students/:id/first-booking`

### Packages

- `GET /api/packages`
- `POST /api/packages`
- `GET /api/packages/:id`
- `POST /api/packages/:id/adjustments`

### Incidents

- `GET /api/incidents`
- `POST /api/incidents`
- `PATCH /api/incidents/:id`

### Reports

- `GET /api/reports/overview`
- `GET /api/reports/classes.csv`
- `GET /api/reports/attendance.csv`
- `GET /api/reports/packages.csv`
- `POST /api/weekly-closing/run`

### Settings

- `GET /api/settings/rules`
- `PATCH /api/settings/rules`
- `GET /api/settings/templates`
- `PATCH /api/settings/templates`

### Validacion y errores

- validacion de payload con `Zod`
- `401` sesion invalida
- `403` sin permiso
- `404` entidad no encontrada
- `409` conflicto de politica o estado
- `422` regla de negocio invalida
- `503` integracion externa degradada

## 10. Frontend Architecture

- App Router con grupos de rutas por rol.
- `TanStack Query` para fetch, cache e invalidacion.
- formularios con `react-hook-form` + `zodResolver`
- enums compartidos desde capa de dominio
- capa i18n desde el inicio para `es` y `en`, basada en diccionarios y claves estables
- polling en dashboard y agenda del profesor cada 30-60s en MVP
- optimistic update solo en marcacion de asistencia si el backend responde rapido
- tablas densas para admin y layouts compactos para teacher/student
- API de slots computados para self-scheduling con cache corta

### Rutas base

- `/(public)/login`
- `/(admin)/admin/dashboard`
- `/(admin)/admin/calendar`
- `/(admin)/admin/packages`
- `/(admin)/admin/crm`
- `/(admin)/admin/incidents`
- `/(admin)/admin/reports`
- `/(admin)/admin/settings`
- `/(teacher)/teacher/today`
- `/(teacher)/teacher/availability`
- `/(student)/student/home`
- `/(student)/student/book`

## 11. Integrations

### Google Calendar / Meet

- OAuth2 institucional
- sync incremental por calendar connection
- job cada 5 minutos
- si falla sync, crear incidente o banner de degradacion
- lectura de eventos bloqueantes para evitar doble reserva
- escritura de nuevos eventos creados por self-scheduling
- los eventos de reserva creados por alumno solo se escriben sobre el calendario del profesor asignado

### Email

- envio de confirmaciones y alertas operativas
- canal recomendado para MVP base porque es mas predecible que WhatsApp

### WhatsApp

- usar solo como canal transaccional saliente en MVP si el proveedor queda listo
- si no queda listo a tiempo, el sistema no debe depender de WhatsApp para operar
- registrar template, intentos, respuesta y error

## 12. Background Jobs and Notifications

### Jobs

- `google_calendar_sync`
- `slot_projection_refresh`
- `weekly_closing_digest`
- `package_reconciliation`
- `notification_dispatch`
- `stale_class_detector`
- `booking_expiry_or_release`

### Notificaciones

- nueva clase o clase reprogramada
- cancelacion aprobada o bloqueada
- clase sin cierre
- saldo por agotarse
- fallo de integracion relevante para admin

### Estrategia MVP

- guardar notificaciones en tabla
- despacharlas en background
- reintentos exponenciales controlados

## 13. File and Media Handling

MVP casi no necesita archivos.

- no hay uploads pesados en fase 1
- los recursos academicos se difieren a fase 3
- si se adjuntan documentos operativos, usar storage privado con URLs firmadas

## 14. Security, Privacy, and Compliance

- hash de contrasenas con `bcrypt` o `argon2`
- cookies seguras y CSRF en formularios sensibles
- rate limit en login y endpoints sensibles
- auditoria en cambios de saldo, politicas y cierres manuales
- secretos en env, nunca en repo
- backups diarios de base de datos
- export y borrado de datos definidos mas adelante si negocio lo necesita

## 15. Observability and Analytics

### Logs

- request id por peticion
- logs de sync
- logs de reservas y colisiones evitadas
- logs de notificaciones
- logs de overrides de politicas

### Metricas operativas

- clases programadas hoy
- slots reservables vs reservados
- clases sin cierre
- asistencias faltantes
- cancelaciones por ventana
- ajustes manuales de saldo
- incidentes abiertos/cerrados
- primeras reservas creadas por staff

### Alertas

- sync fallando repetidamente
- jobs atascados
- aumento inusual de cancelaciones tardias

## 16. Testing Strategy

### Unit

- motor de politicas `24/12/6`
- calculo de saldo
- mapeo de eventos de Google a `classes`
- generacion y filtrado de slots reservables
- validacion de duracion y tipo de clase contra paquete y profesor asignado

### Integration

- login y permisos
- sync manual de calendario
- publicacion de disponibilidad
- reserva de slot
- primera reserva asistida por staff
- cierre de clase
- ajuste de paquete
- creacion de incidente

### E2E

- admin crea alumno y paquete
- teacher publica disponibilidad
- student reserva una clase
- staff crea la primera reserva de un alumno nuevo
- teacher marca asistencia
- sistema consume horas
- admin exporta semana

### Accesibilidad

- smoke de teclado y roles basicos en pantallas criticas

## 17. Deployment Plan

### Entornos

- local para desarrollo
- staging para QA interno
- production

### CI/CD

- install
- lint
- typecheck
- test
- build

### Migraciones

- migraciones Prisma versionadas
- seed inicial de roles, usuarios demo, reglas base

### Rollback

- backup pre-deploy
- rollback de contenedor o release
- plan de reversa para migraciones destructivas

## 18. Implementation Phases

### Fase 1: Foundation

- estructura del repo
- auth
- shell por rol
- schema inicial Prisma

### Fase 2: Core operativo

- clases
- disponibilidad
- reservas
- asistencia
- paquetes
- reglas de cancelacion
- cierres

### Fase 3: Integraciones y reportes

- Google Calendar sync
- reportes CSV
- incidentes
- notificaciones

### Fase 4: CRM minimo y endurecimiento

- CRM basico
- ajustes operativos
- auditoria visible
- mejoras de UX

### Primer milestone que Codex debe construir

Un vertical slice completo:

1. login por rol;
2. CRUD minimo de alumno/profesor/paquete;
3. disponibilidad del profesor;
4. reserva de un slot por alumno;
5. detalle de clase con asistencia;
6. consumo automatico de horas al cerrar clase.

## 19. Risks and Open Technical Decisions

### Confirmado

- MVP en monolito web
- fuente de verdad interna en DB
- despliegue fuera de Wix

### Riesgos

- definicion tardia de politica exacta por ventana
- definicion incompleta de la logica de reserva vs consumo de horas
- calendarios historicamente desordenados
- expectativa inflada sobre WhatsApp
- mezcla de backoffice con LMS demasiado temprano

### Decisiones abiertas

- proveedor final de WhatsApp
- auth exacta: Better Auth vs NextAuth
- infraestructura final: VPS Docker vs Railway/Render/Fly
- si se necesita sincronizacion bidireccional con Google o solo lectura + escritura controlada
- si la reserva consume hora al reservar o solo la bloquea
- regla exacta de consumo para clases grupales

## 20. Codex Build Handoff

### Orden de construccion

1. leer `PRD.md`, `design_system.md`, `architecture.md`
2. inicializar estructura limpia del proyecto
3. crear schema Prisma y migracion inicial
4. implementar auth y guardias por rol
5. construir vertical slice de `availability + booking + classes + attendance + packages`
6. agregar dashboard admin y agenda teacher
7. integrar Google Calendar
8. agregar reportes, incidencias y notificaciones

### Primeros archivos/folders

- `src/app/(public)/login/page.tsx`
- `src/app/(admin)/admin/dashboard/page.tsx`
- `src/app/(teacher)/teacher/today/page.tsx`
- `src/app/(teacher)/teacher/availability/page.tsx`
- `src/app/(student)/student/home/page.tsx`
- `src/app/(student)/student/book/page.tsx`
- `src/lib/auth/*`
- `src/lib/policies/*`
- `src/lib/booking/*`
- `src/lib/google-calendar/*`
- `prisma/schema.prisma`

### Acceptance checks iniciales

- un admin puede iniciar sesion;
- puede crear alumno, profesor y paquete;
- el profesor publica disponibilidad;
- un alumno ve slots validos y reserva uno;
- existe una clase y puede abrirse su detalle;
- un teacher puede marcar asistencia;
- cerrar la clase descuenta horas correctamente;
- un cambio sensible deja auditoria.
