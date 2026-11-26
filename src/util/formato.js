const _ = require('lodash');

// Funciones auxiliares para presentar cursos como texto.

function formatearNombre(nombre) {
  return _.toLower(nombre).split(' ').map(_.capitalize).join(' ');
}

function formatearCreditos(creditos) {
  return `${Number(creditos).toFixed(1)} créditos`;
}

function formatearCiclo(ciclo) {
  if (ciclo === null || ciclo === undefined) {
    return 'Electivo';
  }
  return `Ciclo ${ciclo}`;
}

function formatearTipo(tipo) {
  if (tipo === 'obligatorio') {
    return 'Obligatorio';
  }
  return 'Electivo';
}

function resumenCurso(curso) {
  return `${curso.id} · ${curso.name} · ${formatearCreditos(curso.credits)}`;
}

function totalCreditos(cursos) {
  return _.sumBy(cursos, 'credits');
}

function agruparPorCiclo(cursos) {
  const grupos = _.groupBy(cursos, (curso) => formatearCiclo(curso.cycle));
  return _.mapValues(grupos, (lista) => _.sortBy(lista, 'id'));
}

function ordenarPorCreditos(cursos) {
  return _.orderBy(cursos, ['credits', 'id'], ['desc', 'asc']);
}

function listaRequisitos(codigos) {
  if (_.isEmpty(codigos)) {
    return 'Sin requisitos';
  }
  return _.join(_.sortBy(codigos), ', ');
}

// DEMOSTRACIÓN (rama demo-cobertura-roja, no se fusiona): función nueva sin pruebas.
function resumenMalla(cursos) {
  const obligatorios = cursos.filter((curso) => curso.type === 'obligatorio');
  const electivos = cursos.filter((curso) => curso.type === 'electivo');
  const creditos = totalCreditos(cursos);
  if (creditos === 0) {
    return 'Sin cursos';
  }
  return `${obligatorios.length} obligatorios, ${electivos.length} electivos, ${creditos} créditos`;
}

module.exports = {
  resumenMalla,
  formatearNombre,
  formatearCreditos,
  formatearCiclo,
  formatearTipo,
  resumenCurso,
  totalCreditos,
  agruparPorCiclo,
  ordenarPorCreditos,
  listaRequisitos,
};
