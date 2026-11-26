# Plan de implementación: Consulta de cursos

- [x] 1. Implementar `GET /cursos` con filtro por ciclo
  - Crear la ruta en `src/routes/cursos.js` usando `src/data/repositorio.js`
  - Montar el router en `src/app.js`
  - Tests con supertest para 1.1, 1.2 y 1.3
  - _Requisitos: 1.1, 1.2, 1.3_

- [x] 2. Implementar `GET /cursos/:codigo`
  - Resolver el nombre de cada requisito con el repositorio
  - Tests para 2.1 y 2.2
  - _Requisitos: 2.1, 2.2_

- [x] 3. Middleware de manejo de errores
  - Respuesta genérica para errores no controlados
  - Test que simula un error del repositorio y verifica el 500 sin stack trace ni rutas
  - _Requisitos: 3.1_

- [ ] 4. Gate de cobertura
  - Configurar en `jest.config.js` un umbral de 80 % de cobertura de líneas
  - Ejecutar las pruebas con cobertura en `.github/workflows/ci.yml`
  - _Requisitos: 4.1_
