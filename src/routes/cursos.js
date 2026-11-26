const { Router } = require('express');
const repositorio = require('../data/repositorio');

const router = Router();

// Campos del contrato de la lista (design.md): no incluye prerequisites.
function aResumen({ id, name, credits, cycle, type }) {
  return { id, name, credits, cycle, type };
}

// GET /cursos/:codigo
router.get('/:codigo', (req, res) => {
  const curso = repositorio.obtener(req.params.codigo);
  if (!curso) {
    return res.status(404).json({ error: 'curso no encontrado' });
  }

  const prerequisites = (curso.prerequisites || []).map((preId) => {
    const pre = repositorio.obtener(preId);
    return pre ? { id: pre.id, name: pre.name } : { id: preId, name: null };
  });

  return res.json({
    id: curso.id,
    name: curso.name,
    credits: curso.credits,
    cycle: curso.cycle,
    type: curso.type,
    prerequisites,
  });
});

// GET /cursos?ciclo=N
router.get('/', (req, res) => {
  const { ciclo } = req.query;

  if (ciclo !== undefined) {
    const n = Number(ciclo);
    if (!Number.isInteger(n) || n < 5 || n > 10) {
      return res.status(400).json({ error: 'ciclo debe ser un entero entre 5 y 10' });
    }
    return res.json(repositorio.listarPorCiclo(n).map(aResumen));
  }

  return res.json(repositorio.listar().map(aResumen));
});

module.exports = router;
