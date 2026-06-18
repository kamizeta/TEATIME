# Design System

## 1. Product and Brand Context

App de operación diaria para academia de idiomas. Tono: eficiente, directo, confiable. Prioridad: rapidez y baja fricción para tareas críticas (asistencia, cancelación, paquete y reporte).

## 2. Design Principles

1. Clarity over decoration
2. Estado primero: todo objeto debe mostrar estado claro
3. Acción segura por defecto
4. Menor carga cognitiva en flujos repetitivos
5. Diseño responsive utilitario para escritorio y móvil

## 3. Visual Direction

Look and feel: dashboard profesional con alta legibilidad.
- Densidad media-alta para tablas.
- Evitar iconografía ambigua, bordes redondeados suaves, tipografía clara.
- No usar estética de “app social” ni elementos lúdicos.

## 4. Design Tokens

### Color

- primary: `#0F6BFF`
- secondary: `#0A9BFF`
- success: `#16A34A`
- warning: `#D97706`
- danger: `#DC2626`
- neutral-900: `#0F172A`
- neutral-700: `#334155`
- neutral-400: `#94A3B8`
- surface: `#FFFFFF`
- surface-muted: `#F8FAFC`
- border: `#E2E8F0`
- focus: `#2563EB`

### Typography

- Fuente base: `Inter`.
- Scale: 12, 14, 16, 18, 20, 24, 32 px.
- Pesos: 400/500/600/700.

### Spacing and Layout

- Grid: 12 columnas desktop, 1–2 columnas mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 40.
- Page width max: 1280 px.
- Gutter desktop 16, mobile 12.

### Radius, Shadows, Borders

- Radius: cards 12, botones 8, modales 16.
- Shadows: leve 0 8 30 0 `rgba(15,23,42,0.08)`.
- Border: 1px solid base.

### Motion

- Transiciones: 160ms ease-out.
- Skeleton shimmer suave 1s.
- `prefers-reduced-motion`: desactivar animaciones largas.

## 5. Information Architecture and Navigation

- Navegación primaria (Desktop):
  - Dashboard
  - Calendario
  - Clases
  - Paquetes
  - Reportes
  - Ajustes
- Móvil: barra inferior con Dashboard, Clases, Reportes.
- Acceso rápido: botón fijo para "Registrar Asistencia" en Clase activa.

## 6. Core Components

- TopBar: título, usuario, rol, acciones rápidas.
- StatCard: métrica + mini tendencia + estado.
- CalendarTimeline: vista semanal con filtros por profesor/alumno.
- ClassRow: fila compacta con estado (programada, hecha, cancelada, pendiente).
- AttendanceGrid: tabla con asistentes y toggles.
- CancelDialog: modal con motivo y confirmación + motivo de bloqueo.
- RuleBadge: etiqueta de estado/regla (OK, Riesgo, Bloqueado).
- AuditTimeline: lista de cambios con timestamp.
- NotifyBanner: estado de notificación WhatsApp.

## 7. Screen Map from PRD Moments of Contact

- Login
  - Objetivo: acceso seguro por rol.
  - Componentes: formulario, campo de error, validación.
  - Estado: loading/error.
- Dashboard Admin
  - Objetivo: visión diaria de operación.
  - Componentes: StatCard, CalendarTimeline, alertas.
- Calendario Operativo
  - Objetivo: controlar programación.
  - Estados: vacío, duplicado, conflicto.
- Detalle de Clase
  - Objetivo: marcar asistencia y justificar cancelaciones.
  - Componentes: AttendanceGrid, CancelDialog, AuditTimeline.
- Lista de Incidencias
  - Objetivo: seguimiento de bloqueos/sos.
  - Componentes: filtros, chips de estado, acción resolver.
- Gestión de Paquetes
  - Objetivo: crear paquetes y consultar saldo.
  - Componentes: tabla+modal.
- Reportes
  - Objetivo: exportar asistencia y horas.
  - Componentes: select de periodo, tabla, export.
- Ajustes de Reglas
  - Objetivo: editar ventanas y políticas.
  - Componentes: toggle y campos de horas.
- Panel Profesor
  - Objetivo: vista personal diaria.
  - Componentes: calendario, clase activa, botón asistencia.
- Vista Alumno
  - Objetivo: consulta de agenda y saldo.
  - Componentes: lista de clases y estado.

## 8. Key Screen Patterns

- Todos los formularios usan validación inline + tooltip de ayuda.
- Confirmación destructiva obligatoria para:
  - Borrar clases
  - Cambiar asistencia después de cierre
  - Ajustes manuales de saldo
- Filtros persistentes por sesión.

## 9. Forms and Inputs

- Labels explícitas, placeholders mínimos.
- Campos obligatorios marcados con asterisco.
- Fechas en formato local `DD/MM/YYYY hh:mm`.
- Selector de estado con chips de 3 estados como mínimo.

## 10. Data Display

- Tablas con paginación de 25 por vista.
- Ordenamiento por fecha, profesor, estado.
- Colores por estado:
  - Hecha/Asistió: verde
  - Pendiente: amarillo
  - Ausente: gris
  - Cancelada: rojo

## 11. Feedback States

- Loading: esqueleto + texto "Sincronizando..."
- Empty: icono de calendario y CTA para importar.
- Error: bloque rojo con acción de reintentar.
- Success: toast verde.
- Warning: banner amarillo con acción recomendada.
- Disabled: opacidad 60%, cursor no permitido.
- Offline: banner superior con timestamp de última sincronización.

## 12. Accessibility

- Contraste mínimo AA.
- Teclado para flujos clave (enter, escape, tab).
- Focus visible mínimo 2px.
- Tamaño de click mínimo 44x44 px en móvil.

## 13. Content Style

- Tono: directo, sin ambigüedad.
- Mensajes de error: indicar causa y siguiente acción.
- Terminología consistente: "Clase", "Asistencia", "Cancelación", "Saldo".

## 14. Design QA Checklist

- ¿Cada pantalla tiene estado vacío y error?
- ¿Todos los estados críticos tienen confirmación?
- ¿Las etiquetas de estado usan el mismo significado en tablas y notificaciones?
- ¿Lectura rápida de 3 métricas clave posible en <= 5s?
- ¿Alumno no puede editar datos de asistencia?
- ¿Vista móvil conserva acciones críticas?

## 15. Handoff to Architecture

- Requiere estados de evento persistentes y auditables.
- El frontend depende de eventos de sincronización y de reglas de permiso por rol.
- Reportes deben consumir IDs estables de clase/usuario.
- Se necesitan websockets opcionales para reflejo rápido de asistencia en vivo.
