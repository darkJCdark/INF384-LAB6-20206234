# Design Document

## Overview

Este documento describe el diseño del endpoint `POST /habilitados`, que calcula qué cursos de la malla de Ingeniería Informática están disponibles para cursar dado un conjunto de cursos ya aprobados por el estudiante.

Un curso está habilitado cuando cumple dos condiciones simultáneas: no figura en la lista de aprobados y todos sus requisitos previos están contenidos en dicha lista. Los cursos sin requisitos previos siempre cumplen la segunda condición y, por tanto, están habilitados salvo que el estudiante ya los haya aprobado.

El endpoint se integra a la API REST Node.js/Express existente y sigue los patrones ya establecidos: validación antes de la lógica de negocio, respuestas JSON uniformes y manejo centralizado de errores mediante el middleware de Express.

## Architecture

El endpoint sigue la arquitectura por capas ya presente en el proyecto:

```
Cliente HTTP
     │
     ▼
Middleware Express (express.json, límite 50 KB)
     │
     ▼
Middleware de verificación de Content-Type  ←─── nuevo, en src/routes/habilitados.js
     │
     ▼
Validador de entrada                         ←─── nuevo, lógica inline en la ruta
     │
     ▼
Lógica de habilitados                        ←─── nueva función en src/data/repositorio.js
     │
     ▼
Middleware de error (actualizado en src/app.js)
     │
     ▼
Respuesta JSON
```

Los componentes nuevos son:

- **`src/routes/habilitados.js`**: router Express con la ruta `POST /`, validación de entrada y llamada al repositorio.
- **`repositorio.listarHabilitados(aprobadosSet)`**: función pura que calcula los cursos habilitados dado un `Set` de códigos aprobados.
- **Actualización de `src/app.js`**: se monta el router en `/habilitados` y se amplía el middleware de error para distinguir 400, 413 y 500.

No se modifica la carga de datos ni la estructura de `data/cursos.json`.

## Components and Interfaces

### Router `src/routes/habilitados.js`

Expone un único endpoint:

```
POST /habilitados
Content-Type: application/json

Body: { "aprobados": [<código>, ...] }
```

**Responsabilidades:**

1. Verificar que el `Content-Type` es `application/json` revisando directamente el encabezado `req.headers['content-type']` (se admiten parámetros como `charset`). No se usa `req.is()`, porque sin cuerpo devuelve `null` y no distingue los casos 1 y 1b.
2. Delegar el parseo del JSON a `express.json()` (ya configurado en `app.js`).
3. Validar que `aprobados` existe, es un arreglo, no supera 100 elementos y cada elemento cumple la regex `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$`.
4. Deduplicar los códigos con un `Set`.
5. Llamar a `repositorio.listarHabilitados(aprobadosSet)`.
6. Devolver el resultado con estado 200.

**Contrato de respuesta exitosa:**

```json
[
  {
    "id": "1INF29",
    "name": "Sistemas Operativos",
    "credits": 2.5,
    "cycle": 6,
    "type": "obligatorio"
  }
]
```

El campo `prerequisites` no se incluye en la respuesta (igual que en `GET /cursos`).

### Función `repositorio.listarHabilitados(aprobadosSet)`

Recibe un `Set<string>` con los códigos aprobados (ya validados y deduplicados).

Devuelve un arreglo de objetos curso en el orden de inserción del `Map` interno del repositorio, filtrado por los cursos que cumplen:

- El `id` del curso no está en `aprobadosSet`.
- Todos los elementos de `prerequisites` del curso están en `aprobadosSet` (vacío incluido).

Los objetos devueltos incluyen únicamente los campos `id`, `name`, `credits`, `cycle` y `type`.

### Actualización de `src/app.js`

Se añade el montaje del router nuevo antes del middleware de error:

```
app.use('/habilitados', require('./routes/habilitados'));
```

Se amplía `express.json()` con límite de tamaño:

```
app.use(express.json({ limit: '50kb' }));
```

El middleware de error existente se actualiza (ver sección Error Handling).

## Data Models

### Entrada — cuerpo de la solicitud

| Campo | Tipo | Restricciones |
|---|---|---|
| `aprobados` | `Array<string>` | Obligatorio. Máximo 100 elementos (contados antes de deduplicar). Cada elemento debe cumplir `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$`. |

### Salida — elemento del arreglo respuesta

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único del curso (p. ej. `"1INF29"`). |
| `name` | `string` | Nombre del curso. |
| `credits` | `number` | Créditos del curso. |
| `cycle` | `number \| null` | Ciclo académico; `null` para cursos electivos sin ciclo fijo. |
| `type` | `string` | `"obligatorio"` o `"electivo"`. |

El campo `prerequisites` del modelo interno no se expone en la respuesta.

### Modelo interno del Repositorio (sin cambios)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Código único del curso. |
| `name` | `string` | Nombre. |
| `credits` | `number` | Créditos. |
| `cycle` | `number \| null` | Ciclo. |
| `type` | `string` | Tipo de curso. |
| `prerequisites` | `Array<string>` | Códigos de los cursos que son requisito previo. |

## Casos no definidos por la especificación

Los siguientes casos no están cubiertos explícitamente en los requisitos. La tabla define la respuesta exacta y la razón de cada decisión de diseño.

| # | Situación | Código HTTP | Cuerpo JSON | Razón de la decisión |
|---|---|---|---|---|
| 1 | Cuerpo ausente — con `Content-Type: application/json` | 400 | `{"error":"aprobados debe ser un arreglo"}` | El cliente declara JSON pero no envía `aprobados`; el mensaje le indica el dato que falta. |
| 1b | Cuerpo ausente — sin `Content-Type: application/json` | 400 | `{"error":"Content-Type debe ser application/json"}` | El router verifica el header antes de cualquier otra validación; las solicitudes sin ese header no llegan al validador de cuerpo. |
| 2 | JSON mal formado | 400 | `{"error":"el cuerpo debe ser JSON válido"}` | `express.json()` lanza un `SyntaxError` con `status 400`; el middleware de error lo intercepta antes del manejador genérico 500, diferenciando error de cliente de error de servidor. |
| 3 | `Content-Type` distinto de `application/json` | 400 | `{"error":"Content-Type debe ser application/json"}` | El router verifica el header antes de cualquier otra validación; las solicitudes sin ese header no pasan al validador de cuerpo. |
| 4 | Campo `aprobados` ausente o no es arreglo | 400 | `{"error":"aprobados debe ser un arreglo"}` | Se rechaza antes de iterar para evitar excepciones en tiempo de ejecución. |
| 5 | Lista vacía `[]` | 200 | Arreglo con cursos sin prerrequisitos | Estado válido — estudiante en primer ciclo; Req 1.8 lo define explícitamente. |
| 6 | Elementos que no son texto o no cumplen la regex | 400 | `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` (sin reflejar el valor recibido) | Se evita la reflexión de entrada arbitraria en la respuesta para prevenir la exposición de payloads maliciosos. |
| 7 | Códigos en minúsculas o con espacios (p. ej. `"1inf25"`, `" 1INF25"`) | 400 | Mismo mensaje que el caso anterior | No se normalizan; la regex es estricta para evitar ambigüedad. |
| 8 | Código con formato válido inexistente en el Repositorio | 200 | Resultado calculado ignorando el código desconocido | La malla puede cambiar; un código retirado no debe bloquear la consulta. Req 2.5. |
| 9 | Códigos duplicados en `aprobados` | 200 (si la longitud del arreglo recibido ≤ 100) | Resultado calculado tras deduplicar | Cada elemento recibido cuenta individualmente para el límite; la deduplicación con `Set` ocurre después de verificar que la longitud está dentro del límite. |
| 10 | Más de 100 elementos (antes de deduplicar) | 400 | `{"error":"aprobados admite como máximo 100 códigos"}` | Cada elemento recibido cuenta individualmente para el límite, incluidos los duplicados. La verificación ocurre sobre el arreglo recibido, antes de deduplicar. |
| 11 | Cuerpo que supera 50 KB | 413 | `{"error":"el cuerpo supera el tamaño máximo permitido"}` | El tamaño máximo es 50 KB. 100 códigos con el formato más largo (`1INF25`) y el overhead de JSON (`["1INF25",...]`) ocupan aproximadamente 915 bytes. 5000 códigos ocupan aproximadamente 45 KB, por debajo del límite, por lo que una lista de 5000 elementos llega al validador y recibe el 400 del Paso 5 (límite de 100 elementos), no el 413. El 413 se activa con cuerpos maliciosos que superen los 50 KB. Este código 413 amplía los códigos HTTP ya presentes en el proyecto (200, 400, 404, 500); se justifica porque la condición (cuerpo demasiado grande) es distinta de una entrada mal formada (400) y no es un error del servidor (500). |
| 12 | Códigos en `aprobados` que no cumplen sus propios prerrequisitos (inconsistencia académica) | 200 | Resultado calculado tal como se declaró | El endpoint responde qué está habilitado dado lo declarado; no es responsable de auditar si la lista es académicamente posible. |
| 13 | Orden de los cursos en la respuesta | — | Orden de inserción del `Map` del Repositorio | Orden estable y determinista sin coste adicional. Los clientes no deben depender del orden, pero la respuesta debe ser reproducible. |

## Orden de validaciones

El siguiente orden es obligatorio. Cada paso define qué se verifica, el error que se emite y por qué ese orden es el correcto.

| Paso | Qué se verifica | Error emitido | Razón |
|---|---|---|---|
| 1 | `Content-Type: application/json` presente | 400 `{"error":"Content-Type debe ser application/json"}` | El router verifica el header antes de cualquier otra lógica. Las solicitudes sin ese header no pasan al validador de cuerpo. |
| 2 | Tamaño del cuerpo | 413 `{"error":"el cuerpo supera el tamaño máximo permitido"}` | `express.json({ limit: '50kb' })` rechaza el cuerpo antes de intentar parsearlo si supera el límite. El middleware de error captura el 413. |
| 3 | Parseo del JSON | 400 `{"error":"el cuerpo debe ser JSON válido"}` si lanza `SyntaxError` | Solo para solicitudes con `Content-Type: application/json` que pasaron el paso 2. Diferencia error de cliente de error de servidor. |
| 4 | `aprobados` presente y es arreglo | 400 `{"error":"aprobados debe ser un arreglo"}` | Necesario antes de iterar. |
| 5 | Longitud ≤ 100 (sobre el arreglo recibido, antes de deduplicar) | 400 `{"error":"aprobados admite como máximo 100 códigos"}` | Verificación O(1); cada elemento recibido cuenta, incluidos los duplicados. |
| 6 | Cada elemento es cadena que cumple la regex `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` | Una sola pasada, falla rápido al primer elemento inválido. |
| 7 | Deduplicar con `Set` | — | Elimina duplicados antes del cálculo; operación O(n), solo se ejecuta si todos los elementos son válidos. |
| 8 | Calcular habilitados consultando el Repositorio | — | Lógica de negocio; solo se ejecuta si todas las validaciones pasaron. |

## Error Handling

### Estrategia de manejo de errores

El middleware de error centralizado en `src/app.js` debe distinguir tres categorías de error. El middleware actual responde 500 a todo; es necesario ampliarlo para interceptar los errores de cliente antes.

**Middleware resultante (pseudocódigo):**

```
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'el cuerpo debe ser JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'el cuerpo supera el tamaño máximo permitido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'error interno' });
});
```

**Decisiones de diseño:**

- Se distingue por `err.type`, que `body-parser` (usado por `express.json()`) asigna a sus errores: `entity.parse.failed` para JSON mal formado y `entity.too.large` para un cuerpo mayor al límite. Un error de otro origen no tiene ese tipo y cae al bloque genérico 500.
- El bloque genérico llama a `console.error(err)` antes de responder, cumpliendo el Req 4.2.
- El cuerpo de la respuesta de error nunca incluye el stack trace, rutas del sistema de archivos ni nombres de dependencias, cumpliendo el Req 4.1.
- Los endpoints GET existentes (`GET /cursos`, `GET /cursos/:codigo`, `GET /health`) no producen errores de parseo ni de tamaño; el comportamiento de esos endpoints no cambia.

### Tabla de errores del endpoint

| Situación | Código HTTP | Cuerpo |
|---|---|---|
| `Content-Type` incorrecto | 400 | `{"error":"Content-Type debe ser application/json"}` |
| JSON mal formado | 400 | `{"error":"el cuerpo debe ser JSON válido"}` |
| Cuerpo supera 50 KB | 413 | `{"error":"el cuerpo supera el tamaño máximo permitido"}` |
| `aprobados` ausente o no es arreglo | 400 | `{"error":"aprobados debe ser un arreglo"}` |
| Más de 100 elementos | 400 | `{"error":"aprobados admite como máximo 100 códigos"}` |
| Elemento con formato inválido | 400 | `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` |
| Error no controlado | 500 | `{"error":"error interno"}` |

## Gates de integración continua

El pipeline de CI debe implementar cuatro gates que bloquean el merge cuando no se cumplen los criterios de calidad y seguridad definidos.

### Gate 1 — Análisis de composición de software (SCA)

- **Herramienta:** `npm audit --audit-level=high` sobre todas las dependencias, incluidas las de desarrollo (`--include=dev` si la versión de npm lo requiere).
- **Umbral:** falla si existe al menos una vulnerabilidad de severidad alta o crítica. Las vulnerabilidades de severidad media o baja se muestran en el reporte pero no bloquean.
  - **Razón del umbral:** la política de TI prohíbe vulnerabilidades altas y críticas; no prohíbe las medias ni las bajas, por lo que bloquear en esos niveles sería más restrictivo que la política.
- **Bloquea o avisa:** bloquea el merge ante vulnerabilidades altas o críticas; solo reporta ante medias o bajas.
  - **Razón:** la política exige que no lleguen a `main` dependencias con vulnerabilidades altas o críticas, y un aviso no lo impediría. Las medias y bajas solo se reportan porque la política no las prohíbe.
- **Etapa:** en cada pull request hacia `main` y en cada push directo a `main`.
  - **Razón:** detectar antes del merge reduce el coste de corrección; correr también en push a `main` cubre los cambios directos que no pasan por un PR.

### Gate 2 — Detección de secretos

- **Herramienta:** `gitleaks` en la versión fijada `v8.24.3`, que incluye el comando `gitleaks git`.
- **Umbral:** falla si detecta al menos un hallazgo no registrado en `.gitleaksignore`.
  - **Razón del umbral:** la política exige que no haya ningún secreto en el repositorio; un hallazgo no registrado indica un secreto activo o no evaluado.
- **Bloquea o avisa:** bloquea el merge.
  - **Razón:** la política no admite ningún secreto; un aviso que no bloquea permite que el problema llegue a main.
- **Etapa:** en cada pull request hacia `main` y en cada push directo a `main`.
  - **Razón de la etapa:** en pull request el secreto se detecta antes de fusionar; en push a `main` se revisan también los cambios directos que no pasan por un pull request, aunque en ese caso la detección ocurre cuando el cambio ya llegó a `main`.
- **Modo de escaneo:** `fetch-depth: 0` en el checkout para clonar el historial completo, y `gitleaks git` para escanearlo en cada ejecución.
  - **Razón:** la política prohíbe cualquier secreto en el repositorio; un escaneo que solo cubra commits nuevos puede pasar por alto uno introducido anteriormente.
- **Procedimiento si un secreto ya está en el historial:** retirar el secreto del archivo que lo contenía, rotar la clave en el proveedor correspondiente (proceso externo al repositorio), y registrar únicamente el fingerprint exacto del hallazgo en `.gitleaksignore` con un comentario que indique el motivo y la fecha del registro. No se reescribe el historial de git.

### Gate 3 — Cobertura de líneas *(requisito de calidad)*

- **Herramienta:** Jest con `--coverage --coverageThreshold='{"global":{"lines":80}}'`.
- **Umbral:** 80 % de líneas en el conjunto total de archivos del proyecto.
  - **Razón del umbral:** la política de TI establece 80 % como mínimo; cualquier PR que baje la cobertura por debajo de ese umbral no puede mergearse.
- **Bloquea o avisa:** bloquea el merge.
  - **Razón:** un umbral que no bloquea no es un gate; la cobertura puede degradarse silenciosamente sin que nadie lo note hasta que el daño es acumulado.
- **Etapa:** en cada pull request hacia `main` y en cada push directo a `main`.
  - **Razón:** detectar antes del merge evita que código sin cobertura suficiente llegue a la rama principal; correr también en push a `main` cubre los cambios directos.

### Gate 4 — Análisis estático de seguridad (SAST) *(extra)*

- **Herramienta:** Semgrep `1.183.0` (imagen `semgrep/semgrep:1.183.0`, versión fijada) sobre `src/`.
- **Umbral:** falla con un solo hallazgo de las reglas propias de `.semgrep/reglas.yml`, todas de severidad ERROR: respuesta HTTP que incluye `err.stack` o `err.message` (hallazgo 2, criterio 4.1) y evaluación dinámica de código (`eval`, `new Function`).
  - **Razón del umbral:** son patrones de alta confianza ligados a los hallazgos del caso; cada coincidencia es un defecto real que se corrige en el mismo cambio, por lo que no se tolera ninguno.
- **Bloquea o avisa:** las reglas propias bloquean; el conjunto público `p/javascript` corre en un paso aparte que solo avisa (`continue-on-error`).
  - **Razón:** una regla genérica que aún no se calibró contra este código puede dar falsos positivos, y un bloqueo por ruido enseña a ignorar el gate. Entra como aviso y pasa a bloquear por acuerdo del equipo después de revisar sus resultados.
- **Etapa:** en cada pull request hacia `main` y en cada push a `main`.
  - **Razón:** el análisis es rápido, determinista y no necesita la aplicación desplegada, así que pertenece a CI; en pull request detecta antes de fusionar y en `main` cubre los cambios directos.
- **Alcance:** solo `src/`.
  - **Razón:** es el código que se despliega; las pruebas simulan a propósito errores con rutas internas y generarían falsos positivos.

> Un job fallido deja el run en rojo, pero para impedir la fusión de un pull request se requiere además una regla de protección de rama en GitHub que marque esos checks como obligatorios. Esa regla no afecta los cambios que llegan a `main` por medios que no pasen por ella (por ejemplo, pushes directos con permisos de administrador).

## Testing Strategy

Las pruebas se organizan en un archivo dentro de `tests/`:

- **`tests/habilitados.test.js`**: pruebas de integración HTTP con `supertest` para los requisitos 1 a 4.

La biblioteca de pruebas es Jest con supertest.

### Requisito 1 — Lógica de habilitados

| ID | Criterio | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|---|
| T1.1 | Req 1.1 | Respuesta exitosa con entrada válida | `POST /habilitados` con `aprobados: ["1INF25","1INF27","1INF49"]` | 200, cuerpo es un arreglo JSON |
| T1.2 | Req 1.2 | Conteo exacto para entrada conocida | Misma entrada que T1.1 | La respuesta tiene exactamente 27 elementos |
| T1.3 | Req 1.3 | Cursos específicos presentes | Misma entrada que T1.1 | La respuesta incluye los IDs `1INF29`, `1INF30`, `1INF31`, `1INF32` |
| T1.4 | Req 1.4 | Curso con prerrequisitos satisfechos aparece | `aprobados: ["1INF25"]` | `1INF29` y `1INF30` están en la respuesta |
| T1.5 | Req 1.5 | Curso sin prerrequisitos aparece si no está aprobado | `aprobados: []` | `1GES92` (sin prerrequisitos) está en la respuesta |
| T1.6 | Req 1.6 | Curso aprobado no aparece en la respuesta | `aprobados: ["1INF25"]` | `1INF25` no está en la respuesta |
| T1.7 | Req 1.7 | Curso con prerrequisito insatisfecho no aparece | `aprobados: []` | `1INF29` (requiere `1INF25`) no está en la respuesta |
| T1.8 | Req 1.8 | Lista vacía devuelve solo cursos sin prerrequisitos | `aprobados: []` | Solo aparecen cursos con `prerequisites: []` en `cursos.json` |
| T1.9 | Req 1.9 | Estructura de cada objeto en la respuesta | `aprobados: ["1INF25","1INF27","1INF49"]` | Cada objeto tiene `id`, `name`, `credits`, `cycle`, `type`; no tiene `prerequisites` |

### Requisito 2 — Validación de entrada

| ID | Criterio | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|---|
| T2.1 | Req 2.1 | JSON mal formado | Cuerpo `{aprobados:[` (JSON inválido), `Content-Type: application/json` | 400 `{"error":"el cuerpo debe ser JSON válido"}` |
| T2.2 | Req 2.2 | `Content-Type` incorrecto | `Content-Type: text/plain` con cuerpo válido | 400 `{"error":"Content-Type debe ser application/json"}` |
| T2.3a | Req 2.3 | `aprobados` es una cadena | `{"aprobados":"1INF25"}` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.3b | Req 2.3 | `aprobados` es `null` | `{"aprobados":null}` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.3c | Req 2.3 | Campo `aprobados` ausente | `{}`, `Content-Type: application/json` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.4a | Req 2.4 | Elemento con carácter no permitido | `{"aprobados":["1INF30<script>"]}` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`; cuerpo no contiene `<script>` |
| T2.4b | Req 2.4 | Elemento en minúsculas | `{"aprobados":["1inf25"]}` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` |
| T2.4c | Req 2.4 | Elemento del arreglo no es texto (número) | `{"aprobados":[1,2,3]}` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` |
| T2.5 | Req 2.5 | Código válido inexistente | `{"aprobados":["XXX999"]}` | 200; `XXX999` ignorado |
| T2.caso1 | Caso no definido 1 | Cuerpo ausente con `Content-Type` JSON | Sin cuerpo, `Content-Type: application/json` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.caso1b | Caso no definido 1b | Cuerpo ausente sin `Content-Type` | Sin cuerpo ni `Content-Type` | 400 `{"error":"Content-Type debe ser application/json"}` |

> Nota: `XXX999` cumple la expresión regular `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$` (rama `[A-Z]{3}[0-9]{3}`).

### Requisito 3 — Límite de entrada

| ID | Criterio | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|---|
| T3.1 | Req 3.1 | Arreglo de 101 elementos | 101 códigos con formato válido | 400 `{"error":"aprobados admite como máximo 100 códigos"}` |
| T3.2 | Req 3.2 | Arreglo de exactamente 100 elementos | 100 códigos con formato válido | 200 |
| T3.3 | Req 3.3 | Arreglo de 5000 elementos (tiempo de respuesta) | 5000 códigos con formato válido | 400 en menos de 1000 ms |
| T3.extra | — | Duplicados: longitud recibida cuenta antes de deduplicar | Arreglo de 101 elementos donde 10 son duplicados (101 recibidos, 91 únicos) | 400 `{"error":"aprobados admite como máximo 100 códigos"}` |
| T3.extra2 | — | Cuerpo superior a 50 KB | Cuerpo JSON de más de 50 KB | 413 `{"error":"el cuerpo supera el tamaño máximo permitido"}` |

### Requisito 4 — Errores internos

| ID | Criterio | Nombre del caso | Entrada / configuración | Resultado esperado |
|---|---|---|---|---|
| T4.1 | Req 4.1 | Error no controlado no expone stack trace | Mock de `repositorio.listarHabilitados` lanzando `new Error('fallo')` | 500 `{"error":"error interno"}`; cuerpo no contiene `stack`, rutas ni nombres de dependencias |
| T4.2 | Req 4.2 | Error no controlado registra en `console.error` | Mismo mock + spy de `console.error` | `console.error` fue llamado con el objeto de error |

### Configuración de cobertura

Para mantener el Gate 3 activo, `jest.config.js` debe declarar el umbral:

```js
coverageThreshold: {
  global: { lines: 80 }
}
```

Los archivos nuevos `src/routes/habilitados.js` y la función `repositorio.listarHabilitados` deben estar cubiertos por las pruebas anteriores para no degradar el porcentaje global.
