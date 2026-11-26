const request = require('supertest');
const app = require('../src/app');
const repositorio = require('../src/data/repositorio');

const REFERENCIA = ['1INF25', '1INF27', '1INF49'];

const consultar = (aprobados) => request(app).post('/habilitados').send({ aprobados });
const idsDe = async (aprobados) => (await consultar(aprobados)).body.map((curso) => curso.id);

describe('POST /habilitados - lógica funcional', () => {
  test('1.1 responde 200 con un arreglo JSON para entrada válida', async () => {
    const res = await consultar(REFERENCIA);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('1.2 devuelve exactamente 27 cursos para la entrada de referencia', async () => {
    expect(await idsDe(REFERENCIA)).toHaveLength(27);
  });

  test('1.3 incluye 1INF29, 1INF30, 1INF31 y 1INF32', async () => {
    expect(await idsDe(REFERENCIA)).toEqual(
      expect.arrayContaining(['1INF29', '1INF30', '1INF31', '1INF32']),
    );
  });

  test('1.4 incluye cursos cuyos requisitos están aprobados', async () => {
    expect(await idsDe(['1INF25'])).toEqual(expect.arrayContaining(['1INF29', '1INF30']));
  });

  test('1.5 incluye un curso sin requisitos no aprobado', async () => {
    expect(await idsDe([])).toContain('1GES92');
  });

  test('1.6 excluye un curso aprobado', async () => {
    expect(await idsDe(['1INF25'])).not.toContain('1INF25');
  });

  test('1.7 excluye un curso con un requisito no aprobado', async () => {
    expect(await idsDe([])).not.toContain('1INF29');
  });

  test('1.8 con lista vacía devuelve solo los cursos sin requisitos', async () => {
    const esperados = repositorio.listar()
      .filter((curso) => curso.prerequisites.length === 0)
      .map((curso) => curso.id);

    expect(await idsDe([])).toEqual(esperados);
  });

  test('1.9 cada curso tiene solo id, name, credits, cycle y type', async () => {
    const res = await consultar(REFERENCIA);

    for (const curso of res.body) {
      expect(Object.keys(curso).sort()).toEqual(['credits', 'cycle', 'id', 'name', 'type']);
    }
  });

  test('2.5 ignora un código válido que no existe', async () => {
    const res = await consultar(['XXX999']);

    expect(res.status).toBe(200);
    expect(res.body.map((curso) => curso.id)).toEqual(await idsDe([]));
  });
});
