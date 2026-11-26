# Diseño: Consulta de cursos

## Visión general

API REST de solo lectura sobre los datos de `data/cursos.json`, cargados en memoria al iniciar.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| `src/data/repositorio.js` | Carga el JSON una vez y expone `listar()`, `listarPorCiclo(ciclo)` y `obtener(codigo)`. Usa un `Map` por código. |
| `src/routes/cursos.js` | Define `GET /cursos` y `GET /cursos/:codigo`. Valida parámetros y traduce resultados a respuestas HTTP. |
| `src/app.js` | Crea la app Express, sirve `public/` y monta el router en `/cursos`. |

## Contratos

`GET /cursos` y `GET /cursos?ciclo=N` → `200` con un arreglo de cursos:

```json
[{ "id": "1INF30", "name": "Programación 3", "credits": 5.0, "cycle": 6, "type": "obligatorio" }]
```

`GET /cursos/:codigo` → `200`:

```json
{
  "id": "1INF30",
  "name": "Programación 3",
  "credits": 5.0,
  "cycle": 6,
  "type": "obligatorio",
  "prerequisites": [{ "id": "1INF25", "name": "Programación 2" }]
}
```

## Manejo de errores

| Caso | Respuesta |
| --- | --- |
| `ciclo` inválido | `400 { "error": "ciclo debe ser un entero entre 5 y 10" }` |
| Código inexistente | `404 { "error": "curso no encontrado" }` |
| Error no controlado | `500 { "error": "error interno" }` |

El error no controlado se atiende en un middleware de errores en `src/app.js`, registrado después de las rutas. La respuesta no incluye el mensaje original, el stack trace ni rutas de archivos, porque exponen detalles internos del servicio.

## Estrategia de pruebas

- Tests de rutas con supertest, uno o más por criterio de aceptación.
- Tests de `repositorio.js` con los datos reales de `data/cursos.json`.
- Para 3.1, un test simula que el repositorio lanza un error y comprueba el código 500, el cuerpo exacto y que no se exponen detalles internos.

## Gates

| Gate | Herramienta y umbral | Bloquea / avisa | Etapa |
| --- | --- | --- | --- |
| Cobertura (4.1) | Jest, cobertura de líneas mínima de 80 % | Bloquea | Pull request y `main` |

- **Umbral:** la política de TI exige que la cobertura de líneas no baje de 80 %.
- **Bloquea:** un aviso permitiría que un cambio que incumple la política llegue a `main`.
- **Etapa:** en el pull request se detecta antes de fusionar; en `main` se verifican también los cambios que entran por push directo.
