# Declaración de uso de IA generativa · Laboratorio 6 (INF384)

Alumno: 20206234 · Fecha: 26/11/2026

## Herramientas

- **Kiro**, con el modelo **Auto**, como pide el laboratorio.
- **Claude** (Anthropic), mediante Claude Code en la aplicación de escritorio, con los modelos Claude Opus 5.5 y Claude Sonnet 5.5.
- No usé GitHub Copilot.

## Qué hizo Kiro

- Generó la propuesta inicial de `requirements.md`, `design.md` y `tasks.md` del spec `habilitados`, y después las corrigió según mis prompts. Las propuestas sin revisar quedaron en sus propios commits ("propuesta inicial de Kiro ...").
- Implementó, con sus pruebas, las tareas 1, 2 y 3 del spec guiado `consulta-cursos` (`GET /cursos`, `GET /cursos/:codigo` y el middleware de errores).

## Qué hizo Claude

- Me explicó la teoría del curso que aplica al laboratorio y la consigna.
- Redactó los prompts que envié a Kiro y revisó cada documento que generó Kiro contra la rúbrica. Los cambios a la propuesta de Kiro registrados en `TRAZABILIDAD.md` fueron recomendaciones de Claude que yo aprobé.
- Con mi aprobación explícita, editó estos archivos:
  - el spec guiado (paso 1) y el ajuste de campos de `GET /cursos`;
  - los ajustes finales de `requirements.md` y `design.md` de `habilitados`;
  - la implementación de `POST /habilitados` (repositorio, ruta, validaciones y manejo de errores), sus pruebas y las marcas de `tasks.md`;
  - `ci.yml` con los gates, `jest.config.js`, la actualización de `lodash`, el retiro de la clave de `config/ejemplo.env`, `.gitleaksignore`, `TRAZABILIDAD.md` y el borrador de esta declaración.
- Me ayudó a interpretar los resultados de los runs de GitHub Actions.

## Qué hice yo

- Aprobé o rechacé cada cambio antes de que se aplicara, y decidí qué correcciones pedir a Kiro.
- Ejecuté Kiro y los comandos, e hice todos los commits y push; ninguna IA hizo commits ni push.
- Revisé cada run en GitHub Actions y reuní los links de evidencia en rojo y en verde.

Puedo presentar el historial de la conversación con Claude y de las sesiones de Kiro si se solicita.
