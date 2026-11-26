# Requirements Document

## Introduction

Este documento describe los requisitos del endpoint `POST /habilitados`, que permite consultar qué cursos de la malla de Ingeniería Informática (ciclos 5 a 10) están disponibles para cursar dado un conjunto de cursos ya aprobados. Un curso está habilitado cuando todos sus requisitos previos figuran en la lista de aprobados, o cuando no tiene requisitos previos. El endpoint se integra a la API REST Node.js/Express existente y sigue los patrones ya establecidos en el proyecto.

## Glossary

- **API**: La aplicación Express que expone los endpoints REST del proyecto Malla INF.
- **Repositorio**: El módulo `src/data/repositorio.js` que provee acceso a los datos de `data/cursos.json`.
- **Curso**: Unidad académica con identificador único (`id`), nombre, créditos, ciclo y lista de requisitos previos.
- **Código_de_curso**: Cadena de texto que identifica de forma única a un curso (por ejemplo, `1INF25`).
- **Aprobados**: Arreglo de códigos de curso que el estudiante ya aprobó, proporcionado en el cuerpo de la solicitud.
- **Curso_habilitado**: Curso que no figura en `aprobados` y cuyos requisitos previos están todos contenidos en `aprobados`.
- **Validador**: Componente interno que verifica el tipo y contenido del cuerpo de la solicitud antes de procesarla.
- **Límite_de_entrada**: Cantidad máxima de códigos permitidos en el arreglo `aprobados` (500 elementos).

## Requirements

### Requisito 1: Consulta de cursos habilitados

**Historia de usuario:** Como estudiante de Ingeniería Informática, quiero conocer qué cursos puedo matricular dado el conjunto de cursos que ya aprobé, para planificar mis siguientes ciclos académicos.

#### Criterios de aceptación

1. WHEN el cliente envía `POST /habilitados` con un arreglo `aprobados` válido, THE API SHALL responder con código HTTP 200 y un arreglo JSON de cursos habilitados.
2. WHEN el arreglo `aprobados` incluye los códigos `1INF25`, `1INF27` e `1INF49`, THE API SHALL incluir en la respuesta exactamente 27 cursos habilitados.
3. WHEN el arreglo `aprobados` incluye los códigos `1INF25`, `1INF27` e `1INF49`, THE API SHALL incluir en la respuesta los cursos con códigos `1INF29`, `1INF30`, `1INF31` y `1INF32`.
4. WHEN un curso tiene todos sus requisitos previos contenidos en `aprobados`, THE API SHALL incluir ese curso en la respuesta, siempre que el curso no figure en `aprobados`.
5. WHEN un curso no tiene requisitos previos y no figura en `aprobados`, THE API SHALL incluir ese curso en la respuesta.
6. WHEN un curso figura en `aprobados`, THE API SHALL excluir ese curso de la respuesta, aunque todos sus requisitos previos también figuren en `aprobados`.
7. WHEN al menos un requisito previo de un curso no figura en `aprobados`, THE API SHALL excluir ese curso de la respuesta.
8. WHEN el arreglo `aprobados` está vacío, THE API SHALL devolver en la respuesta únicamente los cursos que no tienen requisitos previos y que existen en el Repositorio.
9. THE API SHALL incluir en cada elemento de la respuesta los campos `id`, `name`, `credits`, `cycle` y `type` del curso habilitado.
10. THE Repositorio SHALL ser la única fuente de datos consultada para determinar los cursos habilitados.

---

### Requisito 2: Validación del cuerpo de la solicitud

**Historia de usuario:** Como operador de la API, quiero que el endpoint rechace solicitudes malformadas antes de procesarlas, para evitar comportamientos incorrectos y vulnerabilidades de seguridad.

#### Criterios de aceptación

1. WHEN el cuerpo de la solicitud no contiene el campo `aprobados`, THE Validador SHALL responder con código HTTP 400 y un mensaje de error descriptivo en JSON.
2. WHEN el campo `aprobados` no es un arreglo, THE Validador SHALL responder con código HTTP 400 y un mensaje de error descriptivo en JSON.
3. WHEN el arreglo `aprobados` contiene algún elemento que no es una cadena de texto, THE Validador SHALL responder con código HTTP 400 y un mensaje de error descriptivo en JSON.
4. WHEN el cuerpo de la solicitud tiene tipo de contenido distinto de `application/json`, THE Validador SHALL responder con código HTTP 400 y un mensaje de error descriptivo en JSON.
5. WHEN el arreglo `aprobados` contiene un código que no existe en el Repositorio, THE API SHALL ignorar ese código sin producir un error, y continuar el cálculo con los códigos válidos restantes.
6. THE Validador SHALL sanitizar cada elemento del arreglo `aprobados` tratándolo exclusivamente como identificador opaco, sin interpretar ni reflejar su contenido como HTML o código ejecutable.

---

### Requisito 3: Protección contra denegación de servicio por entradas grandes

**Historia de usuario:** Como operador de la API, quiero que el endpoint rechace arreglos excesivamente grandes, para evitar que una sola solicitud monopolice los recursos del servicio.

#### Criterios de aceptación

1. WHEN el arreglo `aprobados` contiene más de 500 elementos, THE Validador SHALL responder con código HTTP 400 y un mensaje de error que indique que se superó el límite de entrada, sin procesar el arreglo.
2. WHEN el arreglo `aprobados` contiene exactamente 500 elementos válidos, THE API SHALL procesar la solicitud normalmente y responder con código HTTP 200.
3. THE API SHALL responder a cualquier solicitud válida de `POST /habilitados` en un tiempo máximo de 2 000 ms bajo carga normal de un solo usuario.

---

### Requisito 4: No exposición de información interna en errores

**Historia de usuario:** Como operador de la API, quiero que los mensajes de error nunca revelen detalles internos del servidor, para evitar la exposición de rutas del sistema, stack traces o nombres de dependencias.

#### Criterios de aceptación

1. WHEN ocurre un error no controlado durante el procesamiento de `POST /habilitados`, THE API SHALL responder con código HTTP 500 y el cuerpo `{"error": "error interno"}`, sin incluir stack traces ni rutas del sistema de archivos.
2. WHEN el Validador rechaza una solicitud con código HTTP 400, THE API SHALL incluir únicamente un mensaje de error descriptivo para el cliente, sin exponer detalles de implementación interna.
3. THE API SHALL registrar los detalles completos del error (incluyendo stack trace) en los logs del servidor, sin transmitirlos al cliente.

---

### Requisito 5: Calidad del código y la cadena de suministro

**Historia de usuario:** Como equipo de desarrollo, quiero que el código del endpoint cumpla las políticas de calidad del proyecto para que pueda integrarse a la rama principal.

#### Criterios de aceptación

1. THE API SHALL no introducir dependencias npm con vulnerabilidades de severidad alta o crítica según `npm audit`.
2. THE API SHALL no contener secretos (tokens, contraseñas, claves privadas) en el repositorio, verificado mediante análisis estático de secretos.
3. WHEN se ejecuta la suite de pruebas del proyecto, THE API SHALL mantener una cobertura de líneas no inferior al 80 % en el conjunto total de archivos del proyecto.
4. WHEN se ejecuta la suite de pruebas para el módulo de `POST /habilitados`, THE API SHALL contar con pruebas que cubran: el caso base con arreglo no vacío, el caso con arreglo vacío, el rechazo de tipos incorrectos, el rechazo de arreglos que superen el Límite_de_entrada, y el manejo de errores internos.
