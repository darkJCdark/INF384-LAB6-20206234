# Implementation Plan: habilitados

## Overview

Plan de implementación para el endpoint `POST /habilitados`, que calcula qué cursos de la malla están disponibles dado un conjunto de cursos ya aprobados. El plan se divide en tres tareas: primero la lógica funcional básica con sus pruebas de camino feliz, luego las pruebas de validación y error en rojo, y finalmente la implementación completa de validaciones y manejo de errores.

## Tasks

- [x] 1. Implementar la lógica funcional de `POST /habilitados`
  - Agregar la función `listarHabilitados(aprobadosSet)` en `src/data/repositorio.js`. Recibe un `Set<string>` con los códigos aprobados. Devuelve los cursos del repositorio que cumplen: su `id` no está en `aprobadosSet` y todos sus `prerequisites` están en `aprobadosSet`. Cada objeto devuelto incluye solo los campos `id`, `name`, `credits`, `cycle` y `type`, en el orden de inserción del `Map` interno.
  - [x] 1.1 Agregar `listarHabilitados(aprobadosSet)` en `src/data/repositorio.js`
    - Iterar sobre `porCodigo.values()` y filtrar cursos cuyo `id` no esté en `aprobadosSet` y cuyos `prerequisites` estén todos en `aprobadosSet`
    - Devolver objetos con solo los campos `id`, `name`, `credits`, `cycle` y `type`
    - Exportar la función junto a las existentes
    - _Requisitos: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_
  - [x] 1.2 Crear `src/routes/habilitados.js` con la ruta `POST /` sin validaciones
    - Leer `req.body.aprobados` directamente, construir un `Set` con sus elementos
    - Llamar a `repositorio.listarHabilitados(aprobadosSet)` y responder 200 con el arreglo
    - No agregar ninguna validación de entrada en esta tarea
    - _Requisitos: 1.1_
  - [x] 1.3 Montar el router en `src/app.js`
    - Agregar `app.use('/habilitados', require('./routes/habilitados'))` antes del middleware de error existente
    - No modificar el middleware de error en esta tarea
    - _Requisitos: 1.1_
  - [x] 1.4 Crear `tests/habilitados.test.js` con las pruebas de los criterios 1.1 a 1.9 y 2.5
    - `1.1 responde 200 con un arreglo JSON para entrada válida` — `aprobados: ["1INF25","1INF27","1INF49"]` → 200, cuerpo es arreglo
    - `1.2 devuelve exactamente 27 cursos para la entrada de referencia` — misma entrada → 27 elementos
    - `1.3 incluye 1INF29, 1INF30, 1INF31 y 1INF32 para la entrada de referencia` — misma entrada → esos IDs presentes
    - `1.4 incluye un curso cuyo prereq está en aprobados y el curso no está aprobado` — `aprobados: ["1INF25"]` → `1INF29` y `1INF30` presentes
    - `1.5 incluye un curso sin prerrequisitos que no está aprobado` — `aprobados: []` → `1GES92` presente
    - `1.6 excluye un curso que está en aprobados` — `aprobados: ["1INF25"]` → `1INF25` ausente
    - `1.7 excluye un curso cuyo prereq no está en aprobados` — `aprobados: []` → `1INF29` ausente
    - `1.8 con lista vacía devuelve solo cursos sin prerrequisitos` — `aprobados: []` → solo cursos con `prerequisites: []`
    - `1.9 cada objeto de la respuesta tiene id, name, credits, cycle, type y no tiene prerequisites` — verificar estructura
    - `2.5 ignora un código con formato válido que no existe en el repositorio` — `aprobados: ["XXX999"]` → 200, `XXX999` ignorado
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.5_

- [x] 2. Escribir las pruebas de validación, límite y errores
  - Agregar en `tests/habilitados.test.js` las pruebas de los criterios 2.1 a 2.4, 3.1 a 3.3, 4.1 y 4.2, más los casos sin cuerpo (con y sin `Content-Type` correcto), duplicados sobre el límite y cuerpo mayor a 50 KB. No modificar nada en `src/`. Las pruebas de lo que aún no está implementado deben fallar: no omitirlas ni ajustarlas para que pasen.
  - [x] 2.1 Agregar pruebas de validación de JSON y Content-Type en `tests/habilitados.test.js`
    - `2.1a rechaza JSON mal formado con 400 y mensaje "el cuerpo debe ser JSON válido"` — cuerpo `{aprobados:[`, `Content-Type: application/json` → 400 `{"error":"el cuerpo debe ser JSON válido"}`
    - `2.1b rechaza body ausente con Content-Type correcto con 400 y mensaje "aprobados debe ser un arreglo"` — sin cuerpo, `Content-Type: application/json` → 400 `{"error":"aprobados debe ser un arreglo"}`
    - `2.2 rechaza Content-Type incorrecto con 400 y mensaje "Content-Type debe ser application/json"` — `Content-Type: text/plain` → 400 `{"error":"Content-Type debe ser application/json"}`
    - `2.2b rechaza body ausente sin Content-Type con 400 y mensaje "Content-Type debe ser application/json"` — sin cuerpo, sin `Content-Type` correcto → 400 `{"error":"Content-Type debe ser application/json"}`
    - _Requisitos: 2.1, 2.2_
  - [x] 2.2 Agregar pruebas de validación del campo `aprobados` en `tests/habilitados.test.js`
    - `2.3a rechaza aprobados como cadena con 400 y mensaje "aprobados debe ser un arreglo"` — `{"aprobados":"1INF25"}` → 400 `{"error":"aprobados debe ser un arreglo"}`
    - `2.3b rechaza aprobados null con 400 y mensaje "aprobados debe ser un arreglo"` — `{"aprobados":null}` → 400 `{"error":"aprobados debe ser un arreglo"}`
    - `2.3c rechaza elemento no-texto con 400 y mensaje de código inválido` — `{"aprobados":[1,2,3]}` → 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`
    - `2.4a rechaza elemento con caracteres no permitidos sin reflejar el valor` — `{"aprobados":["1INF30<script>"]}` → 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`, cuerpo no contiene `<script>`
    - `2.4b rechaza código en minúsculas` — `{"aprobados":["1inf25"]}` → 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`
    - _Requisitos: 2.3, 2.4_
  - [x] 2.3 Agregar pruebas de límite de entrada en `tests/habilitados.test.js`
    - `3.1 rechaza arreglo de 101 elementos con 400 y mensaje de límite` — 101 códigos válidos → 400 `{"error":"aprobados admite como máximo 100 códigos"}`
    - `3.2 acepta exactamente 100 elementos válidos con 200` — 100 códigos válidos → 200
    - `3.3 responde 400 en menos de 1000 ms para un arreglo de 5000 elementos` — 5000 códigos → 400 en < 1000 ms
    - `3.extra duplicados sobre el límite: 101 recibidos con 10 duplicados reciben 400` — arreglo de 101 elementos (10 duplicados, 91 únicos) → 400 `{"error":"aprobados admite como máximo 100 códigos"}`
    - `3.extra2 rechaza cuerpo mayor a 50 KB con 413` — cuerpo JSON > 50 KB → 413 `{"error":"el cuerpo supera el tamaño máximo permitido"}`
    - _Requisitos: 3.1, 3.2, 3.3_
  - [x] 2.4 Agregar pruebas de errores internos en `tests/habilitados.test.js`
    - `4.1 error no controlado responde 500 sin stack trace` — mock de `repositorio.listarHabilitados` lanzando `new Error('fallo')` → 500 `{"error":"error interno"}`, cuerpo no contiene `stack`, rutas ni nombres de dependencias
    - `4.2 error no controlado llama a console.error con el error` — mismo mock + spy de `console.error` → `console.error` llamado con el error
    - _Requisitos: 4.1, 4.2_
  - [x] 2.5 Ejecutar `npx jest tests/habilitados.test.js --no-coverage` e informar los nombres exactos de las pruebas que fallan (expected) y las que ya pasan
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 3. Implementar validaciones de entrada, límite de 50 KB y manejo de errores
  - Modificar `src/routes/habilitados.js`, `src/app.js` y `src/data/repositorio.js` según el diseño en `design.md` para que todas las pruebas del archivo `tests/habilitados.test.js` pasen. No debilitar ni eliminar pruebas.
  - [x] 3.1 Actualizar `app.use(express.json())` a `app.use(express.json({ limit: '50kb' }))` en `src/app.js`
    - _Requisitos: 3.1_
  - [x] 3.2 Ampliar el middleware de error en `src/app.js`
    - Interceptar `SyntaxError` con `err.status === 400` → responder 400 `{"error":"el cuerpo debe ser JSON válido"}`
    - Interceptar `err.status === 413 || err.type === 'entity.too.large'` → responder 413 `{"error":"el cuerpo supera el tamaño máximo permitido"}`
    - Para cualquier otro error: llamar `console.error(err)` y responder 500 `{"error":"error interno"}`
    - _Requisitos: 2.1, 4.1, 4.2_
  - [x] 3.3 Agregar las validaciones en `src/routes/habilitados.js` en el orden exacto del diseño
    - Paso 1: verificar `Content-Type: application/json` revisando `req.headers['content-type']`; si no → 400 `{"error":"Content-Type debe ser application/json"}`
    - Paso 2: verificar que `req.body.aprobados` existe y es arreglo; si no → 400 `{"error":"aprobados debe ser un arreglo"}`
    - Paso 3: verificar que `req.body.aprobados.length <= 100`; si no → 400 `{"error":"aprobados admite como máximo 100 códigos"}`
    - Paso 4: verificar que cada elemento es cadena que cumple `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$`; si no → 400 `{"error":"cada elemento de aprobados debe ser un código de curso válido"}`
    - Paso 5: deduplicar con `new Set(req.body.aprobados)`
    - Paso 6: llamar a `repositorio.listarHabilitados(aprobadosSet)` y responder 200
    - _Requisitos: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_
  - [x] 3.4 Ejecutar `npx jest tests/habilitados.test.js --no-coverage` y verificar que todas las pruebas pasan; si alguna falla, corregir la implementación sin modificar las pruebas
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_
  - [x] 3.5 Ejecutar `npx jest --no-coverage` (suite completa) y verificar que las pruebas preexistentes siguen pasando
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

## Notes

- Las subtareas de la Tarea 1 no incluyen ninguna validación de entrada; el router responde solo a solicitudes bien formadas hasta que la Tarea 3 las agrega.
- Las pruebas de validación de la Tarea 2 deben escribirse antes de implementar las validaciones; se espera que fallen inicialmente.
- El orden de las validaciones en `src/routes/habilitados.js` debe seguir exactamente la tabla de la sección "Orden de validaciones" de `design.md`.
- No se agregan nuevas dependencias de npm.
- Los gates de CI (Requisito 5) se implementan por separado y no están incluidos en este plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 7, "tasks": ["3.4"] },
    { "id": 8, "tasks": ["3.5"] }
  ]
}
```
