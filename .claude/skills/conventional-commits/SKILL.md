---
name: conventional-commits
description: Use whenever creating a git commit or writing a PR description for this project.
---

# Commit & PR conventions

## Commit format
`tipo(alcance): descripción corta en presente`

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `security`

Ejemplos:
- `feat(ventas): agregar registro de venta con boleta electrónica`
- `fix(stock): corregir race condition en descuento de inventario concurrente`
- `security(auth): restringir endpoint de reportes a rol administrador`

## Reglas
- Un commit = un cambio lógico. No mezclar una feature con un fix no relacionado.
- El cuerpo del commit (si hace falta) explica el *por qué*, no repite el *qué* — eso ya lo dice el diff.
- Cualquier cambio que toque dinero, stock o permisos entre roles menciona explícitamente el riesgo que mitiga, aunque sea en una línea.

## PRs (si se usa flujo de ramas)
Descripción corta: qué cambia, por qué, y qué se probó manualmente o con tests. Si el cambio afecta a más de una sucursal o a los roles, decirlo explícito para que quien revise sepa dónde poner atención.
