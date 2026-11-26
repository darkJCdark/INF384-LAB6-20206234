const request = require('supertest');
const app = require('../src/app');
const repositorio = require('../src/data/repositorio');

describe('GET /cursos', () => {
  // Req 1.1 — devuelve todos los cursos con los campos requeridos
  describe('sin filtro', () => {
    test('responde 200 con un arreglo de 87 cursos', async () => {
      const res = await request(app).get('/cursos');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(87);
    });

    test('cada curso tiene id, name, credits, cycle y type', async () => {
      const res = await request(app).get('/cursos');

      for (const curso of res.body) {
        expect(curso).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            credits: expect.any(Number),
            type: expect.any(String),
          }),
        );
        expect(Object.keys(curso).sort()).toEqual(['credits', 'cycle', 'id', 'name', 'type']);
      }
    });
  });

  // Req 1.2 — filtro por ciclo válido
  describe('con ?ciclo=N (N entre 5 y 10)', () => {
    test('?ciclo=6 devuelve solo los cursos del ciclo 6', async () => {
      const res = await request(app).get('/cursos?ciclo=6');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((c) => c.cycle === 6)).toBe(true);
      for (const curso of res.body) {
        expect(Object.keys(curso).sort()).toEqual(['credits', 'cycle', 'id', 'name', 'type']);
      }
    });

    test('?ciclo=5 devuelve solo los cursos del ciclo 5', async () => {
      const res = await request(app).get('/cursos?ciclo=5');

      expect(res.status).toBe(200);
      expect(res.body.every((c) => c.cycle === 5)).toBe(true);
    });

    test('?ciclo=10 devuelve solo los cursos del ciclo 10', async () => {
      const res = await request(app).get('/cursos?ciclo=10');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body.every((c) => c.cycle === 10)).toBe(true);
    });
  });

  // Req 2.1 — GET /cursos/:codigo con código existente
  describe('GET /cursos/:codigo — código existente', () => {
    test('responde 200 con el objeto completo incluyendo prerequisites con id y name', async () => {
      // 1INF30 (Programación 3) tiene prerequisito 1INF25 (Programación 2)
      const res = await request(app).get('/cursos/1INF30');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: '1INF30',
        name: expect.any(String),
        credits: expect.any(Number),
        cycle: expect.any(Number),
        type: expect.any(String),
        prerequisites: expect.any(Array),
      });
    });

    test('prerequisites incluye id y name de cada requisito', async () => {
      // 1INF30 tiene prerequisites: ["1INF25"]
      const res = await request(app).get('/cursos/1INF30');

      expect(res.status).toBe(200);
      expect(res.body.prerequisites.length).toBeGreaterThan(0);
      for (const pre of res.body.prerequisites) {
        expect(pre).toHaveProperty('id');
        expect(pre).toHaveProperty('name');
        expect(typeof pre.id).toBe('string');
        expect(typeof pre.name).toBe('string');
      }
    });

    test('curso sin requisitos devuelve prerequisites como arreglo vacío', async () => {
      // 1GES92 no tiene prerequisites
      const res = await request(app).get('/cursos/1GES92');

      expect(res.status).toBe(200);
      expect(res.body.prerequisites).toEqual([]);
    });
  });

  // Req 2.2 — GET /cursos/:codigo con código inexistente
  describe('GET /cursos/:codigo — código inexistente', () => {
    test('responde 404 con { error: "curso no encontrado" }', async () => {
      const res = await request(app).get('/cursos/NOEXISTE');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'curso no encontrado' });
    });
  });

  // Req 1.3 — ciclo inválido produce 400
  describe('con ?ciclo=N inválido', () => {
    test('?ciclo=4 (fuera de rango) → 400 con mensaje de error', async () => {
      const res = await request(app).get('/cursos?ciclo=4');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
    });

    test('?ciclo=11 (fuera de rango) → 400', async () => {
      const res = await request(app).get('/cursos?ciclo=11');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
    });

    test('?ciclo=abc (no numérico) → 400', async () => {
      const res = await request(app).get('/cursos?ciclo=abc');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
    });

    test('?ciclo=6.5 (decimal) → 400', async () => {
      const res = await request(app).get('/cursos?ciclo=6.5');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
    });
  });
});

// Req 3.1 — middleware de errores no controlados
describe('Middleware de errores no controlados', () => {
  let listarOriginal;

  beforeEach(() => {
    listarOriginal = repositorio.listar;
  });

  afterEach(() => {
    repositorio.listar = listarOriginal;
  });

  test('responde 500 con { error: "error interno" } cuando el repositorio lanza un error', async () => {
    repositorio.listar = () => {
      throw new Error('fallo simulado del repositorio en /home/user/app/src/data/repositorio.js:12:5');
    };

    const res = await request(app).get('/cursos');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'error interno' });
  });

  test('la respuesta no expone stack trace ni rutas de archivo', async () => {
    repositorio.listar = () => {
      const err = new Error('internal failure');
      throw err;
    };

    const res = await request(app).get('/cursos');
    const bodyText = JSON.stringify(res.body);

    // No debe contener patrones típicos de stack traces
    expect(bodyText).not.toMatch(/\bat\b/);        // líneas "at ..."
    expect(bodyText).not.toMatch(/\.js:/);          // referencias a archivos JS
    expect(bodyText).not.toMatch(/\\/);             // separadores de ruta Windows
    expect(bodyText).not.toMatch(/\//);             // separadores de ruta Unix (excepto la clave "error")
  });
});
