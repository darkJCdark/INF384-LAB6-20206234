# Trazabilidad

Runs: `R` = https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/

## Requisito → gate → evidencia

| Requisito | Gate o test | Bloquea / avisa | Etapa | Run fallido | Run corregido |
| --- | --- | --- | --- | --- | --- |
| 2.1–2.4 Entrada inválida responde 400 (hallazgos 2 y 3) | Tests `2.1`, `2.2`, `2.3 …`, `2.4 …` en `tests/habilitados.test.js` | Bloquea (job `build`) | PR y `main` | [R45906720858](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906720858) | [R45906855243](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906855243) |
| 3.1–3.3 Máximo 100 códigos; 5000 responde 400 en < 1000 ms (hallazgo 1) | Tests `3.1 …`, `3.3 …`, `caso 11` (413) | Bloquea (job `build`) | PR y `main` | [R45906720858](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906720858) | [R45906855243](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906855243) |
| 4.1 Error 500 sin stack trace (hallazgo 2) | Test `4.1 responde 500 sin detalles internos` | Bloquea (job `build`) | PR y `main` | Sin run rojo: ya pasaba por el middleware 500 de la parte guiada (requisito 3.1 de consulta-cursos) | [R45906855243](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906855243) |
| 4.2 Error se registra con `console.error` | Test `4.2 registra el error con console.error` | Bloquea (job `build`) | PR y `main` | [R45906720858](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906720858) | [R45906855243](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45906855243) |
| 5.1 Sin dependencias altas o críticas | Job `sca`: `npm audit --audit-level=high` | Bloquea | PR y `main` | [R45907011546](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45907011546) (lodash 4.17.20, alta) | Último run de `main` tras subir lodash a 4.18.1 |
| 5.2 Ningún secreto en el repositorio | Job `secretos`: gitleaks v8.24.3 sobre todo el historial | Bloquea | PR y `main` | [R45907011546](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45907011546) (`generic-api-key` en `config/ejemplo.env`) | Último run de `main`: clave retirada y fingerprint en `.gitleaksignore` con su razón |
| 5.3 Cobertura de líneas ≥ 80 % (calidad) | Job `build`: Jest `coverageThreshold` lines 80 | Bloquea | PR y `main` | Sin run rojo: al activar el gate la cobertura ya era 80,43 % | [R45907011546](https://github.com/darkJCdark/INF384-LAB6-20206234/actions/runs/45907011546) (job `build` verde) |

**Diagnóstico del secreto:** gitleaks escanea todo el historial, así que retirar la clave del archivo no basta: sigue en el commit `7506fec`. No se reescribe el historial; se registra solo ese fingerprint en `.gitleaksignore`. La rotación de la clave queda **pendiente/simulada**, porque no hay acceso al proveedor.

## Cambios a la propuesta de Kiro

| Documento | Qué propuso Kiro | Qué cambiaste | Por qué |
| --- | --- | --- | --- |
| requirements.md | "Sanitizar" los códigos sin definir la respuesta ante `1INF30<script>` | Formato obligatorio `^([0-9][A-Z]{3}[0-9]{2}\|[A-Z]{3}[0-9]{3})$`; si no se cumple, 400 con mensaje fijo sin repetir el valor | "Sanitizar" no se puede probar; el hallazgo 2 necesita una respuesta observable |
| requirements.md | Máximo de 500 códigos por solicitud | Máximo de 100 | La malla tiene 87 cursos; 100 deja margen y reduce la entrada aceptada (hallazgo 1) |
| design.md | gitleaks solo sobre commits nuevos y solo en pull request | Todo el historial (`fetch-depth: 0`), en PR y en push a `main` | La política exige ningún secreto en el repositorio; un escaneo incremental no ve la clave antigua |
