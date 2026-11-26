const request = require('supertest');
const app = require('../src/app');

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
