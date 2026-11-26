const { Router } = require('express');
const repositorio = require('../data/repositorio');

const router = Router();

const MAXIMO_CODIGOS = 100;
const FORMATO_CODIGO = /^([0-9][A-Z]{3}[0-9]{2}|[A-Z]{3}[0-9]{3})$/;
const TIPO_JSON = /^application\/json\s*(;|$)/i;

// Devuelve el mensaje de error de la primera validación que falla (orden de design.md).
function validar(req) {
  if (!TIPO_JSON.test(req.headers['content-type'] || '')) {
    return 'Content-Type debe ser application/json';
  }
  const aprobados = req.body?.aprobados;
  if (!Array.isArray(aprobados)) {
    return 'aprobados debe ser un arreglo';
  }
  if (aprobados.length > MAXIMO_CODIGOS) {
    return 'aprobados admite como máximo 100 códigos';
  }
  if (!aprobados.every((codigo) => typeof codigo === 'string' && FORMATO_CODIGO.test(codigo))) {
    return 'cada elemento de aprobados debe ser un código de curso válido';
  }
  return null;
}

// POST /habilitados
router.post('/', (req, res) => {
  const error = validar(req);
  if (error) {
    return res.status(400).json({ error });
  }
  return res.json(repositorio.listarHabilitados(new Set(req.body.aprobados)));
});

module.exports = router;
