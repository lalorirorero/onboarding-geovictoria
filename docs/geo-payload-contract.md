# Contrato Geo Hacia Zoho Flow

Este proyecto congela la estructura del payload Geo enviado a Zoho Flow para evitar quiebres de mapeo.

## Qué valida

- Estructura exacta y orden de llaves del payload de `progreso`.
- Estructura exacta y orden de llaves del payload de `completado`.
- Normalizaciones críticas (por ejemplo, `Dasboard BI` -> `Dashboard BI`).

## Archivos de contrato

- `contracts/geo/zoho-payload-progress-v1.json`
- `contracts/geo/zoho-payload-complete-v1.json`

## Ejecución local

```bash
npm run contract:geo
```

## Actualizar contrato (solo cuando el cambio es intencional)

1. Confirmar impacto con integraciones externas (Zoho Flow/CRM).
2. Regenerar snapshots:

```bash
node scripts/validate-geo-zoho-contract.mjs --update
```

3. Ejecutar validación:

```bash
npm run contract:geo
```

## CI

El workflow `.github/workflows/geo-payload-contract.yml` bloquea PR/push cuando el contrato cambia.

