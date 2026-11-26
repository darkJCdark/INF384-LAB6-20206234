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

1. Verificar que el `Content-Type` es `application/json`.
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
| `aprobados` | `Array<string>` | Obligatorio. Máximo 100 elementos. Cada elemento debe cumplir `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$`. |

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
| 1 | Cuerpo ausente (sin body) | 400 | `{"error":"aprobados debe ser un arreglo"}` | `express.json()` deja `req.body` como `undefined`; la validación de tipo ya cubre este caso sin lógica adicional. |
| 2 | JSON mal formado | 400 | `{"error":"el cuerpo debe ser JSON válido"}` | `express.json()` lanza un `SyntaxError` con `status 400`; el middleware de error lo intercepta antes del manejador genérico 500, diferenciando error de cliente de error de servidor. |
| 3 | `Content-Type` distinto de `application/json` | 400 | `{"error":"Content-Type debe ser application/json"}` | Sin `Content-Type: application/json`, `express.json()` no parsea y `req.body` queda `undefined`; verificar el header antes de cualquier otra validación garantiza el mensaje correcto. |
| 4 | Campo `aprobados` ausente o no es arreglo | 400 | `{"error":"aprobados debe ser un arreglo"}` | Se rechaza antes de iterar para evitar excepciones en tiempo de ejecución. |
| 5 | Lista vacía `[]` | 200 | Arreglo con cursos sin prerrequisitos | Estado válido — estudiante en primer ciclo; Req 1.8 lo define explícitamente. |
| 6 | Elementos que no son texto o no cumplen la regex | 400 | `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` (sin reflejar el valor recibido) | Se evita la reflexión de entrada arbitraria en la respuesta para prevenir la exposición de payloads maliciosos. |
| 7 | Códigos en minúsculas o con espacios (p. ej. `"1inf25"`, `" 1INF25"`) | 400 | Mismo mensaje que el caso anterior | No se normalizan; la regex es estricta para evitar ambigüedad. |
| 8 | Código con formato válido inexistente en el Repositorio | 200 | Resultado calculado ignorando el código desconocido | La malla puede cambiar; un código retirado no debe bloquear la consulta. Req 2.5. |
| 9 | Códigos duplicados en `aprobados` | 200 | Resultado calculado tras deduplicar | El estudiante no puede aprobar el mismo curso dos veces; duplicados no aportan información. Se dedupliccan con un `Set`; cuentan como 1 elemento para el límite de 100. |
| 10 | Más de 100 elementos (antes de deduplicar) | 400 | `{"error":"aprobados admite como máximo 100 códigos"}` | La verificación del límite ocurre sobre el arreglo recibido, antes de deduplicar, para ser O(1) y detectar abusos inmediatamente. |
| 11 | Cuerpo que supera 50 KB | 413 | `{"error":"el cuerpo supera el tamaño máximo permitido"}` | `express.json({ limit: '50kb' })` rechaza el cuerpo automáticamente; 50 KB es más de 1000 veces el tamaño máximo esperado (100 códigos × ~8 bytes), por lo que no afecta el uso legítimo. |
| 12 | Códigos en `aprobados` que no cumplen sus propios prerrequisitos (inconsistencia académica) | 200 | Resultado calculado tal como se declaró | El endpoint responde qué está habilitado dado lo declarado; no es responsable de auditar si la lista es académicamente posible. |
| 13 | Orden de los cursos en la respuesta | — | Orden de inserción del `Map` del Repositorio | Orden estable y determinista sin coste adicional. Los clientes no deben depender del orden, pero la respuesta debe ser reproducible. |

## Orden de validaciones

El siguiente orden es obligatorio. Cada paso define qué se verifica, el error que se emite y por qué ese orden es el correcto.

| Paso | Qué se verifica | Error emitido | Razón |
|---|---|---|---|
| 1 | `Content-Type: application/json` presente | 400 `{"error":"Content-Type debe ser application/json"}` | Si no es JSON, `express.json()` no parsea; verificar primero evita confusión en el mensaje de error. |
| 2 | Parseo del JSON por `express.json()` | 400 `{"error":"el cuerpo debe ser JSON válido"}` si lanza `SyntaxError` | Diferencia error de cliente de error de servidor antes de cualquier lógica de negocio. |
| 3 | Tamaño del cuerpo | 413 `{"error":"el cuerpo supera el tamaño máximo permitido"}` si supera 50 KB | `express.json({ limit: '50kb' })` lo hace automáticamente; el middleware de error captura el 413. |
| 4 | `aprobados` presente y es arreglo | 400 `{"error":"aprobados debe ser un arreglo"}` | Necesario antes de iterar. |
| 5 | Longitud ≤ 100 | 400 `{"error":"aprobados admite como máximo 100 códigos"}` | Verificación O(1) sobre el arreglo recibido, antes de iterar sobre los elementos. |
| 6 | Cada elemento es cadena que cumple la regex | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` | Una sola pasada, falla rápido al primer elemento inválido. |
| 7 | Deduplicar con `Set` | — | Los duplicados no aportan; operación O(n). |
| 8 | Calcular habilitados consultando el Repositorio | — | Lógica de negocio; solo se ejecuta si todas las validaciones pasaron. |

## Error Handling

### Estrategia de manejo de errores

El middleware de error centralizado en `src/app.js` debe distinguir tres categorías de error. El middleware actual responde 500 a todo; es necesario ampliarlo para interceptar los errores de cliente antes.

**Middleware resultante (pseudocódigo):**

```
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: 'el cuerpo debe ser JSON válido' });
  }
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'el cuerpo supera el tamaño máximo permitido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'error interno' });
});
```

**Decisiones de diseño:**

- El bloque `SyntaxError` intercepta únicamente los errores de parseo de JSON lanzados por `express.json()`, que llevan `status: 400`. Un `SyntaxError` de otro origen no tiene `status: 400` y cae al bloque genérico 500.
- El bloque 413 intercepta tanto `err.status === 413` como `err.type === 'entity.too.large'` para cubrir distintas versiones de la biblioteca `body-parser` subyacente.
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

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables automáticamente.*

Del análisis de los criterios de aceptación se identificaron las siguientes propiedades universales susceptibles de verificación mediante pruebas basadas en propiedades.

### Property 1: Inclusión correcta de cursos habilitados

*Para cualquier* conjunto de códigos aprobados válidos, todo curso del repositorio que no figure en dicho conjunto y cuyos requisitos previos estén todos contenidos en él debe aparecer en la respuesta.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Exclusión de cursos ya aprobados

*Para cualquier* conjunto de códigos aprobados válidos, ningún curso cuyo `id` figure en dicho conjunto debe aparecer en la respuesta.

**Validates: Requirements 1.6**

### Property 3: Exclusión de cursos con prerrequisitos no satisfechos

*Para cualquier* conjunto de códigos aprobados válidos, ningún curso cuyo arreglo de requisitos previos contenga al menos un elemento no presente en dicho conjunto debe aparecer en la respuesta.

**Validates: Requirements 1.7**

### Property 4: Estructura de cada objeto en la respuesta

*Para cualquier* conjunto de códigos aprobados válidos, cada objeto del arreglo respuesta debe contener exactamente los campos `id`, `name`, `credits`, `cycle` y `type`, y no debe contener el campo `prerequisites`.

**Validates: Requirements 1.9**

### Property 5: Rechazo de cualquier valor no-arreglo en `aprobados`

*Para cualquier* valor que no sea un arreglo (incluyendo `null`, cadenas, números, objetos y booleanos) asignado al campo `aprobados`, la respuesta debe ser 400 con el cuerpo `{"error":"aprobados debe ser un arreglo"}`.

**Validates: Requirements 2.3**

### Property 6: Rechazo de códigos con formato inválido sin reflejar el valor

*Para cualquier* cadena que no cumpla la expresión regular `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$` y sea enviada como elemento de `aprobados`, la respuesta debe ser 400 con el cuerpo `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` y el cuerpo de la respuesta no debe contener el valor enviado.

**Validates: Requirements 2.4**

### Property 7: Rechazo de arreglos con más de 100 elementos

*Para cualquier* arreglo `aprobados` cuya longitud sea estrictamente mayor que 100, la respuesta debe ser 400 con el cuerpo `{"error":"aprobados admite como máximo 100 códigos"}`.

**Validates: Requirements 3.1**

## Gates de integración continua

El pipeline de CI debe implementar tres gates que bloquean el merge cuando no se cumplen los criterios de calidad y seguridad definidos.

### Gate 1 — Análisis de composición de software (SCA)

- **Herramienta:** `npm audit --audit-level=high`
- **Umbral:** falla si existe al menos una vulnerabilidad de severidad alta o crítica.
- **Comportamiento:** bloquea el merge; no es solo un aviso.
- **Etapa:** en cada pull request hacia `main` y en cada push directo a `main`.
- **Razón del umbral:** las vulnerabilidades altas y críticas tienen exploits conocidos o impacto grave; las de severidad media o baja se aceptan con deuda técnica registrada.
- **Razón de la etapa:** detectar antes del merge reduce el coste de corrección; una vez que el código está en `main`, el remedio requiere un commit adicional.

### Gate 2 — Detección de secretos

- **Herramienta:** `gitleaks detect`
- **Modo de escaneo:** escaneo de commits nuevos en cada pull request (`--log-opts="origin/main..HEAD"`); escaneo completo del historial al crear el repositorio o manualmente cuando se sospecha una fuga.
- **Umbral:** falla si detecta al menos un secreto.
- **Comportamiento:** bloquea el merge.
- **Etapa:** en cada pull request hacia `main`.
- **Razón del modo incremental:** escanear solo commits nuevos mantiene el tiempo de ejecución bajo (menos de 5 s en PRs normales); el escaneo completo del historial se realiza una vez al configurar el repositorio.
- **Procedimiento si un secreto ya está en el historial:** rotar la clave de inmediato (invalidar el valor comprometido en el proveedor del secreto), luego registrar el hallazgo en `.gitleaksignore` con un comentario que indique que la clave fue rotada y la fecha. No se reescribe el historial de git porque una reescritura en repositorios con múltiples colaboradores genera conflictos graves y el secreto puede seguir presente en forks o cachés de CI.

### Gate 3 — Cobertura de líneas *(requisito de calidad)*

- **Herramienta:** Jest con `--coverage --coverageThreshold='{"global":{"lines":80}}'`
- **Umbral:** 80 % de líneas en el conjunto total de archivos del proyecto.
- **Comportamiento:** bloquea el merge.
- **Etapa:** en cada pull request hacia `main` y en cada push a `main`.
- **Razón del umbral:** la política de TI establece 80 %; cualquier PR que baje la cobertura por debajo de ese umbral no puede mergearse.
- **Razón de bloquear y no solo avisar:** un umbral que no bloquea no es un gate; la cobertura puede degradarse silenciosamente sin que nadie lo note hasta que el daño es acumulado.

## Testing Strategy

Las pruebas se organizan en dos archivos dentro de `tests/`:

- **`tests/habilitados.test.js`**: pruebas de integración HTTP con `supertest` para los requisitos 1 a 4.
- **`tests/repositorio.habilitados.test.js`**: pruebas unitarias y de propiedad para `repositorio.listarHabilitados`.

Se usa **fast-check** como biblioteca de pruebas basadas en propiedades (PBT). Cada prueba de propiedad se configura con al menos 100 iteraciones.

### Requisito 1 — Lógica de habilitados

| ID | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|
| T1.1 | Respuesta exitosa con entrada válida | `POST /habilitados` con `aprobados: ["1INF25","1INF27","1INF49"]` | 200, cuerpo es un arreglo JSON |
| T1.2 | Conteo exacto para entrada conocida | Misma entrada que T1.1 | La respuesta tiene exactamente 27 elementos |
| T1.3 | Cursos específicos presentes en la respuesta | Misma entrada que T1.1 | La respuesta incluye los IDs `1INF29`, `1INF30`, `1INF31`, `1INF32` |
| T1.4 | Curso con prerrequisitos satisfechos aparece | `aprobados: ["1INF25"]` | `1INF29` y `1INF30` están en la respuesta |
| T1.5 | Curso sin prerrequisitos aparece si no está aprobado | `aprobados: []` | `1GES92` (sin prerrequisitos) está en la respuesta |
| T1.6 | Curso aprobado no aparece en la respuesta | `aprobados: ["1INF25"]` | `1INF25` no está en la respuesta |
| T1.7 | Curso con prerrequisito insatisfecho no aparece | `aprobados: []` | `1INF29` (requiere `1INF25`) no está en la respuesta |
| T1.8 | Lista vacía devuelve solo cursos sin prerrequisitos | `aprobados: []` | Solo aparecen cursos con `prerequisites: []` en `cursos.json` |
| T1.9 | Estructura de cada objeto en la respuesta | `aprobados: ["1INF25","1INF27","1INF49"]` | Cada objeto tiene `id`, `name`, `credits`, `cycle`, `type`; no tiene `prerequisites` |

**Prueba de propiedad — Property 1, 2, 3 (combinada):**
*Feature: habilitados, Property 1, 2, 3: inclusión y exclusión de cursos habilitados*
Para cualquier subconjunto de IDs válidos del repositorio: todo curso en la respuesta tiene todos sus prerrequisitos en `aprobados` y no está en `aprobados`; y todo curso que cumple esa condición está en la respuesta.

**Prueba de propiedad — Property 4:**
*Feature: habilitados, Property 4: estructura de objetos en la respuesta*
Para cualquier subconjunto de IDs válidos, cada objeto de la respuesta tiene exactamente los campos `id`, `name`, `credits`, `cycle`, `type`.

### Requisito 2 — Validación de entrada

| ID | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|
| T2.1a | Campo `aprobados` ausente | `{}` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.1b | `aprobados` es una cadena | `{"aprobados":"1INF25"}` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.2 | `Content-Type` incorrecto | `Content-Type: text/plain` | 400 `{"error":"Content-Type debe ser application/json"}` |
| T2.3 | `aprobados` es `null` | `{"aprobados":null}` | 400 `{"error":"aprobados debe ser un arreglo"}` |
| T2.4a | Elemento con XSS | `{"aprobados":["1INF30<script>"]}` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`; cuerpo no contiene `<script>` |
| T2.4b | Elemento en minúsculas | `{"aprobados":["1inf25"]}` | 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` |
| T2.5 | Código válido inexistente | `{"aprobados":["XXXX99"]}` | 200, `XXXX99` ignorado |

**Prueba de propiedad — Property 5:**
*Feature: habilitados, Property 5: rechazo de aprobados no-arreglo*
Para cualquier valor no-arreglo en `aprobados` (null, string, número, objeto, booleano), la respuesta es 400 con el mensaje `"aprobados debe ser un arreglo"`.

**Prueba de propiedad — Property 6:**
*Feature: habilitados, Property 6: rechazo de códigos inválidos sin reflexión*
Para cualquier string que no cumpla la regex, la respuesta es 400 con el mensaje fijo y el cuerpo no contiene el valor enviado.

### Requisito 3 — Límite de entrada

| ID | Nombre del caso | Entrada | Resultado esperado |
|---|---|---|---|
| T3.1 | Arreglo de 101 elementos | 101 códigos con formato válido | 400 `{"error":"aprobados admite como máximo 100 códigos"}` |
| T3.2 | Arreglo de exactamente 100 elementos | 100 códigos con formato válido | 200 |
| T3.3 | Arreglo de 5000 elementos | 5000 códigos | 400 en menos de 1000 ms |

**Prueba de propiedad — Property 7:**
*Feature: habilitados, Property 7: rechazo de arreglos grandes*
Para cualquier arreglo de longitud n > 100, la respuesta es 400 `{"error":"aprobados admite como máximo 100 códigos"}`.

### Requisito 4 — Errores internos

| ID | Nombre del caso | Entrada / configuración | Resultado esperado |
|---|---|---|---|
| T4.1 | Error no controlado no expone stack trace | Mock de `repositorio.listarHabilitados` lanzando `new Error('fallo')` | 500 `{"error":"error interno"}`; cuerpo no contiene `stack`, rutas ni nombres de dependencias |
| T4.2 | Error no controlado registra en `console.error` | Mismo mock + spy de `console.error` | `console.error` fue llamado con el objeto de error |

### Configuración de cobertura

Para mantener el Gate 3 activo, `jest.config.js` debe declarar el umbral de cobertura:

```js
coverageThreshold: {
  global: { lines: 80 }
}
```

Los archivos nuevos `src/routes/habilitados.js` y la función `repositorio.listarHabilitados` deben estar cubiertos por las pruebas anteriores para no degradar el porcentaje global.
