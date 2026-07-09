# PRD.md

## 1. Resumen

- Producto: `TEATIME Ops`
- Tipo: web app operativa con backoffice interno y autoservicio controlado para profesores y alumnos.
- Objetivo principal: convertir una operacion dispersa entre Google Calendar, WhatsApp y Excel en una sola fuente de verdad para clases, asistencia, cancelaciones y saldo de paquetes.
- Version objetivo: `MVP v1`.
- Estado del documento: `v2 - replanteado desde transcripcion y resumen de reunion`.

## 2. Direccion del producto

### Problema real

TEATIME hoy opera con demasiada friccion manual:

- Liliana agenda clases manualmente en varios calendarios de Google.
- Los profesores reportan asistencia por chat o documento.
- David consolida esa informacion en Excel todos los lunes.
- El saldo de clases pagadas, reservadas y tomadas se reconcilia a mano.
- Las cancelaciones y reprogramaciones generan malos entendidos porque la evidencia esta repartida entre calendario, memoria y WhatsApp.

### Resultado de negocio buscado

Crear una plataforma que:

- reduzca a casi cero la conciliacion manual semanal;
- muestre el estado real de cada clase en tiempo real;
- mantenga saldo confiable por alumno;
- deje trazabilidad suficiente para resolver reclamos sin depender de memoria humana;
- permita crecer operativamente sin aumentar la carga administrativa en la misma proporcion.

## 3. Contexto operativo actual

### Flujo actual resumido

1. Un prospecto llega por WhatsApp o referido.
2. Liliana agenda una reunion inicial por Meet.
3. Se hace entrevista y examen de clasificacion.
4. Se define plan o paquete.
5. Liliana revisa disponibilidad de profesores en varios calendarios/correos.
6. Liliana crea manualmente las recurrencias en Google Calendar.
7. Se crea o usa un grupo de WhatsApp con alumno, profesor y administracion.
8. Cada semana se consolida asistencia en Excel.

### Cuellos de botella actuales

- Multiples calendarios con convenciones informales por color.
- Dependencia excesiva de Liliana como cerebro operativo.
- Falta de visibilidad central de disponibilidad docente y de slots realmente reservables.
- Politicas de cancelacion no ejecutadas por sistema.
- CRM comercial y operativo fragmentado.

## 4. Usuarios

### Usuarios primarios

- `Admin academico`: Liliana, Alonso, asistente operativo.
- `Profesor`: docente que dicta clases y reporta asistencia/incidencias.
- `Alumno`: estudiante que consulta agenda, enlaces, saldo y estado.

### Usuarios secundarios

- `Asistente operacional`: consolida, revisa excepciones y apoya cierres.
- `Direccion`: revisa metricas, crecimiento y problemas operativos.

### Buyer

- Socios/duenos de TEATIME Academy.

## 5. Alcance MVP

### En alcance

- Autenticacion por rol.
- Backoffice de administracion para clases, alumnos, profesores y paquetes.
- Sincronizacion con Google Calendar y almacenamiento del enlace Meet.
- Self-scheduling controlado para alumnos y profesores.
- Soporte para clases `1:1` y `grupales`.
- Soporte para multiples duraciones de clase.
- Registro de asistencia de profesor y alumno.
- Motor de politicas de cancelacion y reprogramacion.
- Dashboard operativo con incidencias y metricas basicas.
- Reportes exportables de clases, asistencia y saldo.
- CRM basico para alumnos y prospectos convertidos.
- Notificaciones transaccionales basicas.
- Portal de profesor y portal de alumno con agenda, reservas y reprogramaciones permitidas.

### Fuera de alcance en MVP

- LMS completo con videos, PDFs, cuestionarios y diploma.
- Automatizacion full de WhatsApp bidireccional.
- Facturacion, pasarela de pago y contabilidad integrada.
- App movil nativa.
- Multi-tenant real para varias academias.

### Decision de alcance importante

La reunion mezcla tres productos:

- backoffice operativo;
- CRM comercial;
- LMS/portal academico.

El MVP no debe intentar construir los tres a fondo al mismo tiempo. El sistema se enfoca primero en el backoffice operativo y en un CRM/portal minimo con self-scheduling controlado. El LMS queda para fase posterior.

## 6. Objetivos y metricas

### Objetivos de negocio

- Reducir en al menos `80%` el tiempo administrativo semanal invertido en consolidacion.
- Reducir reclamos por conteo de clases y cancelaciones en al menos `50%` durante los primeros 90 dias.
- Aumentar la visibilidad diaria del estado operativo sin depender de Excel.

### Objetivos de usuario

- Admin: entender en una sola pantalla que clases pasaron, cuales faltan, cuales tienen problema.
- Profesor: marcar una clase en menos de 30 segundos.
- Alumno: reservar, consultar, mover o cancelar su clase dentro de politica sin preguntar por WhatsApp.

### KPIs del MVP

- `% de clases con asistencia registrada dentro de 30 min`.
- `% de clases con estado operativo final antes del cierre semanal`.
- `diferencia entre saldo teórico y saldo real`.
- `numero de incidencias por cancelacion tardia`.
- `numero de ajustes manuales por semana`.

## 7. Roles y permisos

### Admin

- Crear y editar profesores, alumnos, paquetes y reglas.
- Conectar calendarios oficiales.
- Crear clases manualmente cuando haga falta.
- Aprobar excepciones y ajustes manuales.
- Ver todos los reportes y exportaciones.
- Resolver incidencias.

### Staff

- Ver operacion completa.
- Editar datos operativos no sensibles.
- Registrar soporte y observaciones.
- Gestiona normalmente la primera reserva de un alumno nuevo.
- No puede cambiar reglas globales ni borrar historicos salvo permiso expreso de admin.

### Teacher

- Ver solo sus clases y alumnos asignados.
- Marcar asistencia.
- Publicar disponibilidad y bloquear tiempos no disponibles.
- Solicitar cancelacion o reprogramacion.
- Ver saldo y progreso del alumno solo a nivel operativo.

### Student

- Ver proximas clases, historial, saldo y enlace Meet.
- Autogestionar reservas dentro de disponibilidad y reglas.
- Reservar solo con el profesor asignado por admin.
- Ver politicas aplicadas a sus clases.

## 8. Jornadas principales

### Jornada 1: convertir un nuevo interesado en alumno activo

1. Admin registra lead o alumno.
2. Agenda reunion inicial.
3. Registra resultado de clasificacion.
4. Asigna profesor, frecuencia y paquete.
5. Staff o admin crea normalmente la primera reserva.
6. Sistema crea el plan operativo base y deja trazabilidad.

Exito:
- el alumno queda listo para programacion sin depender de notas sueltas en WhatsApp.

### Jornada 2: programar una clase recurrente

1. Admin identifica disponibilidad docente.
2. Crea o sincroniza serie de clases.
3. Sistema asocia profesor, alumno, Meet y paquete.
4. Clase queda visible para todos los roles correctos.

Exito:
- cada clase existe como registro propio, no solo como bloque visual en Google Calendar.

### Jornada 3: self-scheduling de una nueva clase

1. Teacher publica bloques de disponibilidad base y excepciones.
2. Student entra a su portal y ve solo slots del profesor asignado.
3. Student reserva un slot compatible con su paquete, tipo de clase, duracion y politica.
4. Sistema crea la clase, reserva saldo segun configuracion y sincroniza el evento.

Exito:
- el estudiante puede reservar sin intervencion manual y sin producir dobles reservas.

### Jornada 4: dictar y cerrar una clase

1. Profesor entra a su agenda.
2. Abre la clase activa.
3. Marca asistencia propia y del alumno.
4. Sistema cierra la clase, actualiza estado y descuenta horas si aplica.

Exito:
- el saldo queda actualizado automaticamente y auditado.

### Jornada 5: cancelar o reprogramar

1. Usuario intenta cancelar o reprogramar.
2. Sistema evalua ventana de tiempo, rol y politica.
3. Si procede, crea solicitud o cambio.
4. Si no procede, bloquea o exige aprobacion administrativa.

Exito:
- la politica deja de ser verbal y se vuelve ejecutable.

### Jornada 6: cierre semanal sin Excel

1. Admin filtra semana/profesor/alumno.
2. Revisa clases sin asistencia, incidencias y ajustes.
3. Exporta si necesita soporte externo.
4. Cierra semana con datos consistentes.

Exito:
- David no necesita consolidar manualmente varias fuentes.

## 9. Requerimientos funcionales

### Prioridad `Must`

1. Login y autorizacion por rol.
2. Maestro de alumnos, profesores y paquetes.
3. Calendario interno de clases con sincronizacion desde Google Calendar.
4. Disponibilidad de profesor y agenda reservable para self-scheduling.
5. Soporte para clases `1:1` y `grupales`.
6. Estado de clase: `programada`, `reservada`, `en_curso`, `realizada`, `cancelada`, `reprogramada`, `incidencia`.
7. Registro de asistencia de profesor y alumno.
8. Politicas configurables de cancelacion con ventanas `24h`, `12h`, `6h`.
9. Ajuste automatico de saldo al cerrar clase.
10. Registro y resolucion de incidencias.
11. Reportes exportables por fecha, profesor, alumno y estado.
12. Auditoria de cambios sensibles.

### Prioridad `Should`

1. CRM basico con estado comercial y notas.
2. Plantillas de notificacion por email y canal saliente de WhatsApp.
3. UI lista para i18n `ES/EN` y extensible a otros idiomas.
4. Alertas de clases sin cierre o sin asistencia.
5. Reserva y liberacion de cupo/saldo por cancelacion valida.

### Prioridad `Could`

1. Portal academico con materiales y tareas.
2. Autoservicio de reprogramacion para alumnos.
3. Integracion de pagos para compra de nuevas horas.

## 10. Reglas de negocio del MVP

1. La fuente de verdad operativa es la base de datos de la app, no Google Calendar.
2. Google Calendar funciona como integracion y apoyo visual, no como logica central.
3. Ninguna clase cerrada debe depender de memoria humana para contar saldo.
4. Toda cancelacion debe guardar solicitante, momento, motivo y resultado.
5. Un cambio manual de saldo debe exigir motivo y actor responsable.
6. Toda reserva debe validar disponibilidad real, reglas de paquete y conflictos antes de confirmarse.
7. El alumno y el profesor autogestionan agenda solo dentro de reglas y permisos.
8. La app no borra eventos de Google como mecanismo principal de negocio.
9. El alumno solo puede reservar con el profesor asignado por admin.
10. La primera reserva de un alumno nuevo normalmente la hace staff/admin y luego queda visible en la plataforma del alumno.

## 11. Politica de cancelacion propuesta

### Regla operativa por defecto

- `>= 24h`: cancelacion libre segun politica configurada.
- `>= 12h y < 24h`: permitida con advertencia.
- `>= 6h y < 12h`: permitida pero marcada como sensible.
- `< 6h`: bloqueada o enviada a aprobacion de admin segun configuracion.

### Regla sugerida para reservas

- reserva minima anticipada: `6h`
- reserva maxima anticipada: `30 dias`
- buffer sugerido entre clases del mismo profesor: `15 min`
- un alumno no puede reservar si no tiene horas disponibles o reservables
- un profesor no puede aparecer disponible si tiene conflicto con evento bloqueante
- la reserva del alumno solo muestra slots del profesor asignado
- la clase puede ser individual o grupal segun configuracion del paquete o la serie
- la duracion se valida contra el tipo de paquete o configuracion academica

### Decision importante

La reunion menciona `24/12/6`, pero no deja totalmente definido el efecto exacto de cada ventana. Por tanto:

- en MVP se modelan como politicas configurables;
- la academia podra decidir si una ventana solo avisa, penaliza o bloquea.

## 12. Datos y contenidos requeridos

### Datos base

- Usuario, rol, idioma, telefono, correo.
- Profesor, disponibilidad, especialidad.
- Alumno, nivel, zona horaria, estado.
- Paquete, horas totales, usadas, vigencia.
- Clase, fecha, duracion, Meet, calendario origen.
- Slot, disponibilidad, bloqueo, reserva.
- Asignacion profesor-alumno.
- Tipo de clase.
- Asistencia, cancelacion, reprogramacion, incidente, auditoria.

### Datos CRM minimos

- origen del lead;
- estado comercial;
- notas de clasificacion;
- observaciones clave;
- ultimo contacto.

### Datos reportables

- clases programadas;
- clases efectivamente dictadas;
- clases canceladas por rol;
- saldo por alumno;
- cargas por profesor;
- incidencias abiertas y cerradas.

## 13. Requerimientos no funcionales

- Rendimiento: dashboard y listados principales bajo 3 segundos en volumen inicial.
- Disponibilidad: objetivo `99%` mensual.
- Seguridad: sesiones seguras, hash de contrasenas, secretos fuera de codigo.
- Trazabilidad: log obligatorio para acciones criticas.
- Localizacion: timezone principal `America/Bogota` con soporte para alumnos internacionales.
- Accesibilidad: contraste AA, teclado en acciones criticas, estados claros.

## 14. Supuestos

- TEATIME podra centralizar al menos los calendarios oficiales que realmente importan.
- Los profesores si pueden adoptar el marcado de asistencia en una interfaz web.
- El hosting actual puede no servir; por eso se asume despliegue en infraestructura aparte.
- La primera version no automatizara por completo la recepcion de mensajes entrantes por WhatsApp.

## 15. Riesgos y preguntas abiertas

### Riesgos

- Riesgo de seguir dependiendo de calendarios desordenados si no se define un calendario oficial por operacion.
- Riesgo de sobrecargar el MVP si se intenta incluir LMS y automatizacion comercial profunda.
- Riesgo de friccion docente si la marcacion de asistencia no es extremadamente simple.
- Riesgo de colisiones de agenda si el self-scheduling no valida bien conflictos y buffers.
- Riesgo de complejidad adicional por soportar `1:1` y grupales desde MVP.
- Riesgo de conflictos por politicas si la academia no decide el efecto exacto de cada ventana.

### Preguntas abiertas no bloqueantes

- Cual sera la politica exacta de penalizacion o recuperacion por ventana `24/12/6`.
- Si el CRM MVP cubrira solo alumnos activos o tambien prospectos.
- Si las notificaciones transaccionales iniciales salen primero por email y luego por WhatsApp.
- Si la reserva consume horas de inmediato o solo las aparta hasta el cierre de clase.
- Como se comporta el saldo en clases grupales: hora por alumno, por cupo reservado o por asistencia efectiva.

## 16. Roadmap

### Fase 1: Core operativo

- usuarios, roles, clases, disponibilidad, reservas, asistencia, politicas, paquetes, reportes;
- asignacion alumno-profesor, clases `1:1` y grupales, duraciones variables;
- integracion con Google Calendar;
- portal profesor/alumno con self-scheduling controlado.

### Fase 2: CRM y automatizacion

- CRM mas completo;
- incidencias enriquecidas;
- notificaciones por WhatsApp con mejor trazabilidad;
- dashboards administrativos ampliados.

### Fase 3: Experiencia academica

- materiales por clase;
- cuestionarios;
- progreso academico;
- portal de aprendizaje mas completo.

## 17. Handoff a diseno

- Este producto es una consola operativa, no una landing bonita.
- Lo critico es leer estados y actuar rapido.
- La pantalla mas importante es el tablero operativo diario.
- Las acciones sensibles deben sentirse controladas y auditables.
- El profesor necesita una experiencia movil utilitaria y muy rapida.
- El alumno necesita una vista clara para reservar sin cometer errores.

## 18. Mapa funcional

### Nouns

- Academia
- Usuario
- Rol
- Profesor
- Alumno
- Lead
- Paquete
- Clase
- Serie de clases
- Asignacion alumno-profesor
- Disponibilidad
- Slot reservable
- Reserva
- Tipo de clase
- Duracion de clase
- Asistencia alumno
- Asistencia profesor
- Cancelacion
- Reprogramacion
- Incidencia
- Regla de operacion
- Notificacion
- Calendario externo
- Enlace Meet
- Contacto CRM
- Nota CRM
- Auditoria

### Verbs

- registrar lead
- clasificar alumno
- asignar profesor
- conectar calendario
- sincronizar eventos
- crear clase
- publicar disponibilidad
- reservar slot
- liberar reserva
- asignar profesor al alumno
- reprogramar clase
- cancelar clase
- validar politica
- marcar asistencia
- cerrar clase
- descontar horas
- ajustar saldo
- registrar incidente
- notificar cambio
- exportar reporte
- cerrar semana

### Moments of contact

- Login
- Dashboard operativo
- Calendario maestro
- Agenda del profesor
- Detalle de clase
- Modal de cancelacion/reprogramacion
- Gestion de paquetes
- CRM
- Centro de incidencias
- Reportes
- Ajustes
- Portal de alumno
