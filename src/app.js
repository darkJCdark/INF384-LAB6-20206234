const path = require('path');
const express = require('express');
const repositorio = require('./data/repositorio');

const app = express();

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', cursos: repositorio.listar().length });
});

app.use('/cursos', require('./routes/cursos'));
app.use('/habilitados', require('./routes/habilitados'));

// Middleware de manejo de errores no controlados (Req 3.1).
// Debe registrarse después de todas las rutas y tener exactamente 4 argumentos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'el cuerpo debe ser JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'el cuerpo supera el tamaño máximo permitido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'error interno' });
});

module.exports = app;
