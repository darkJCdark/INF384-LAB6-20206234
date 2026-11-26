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

const ERROR_JSON = 'el cuerpo debe ser JSON válido';
const ERROR_TIPO = 'Content-Type debe ser application/json';
const ERROR_ARREGLO = 'aprobados debe ser un arreglo';
const ERROR_CODIGO = 'cada elemento de aprobados debe ser un código de curso válido';
const ERROR_LIMITE = 'aprobados admite como máximo 100 códigos';

const enviarTexto = (tipo, texto) => request(app)
  .post('/habilitados')
  .set('Content-Type', tipo)
  .send(texto);
const codigos = (cantidad) => Array(cantidad).fill('1INF25');

function esperarError(res, status, error) {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error });
}

describe('POST /habilitados - validación de entrada', () => {
  test('2.1 rechaza JSON mal formado', async () => {
    esperarError(await enviarTexto('application/json', '{aprobados:['), 400, ERROR_JSON);
  });

  test('2.2 rechaza un Content-Type distinto de application/json', async () => {
    esperarError(await enviarTexto('text/plain', '{"aprobados":[]}'), 400, ERROR_TIPO);
  });

  test.each([
    ['un texto', { aprobados: '1INF25' }],
    ['null', { aprobados: null }],
    ['un campo ausente', {}],
  ])('2.3 rechaza aprobados con %s', async (_caso, cuerpo) => {
    esperarError(await request(app).post('/habilitados').send(cuerpo), 400, ERROR_ARREGLO);
  });

  test.each([
    ['caracteres no permitidos', ['1INF30<script>']],
    ['minúsculas', ['1inf25']],
    ['espacios', [' 1INF25']],
    ['números', [1, 2, 3]],
  ])('2.4 rechaza códigos con %s sin repetir el valor', async (_caso, aprobados) => {
    const res = await consultar(aprobados);

    esperarError(res, 400, ERROR_CODIGO);
    expect(res.text).not.toContain('<script>');
  });

  test('caso 1: sin cuerpo y con Content-Type JSON pide el arreglo', async () => {
    const res = await request(app).post('/habilitados').set('Content-Type', 'application/json');

    esperarError(res, 400, ERROR_ARREGLO);
  });

  test('caso 1b: sin cuerpo ni Content-Type pide application/json', async () => {
    esperarError(await request(app).post('/habilitados'), 400, ERROR_TIPO);
  });
});

describe('POST /habilitados - límites de entrada', () => {
  test('3.1 rechaza 101 elementos', async () => {
    esperarError(await consultar(codigos(101)), 400, ERROR_LIMITE);
  });

  test('3.1 los duplicados cuentan para el límite', async () => {
    const unicos = Array.from({ length: 91 }, (_, i) => `ABC${String(i).padStart(3, '0')}`);

    esperarError(await consultar([...unicos, ...unicos.slice(0, 10)]), 400, ERROR_LIMITE);
  });

  test('3.2 acepta exactamente 100 elementos', async () => {
    expect((await consultar(codigos(100))).status).toBe(200);
  });

  test('3.3 responde 400 a 5000 elementos en menos de 1000 ms', async () => {
    const inicio = Date.now();
    const res = await consultar(codigos(5000));

    expect(Date.now() - inicio).toBeLessThan(1000);
    esperarError(res, 400, ERROR_LIMITE);
  });

  test('caso 11: rechaza con 413 un cuerpo mayor a 50 KB', async () => {
    esperarError(await consultar(codigos(7000)), 413, 'el cuerpo supera el tamaño máximo permitido');
  });
});

describe('POST /habilitados - errores internos', () => {
  const fallo = new Error('fallo simulado en C:\apps\malla\src\data');
  let registro;

  beforeEach(() => {
    registro = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(repositorio, 'listarHabilitados').mockImplementation(() => {
      throw fallo;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test('4.1 responde 500 sin detalles internos', async () => {
    esperarError(await consultar([]), 500, 'error interno');
  });

  test('4.2 registra el error con console.error', async () => {
    await consultar([]);

    expect(registro).toHaveBeenCalledWith(fallo);
  });
});
