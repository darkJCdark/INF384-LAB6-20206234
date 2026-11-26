const { Router } = require('express');
const repositorio = require('../data/repositorio');

const router = Router();

// POST /habilitados
router.post('/', (req, res) => {
  const aprobados = new Set(req.body.aprobados);
  res.json(repositorio.listarHabilitados(aprobados));
});

module.exports = router;
