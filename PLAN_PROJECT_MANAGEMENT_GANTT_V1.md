# Broco Finance — Project Management / Gantt V1

**Estado:** Plan funcional y técnico aprobado para implementación  
**Repositorio:** `Broco-Solutions/broco-finance`  
**Objetivo:** incorporar planificación de proyectos y una vista Gantt compartible con clientes dentro de Broco Finance, manteniendo un alcance reducido y una experiencia visual profesional.

---

## 1. Contexto

Broco Finance actualmente gestiona clientes, proyectos, ingresos, gastos y proyecciones financieras.

La aplicación ya cuenta con las entidades `Client` y `Project`, por lo que la nueva funcionalidad de gestión de proyectos no debe implementarse como una aplicación independiente ni duplicar esos conceptos.

El objetivo de esta V1 es ampliar el concepto de `Project` para incorporar:

- planificación temporal;
- fases;
- tareas;
- estados;
- hitos;
- fecha opcional de Go Live;
- vista Gantt;
- avance general;
- tiempo transcurrido;
- portal read-only para el cliente mediante un enlace privado.

Esta V1 **no busca reemplazar Trello, Jira, ClickUp, Asana ni otras herramientas de gestión integral**.

El alcance debe mantenerse deliberadamente reducido.

---

# 2. Principios de implementación

## 2.1 Una sola aplicación

La funcionalidad se incorpora dentro de Broco Finance.

No crear:

- otro repositorio;
- otra aplicación;
- otro backend;
- otra base de datos;
- sincronizaciones entre sistemas.

La estructura conceptual queda:

```text
Client
└── Project
    ├── Información financiera
    ├── Planificación
    └── Acceso cliente
```

---

## 2.2 Una sola fuente de verdad

Las tareas y fases almacenadas en Broco son las mismas que verá el cliente.

No existirán:

- nombres internos y externos distintos;
- descripciones internas y externas distintas;
- un Gantt interno y otro Gantt duplicado.

La única excepción será la posibilidad de marcar una tarea como no visible para el cliente.

---

## 2.3 Mantener la V1 sencilla

Toda funcionalidad nueva debe responder afirmativamente a esta pregunta:

> ¿Es necesaria para tener un Gantt útil, gestionable por Broco y profesional para mostrar al cliente?

Si la respuesta es no, queda fuera de V1.

---

# 3. Alcance funcional definitivo

## Incluido

- reutilizar `Project` existente;
- fecha opcional de Go Live;
- fases de proyecto;
- tareas;
- milestones;
- cinco estados de tarea;
- fechas planificadas;
- orden visual;
- visibilidad para cliente;
- Gantt;
- línea nativa de fecha actual;
- colores por estado;
- avance general automático;
- tiempo transcurrido automático;
- contador hasta Go Live;
- portal de cliente read-only;
- enlace privado y revocable;
- interfaz visual de alta calidad para el cliente.

## Fuera de alcance

- Kanban;
- subtareas;
- dependencias entre tareas;
- critical path;
- baseline;
- porcentaje manual de avance;
- responsables;
- workload;
- horas estimadas;
- horas reales;
- prioridades;
- tags;
- comentarios;
- archivos adjuntos;
- notificaciones;
- Slack;
- WhatsApp;
- emails automáticos;
- sprints;
- calendarios;
- usuarios de clientes;
- invitaciones;
- roles complejos;
- sistema completo de permisos;
- edición por parte del cliente;
- personalización visual por cliente;
- logos específicos por cliente;
- colores específicos por cliente.

El branding específico de cada cliente podrá incorporarse posteriormente.

---

# 4. Modelo de dominio

## 4.1 `Project`

Se reutiliza el modelo existente.

Agregar únicamente:

```text
goLiveDate Date?
```

### Reglas

- opcional;
- representa la fecha global prevista de salida a producción;
- no debe duplicarse como `ProjectTask`;
- el Gantt puede generar visualmente una referencia de Go Live a partir de este campo;
- el contador de Go Live se calcula dinámicamente;
- si no existe `goLiveDate`, no se muestra ningún contador ni referencia especial.

---

# 5. `ProjectPhase`

Nueva entidad.

Modelo conceptual:

```text
ProjectPhase

id
projectId

name
position

createdAt
updatedAt
```

## Reglas

- pertenece a un único `Project`;
- un proyecto puede tener cero o muchas fases;
- `name` es obligatorio;
- `position` define el orden visual;
- eliminar un proyecto elimina sus fases;
- una fase no necesita fechas;
- una fase no necesita estado;
- una fase no necesita progreso.

Las fechas visuales de una fase pueden derivarse de sus tareas:

```text
inicio fase = MIN(task.startDate)
fin fase    = MAX(task.endDate)
```

No almacenar estos valores de manera duplicada.

---

# 6. `ProjectTask`

Nueva entidad.

Modelo conceptual definitivo:

```text
ProjectTask

id
projectId
phaseId?

name
description?

type

startDate
endDate

status

position
clientVisible

createdAt
updatedAt
```

---

## 6.1 Relaciones

- toda tarea pertenece a un `Project`;
- `phaseId` es opcional;
- si existe `phaseId`, la fase debe pertenecer al mismo `Project`;
- una tarea puede existir sin fase;
- al eliminar un proyecto, se eliminan sus tareas;
- definir explícitamente el comportamiento al eliminar una fase:
  - preferencia V1: las tareas quedan sin fase (`phaseId = null`) en vez de eliminarse.

---

## 6.2 Nombre

```text
name
```

- obligatorio;
- mismo nombre para Broco y cliente;
- no existe `internalName`;
- no existe `clientName`.

---

## 6.3 Descripción

```text
description?
```

- opcional;
- misma descripción para Broco y cliente;
- no existe `internalDescription`;
- no existe `clientDescription`.

---

## 6.4 Tipo

Enum:

```text
ProjectTaskType

TASK
MILESTONE
```

### TASK

Tarea normal con inicio y fin.

### MILESTONE

Representa un hito puntual.

Para simplificar almacenamiento:

```text
startDate = endDate
```

La UI debe mostrar solamente un selector de fecha cuando `type = MILESTONE`.

---

# 7. Estados

Enum:

```text
ProjectTaskStatus

TODO
IN_PROGRESS
TO_REVIEW
BLOCKED
DONE
```

Labels visibles:

```text
TO DO
IN PROGRESS
TO REVIEW
BLOCKED
DONE
```

No agregar más estados en V1.

---

# 8. Progreso

## 8.1 No almacenar porcentaje manual

No crear:

```text
progress
progressPercentage
completion
```

Nadie deberá introducir manualmente porcentajes de avance.

---

## 8.2 Avance general

El avance del proyecto se calcula automáticamente.

Fórmula:

```text
cantidad de TASK visibles y en DONE
──────────────────────────────────
cantidad total de TASK visibles
```

Los `MILESTONE` no participan del cálculo.

### Vista interna

Puede calcularse utilizando todas las tareas.

### Portal cliente

Debe calcularse exclusivamente con:

```text
clientVisible = true
```

### Caso sin tareas

No mostrar `0%` como si fuera progreso real.

Mostrar un estado neutro como:

```text
Sin tareas cargadas
```

---

# 9. Tiempo transcurrido

Debe calcularse utilizando:

```text
Project.startDate
Project.endDate
fecha actual
```

Conceptualmente:

```text
hoy - startDate
────────────────
endDate - startDate
```

El resultado debe acotarse entre 0% y 100%.

Casos:

- antes del inicio: `0%`;
- durante el proyecto: porcentaje correspondiente;
- después del fin: `100%`.

Si falta `startDate` o `endDate`, no mostrar la métrica.

---

# 10. Go Live

## 10.1 Campo

```text
Project.goLiveDate
```

Opcional.

---

## 10.2 Contador

Si existe, calcular dinámicamente la distancia respecto de hoy.

Ejemplos de presentación:

```text
Faltan 120 días
Faltan 7 días
Go Live mañana
Go Live hoy
Hace 5 días
```

No almacenar el contador en base de datos.

---

## 10.3 Gantt

La fecha Go Live debe aparecer visualmente dentro del cronograma como una referencia especial.

No crear una tarea automática en base de datos.

El componente del Gantt genera esta representación a partir de:

```text
project.goLiveDate
```

---

# 11. `clientVisible`

Campo:

```text
clientVisible Boolean @default(true)
```

## Decisión

Visible por defecto.

La transparencia es el comportamiento normal.

Sólo se desactiva manualmente cuando una tarea no aporta valor a la vista del cliente.

Ejemplo:

```text
Visible para el cliente
[x]
```

No crear sistemas de permisos por campo.

---

# 12. Gantt

## 12.1 Librería

Utilizar **Frappe Gantt** como motor base.

No desarrollar un motor de Gantt desde cero.

Sin embargo, Frappe debe estar encapsulado detrás de un componente propio:

```text
<ProjectGantt />
```

La aplicación no debe acoplar el dominio directamente a la API de Frappe.

---

## 12.2 Responsabilidades de `<ProjectGantt />`

Debe ocuparse de:

- transformar `ProjectTask` al formato requerido por Frappe;
- ordenar tareas;
- representar fases;
- representar milestones;
- representar Go Live;
- mostrar la línea nativa de hoy;
- aplicar estilos por estado;
- controlar view mode;
- tooltips;
- modo read-only;
- responsive;
- empty states.

---

## 12.3 Línea de hoy

Usar la funcionalidad nativa de Frappe.

No personalizar innecesariamente.

No es requisito que sea punteada.

Debe:

- ser claramente visible;
- mostrar la posición temporal actual;
- actualizarse automáticamente con la fecha;
- permitir volver a hoy mediante la navegación disponible.

Priorizar configuración nativa antes que CSS o extensiones propias.

---

# 13. Colores por estado

El Gantt debe comunicar estado mediante color.

Propuesta visual:

| Estado | Tratamiento |
|---|---|
| `TODO` | gris neutro |
| `IN_PROGRESS` | azul |
| `TO_REVIEW` | ámbar |
| `BLOCKED` | rojo |
| `DONE` | verde |

Estos colores son una guía semántica.

El diseño final debe utilizar tonos sobrios y profesionales.

Evitar:

- colores extremadamente saturados;
- apariencia de planilla Excel;
- demasiados colores simultáneos;
- decoraciones innecesarias.

Frappe permite asignar clases específicas a cada task. Utilizar esa capacidad.

---

# 14. Visualización de fases

El Gantt debe mostrar agrupación visual por `ProjectPhase`.

Ejemplo:

```text
RELEVAMIENTO
  Análisis inicial               █████████
  Validación                         █████

DISEÑO
  Diseño funcional                     ███████
  Revisión                                  ███

DESARROLLO
  Desarrollo                                █████████████

IMPLEMENTACIÓN
  Pruebas                                                █████
  Go Live                                                     ◆
```

El objetivo es evitar una lista plana difícil de leer.

No agregar funcionalidad compleja de collapse/expand si aumenta significativamente el alcance.

Puede evaluarse si Frappe o el wrapper lo permite de manera sencilla.

---

# 15. Experiencia interna

Ruta existente:

```text
/projects/[id]
```

Debe evolucionar para permitir dos áreas conceptuales:

```text
[ Resumen ] [ Planificación ]
```

## 15.1 Resumen

Mantener la información existente:

- cliente;
- fechas;
- notas;
- importes;
- movimientos;
- información financiera.

No rediseñar innecesariamente esta pantalla.

---

## 15.2 Planificación

Nueva vista.

Contenido recomendado:

```text
Proyecto
Planificación

[ + Nueva fase ] [ + Nueva tarea ]             [ Compartir ]

Avance                  Tiempo transcurrido          Go Live
42%                     37%                         Faltan 94 días


FASES Y TAREAS
...


CRONOGRAMA
[ Hoy ]                         [ Semana ] [ Mes ]

<Gantt />
```

El layout puede evolucionar durante implementación si mejora UX sin ampliar scope.

---

# 16. Gestión de fases

Acciones mínimas:

- crear;
- editar nombre;
- eliminar;
- ordenar.

No se necesita un módulo ABM independiente.

La gestión debe ocurrir dentro de la planificación del proyecto.

---

# 17. Gestión de tareas

Acciones mínimas:

- crear;
- editar;
- eliminar;
- cambiar estado;
- cambiar fase;
- cambiar fechas;
- cambiar visibilidad;
- ordenar.

---

## 17.1 Formulario de tarea

Campos:

```text
Nombre
Descripción

Fase

Tipo
- Tarea
- Hito

Fecha inicio
Fecha fin

Estado

Visible para el cliente
[x]
```

Para `MILESTONE`:

```text
Fecha
```

en vez de inicio + fin.

---

# 18. Validaciones

## Project

Si existen ambas:

```text
startDate <= endDate
```

Si existe `goLiveDate`, no imponer inicialmente que esté obligatoriamente dentro del rango del proyecto.

Se puede advertir visualmente si es inconsistente, pero no bloquear sin necesidad.

---

## ProjectTask

### TASK

Obligatorio:

```text
startDate
endDate
startDate <= endDate
```

### MILESTONE

Obligatorio:

```text
startDate = endDate
```

### Fase

Si `phaseId != null`:

```text
phase.projectId == task.projectId
```

Esta validación debe existir server-side.

---

# 19. `ProjectShareLink`

Nueva entidad.

Modelo conceptual:

```text
ProjectShareLink

id
projectId
tokenHash

createdAt
revokedAt?
```

## Reglas V1

- un proyecto necesita como máximo un link activo;
- puede regenerarse;
- puede desactivarse;
- regenerar invalida el anterior;
- el token real no debe almacenarse en texto plano;
- almacenar hash criptográfico del token.

No agregar expiración obligatoria en V1.

---

# 20. Portal del cliente

Ruta:

```text
/p/[token]
```

Debe ser una experiencia visual independiente.

No mostrar el shell interno de Broco Finance.

No mostrar:

- sidebar;
- Dashboard;
- Clientes;
- Ingresos;
- Gastos;
- navegación interna;
- información financiera;
- botones de edición.

---

# 21. Seguridad del portal

## Regla principal

El portal debe cargar exclusivamente información permitida.

No utilizar el servicio interno completo del proyecto y luego esconder campos financieros en frontend.

Crear un servicio específico, conceptualmente:

```text
getSharedProjectPlan(token)
```

---

## Datos permitidos

### Project

```text
id
name
startDate
endDate
goLiveDate
updatedAt
```

### Client

```text
name
```

### ProjectPhase

```text
id
name
position
```

### ProjectTask

```text
id
phaseId
name
description
type
startDate
endDate
status
position
```

Filtrar:

```text
clientVisible = true
```

No cargar:

- incomes;
- expenses;
- montos;
- cotizaciones;
- información económica;
- notas financieras.

---

# 22. Middleware y autenticación

Broco Finance actualmente utiliza autenticación global mediante cookie.

La nueva ruta:

```text
/p/*
```

debe quedar fuera del login interno.

Esto no significa que el proyecto sea público.

El token funciona como credencial.

Flujo:

```text
/p/[token]
   ↓
hash(token)
   ↓
ProjectShareLink activo
   ↓
Project
   ↓
datos públicos permitidos
```

Token inválido o revocado:

- no revelar si el proyecto existe;
- mostrar una pantalla genérica de enlace inválido/no disponible.

---

# 23. App Shell

Actualmente el shell interno se utiliza prácticamente para toda la aplicación excepto login.

Modificar la lógica para que:

```text
/login
/p/*
```

no utilicen:

- Sidebar;
- Header interno;
- navegación financiera.

Idealmente separar layouts de Next.js si hacerlo resulta limpio.

Preferir una estructura mantenible antes que múltiples condicionales dispersos por pathname.

---

# 24. Diseño visual del portal

La calidad visual del portal es parte del MVP.

No debe tratarse como una pantalla administrativa secundaria.

Debe sentirse como una pequeña aplicación de seguimiento de proyecto creada por Broco Solutions para su cliente.

---

## 24.1 Jerarquía sugerida

```text
BROCO SOLUTIONS

Nombre del proyecto
Cliente

Fecha inicio — Fecha fin

[Métrica]     [Métrica]       [Métrica]
Avance        Tiempo          Go Live

Cronograma

[Gantt]
```

---

## 24.2 Métricas

Mostrar únicamente las disponibles.

Ejemplo:

```text
42%
Avance completado
```

```text
37%
Tiempo transcurrido
```

```text
94 días
Para Go Live
```

No llenar la pantalla con KPIs innecesarios.

---

## 24.3 Actualización

Puede mostrarse:

```text
Actualizado: 1 de septiembre de 2026
```

usando la actualización relevante del proyecto o de la planificación.

No implementar historial de actualizaciones en V1.

---

## 24.4 Branding inicial

V1:

- Broco Solutions;
- nombre del cliente;
- nombre del proyecto.

No agregar todavía configuración visual por cliente.

Diseñar el layout de modo que posteriormente sea simple incorporar:

- logo del cliente;
- color/acento;
- cover;
- nombre comercial.

---

# 25. Responsive

El Gantt es intrínsecamente horizontal.

No intentar comprimir toda la línea temporal dentro de una pantalla móvil.

Comportamiento esperado:

### Desktop

Experiencia completa.

### Tablet

Experiencia completa con scroll horizontal cuando sea necesario.

### Mobile

- cabecera responsive;
- métricas apiladas;
- controles accesibles;
- Gantt con scroll horizontal claro;
- mantener nombres legibles;
- no deformar barras ni escalas.

Desktop es prioritario, pero mobile no puede quedar roto.

---

# 26. Empty states

Diseñar estados vacíos explícitos.

## Sin planificación

```text
Este proyecto todavía no tiene planificación cargada.

Creá una fase o una tarea para comenzar.
```

## Cliente sin tareas visibles

No revelar que existen tareas ocultas.

Mostrar:

```text
El cronograma de este proyecto todavía no está disponible.
```

---

# 27. Loading y errores

Incluir:

- loading de planificación;
- loading de portal;
- error al guardar;
- enlace inválido;
- enlace revocado;
- error inesperado.

Evitar pantallas en blanco.

---

# 28. Arquitectura actual a respetar

Broco Finance utiliza actualmente:

- Next.js App Router;
- React;
- TypeScript;
- Prisma;
- PostgreSQL;
- Server Actions;
- servicios server-side dentro del mismo proyecto;
- Vercel.

No introducir otro backend.

Mantener:

```text
Next.js
   ↓
Server Components / Server Actions
   ↓
Services
   ↓
Prisma
   ↓
PostgreSQL
```

---

# 29. Paths actuales relevantes

Revisados previamente:

```text
prisma/schema.prisma

src/app/projects/[id]/page.tsx
src/app/projects/actions.ts

src/server/services/projects.ts

src/lib/auth.ts
src/middleware.ts

src/components/layout/app-shell.tsx
src/components/layout/navigation-config.ts

src/app/globals.css

package.json
```

Estos paths son referencias para implementar, no una obligación de concentrar toda la nueva funcionalidad allí.

---

# 30. Estructura sugerida de nuevos archivos

La implementación puede ajustarla si encuentra una estructura más coherente.

Orientativamente:

```text
src/app/projects/[id]/
  page.tsx
  planning/
    project-planning.tsx
    phase-form-modal.tsx
    task-form-modal.tsx
    actions.ts

src/components/projects/
  project-gantt.tsx
  project-metrics.tsx
  task-status-badge.tsx

src/server/services/
  project-planning.ts
  project-sharing.ts

src/app/p/[token]/
  page.tsx
  project-portal.tsx

src/lib/
  project-progress.ts
  project-dates.ts
```

No crear capas artificiales si no aportan valor.

---

# 31. Limpieza del intento anterior de Kanban

Hubo un intento histórico de Kanban.

No recuperarlo.

No utilizarlo como base para esta funcionalidad.

---

## 31.1 Migraciones

Existe una migración histórica que creó tablas de Kanban.

Una migración posterior ya las eliminó.

**No eliminar migraciones históricas que pudieron haber sido aplicadas en producción.**

Mantener historial Prisma.

---

## 31.2 Código muerto

Buscar y eliminar, si existen:

- componentes Kanban;
- servicios Kanban;
- tipos Kanban;
- imports Kanban;
- documentación obsoleta;
- tests Kanban.

---

## 31.3 Dependencias

`package.json` contiene actualmente dependencias `@dnd-kit`.

Antes de eliminarlas:

1. buscar todos sus usos;
2. confirmar que ningún código activo depende de ellas;
3. si sólo pertenecían al Kanban fallido, eliminarlas;
4. actualizar lockfile;
5. ejecutar tests/build.

---

# 32. Frappe Gantt

Agregar la dependencia siguiendo la documentación oficial vigente al momento de implementar.

No copiar internamente el código de la librería.

Crear adapter/wrapper.

---

## 32.1 Transformación

Conceptualmente:

```text
ProjectTask
   ↓
mapProjectTaskToGanttTask()
   ↓
Frappe Task
```

El dominio no debe almacenar propiedades específicas de Frappe como:

```text
custom_class
dependencies
progress
```

si no son parte real del modelo.

`custom_class` se calcula en el adapter según `status`.

---

# 33. Estados visuales del Gantt

Mapping conceptual:

```text
TODO         → status-todo
IN_PROGRESS  → status-in-progress
TO_REVIEW    → status-to-review
BLOCKED      → status-blocked
DONE         → status-done
```

El CSS correspondiente pertenece al componente/adaptador visual, no al dominio.

---

# 34. Read-only

## Portal cliente

El Gantt debe ser estrictamente read-only.

El cliente no puede:

- mover barras;
- cambiar fechas;
- editar progreso;
- cambiar estado;
- crear tareas;
- borrar tareas.

---

## Vista interna

Para V1 tampoco es obligatorio editar arrastrando barras en el Gantt.

Puede mantenerse read-only visualmente y realizar cambios mediante formularios.

Esto reduce errores y complejidad.

Si Frappe permite edición sencilla y segura, puede evaluarse posteriormente, pero no es criterio de aceptación.

---

# 35. Escalas temporales

Mantener pocas opciones.

Preferencia V1:

```text
Semana
Mes
```

Agregar `Día` solamente si aporta valor real y viene prácticamente gratis.

No llenar la interfaz con:

- Quarter;
- Year;
- Hour;
- Half Day;
- configuraciones avanzadas.

Debe existir una acción simple para volver a hoy.

---

# 36. Ordenamiento

## Fases

`position`.

## Tareas

`position`.

No implementar drag & drop si complica significativamente el MVP.

Puede existir inicialmente ordenamiento mediante:

- botones subir/bajar;
- orden al crear;
- edición simple.

Si drag & drop ya resulta trivial con componentes existentes, puede utilizarse, pero no debe convertirse en un subproyecto.

---

# 37. Eliminaciones

## Proyecto

Mantener reglas financieras existentes.

Si se permite eliminar un Project sin movimientos y contiene planificación, las fases/tareas/share links deben eliminarse por cascada.

---

## Fase

Preferencia:

```text
onDelete: SetNull
```

para `ProjectTask.phaseId`.

No eliminar tareas al borrar una fase.

---

## Tarea

Puede eliminarse directamente después de confirmación.

No implementar papelera.

---

# 38. Share link UX interno

Dentro de Planificación:

```text
[ Compartir con cliente ]
```

Estados posibles:

## Sin link activo

```text
Generar enlace
```

## Con link activo

```text
Copiar enlace
Regenerar enlace
Desactivar enlace
```

No hace falta historial de links.

---

# 39. Portal URL

Formato conceptual:

```text
https://<dominio>/p/<token>
```

El token debe:

- ser criptográficamente aleatorio;
- tener suficiente entropía;
- no ser un UUID de proyecto;
- no exponer `projectId`.

---

# 40. Seguridad mínima

- token aleatorio;
- hash en DB;
- comparación segura;
- sólo share links no revocados;
- queries con whitelist explícita;
- no incluir datos financieros;
- no incluir IDs innecesarios en HTML si pueden evitarse;
- no indexar portal en buscadores.

Agregar:

```text
noindex
nofollow
```

al portal.

---

# 41. SEO / metadata

El portal no debe aparecer en Google.

Utilizar metadata apropiada:

```text
robots:
  index: false
  follow: false
```

El título puede ser:

```text
<Proyecto> | Broco Solutions
```

---

# 42. Accesibilidad

Mínimos:

- contraste adecuado;
- estados no comunicados únicamente por color;
- badges con texto;
- botones con labels;
- navegación por teclado en formularios;
- tooltips no esenciales para comprender información crítica.

---

# 43. Tests

Agregar tests donde aporten valor real.

Prioridades:

## Dominio

- validación fechas;
- milestones;
- cálculo progreso;
- cálculo tiempo transcurrido;
- cálculo Go Live.

## Servicios

- crear fase;
- crear tarea;
- fase de otro proyecto rechazada;
- filtro `clientVisible`;
- share link válido;
- share link revocado;
- portal no devuelve información financiera.

## Integración

- proyecto con planificación;
- eliminación de fase mantiene tarea sin fase;
- share link regenerado invalida anterior.

No hace falta testear internamente Frappe Gantt.

---

# 44. Calidad

Antes de cerrar implementación:

- lint;
- typecheck;
- tests;
- build;
- Prisma generate;
- revisar migration;
- QA visual desktop;
- QA visual mobile;
- verificar portal sin autenticación interna;
- verificar que rutas financieras siguen protegidas;
- verificar token inválido;
- verificar enlace revocado.

---

# 45. Etapas de implementación

## Etapa 0 — Verificación previa

Antes de editar:

1. revisar estado actual del repositorio;
2. confirmar branch;
3. revisar migraciones existentes;
4. buscar residuos de Kanban;
5. buscar usos de `@dnd-kit`;
6. revisar tests existentes;
7. revisar estructura UI actual.

No modificar todavía comportamiento financiero.

---

## Etapa 1 — Limpieza

- eliminar código muerto del Kanban;
- eliminar dependencias exclusivamente Kanban si corresponde;
- mantener migraciones históricas;
- confirmar build verde.

Commit sugerido:

```text
chore: remove obsolete kanban code
```

---

## Etapa 2 — Prisma / dominio

Agregar:

- `Project.goLiveDate`;
- `ProjectPhase`;
- `ProjectTask`;
- enums;
- `ProjectShareLink`;
- relaciones;
- índices;
- defaults;
- cascadas.

Crear nueva migración.

No editar migraciones históricas.

Commit sugerido:

```text
feat: add project planning data model
```

---

## Etapa 3 — Servicios

Implementar:

- fases;
- tareas;
- share links;
- cálculos;
- query pública segura.

Commit sugerido:

```text
feat: add project planning services
```

---

## Etapa 4 — Planificación interna

Implementar:

- tabs/secciones;
- fases;
- tasks;
- formularios;
- estados;
- métricas;
- Go Live.

Commit sugerido:

```text
feat: add project planning interface
```

---

## Etapa 5 — Gantt

- instalar Frappe;
- crear adapter;
- `<ProjectGantt>`;
- estados visuales;
- milestones;
- Go Live;
- hoy;
- escalas.

Commit sugerido:

```text
feat: add project gantt view
```

---

## Etapa 6 — Share links

- generar;
- copiar;
- regenerar;
- revocar;
- seguridad.

Commit sugerido:

```text
feat: add project share links
```

---

## Etapa 7 — Portal cliente

- ruta pública;
- layout;
- métricas;
- Gantt;
- loading;
- errores;
- noindex;
- responsive.

Commit sugerido:

```text
feat: add client project portal
```

---

## Etapa 8 — Pulido y QA

- UX;
- spacing;
- tipografía;
- responsive;
- accesibilidad;
- tests;
- build;
- regresiones.

Commit sugerido:

```text
chore: polish project planning experience
```

---

# 46. Criterios de aceptación V1

La funcionalidad se considera terminada cuando se cumplen todos los siguientes puntos.

## Proyecto

- [ ] un proyecto existente puede tener `goLiveDate`;
- [ ] no se rompe ninguna funcionalidad financiera existente.

## Fases

- [ ] se puede crear una fase;
- [ ] editarla;
- [ ] eliminarla;
- [ ] ordenarla;
- [ ] una tarea puede estar sin fase.

## Tareas

- [ ] crear;
- [ ] editar;
- [ ] eliminar;
- [ ] TASK;
- [ ] MILESTONE;
- [ ] fechas válidas;
- [ ] cinco estados;
- [ ] `clientVisible=true` por defecto;
- [ ] orden visual.

## Métricas

- [ ] avance automático;
- [ ] milestones excluidos del avance;
- [ ] tiempo transcurrido;
- [ ] contador Go Live;
- [ ] manejo correcto de fechas futuras/pasadas.

## Gantt

- [ ] renderiza tareas;
- [ ] renderiza milestones;
- [ ] agrupa visualmente fases;
- [ ] muestra hoy;
- [ ] permite volver a hoy;
- [ ] colorea según estado;
- [ ] muestra Go Live si existe;
- [ ] funciona en desktop;
- [ ] es utilizable en mobile con scroll horizontal.

## Sharing

- [ ] genera token;
- [ ] almacena hash;
- [ ] copia link;
- [ ] regenera;
- [ ] revoca;
- [ ] token inválido no revela información.

## Portal

- [ ] funciona sin login interno;
- [ ] sólo muestra un proyecto;
- [ ] muestra cliente;
- [ ] muestra fechas;
- [ ] muestra métricas;
- [ ] muestra Gantt;
- [ ] sólo incluye `clientVisible=true`;
- [ ] no permite editar;
- [ ] no muestra finanzas;
- [ ] no usa Sidebar;
- [ ] no usa navegación interna;
- [ ] tiene diseño profesional;
- [ ] tiene `noindex`.

## Calidad

- [ ] tests verdes;
- [ ] lint verde;
- [ ] typecheck verde;
- [ ] build verde;
- [ ] migration revisada;
- [ ] QA visual aprobado.

---

# 47. Decisiones explícitamente cerradas

No reabrir durante implementación salvo problema técnico real:

1. se integra en Broco Finance;
2. no hay segunda app;
3. no hay backend separado;
4. no hay Kanban;
5. no hay porcentajes manuales;
6. cinco estados;
7. `clientVisible=true`;
8. un único nombre;
9. una única descripción;
10. fases simples;
11. milestone como tipo de task;
12. `goLiveDate` pertenece a Project;
13. Go Live no crea una task ficticia;
14. Frappe Gantt;
15. utilizar la línea de hoy nativa;
16. colores según status;
17. portal read-only;
18. acceso mediante token;
19. sin usuarios cliente en V1;
20. sin branding por cliente en V1;
21. calidad visual del portal forma parte del MVP.

---

# 48. Reglas para el agente que implemente

Antes de comenzar:

1. leer este documento completo;
2. inspeccionar el código actual;
3. no asumir que paths o implementaciones actuales siguen exactamente iguales;
4. no ampliar el alcance;
5. preservar funcionalidad financiera;
6. no modificar migraciones históricas;
7. no ejecutar cambios destructivos contra producción;
8. crear nuevas migraciones;
9. mantener convenciones existentes del repo;
10. ejecutar tests/build en cada etapa relevante.

Si encuentra una contradicción entre este plan y el código actual:

- priorizar seguridad e integridad de datos;
- documentar el conflicto;
- elegir la solución mínima compatible con el objetivo;
- no introducir arquitectura nueva innecesaria.

---

# 49. Resultado esperado

Broco Finance deja de ser únicamente una herramienta financiera y comienza a consolidar el proyecto como entidad transversal del negocio.

La V1 debe permitir que Broco:

1. abra un proyecto existente;
2. cargue su planificación;
3. mantenga estados simples;
4. vea un Gantt claro;
5. comprenda rápidamente avance vs tiempo;
6. conozca cuánto falta para Go Live;
7. comparta un enlace con el cliente;
8. permita que el cliente consulte el avance sin acceder a ningún dato financiero.

El resultado debe sentirse simple internamente y profesional externamente.

---

# 50. No implementar todavía

Para evitar scope creep, dejar explícitamente para futuras versiones:

```text
Kanban
Dependencias
Critical path
Baseline
Responsables
Horas
Prioridades
Subtareas
Comentarios
Archivos
Notificaciones
Usuarios cliente
Roles
Permisos avanzados
Branding cliente
Logos cliente
Automatizaciones
IA
Reportes avanzados
```

Estas funcionalidades sólo deben incorporarse si el uso real de la V1 demuestra que son necesarias.

---

**Fin del plan V1.**
