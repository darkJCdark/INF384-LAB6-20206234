# Requirements Document

## Introduction

Este documento describe los requisitos del endpoint `POST /habilitados`, que permite consultar qué cursos de la malla de Ingeniería Informática (ciclos 5 a 10) están disponibles para cursar dado un conjunto de cursos ya aprobados. Un curso está habilitado cuando todos sus requisitos previos figuran en la lista de aprobados, o cuando no tiene requisitos previos. El endpoint se integra a la API REST Node.js/Express existente y sigue los patrones ya establecidos en el proyecto.

## Glossary

- **API**: La aplicación Express que expone los endpoints REST del proyecto Malla INF.
- **Repositorio**: El módulo `src/data/repositorio.js` que provee acceso a los datos de `data/cursos.json`.
- **Curso**: Unidad académica con identificador único (`id`), nombre, créditos, ciclo y lista de requisitos previos.
- **Código_de_curso**: Cadena de texto que identifica de forma única a un curso (por ejemplo, `1INF25`).
- **Código_válido**: Cadena que cumple la expresión regular `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$` (por ejemplo `1INF25` o `INF001`).
- **Aprobados**: Arreglo de códigos de curso que el estudiante ya aprobó, proporcionado en el cuerpo de la solicitud.
- **Curso_habilitado**: Curso que no figura en `aprobados` y cuyos requisitos previos están todos contenidos en `aprobados`.
- **Validador**: Componente interno que verifica el tipo y contenido del cuerpo de la solicitud antes de procesarla.
- **Límite_de_entrada**: Cantidad máxima de códigos permitidos en el arreglo `aprobados` (100 elementos, ya que la malla tiene 87 cursos y 100 deja margen).

## Requirements

### Requisito 1: Consulta de cursos habilitados

**Historia de usuario:** Como estudiante de Ingeniería Informática, quiero conocer qué cursos puedo matricular dado el conjunto de cursos que ya aprobé, para planificar mis siguientes ciclos académicos.

#### Criterios de aceptación

1. CUANDO el cliente envía `POST /habilitados` con un arreglo `aprobados` válido, EL sistema DEBE responder con código HTTP 200 y un arreglo JSON de cursos habilitados.
2. CUANDO el arreglo `aprobados` incluye los códigos `1INF25`, `1INF27` e `1INF49`, EL sistema DEBE incluir en la respuesta exactamente 27 cursos habilitados.
3. CUANDO el arreglo `aprobados` incluye los códigos `1INF25`, `1INF27` e `1INF49`, EL sistema DEBE incluir en la respuesta los cursos con códigos `1INF29`, `1INF30`, `1INF31` y `1INF32`.
4. CUANDO un curso tiene todos sus requisitos previos contenidos en `aprobados`, EL sistema DEBE incluir ese curso en la respuesta, siempre que el curso no figure en `aprobados`.
5. CUANDO un curso no tiene requisitos previos y no figura en `aprobados`, EL sistema DEBE incluir ese curso en la respuesta.
6. CUANDO un curso figura en `aprobados`, EL sistema DEBE excluir ese curso de la respuesta, aunque todos sus requisitos previos también figuren en `aprobados`.
7. CUANDO al menos un requisito previo de un curso no figura en `aprobados`, EL sistema DEBE excluir ese curso de la respuesta.
8. CUANDO el arreglo `aprobados` está vacío, EL sistema DEBE devolver en la respuesta únicamente los cursos que no tienen requisitos previos y que existen en el Repositorio.
9. EL sistema DEBE incluir en cada elemento de la respuesta los campos `id`, `name`, `credits`, `cycle` y `type` del curso habilitado.

---

### Requisito 2: Validación del cuerpo de la solicitud

**Historia de usuario:** Como operador de la API, quiero que el endpoint rechace solicitudes malformadas antes de procesarlas, para evitar comportamientos incorrectos.

#### Criterios de aceptación

1. SI el cuerpo de la solicitud no es JSON válido, EL sistema DEBE responder 400 con `{"error":"el cuerpo debe ser JSON válido"}`.
2. SI el encabezado `Content-Type` de la solicitud no es `application/json`, EL sistema DEBE responder 400 con `{"error":"Content-Type debe ser application/json"}`.
3. SI el cuerpo no contiene el campo `aprobados` o `aprobados` no es un arreglo, EL sistema DEBE responder 400 con `{"error":"aprobados debe ser un arreglo"}`.
4. SI algún elemento de `aprobados` no es una cadena de texto o no cumple la expresión regular `^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$`, EL sistema DEBE responder 400 con `{"error":"cada elemento de aprobados debe ser un código de curso válido"}` sin incluir el valor recibido en la respuesta.
5. CUANDO el arreglo `aprobados` contiene un código con formato válido que no existe en los datos del Repositorio, EL sistema DEBE ignorarlo y continuar el cálculo con los códigos restantes.

---

### Requisito 3: Protección contra entradas grandes

**Historia de usuario:** Como operador de la API, quiero que el endpoint rechace arreglos excesivamente grandes, para evitar que una sola solicitud monopolice los recursos del servicio.

#### Criterios de aceptación

1. SI el arreglo `aprobados` tiene más de 100 elementos, EL sistema DEBE responder 400 con `{"error":"aprobados admite como máximo 100 códigos"}`.
2. CUANDO el arreglo `aprobados` tiene exactamente 100 elementos válidos, EL sistema DEBE responder 200.
3. CUANDO el cliente envía un arreglo `aprobados` con 5000 elementos, EL sistema DEBE responder con 400 en menos de 1000 ms.

---

### Requisito 4: No exposición de información interna en errores

**Historia de usuario:** Como operador de la API, quiero que los mensajes de error nunca revelen detalles internos del servidor, para evitar la exposición de rutas del sistema, stack traces o nombres de dependencias.

#### Criterios de aceptación

1. SI ocurre un error no controlado durante el procesamiento de `POST /habilitados`, EL sistema DEBE responder 500 con `{"error":"error interno"}` sin incluir stack trace, rutas del sistema de archivos ni nombres de dependencias en el cuerpo de la respuesta.
2. SI ocurre un error no controlado, EL sistema DEBE registrar el error y su stack trace con `console.error` en el proceso del servidor.

---

### Requisito 5: Política de integración continua

**Historia de usuario:** Como equipo de desarrollo, quiero que el pipeline de CI bloquee cambios que introduzcan vulnerabilidades o bajen la cobertura, para mantener la calidad del código.

**Clasificación:** los criterios 5.1 y 5.2 son requisitos de seguridad de la política; el criterio 5.3 (cobertura de líneas) es el requisito de calidad.

#### Criterios de aceptación

1. SI `npm audit` reporta una vulnerabilidad de severidad alta o crítica, EL pipeline DEBE fallar.
2. SI `gitleaks` detecta un secreto en el repositorio, EL pipeline DEBE fallar.
3. SI la cobertura de líneas del proyecto es menor al 80 %, EL pipeline DEBE fallar.
