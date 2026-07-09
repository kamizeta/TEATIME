# design_system.md

## 1. Contexto del producto

`TEATIME Ops` no debe parecer una red social ni un curso online. Debe parecer una torre de control academica construida a partir del tono actual de `teatimeacademy.com`: cercana, humana e internacional, pero con disciplina operativa. La app tiene tres modos de uso dominantes:

- escritorio denso para admin/staff;
- movil funcional para profesor;
- portal claro de reserva para alumno.

## 2. Direccion visual

### Personalidad

- sobria;
- profesional;
- calida;
- precisa;
- internacional;
- operativa.

### Lo que si debe transmitir

- control;
- trazabilidad;
- calma en medio del caos;
- claridad de estados;
- acompañamiento.

### Lo que no debe transmitir

- juguete;
- plataforma educativa infantil;
- CRM generico sin criterio;
- exceso de decoracion.

## 3. Principios de diseno

1. Estado antes que ornamento.
2. Una accion critica nunca debe ser ambigua.
3. La informacion clave debe entenderse en menos de 5 segundos.
4. El profesor no debe navegar de mas para cerrar una clase.
5. Los mismos colores y palabras deben significar exactamente lo mismo en toda la app.
6. El alumno debe sentir autonomia guiada, no libertad caotica.
7. La reserva debe sentirse confiable y limitada por reglas claras.

## 4. Sistema visual

### Color tokens

- `--bg`: `#f7f8fb`
- `--surface`: `#ffffff`
- `--surface-2`: `#f2f5f8`
- `--ink`: `#243446`
- `--muted`: `#6d7783`
- `--line`: `#dbe2ea`
- `--brand`: `#ea5434`
- `--brand-deep`: `#c9482d`
- `--secondary`: `#3e5b74`
- `--accent-soft`: `#6ec1e4`
- `--accent-positive`: `#61ce70`
- `--success`: `#218c5c`
- `--warning`: `#b87a24`
- `--danger`: `#c44536`
- `--info`: `#4f8db8`

### Tipografia

- Display puntual: `Baloo Tammudu 2`
- Titulos UI: `Montserrat`
- Texto base: `Roboto`
- Numeros/tablas: `Roboto Mono`

### Escala tipografica

- `12`, `14`, `16`, `18`, `22`, `28`, `36`

### Espaciado

- `4`, `8`, `12`, `16`, `24`, `32`, `40`

### Bordes y volumen

- Radio pequeño: `8`
- Radio medio: `12`
- Radio grande: `18`
- Sombra base: `0 10px 30px rgba(16, 24, 40, 0.08)`

### Motion

- transiciones: `140ms` a `180ms`;
- skeletons suaves;
- nada de animaciones largas o decorativas.

## 5. Estados semanticos

### Estados de clase

- `Programada`: azul
- `Reservada`: coral suave
- `En curso`: teal oscuro
- `Realizada`: verde
- `Cancelada`: rojo
- `Reprogramada`: naranja
- `Incidencia`: ocre
- `Sin cierre`: gris oscuro

### Estados de integracion

- `Sincronizada`
- `Pendiente`
- `Con error`
- `Parcial`

### Estados de saldo

- `Disponible`
- `Por vencer`
- `Agotado`
- `Ajustado manualmente`

## 6. Arquitectura de informacion

### Navegacion admin/staff

- Dashboard
- Calendario
- Clases
- Paquetes
- CRM
- Incidencias
- Reportes
- Ajustes

### Navegacion teacher

- Hoy
- Mi agenda
- Mi disponibilidad
- Mis alumnos
- Incidencias

### Navegacion student

- Proximas clases
- Reservar clase
- Historial
- Mi saldo
- Politicas

## 7. Layouts principales

### Admin desktop

- sidebar fija;
- topbar con estado de sync y accesos rapidos;
- area central con modulos densos;
- panel lateral contextual en detalle de clase o incidente.

### Teacher mobile-first

- barra superior compacta;
- lista cronologica de clases;
- bloque editable de disponibilidad;
- CTA fijo `Marcar asistencia` cuando hay clase activa;
- flujo de 1 mano.

### Student portal

- layout simple;
- lenguaje tranquilo;
- flujo central de seleccionar slot y confirmar reserva con su profesor asignado;
- mucho menos densidad que admin.

## 8. Componentes principales

### `AppShell`

- sidebar, topbar, area principal;
- variante por rol.

### `KpiCard`

- numero principal;
- etiqueta;
- delta o alerta breve.

### `OperationalBanner`

- sync de calendario;
- cola de notificaciones;
- incidencias criticas del dia.

### `ClassTimeline`

- vista diaria/semanal;
- color semantico;
- conflicto visual si hay solapes o datos incompletos.

### `AvailabilityGrid`

- matriz semanal de slots;
- variante teacher para publicar disponibilidad;
- variante student para elegir solo espacios reservables de su profesor asignado.

### `ClassCard`

- hora;
- alumno(s);
- profesor;
- saldo relacionado;
- estado;
- accesos de accion.

### `BookingPanel`

- resumen de profesor, idioma, duracion y politica;
- muestra disponibilidad real filtrada;
- incluye confirmacion final y consecuencias de cancelacion;
- soporta duraciones multiples y clases `1:1` o grupales.

### `AttendancePanel`

- check rapido por alumno;
- selector de estado;
- notas de incidente;
- confirmacion de cierre.

### `PolicyBadge`

- muestra si una cancelacion esta `OK`, `Sensible` o `Bloqueada`.

### `SlotBadge`

- `Disponible`, `Reservado`, `No disponible`, `Requiere aprobacion`.

### `IncidentDrawer`

- detalle de problema;
- dueño;
- resolucion;
- historial.

### `PackageLedger`

- horas compradas;
- consumidas;
- pendientes;
- ajustes;
- compatibilidad con duraciones variables y clases grupales.

### `CRMCard`

- etapa;
- ultimo contacto;
- origen;
- proxima accion.

### `AuditTrail`

- actor;
- timestamp;
- cambio;
- antes/despues resumido.

## 9. Especificacion por momento de contacto

### Login

- objetivo: acceso claro por rol;
- campos: email, password;
- estados: loading, error de credenciales, sesion expirada.

### Dashboard operativo

- objetivo: detectar riesgo del dia en segundos;
- modulos: KPIs, clases de hoy, clases sin cierre, incidentes, sync status.

### Calendario maestro

- objetivo: ver capacidad y conflictos;
- modulos: timeline, filtros, leyenda, detalle rapido.

### Agenda del profesor

- objetivo: ejecutar su dia sin friccion;
- modulos: lista de hoy, proxima clase, CTA de asistencia, disponibilidad editable, incidencias propias.

### Reserva de clase

- objetivo: permitir self-scheduling sin errores;
- modulos: resumen del profesor asignado, selector de duracion permitida, slot picker, resumen de reglas, confirmacion.

### Onboarding de reserva inicial

- objetivo: que staff haga la primera reserva y el alumno luego la vea reflejada;
- modulos: ficha del alumno, profesor asignado, paquete, primera reserva sugerida, confirmacion.

### Detalle de clase

- objetivo: resolver toda la operacion de una clase en un solo lugar;
- modulos: datos base, Meet, paquete, asistencia, historial, acciones.

### Modal de cancelacion/reprogramacion

- objetivo: detener errores;
- modulos: regla aplicada, tiempo restante, motivo, aprobacion requerida.

### Gestion de paquetes

- objetivo: leer saldo real y movimientos;
- modulos: ledger, ajuste manual, vigencia, alertas.

### CRM

- objetivo: centralizar contexto del alumno o lead;
- modulos: perfil, notas, etapa, historial resumido.

### Centro de incidencias

- objetivo: que nada quede en el aire;
- modulos: cola de pendientes, severidad, responsable, SLA operativo.

### Reportes

- objetivo: cerrar semana y exportar;
- modulos: filtros, tabla, CSV, resumen visual.

### Ajustes

- objetivo: modificar reglas sin tocar codigo;
- modulos: politicas, usuarios, integraciones, plantillas.

### Portal de alumno

- objetivo: consulta sencilla y confianza;
- modulos: proximas clases, saldo, historial, politicas, acceso a reservar.

## 10. Patrones de interaccion

- acciones destructivas o sensibles siempre con confirmacion;
- filtros persistentes por sesion;
- acciones mas comunes visibles sin abrir menus profundos;
- feedback inmediato despues de marcar asistencia o guardar ajuste;
- estados bloqueados explican el por que, no solo deshabilitan.
- en self-scheduling, el slot elegido debe mostrar regla y saldo antes de confirmar.
- si la primera reserva fue creada por staff, debe verse claramente como `Reserva creada para ti`.

## 11. Responsive behavior

- admin pensado para `1280px+`, pero utilizable desde `1024px`;
- teacher optimizado para `390px-430px`;
- student optimizado para `390px-768px`;
- tablas densas pasan a cards apiladas en movil;
- paneles secundarios se convierten en drawer en pantalla pequena.

## 12. Estados de feedback

### Loading

- skeleton + texto especifico: `Sincronizando calendario`, `Cargando saldo`, etc.

### Empty

- mensaje accionable, no vacio decorativo.

### Error

- causa resumida + que puede hacer el usuario.

### Conflict

- mensaje explicito cuando un slot ya no esta disponible o entra en conflicto.

### Success

- toast corto con hora de accion.

### Approval required

- banner/modal claro cuando una accion queda pendiente de staff o admin.

### Disabled

- boton deshabilitado + tooltip o texto explicativo.

### Permission denied

- pantalla o banner claro: `No tienes permiso para esta accion`.

### Offline or degraded

- banner fijo con ultima sincronizacion y modulos afectados.

## 13. Accesibilidad

- contraste AA minimo;
- tamano objetivo tactil `44x44`;
- foco visible consistente;
- navegacion por teclado en formularios y modales;
- semantica clara en tablas y estados;
- textos implementados desde claves i18n para `ES/EN` y futuros idiomas.

## 14. Contenido y tono

- tono directo y profesional;
- tono humano, internacional y claro, alineado con la web de TEATIME;
- nada de mensajes vagos como `Algo salio mal`;
- copiar exactitud operativa: `Clase cerrada`, `Saldo ajustado`, `Cancelacion fuera de ventana`, `Reserva confirmada`.

## 15. Checklist QA de diseno

- Cada pantalla tiene estados `loading`, `empty`, `error`, `success`, `permission`.
- Todo color semantico tiene un unico significado.
- La politica `24/12/6` se entiende visualmente en todas las acciones relacionadas.
- El profesor puede cerrar una clase completa en menos de 30 segundos.
- El alumno no encuentra acciones que no le corresponden.
- El dashboard permite detectar excepciones del dia sin abrir reportes.
- El alumno puede reservar una clase sin confundir disponibilidad con solicitud pendiente.
- La primera reserva asistida por staff se diferencia visualmente de una reserva hecha por el alumno.

## 16. Handoff a arquitectura

- El frontend depende de una fuente de verdad transaccional para clase, asistencia y saldo.
- La vista de clase requiere historial y reglas calculadas en backend.
- El dashboard necesita consultas agregadas rapidas y polling inicial.
- Los labels y estados deben venir de enums estables compartidos entre backend y frontend.
- El calendario de reservas necesita API de slots computados, no solo eventos crudos.
- La capa i18n debe montarse desde el inicio para `ES/EN` y expansion futura sin refactor grande.
